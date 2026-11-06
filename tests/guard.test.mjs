import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { rmSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeProject, GUARD_HOOK, ok, red } from './fixtures/project.mjs';

// The guard ships with the plugin: every test drives hooks/guard.mjs the
// way Claude Code does, with the project named by the payload's cwd.
const edit = (p, path) => p.hook('Edit', { file_path: join(p.root, path), old_string: 'a', new_string: 'b' });
const write = (p, path) => p.hook('Write', { file_path: join(p.root, path), content: 'x' });
const bash = (p, command) => p.hook('Bash', { command });
const pwsh = (p, command) => p.hook('PowerShell', { command });
const cleanEnv = { ...process.env };
delete cleanEnv.ACDEV_GUARD;
delete cleanEnv.CLAUDE_PROJECT_DIR;

test('before build, product code is denied and docs, mockups, spikes open by stage', () => {
  const mvp = makeProject({ stage: 'mvp' });
  assert.equal(write(mvp, 'src/app.ts').decision, 'deny');
  assert.match(write(mvp, 'src/app.ts').reason, /Zero product code before build: this project is at stage "mvp"/);
  assert.equal(write(mvp, 'docs/MVP.md').decision, 'allow');
  assert.equal(write(mvp, 'mockups/index.html').decision, 'deny', 'mockups are not open at the mvp stage');
  const mockups = makeProject({ stage: 'mockups' });
  assert.equal(write(mockups, 'mockups/index.html').decision, 'allow');
  assert.equal(write(mockups, 'scripts/verify/auth.mjs').decision, 'deny', 'repo mechanics open at blueprint');
  const blueprint = makeProject({ stage: 'blueprint' });
  assert.equal(write(blueprint, 'scripts/verify/auth.mjs').decision, 'allow');
  assert.equal(write(blueprint, 'spikes/001-oauth/probe.ts').decision, 'allow');
  assert.equal(write(blueprint, 'package.json').decision, 'allow');
  assert.equal(write(blueprint, '.github/workflows/ci.yml').decision, 'allow');
  assert.equal(write(blueprint, 'src/index.ts').decision, 'deny');
  const build = makeProject({ stage: 'build' });
  assert.equal(write(build, 'src/index.ts').decision, 'allow');
});

test('approved documents ask once their gate has closed, and are free while it is open', () => {
  const product = makeProject({ stage: 'product' });
  assert.equal(edit(product, 'docs/PRODUCT.md').decision, 'allow');
  const mvp = makeProject({ stage: 'mvp' });
  assert.equal(edit(mvp, 'docs/PRODUCT.md').decision, 'ask');
  assert.match(edit(mvp, 'docs/PRODUCT.md').reason, /the approved PRODUCT document[\s\S]*user-challenge/);
  assert.equal(edit(mvp, 'docs/VISION.md').decision, 'ask', 'a project not yet migrated keeps its document protected');
  assert.equal(edit(mvp, 'docs/MVP.md').decision, 'allow');
  const build = makeProject({ stage: 'build', mockups: true });
  assert.equal(edit(build, 'docs/MVP.md').decision, 'ask');
  // What was approved asks; a later phase adds pages beside it freely.
  assert.equal(edit(build, 'mockups/invoice-list.html').decision, 'ask');
  assert.match(edit(build, 'mockups/invoice-list.html').reason, /frozen visual contract/);
  assert.equal(write(build, 'mockups/team-billing.html').decision, 'allow');
  assert.equal(edit(build, 'docs/ROADMAP.md').decision, 'allow');
  // A recorded decision asks; a new ADR is a new decision, not a rewrite.
  assert.equal(edit(build, 'docs/adr/0001-stack.md').decision, 'ask');
  assert.equal(write(build, 'docs/adr/0009-new-queue.md').decision, 'allow');
  assert.equal(edit(build, '.acdev/guard.json').decision, 'ask', 'the guard config is the user\'s to change');
  // The pipeline state is written by the checkpoint command, never by hand.
  const state = edit(build, '.acdev/state.md');
  assert.equal(state.decision, 'deny');
  assert.match(state.reason, /acdev checkpoint write/);
  assert.equal(bash(mvp, 'echo "stage: build" > .acdev/state.md').decision, 'deny');
  assert.equal(write(build, '.acdev/checkpoints/x.md').decision, 'allow');
});

