import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { makeProject } from './fixtures/project.mjs';
import { migrate, stripLegacyHook } from '../scripts/lib/migrate.mjs';

const at = (root, rel) => join(root, ...rel.split('/'));
const read = (root, rel) => readFileSync(at(root, rel), 'utf8');
const LEGACY_HOOK = { type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/acdev-guard.mjs"', timeout: 30 };

// A project as acdev 0.4 left it: VISION.md, the stage called "vision",
// the guard copied into the repo and wired in the project settings.
function legacyProject() {
  const p = makeProject({ stage: 'build', commit: false });
  p.write('docs/VISION.md', '# VISION\n\n## 1. What it is / what it is NOT\n\nAn invoice tracker.\n');
  p.write('CLAUDE.md', '# Invoices\n\nFull detail: [docs/VISION.md](docs/VISION.md).\n\nGolden rules derive from VISION.md section 2. See SUPERVISION.md too.\nUpstream idea: https://github.com/other/repo/blob/main/VISION.md\n\nRun node "<plugin-root>/scripts/acdev.mjs" next before working.\n');
  p.write('docs/ROADMAP.md', '# Roadmap\n\n## Phase 1: MVP\n\nFrom [VISION.md](VISION.md).\n');
  p.write('docs/plans/2026-09-01-slice-1.md', '---\nstatus: shipped\n---\n\nTraces to docs/VISION.md section 5.\n');
  p.write('.claude/hooks/acdev-guard.mjs', '// old guard copy\n');
  p.write('.claude/settings.json', JSON.stringify({
    permissions: { allow: ['Bash(node *)'] },
    hooks: {
      PreToolUse: [
        { matcher: 'Edit|Write|MultiEdit|NotebookEdit', hooks: [LEGACY_HOOK] },
        { matcher: 'Bash', hooks: [LEGACY_HOOK] },
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'node scripts/my-own-hook.mjs' }] },
        // The user's formatter shares an entry with the old guard: only the guard goes.
        { matcher: 'Write', hooks: [LEGACY_HOOK, { type: 'command', command: 'node scripts/my-formatter.mjs' }] }
      ]
    }
  }, null, 2));
  p.write('.acdev/lessons.md', '# Lessons ledger\n');
  p.write('.acdev/state.md', '# acdev state\n\nstage: vision\nupdated: 2026-09-01 10:00\nacdev_version: 0.4.3\nlanguage: english\n');
  p.g(['add', '-A']);
  p.g(['commit', '-q', '-m', 'legacy']);
  return p;
}

test('migrate is a dry run by default: it lists every change and touches nothing', () => {
  const p = legacyProject();
  const r = p.cli(['migrate']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^migrate \(dry run\): 6 change\(s\)$/m);
  assert.match(r.stdout, /would: rename docs\/VISION\.md -> docs\/PRODUCT\.md \(git mv\)/);
  assert.match(r.stdout, /would: CLAUDE\.md: 3 reference\(s\) to VISION\.md -> PRODUCT\.md/);
  assert.match(r.stdout, /would: docs\/ROADMAP\.md: 2 reference\(s\)/);
  assert.match(r.stdout, /would: \.acdev\/state\.md: stage vision -> product/);
  assert.match(r.stdout, /would: remove \.claude\/hooks\/acdev-guard\.mjs/);
  assert.match(r.stdout, /would: \.claude\/settings\.json: remove the old guard from 3 PreToolUse hook\(s\); every other hook and key is kept/);
  assert.match(r.stdout, /note: docs\/PRODUCT\.md keeps the sections it had/);
  assert.match(r.stdout, /note: \.claude\/settings\.json still allows Bash\(node \*\); acdev 0\.4 added those/);
  assert.match(r.stdout, /note: no longer read, left in place: \.acdev\/lessons\.md/);
  assert.match(r.stdout, /note: CLAUDE\.md still names commands or skills removed in 0\.5\.0; it is your file/);
  assert.match(r.stdout, /nothing was changed: run this command again with --apply/);
  assert.ok(!r.stdout.includes('docs/plans/'), 'plans are history and stay as written');
  assert.ok(existsSync(at(p.root, 'docs/VISION.md')) && !existsSync(at(p.root, 'docs/PRODUCT.md')));
  assert.equal(p.g(['status', '--porcelain']).stdout.trim(), '', 'the tree is untouched');
});