test('a stage recorded as "vision" before 0.5.0 is read as product', () => {
  const p = makeProject({ stage: 'mvp' });
  p.write('.acdev/state.md', '# acdev state\n\nstage: vision\nupdated: 2026-07-10 21:38\nacdev_version: 0.1.2\nlanguage: english\n');
  assert.equal(edit(p, 'docs/VISION.md').decision, 'allow', 'its gate is still open');
  assert.equal(write(p, 'src/app.ts').decision, 'deny');
});

test('shell write targets go through the same path policy, in Bash and in PowerShell', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(bash(p, 'echo "x" > src/app.ts').decision, 'deny');
  assert.equal(bash(p, 'cp template.ts src/app.ts').decision, 'deny');
  assert.equal(bash(p, 'npm test | tee src/out.log').decision, 'deny');
  assert.equal(bash(p, 'echo "x" > docs/notes.md').decision, 'allow');
  assert.equal(bash(p, 'ls -la src && cat src/invoices.js').decision, 'allow', 'reading is not writing');
  assert.equal(pwsh(p, 'Set-Content -Path src/app.ts -Value "x"').decision, 'deny');
  assert.equal(pwsh(p, '"x" | Out-File src/app.ts').decision, 'deny');
  assert.equal(pwsh(p, 'Copy-Item template.ts -Destination src/app.ts').decision, 'deny');
  assert.equal(pwsh(p, 'New-Item -Path docs/notes.md -ItemType File').decision, 'allow');
  const build = makeProject({ stage: 'build' });
  assert.equal(bash(build, 'echo "- extra" >> docs/MVP.md').decision, 'ask');
  assert.equal(bash(build, 'echo "x" > src/app.ts').decision, 'allow');
});

test('in build, git commit needs a green verification of the current code', () => {
  const p = makeProject({ stage: 'build', verify: [ok()] });
  // Nothing but docs changed: there is nothing to verify, receipt or not.
  p.write('docs/ROADMAP.md', '# Roadmap\n\n## Phase 1: MVP (complete)\n');
  assert.equal(bash(p, 'git add -A && git commit -m "docs: phase 1 exit"').decision, 'allow');
  p.write('src/invoices.js', 'export const invoices = [0];\n');
  const none = bash(p, 'git commit -m "feat: x"');
  assert.equal(none.decision, 'deny');
  assert.match(none.reason, /No verification receipt[\s\S]*acdev verify/);
  const v = p.cli(['verify']);
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /# pass 3/, 'the verdict lines, not the log');
  assert.match(v.stdout, /verify: GREEN \(1 command\(s\)\); receipt written for tree [0-9a-f]{12}/);
  assert.equal(bash(p, 'git commit -m "feat: x"').decision, 'allow');
  assert.equal(pwsh(p, 'git commit -m "feat: x"').decision, 'allow');
  // Docs and acdev state never stale the receipt; code does.
  p.write('docs/notes.md', '# notes\n');
  p.write('CHANGELOG.md', '# Changelog\n');
  assert.equal(bash(p, 'git add -A && git commit -m "feat: x"').decision, 'allow');
  // Committing moves HEAD, not the code: the receipt still stands for an
  // amend or a second commit of the same tree.
  p.g(['add', '-A']);
  p.g(['commit', '-q', '-m', 'feat: x']);
  p.write('docs/more.md', '# more\n');
  assert.equal(bash(p, 'git commit --amend --no-edit').decision, 'allow');
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const stale = bash(p, 'git commit -m "feat: x"');
  assert.equal(stale.decision, 'deny');
  assert.match(stale.reason, /stale: code changed after the last green run/);
  assert.equal(pwsh(p, 'git commit -m "feat: x"').decision, 'deny');
});