test('migrate --apply moves the project over in the working tree and commits nothing', () => {
  const p = legacyProject();
  const r = p.cli(['migrate', '--apply']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^migrate: 6 change\(s\)$/m);
  assert.equal((r.stdout.match(/^ {2}done: /gm) ?? []).length, 6);
  assert.match(r.stdout, /nothing was committed: review with `git status` and `git diff`/);
  assert.ok(!existsSync(at(p.root, 'docs/VISION.md')));
  assert.match(read(p.root, 'docs/PRODUCT.md'), /^# VISION\n\n## 1\. What it is/, 'the content is moved as it is, not rewritten');
  assert.match(p.g(['status', '--porcelain']).stdout, /^R {2}docs\/VISION\.md -> docs\/PRODUCT\.md$/m, 'git sees a rename, so history follows the file');
  const claude = read(p.root, 'CLAUDE.md');
  assert.match(claude, /\[docs\/PRODUCT\.md\]\(docs\/PRODUCT\.md\)/);
  assert.match(claude, /derive from PRODUCT\.md section 2/);
  assert.match(claude, /SUPERVISION\.md/, 'a longer word that ends in the old name is left alone');
  assert.match(claude, /github\.com\/other\/repo\/blob\/main\/VISION\.md/, 'a URL to another repository is not this project\'s file');
  assert.match(read(p.root, 'docs/ROADMAP.md'), /\[PRODUCT\.md\]\(PRODUCT\.md\)/);
  assert.match(read(p.root, 'docs/plans/2026-09-01-slice-1.md'), /docs\/VISION\.md/, 'plans are not rewritten');
  assert.match(read(p.root, '.acdev/state.md'), /^stage: product$/m);
  assert.ok(!existsSync(at(p.root, '.claude/hooks/acdev-guard.mjs')));
  const settings = JSON.parse(read(p.root, '.claude/settings.json'));
  assert.deepEqual(settings.permissions, { allow: ['Bash(node *)'] }, 'every other key is kept');
  assert.equal(settings.hooks.PreToolUse.length, 2);
  assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /my-own-hook/);
  assert.deepEqual(settings.hooks.PreToolUse[1], { matcher: 'Write', hooks: [{ type: 'command', command: 'node scripts/my-formatter.mjs' }] }, 'a hook that shared an entry with the old guard survives');
  assert.ok(existsSync(at(p.root, '.acdev/lessons.md')), 'unread files are left in place');
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 1, 'nothing committed');
  // A second run has nothing left to do.
  const again = p.cli(['migrate', '--apply']);
  assert.match(again.stdout, /^migrate: 0 change\(s\)$/m);
  assert.match(again.stdout, /nothing to do: this project already uses the current layout/);
  // The migrated project reads as a current one.
  const status = p.cli(['status']);
  assert.match(status.stdout, /state: stage product/);
  assert.ok(!status.stdout.includes('legacy:'), status.stdout);
});

test('migrate never merges two product documents: it reports the conflict', () => {
  const p = legacyProject();
  p.write('docs/PRODUCT.md', '# Product\n');
  const r = migrate(p.root, { apply: true });
  assert.equal(r.ok, true);
  assert.match(r.text, /note: conflict: both docs\/VISION\.md and docs\/PRODUCT\.md exist; merge them by hand/);
  assert.ok(existsSync(at(p.root, 'docs/VISION.md')));
  assert.equal(read(p.root, 'docs/PRODUCT.md'), '# Product\n');
});

test('migrate refuses a directory that is not an acdev project', () => {
  const p = makeProject({ git: false });
  rmSync(at(p.root, '.acdev'), { recursive: true, force: true });
  const r = p.cli(['migrate', '--apply']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /no \.acdev\/state\.md here/);
});

test('stripLegacyHook removes only the entries that run the old guard and drops emptied containers', () => {
  const own = { matcher: 'Bash', hooks: [{ type: 'command', command: 'node mine.mjs' }] };
  const mixed = stripLegacyHook({ model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [LEGACY_HOOK] }, own], Stop: [own] } });
  assert.equal(mixed.removed, 1);
  assert.deepEqual(mixed.settings, { model: 'opus', hooks: { PreToolUse: [own], Stop: [own] } });
  const shared = stripLegacyHook({ hooks: { PreToolUse: [{ matcher: 'Write', hooks: [LEGACY_HOOK, own.hooks[0]] }] } });
  assert.equal(shared.removed, 1);
  assert.deepEqual(shared.settings, { hooks: { PreToolUse: [{ matcher: 'Write', hooks: [own.hooks[0]] }] } });
  const only = stripLegacyHook({ model: 'opus', hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [LEGACY_HOOK] }] } });
  assert.deepEqual(only.settings, { model: 'opus' });
  const none = { hooks: { PreToolUse: [own] } };
  assert.equal(stripLegacyHook(none).removed, 0);
  assert.equal(stripLegacyHook(none).settings, none, 'untouched settings are returned as they came');
  assert.equal(stripLegacyHook({}).removed, 0);
});