test('a red verification writes a red receipt and blocks the commit with the failing command', () => {
  const p = makeProject({ stage: 'build', verify: [ok(), red(), ok()] });
  const v = p.cli(['verify']);
  assert.equal(v.status, 1);
  assert.match(v.stdout, /AssertionError: expected 2 got 3/);
  assert.match(v.stdout, /verify: RED at .*\(exit 1\); receipt written, a commit is blocked until a green run/);
  assert.equal((v.stdout.match(/^\$ /gm) ?? []).length, 2, 'the run stops at the first red command');
  p.write('src/invoices.js', 'export const invoices = [0];\n');
  const denied = bash(p, 'git commit -m "feat: x"');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /was red/);
});

test('commits outside build, or without verify commands, are not gated by the receipt', () => {
  const mvp = makeProject({ stage: 'mvp', verify: [ok()] });
  assert.equal(bash(mvp, 'git commit -m "docs: mvp contract"').decision, 'allow');
  const unconfigured = makeProject({ stage: 'build' });
  assert.equal(bash(unconfigured, 'git commit -m "feat: x"').decision, 'allow');
  const v = unconfigured.cli(['verify']);
  assert.equal(v.status, 0);
  assert.match(v.stdout, /no commands configured[^\n]*nothing ran/);
});

test('the guard is inert outside an acdev project and when switched off', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(write(p, 'src/app.ts').decision, 'deny');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'src/app.ts'), content: 'x' }, { ACDEV_GUARD: 'off' }).decision, 'allow');
  p.write('.acdev/guard.json', JSON.stringify({ enabled: false }));
  assert.equal(write(p, 'src/app.ts').decision, 'allow');
  const plain = makeProject({ stage: 'mvp' });
  rmSync(join(plain.root, '.acdev'), { recursive: true, force: true });
  assert.equal(write(plain, 'src/app.ts').decision, 'allow', 'no .acdev/state.md, no rules');
  assert.equal(bash(plain, 'git commit -m x').decision, 'allow');
});

test('the hook fails open on malformed input and on an unreadable config', () => {
  const r = spawnSync(process.execPath, [GUARD_HOOK], { input: 'not json', encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /acdev guard: hook failed open/);
  const p = makeProject({ stage: 'mvp' });
  p.write('.acdev/guard.json', '{ not json');
  assert.equal(write(p, 'src/app.ts').decision, 'deny', 'an unreadable config falls back to the defaults');
});

test('the project config extends the allowlist and the protected set', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(write(p, 'infra/main.tf').decision, 'deny');
  p.write('.acdev/guard.json', JSON.stringify({ allow_before_build: ['infra/**'], protected: [{ glob: 'docs/PRICING.md', after: 'product', what: 'the pricing rules' }] }));
  assert.equal(write(p, 'infra/main.tf').decision, 'allow');
  const asked = edit(p, 'docs/PRICING.md');
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /the pricing rules/);
});

test('paths outside the project are none of the guard\'s business', () => {
  const p = makeProject({ stage: 'mvp' });
  const outside = mkdtempSync(join(tmpdir(), 'acdev-outside-'));
  assert.equal(p.hook('Write', { file_path: join(outside, 'src', 'app.ts'), content: 'x' }).decision, 'allow');
  assert.equal(p.hook('Read', { file_path: join(p.root, 'src/app.ts') }).decision, 'allow', 'only writes and shell commands are judged');
});

// --- found by the committee review -----------------------------------------

test('heredoc bodies and quoted text are data, not commands', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(bash(p, "cat > docs/notes.md <<'EOF'\n> Quote: this matters\na; b | c > d\nEOF").decision, 'allow');
  assert.equal(bash(p, 'echo "a; b > c" > docs/x.md').decision, 'allow');
  assert.equal(bash(p, 'git commit -m "$(cat <<\'EOF\'\ndocs: mvp > mockups; next | later\nEOF\n)"').decision, 'allow');
  assert.equal(pwsh(p, "@'\nx > src/app.ts\n'@ | Set-Content docs/x.md").decision, 'allow');
  // The line that opens a heredoc still names the file it writes.
  assert.equal(bash(p, "cat > src/app.ts <<'EOF'\nconsole.log(1)\nEOF").decision, 'deny');
  assert.equal(bash(p, 'if [ 1 -gt 0 ]; then echo ok; fi').decision, 'allow');
});

test('PowerShell parameters are not mistaken for paths', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(pwsh(p, 'New-Item -ItemType Directory -Force docs\\adr').decision, 'allow');
  assert.equal(pwsh(p, 'New-Item -ItemType Directory -Force src').decision, 'allow', 'a folder is not a file');
  assert.equal(pwsh(p, 'Set-Content -Encoding utf8 docs\\x.md "x"').decision, 'allow');
  assert.equal(pwsh(p, 'Out-File -Encoding utf8 docs\\x.md').decision, 'allow');
  assert.equal(pwsh(p, 'Set-Content -Encoding utf8 src\\app.ts "x"').decision, 'deny');
  assert.equal(pwsh(p, 'New-Item -ItemType File -Path src -Name app.ts').decision, 'deny');
  assert.equal(pwsh(p, 'ni src\\app.ts').decision, 'deny', 'the common aliases count');
  assert.equal(pwsh(p, 'Get-Content src\\invoices.js | Tee-Object -FilePath src\\copy.js').decision, 'deny');
  assert.equal(pwsh(p, 'dir src 2>nul').decision, 'allow');
  assert.equal(bash(p, 'ls src > NUL').decision, 'allow');
});

test('a leading cd moves where relative targets land', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(bash(p, 'cd docs && echo x > ../src/app.ts').decision, 'deny');
  assert.equal(bash(p, 'cd docs && echo x > notes.md').decision, 'allow');
  const m = makeProject({ stage: 'mockups' });
  assert.equal(bash(m, 'cd mockups && echo "<p>" > index2.html').decision, 'allow');
  // The shell's own cwd is where relative paths start from.
  assert.equal(m.hook('Bash', { command: 'echo "<p>" > index3.html' }, {}, join(m.root, 'mockups')).decision, 'allow');
  assert.equal(m.hook('Bash', { command: 'echo x > app.ts' }, {}, join(m.root, 'src')).decision, 'deny');
});

test('cp and mv into a directory are judged by the file they create', () => {
  const p = makeProject({ stage: 'mvp' });
  assert.equal(bash(p, 'cp ../template/app.ts src/').decision, 'deny');
  assert.equal(bash(p, 'cp -r ../template/src .').decision, 'deny');
  assert.equal(bash(p, 'cp ../template/notes.md docs/').decision, 'allow');
  assert.equal(bash(p, 'echo x | sudo tee src/a.ts').decision, 'deny');
});

test('git commit is recognized with global options and ignored inside other text', () => {
  const p = makeProject({ stage: 'build', verify: [ok()] });
  p.write('src/invoices.js', 'export const invoices = [0];\n');
  for (const cmd of ['git commit -m x', 'git -C . commit -m x', 'git -c core.autocrlf=false commit -m x', 'git add -A && git commit -m x']) {
    assert.equal(bash(p, cmd).decision, 'deny', cmd);
  }
  for (const cmd of ['echo "remember to git commit"', 'git log --grep="git commit"', 'git commit-tree abc', 'git status']) {
    assert.equal(bash(p, cmd).decision, 'allow', cmd);
  }
});

test('the receipt is about content: names, coverage files and an empty repo do not break it', () => {
  const p = makeProject({ stage: 'build', verify: [ok()], commit: false });
  // A repo with no commit yet, a file name git would quote, a file with spaces.
  p.write('src/cañón.js', 'export const x = 1;\n');
  p.write('src/my file.js', 'export const y = 1;\n');
  const v = p.cli(['verify']);
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.match(v.stdout, /receipt written for tree [0-9a-f]{12}/);
  assert.equal(bash(p, 'git add -A && git commit -m "feat: first"').decision, 'allow');
  // Rewriting a file with the same content changes nothing.
  p.write('src/my file.js', 'export const y = 1;\n');
  assert.equal(bash(p, 'git commit -m x').decision, 'allow');
  // A binary edit does.
  p.write('src/logo.bin', Buffer.from([0, 1, 2, 3]));
  assert.equal(bash(p, 'git commit -m x').decision, 'deny');
  // What the verify commands leave behind is part of what they certified,
  // and a bare name in receipt_ignore covers the directory.
  const w = makeProject({ stage: 'build', verify: [ok("require('fs').mkdirSync('coverage',{recursive:true});require('fs').writeFileSync('coverage/lcov.info','x')")] });
  w.write('src/invoices.js', 'export const invoices = [0];\n');
  assert.equal(w.cli(['verify']).status, 0);
  assert.equal(bash(w, 'git commit -m x').decision, 'allow');
  w.write('coverage/lcov.info', 'changed by hand');
  assert.equal(bash(w, 'git commit -m x').decision, 'deny', 'without the ignore, a changed report is changed content');
  w.write('.acdev/guard.json', JSON.stringify({ verify: [ok()], receipt_ignore: ['coverage'] }));
  assert.equal(w.cli(['verify']).status, 0);
  w.write('coverage/lcov.info', 'changed again');
  assert.equal(bash(w, 'git commit -m x').decision, 'allow');
});

test('the guard finds the project from a subfolder and from a parent folder', () => {
  const p = makeProject({ stage: 'mvp' });
  // A session opened in root/src, writing a file there.
  assert.equal(p.hook('Write', { file_path: join(p.root, 'src', 'app.ts'), content: 'x' }, { CLAUDE_PROJECT_DIR: join(p.root, 'src') }, join(p.root, 'src')).decision, 'deny');
  // A session opened above the project (a monorepo root).
  const parent = join(p.root, '..');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'src', 'app.ts'), content: 'x' }, { CLAUDE_PROJECT_DIR: parent }, parent).decision, 'deny');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'docs', 'MVP.md'), content: 'x' }, { CLAUDE_PROJECT_DIR: parent }, parent).decision, 'allow');
});

test('a hand-written state and config are tolerated: BOM, case, quotes, comments', () => {
  const p = makeProject({ stage: 'mvp' });
  for (const stage of ['Mvp', '"mvp"', 'mvp # current', 'MVP']) {
    p.write('.acdev/state.md', `# acdev state\n\nstage: ${stage}\n`);
    assert.equal(write(p, 'src/app.ts').decision, 'deny', stage);
  }
  p.write('.acdev/state.md', '﻿# acdev state\r\n\r\nStage: mvp\r\n');
  assert.equal(write(p, 'src/app.ts').decision, 'deny', 'a BOM, CRLF and a capitalized key');
  p.write('.acdev/guard.json', '﻿{ "enabled": false }');
  assert.equal(write(p, 'src/app.ts').decision, 'allow', 'a config with a BOM is still read');
  p.write('.acdev/guard.json', '{}');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'src/app.ts'), content: 'x' }, { ACDEV_GUARD: 'OFF' }).decision, 'allow');
  // A stage that is not a pipeline stage switches the stage rules off, loudly.
  p.write('.acdev/state.md', '# acdev state\n\nstage: banana\n');
  assert.equal(write(p, 'src/app.ts').decision, 'allow');
  assert.match(p.cli(['status']).stdout, /STAGE "banana" IS NOT A PIPELINE STAGE/);
});

test('before build, markdown anywhere, tests and repo dotfiles are not product code', () => {
  const mvp = makeProject({ stage: 'mvp' });
  assert.equal(write(mvp, 'src/README.md').decision, 'allow');
  assert.equal(write(mvp, 'packages/web/README.md').decision, 'allow');
  assert.equal(write(mvp, 'tests/smoke.test.js').decision, 'deny', 'tests open at blueprint, with the runner');
  const bp = makeProject({ stage: 'blueprint' });
  for (const f of ['tests/smoke.test.js', 'test/smoke.test.js', 'src/smoke.test.ts', 'src/__tests__/a.js', '.husky/pre-commit', '.npmrc', '.prettierignore', '.eslintignore', '.dockerignore']) {
    assert.equal(write(bp, f).decision, 'allow', f);
  }
  assert.equal(write(bp, 'src/app.ts').decision, 'deny');
});

test('a stage change is announced, and the move to build says what it unlocks', () => {
  const p = makeProject({ stage: 'blueprint' });
  const r = p.cli(['checkpoint', 'write', '--stage', 'build', '--branch', 'main', '--next', 'await the order']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /acdev: stage blueprint -> build: product code is unlocked from here/);
  assert.match(r.stdout.trim(), /^\.acdev\/checkpoints\/\S+\.md$/, 'stdout stays the checkpoint path');
  const same = p.cli(['checkpoint', 'write', '--stage', 'build', '--branch', 'main', '--next', 'slice 1']);
  assert.equal(same.stderr, '');
});

test('a project scaffolder is judged by where it is pointed', () => {
  const p = makeProject({ stage: 'blueprint' });
  assert.equal(bash(p, 'npx create-vite@latest web --template react').decision, 'deny');
  assert.equal(bash(p, 'npm create vite@latest').decision, 'deny', 'no directory means the repo root');
  assert.equal(bash(p, 'npm create vite@latest . -- --template react').decision, 'deny');
  assert.equal(bash(p, 'pnpm create next-app app').decision, 'deny');
  assert.equal(bash(p, 'npx create-vite@latest spikes/001-vite').decision, 'allow', 'a spike folder is open at blueprint');
  assert.equal(bash(p, 'npm init -y').decision, 'allow', 'a bare package.json is repo mechanics');
  assert.equal(bash(p, 'npm install').decision, 'allow');
  assert.equal(bash(makeProject({ stage: 'build' }), 'npx create-vite@latest web').decision, 'allow');
});

test('the walk up to the project stops at another repository', () => {
  const p = makeProject({ stage: 'mvp' });
  // A separate repository nested inside the project folder is not this project.
  p.write('vendor/tool/README.md', '# tool\n');
  const g = spawnSync('git', ['init', '-q'], { cwd: join(p.root, 'vendor', 'tool') });
  assert.equal(g.status, 0);
  assert.equal(p.hook('Write', { file_path: join(p.root, 'vendor', 'tool', 'src', 'x.js'), content: 'x' }, {}, join(p.root, 'vendor', 'tool')).decision, 'allow');
  assert.equal(write(p, 'vendor/other.js').decision, 'deny', 'a plain folder of the project still is');
});

test('a project in a subfolder of a repository is fingerprinted on its own subtree', () => {
  // repo/apps/web is the acdev project; repo/apps/api is someone else's code.
  const repo = mkdtempSync(join(tmpdir(), 'acdev-mono-'));
  const run = (args, cwd = repo) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  run(['init', '-q', '-b', 'main']);
  run(['config', 'user.email', 'm@test']);
  run(['config', 'user.name', 'm']);
  run(['config', 'commit.gpgsign', 'false']);
  const web = join(repo, 'apps', 'web');
  const file = (rel, text) => {
    const path = join(repo, ...rel.split('/'));
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  };
  file('apps/web/.acdev/state.md', '# acdev state\n\nstage: build\n');
  file('apps/web/.acdev/guard.json', JSON.stringify({ verify: [ok()] }));
  file('apps/web/src/a.js', 'export const a = 1;\n');
  file('apps/api/src/b.js', 'export const b = 1;\n');
  run(['add', '-A']);
  run(['commit', '-q', '-m', 'init']);
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.ACDEV_GUARD;
  const hook = (command) => {
    const r = spawnSync(process.execPath, [GUARD_HOOK], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command }, cwd: web }), encoding: 'utf8', env });
    return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'allow';
  };
  file('apps/web/src/a.js', 'export const a = 2;\n');
  assert.equal(hook('git commit -am x'), 'deny');
  const v = spawnSync(process.execPath, [join(GUARD_HOOK, '..', '..', 'scripts', 'acdev.mjs'), 'verify'], { cwd: web, encoding: 'utf8', env });
  assert.equal(v.status, 0, v.stdout + v.stderr);
  assert.equal(hook('git commit -am x'), 'allow');
  file('apps/api/src/b.js', 'export const b = 2;\n');
  assert.equal(hook('git commit -am x'), 'allow', 'a change in a sibling folder is not this project\'s code');
  file('apps/web/src/a.js', 'export const a = 3;\n');
  assert.equal(hook('git commit -am x'), 'deny');
});

test('a Git Bash drive path is the same file as its Windows path', { skip: process.platform === 'win32' ? false : 'Windows only' }, () => {
  const p = makeProject({ stage: 'mvp' });
  const posix = `/${p.root[0].toLowerCase()}/${p.root.slice(3).replaceAll('\\', '/')}`;
  assert.equal(bash(p, `echo x > ${posix}/src/app.ts`).decision, 'deny');
  assert.equal(p.hook('Write', { file_path: `${posix}/src/app.ts`, content: 'x' }).decision, 'deny');
  assert.equal(bash(p, `echo x > ${posix}/docs/notes.md`).decision, 'allow');
});

test('where no prompt reaches the user, an ask becomes a deny that says how to go on', () => {
  const p = makeProject({ stage: 'build', mockups: true });
  const asBypass = (tool, input, mode = 'bypassPermissions') => {
    const r = spawnSync(process.execPath, [GUARD_HOOK], { input: JSON.stringify({ tool_name: tool, tool_input: input, cwd: p.root, permission_mode: mode }), encoding: 'utf8', env: cleanEnv });
    if (!r.stdout.trim()) return { decision: 'allow' };
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    return { decision: out.permissionDecision, reason: out.permissionDecisionReason };
  };
  const doc = { file_path: join(p.root, 'docs', 'MVP.md'), content: 'x' };
  assert.equal(asBypass('Write', doc, 'default').decision, 'ask');
  assert.equal(asBypass('Write', doc, 'acceptEdits').decision, 'ask');
  const stopped = asBypass('Write', doc);
  assert.equal(stopped.decision, 'deny');
  assert.match(stopped.reason, /No prompt reaches the user in bypassPermissions mode: put the question in chat, and only on an explicit yes run `acdev allow <path>`/);
  assert.equal(asBypass('Write', doc, 'dontAsk').decision, 'deny');
  assert.equal(asBypass('Bash', { command: 'echo x >> docs/MVP.md' }).decision, 'deny');
  // The yes opens that path, and only that one.
  const yes = p.cli(['allow', 'docs/MVP.md']);
  assert.equal(yes.status, 0, yes.stdout + yes.stderr);
  assert.match(yes.stdout, /docs\/MVP\.md may be edited for the next 15 minutes/);
  assert.equal(asBypass('Write', doc).decision, 'allow');
  assert.equal(asBypass('Bash', { command: 'echo x >> docs/MVP.md' }).decision, 'allow');
  p.write('docs/PRODUCT.md', '# Product\n');
  assert.equal(asBypass('Write', { file_path: join(p.root, 'docs', 'PRODUCT.md'), content: 'x' }).decision, 'deny', 'another approved document stays closed');
});

test('a yes covers what it names, expires, and never opens product code or the state', () => {
  const p = makeProject({ stage: 'mvp' });
  p.write('docs/PRODUCT.md', '# Product\n');
  assert.equal(edit(p, 'docs/PRODUCT.md').decision, 'ask');
  assert.equal(p.cli(['allow', 'docs/PRODUCT.md']).status, 0);
  assert.equal(edit(p, 'docs/PRODUCT.md').decision, 'allow');
  assert.equal(write(p, 'src/app.ts').decision, 'deny', 'a yes is about an approved document, not about the stage');
  assert.equal(p.cli(['allow', 'src/app.ts']).status, 0);
  assert.equal(write(p, 'src/app.ts').decision, 'deny');
  assert.equal(p.cli(['allow', '.acdev/state.md']).status, 0);
  assert.equal(edit(p, '.acdev/state.md').decision, 'deny');
  const bad = p.cli(['allow', '../outside.md']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /inside this project/);
  assert.equal(p.cli(['allow']).status, 1);
  // A yes from another project does not count here.
  const other = makeProject({ stage: 'mvp' });
  other.write('docs/PRODUCT.md', '# Product\n');
  assert.equal(edit(other, 'docs/PRODUCT.md').decision, 'ask');
});

test('the guard config is free until build and the user\'s from then on', () => {
  const bp = makeProject({ stage: 'blueprint' });
  assert.equal(edit(bp, '.acdev/guard.json').decision, 'allow', 'the blueprint stage fills it');
  const build = makeProject({ stage: 'build' });
  assert.equal(edit(build, '.acdev/guard.json').decision, 'ask');
});
