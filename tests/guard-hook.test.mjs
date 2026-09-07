import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const template = join(here, '..', 'shared', 'references', 'templates', 'guard-hook.mjs');

// Installs the guard the way blueprint does: <root>/.claude/hooks/acdev-guard.mjs
// plus .acdev/state.md at the requested stage and an optional guard.json.
function project({ stage, config, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'acdev-guard-'));
  mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
  mkdirSync(join(root, '.acdev'), { recursive: true });
  const hook = join(root, '.claude', 'hooks', 'acdev-guard.mjs');
  copyFileSync(template, hook);
  if (stage) writeFileSync(join(root, '.acdev', 'state.md'), `# acdev state\n\nstage: ${stage}\n`);
  if (config) writeFileSync(join(root, '.acdev', 'guard.json'), JSON.stringify(config));
  if (git) {
    const run = (args) => {
      const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
    };
    run(['init', '-q']);
    run(['config', 'user.email', 'guard@test']);
    run(['config', 'user.name', 'guard']);
    run(['config', 'commit.gpgsign', 'false']);
    writeFileSync(join(root, 'README.md'), '# t\n');
    writeFileSync(join(root, '.gitignore'), '.acdev/verify-receipt.json\n.acdev/freeze.json\n');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'index.js'), 'export const v = 1;\n');
    run(['add', '-A']);
    run(['commit', '-q', '-m', 'init']);
  }
  const env = { ...process.env };
  delete env.ACDEV_GUARD;
  const hookCall = (tool_name, tool_input) => {
    const r = spawnSync(process.execPath, [hook], { input: JSON.stringify({ tool_name, tool_input, cwd: root }), encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    if (!r.stdout.trim()) return { decision: 'allow', stderr: r.stderr };
    const out = JSON.parse(r.stdout).hookSpecificOutput;
    return { decision: out.permissionDecision, reason: out.permissionDecisionReason, stderr: r.stderr };
  };
  const cli = (...args) => spawnSync(process.execPath, [hook, ...args], { cwd: root, encoding: 'utf8', env });
  return { root, hook, hookCall, cli, env };
}
const edit = (p, path) => p.hookCall('Edit', { file_path: join(p.root, path), old_string: 'a', new_string: 'b' });
const write = (p, path) => p.hookCall('Write', { file_path: join(p.root, path), content: 'x' });
const bash = (p, command) => p.hookCall('Bash', { command });

test('before build, product code is denied and docs, mockups, spikes are allowed by stage', () => {
  const mvp = project({ stage: 'mvp' });
  assert.equal(write(mvp, 'src/app.ts').decision, 'deny');
  assert.match(write(mvp, 'src/app.ts').reason, /Zero product code before build/);
  assert.equal(write(mvp, 'docs/MVP.md').decision, 'allow');
  assert.equal(write(mvp, 'mockups/index.html').decision, 'deny', 'mockups are not open at the mvp stage');
  const mockups = project({ stage: 'mockups' });
  assert.equal(write(mockups, 'mockups/index.html').decision, 'allow');
  assert.equal(write(mockups, 'scripts/verify/auth.mjs').decision, 'deny', 'repo mechanics open at blueprint');
  const blueprint = project({ stage: 'blueprint' });
  assert.equal(write(blueprint, 'scripts/verify/auth.mjs').decision, 'allow');
  assert.equal(write(blueprint, 'spikes/001-oauth/probe.ts').decision, 'allow');
  assert.equal(write(blueprint, 'package.json').decision, 'allow');
  assert.equal(write(blueprint, '.github/workflows/ci.yml').decision, 'allow');
  assert.equal(write(blueprint, 'src/index.ts').decision, 'deny');
  const build = project({ stage: 'build' });
  assert.equal(write(build, 'src/index.ts').decision, 'allow');
});

test('approved documents ask once their gate has closed, and are free while it is open', () => {
  const vision = project({ stage: 'vision' });
  assert.equal(edit(vision, 'docs/VISION.md').decision, 'allow');
  const mvp = project({ stage: 'mvp' });
  assert.equal(edit(mvp, 'docs/VISION.md').decision, 'ask');
  assert.match(edit(mvp, 'docs/VISION.md').reason, /user-challenge/);
  assert.equal(edit(mvp, 'docs/MVP.md').decision, 'allow');
  const build = project({ stage: 'build' });
  assert.equal(edit(build, 'docs/MVP.md').decision, 'ask');
  assert.equal(edit(build, 'docs/adr/0001-stack.md').decision, 'ask');
  assert.equal(edit(build, 'mockups/login.html').decision, 'ask');
  assert.equal(edit(build, 'docs/ROADMAP.md').decision, 'allow');
});

test('secrets files ask, examples do not; the guard protects its own files', () => {
  const p = project({ stage: 'build' });
  assert.equal(write(p, '.env').decision, 'ask');
  assert.equal(write(p, 'apps/web/.env.local').decision, 'ask');
  assert.equal(write(p, '.env.example').decision, 'allow');
  assert.equal(write(p, 'certs/server.pem').decision, 'ask');
  assert.equal(edit(p, '.claude/hooks/acdev-guard.mjs').decision, 'ask');
  assert.equal(edit(p, '.acdev/guard.json').decision, 'ask');
  assert.equal(edit(p, '.claude/settings.json').decision, 'ask');
});

test('freeze denies edits to matching paths until unfreeze', () => {
  const p = project({ stage: 'build' });
  const f = p.cli('freeze', 'tests/**', 'src/legacy.ts', '--reason', 'fixing the failing login test');
  assert.equal(f.status, 0, f.stderr);
  assert.match(f.stdout, /frozen tests\/\*\*, src\/legacy\.ts/);
  const denied = edit(p, 'tests/login.test.ts');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /frozen/);
  assert.match(denied.reason, /fixing the failing login test/);
  assert.equal(edit(p, 'src/legacy.ts').decision, 'deny');
  assert.equal(edit(p, 'src/login.ts').decision, 'allow');
  const s = p.cli('status');
  assert.match(s.stdout, /freeze: tests\/\*\*, src\/legacy\.ts/);
  assert.equal(p.cli('unfreeze').status, 0);
  assert.equal(edit(p, 'tests/login.test.ts').decision, 'allow');
  assert.ok(!existsSync(join(p.root, '.acdev', 'freeze.json')));
});

test('bash write targets go through the same path policy', () => {
  const p = project({ stage: 'mvp' });
  assert.equal(bash(p, "cat > src/app.ts <<'X'\nconsole.log(1)\nX").decision, 'deny');
  assert.equal(bash(p, 'echo hi >> src/notes.txt').decision, 'deny');
  assert.equal(bash(p, 'printf x | tee src/a.ts').decision, 'deny');
  assert.equal(bash(p, 'cp docs/a.md src/b.md').decision, 'deny');
  assert.equal(bash(p, 'touch lib/x.py').decision, 'deny');
  assert.equal(bash(p, "sed -i 's/a/b/' src/x.ts").decision, 'deny');
  assert.equal(bash(p, 'echo hi > docs/notes.md').decision, 'allow');
  assert.equal(bash(p, 'ls src > /dev/null').decision, 'allow');
  assert.equal(bash(p, 'npm test 2>&1').decision, 'allow');
  assert.equal(bash(p, 'cat src/app.ts').decision, 'allow', 'reads are never judged');
  const build = project({ stage: 'build' });
  assert.equal(bash(build, 'echo SECRET=1 >> .env').decision, 'ask');
});

test('inline node code asks (the path policy cannot read it); node script files and node flags do not', () => {
  const p = project({ stage: 'build' });
  const inline = [
    'node -e "require(\'fs\').writeFileSync(\'src/a.ts\', \'x\')"',
    'node -p 1',
    'node --eval=1',
    'node --input-type=module -',
    'echo x | node',
    "node <<'EOF'\nconsole.log(1)\nEOF",
    '"C:\\Program Files\\nodejs\\node.exe" -e 1',
    'NODE_ENV=test node -e 1',
    'cd src && node -p 1'
  ];
  for (const cmd of inline) {
    const r = bash(p, cmd);
    assert.equal(r.decision, 'ask', cmd);
    assert.match(r.reason, /node runs (inline code|a program read from stdin)/, cmd);
    assert.match(r.reason, /Edit or Write tools/, cmd);
  }
  assert.match(bash(p, 'node -e 1').reason, /inline code \(-e\/-p\/--eval\/--print\/--input-type\)/);
  assert.match(bash(p, 'echo x | node').reason, /a program read from stdin/);
  for (const cmd of ['node scripts/acdev.mjs next', 'node --test tests/', 'node script.mjs -e', 'node < scripts/x.js', 'node --version', 'node -v', 'npm test', 'node_modules/.bin/vitest -e']) {
    assert.equal(bash(p, cmd).decision, 'allow', cmd);
  }
  // The rule is independent of the stage ladder.
  assert.equal(bash(project({ stage: 'mvp' }), 'node -e 1').decision, 'ask');
  assert.equal(bash(project(), 'node -p 1').decision, 'ask');
});

test('destructive commands ask', () => {
  const p = project({ stage: 'build' });
  for (const cmd of ['git push --force origin main', 'git push -f', 'git reset --hard HEAD~1', 'git clean -fd', 'git checkout -- .', 'rm -rf build', 'git branch -D feature', 'git stash drop', 'psql -c "DROP TABLE users"']) {
    const r = bash(p, cmd);
    assert.equal(r.decision, 'ask', cmd);
    assert.match(r.reason, /Destructive/);
  }
  assert.equal(bash(p, 'git push origin main').decision, 'allow');
  assert.equal(bash(p, 'git status').decision, 'allow');
  assert.equal(bash(p, 'git checkout -b feature').decision, 'allow');
});

test('in build, git commit needs a fresh green verification receipt', () => {
  const p = project({ stage: 'build', git: true, config: { verify: [`"${process.execPath}" -e "process.exit(0)"`] } });
  const none = bash(p, 'git commit -m "feat: slice 1"');
  assert.equal(none.decision, 'deny');
  assert.match(none.reason, /No verification receipt/);
  const v = p.cli('verify');
  assert.equal(v.status, 0, v.stderr + v.stdout);
  assert.match(v.stdout, /verification GREEN/);
  assert.equal(bash(p, 'git commit -m "feat: slice 1"').decision, 'allow');
  // Docs bookkeeping after the green run does not stale the receipt.
  mkdirSync(join(p.root, 'docs'), { recursive: true });
  writeFileSync(join(p.root, 'docs', 'ROADMAP.md'), '# roadmap\n');
  writeFileSync(join(p.root, 'CHANGELOG.md'), '# changelog\n');
  writeFileSync(join(p.root, '.acdev', 'state.md'), '# acdev state\n\nstage: build\nupdated: now\n');
  assert.equal(bash(p, 'git commit -m "feat: slice 1"').decision, 'allow');
  // Code changes do.
  mkdirSync(join(p.root, 'src'), { recursive: true });
  writeFileSync(join(p.root, 'src', 'a.ts'), 'export const a = 1;\n');
  const stale = bash(p, 'git commit -m "feat: slice 1"');
  assert.equal(stale.decision, 'deny');
  assert.match(stale.reason, /stale/);
  assert.match(p.cli('status').stdout, /receipt: stale/);
  assert.equal(p.cli('verify').status, 0);
  assert.equal(bash(p, 'git commit -m "feat: slice 1"').decision, 'allow');
  // Markdown is bookkeeping: a tracked README edit does not stale the
  // receipt, a tracked code edit does.
  writeFileSync(join(p.root, 'README.md'), '# changed\n');
  assert.equal(bash(p, 'git commit -m x').decision, 'allow');
  writeFileSync(join(p.root, 'src', 'index.js'), 'export const v = 2;\n');
  assert.equal(bash(p, 'git commit -m x').decision, 'deny');
});

test('a red verification writes a red receipt and blocks the commit with the failing command', () => {
  const p = project({ stage: 'build', git: true, config: { verify: [`"${process.execPath}" -e "process.exit(0)"`, `"${process.execPath}" -e "process.exit(3)"`] } });
  const v = p.cli('verify');
  assert.equal(v.status, 1);
  assert.match(v.stdout, /verification RED/);
  const receipt = JSON.parse(readFileSync(join(p.root, '.acdev', 'verify-receipt.json'), 'utf8'));
  assert.equal(receipt.ok, false);
  assert.match(receipt.failed, /exit 3/);
  const r = bash(p, 'git commit -m x');
  assert.equal(r.decision, 'deny');
  assert.match(r.reason, /was red/);
  assert.match(r.reason, /exit 3/);
});

test('verify prints the verdict lines, not the log; --full prints everything; red prints the failure lines', () => {
  const noisy = `"${process.execPath}" -e "for(let i=0;i<80;i++)console.log('  ok '+i+' - case '+i);console.log('# tests 80');console.log('# pass 80');console.log('# fail 0')"`;
  const p = project({ stage: 'build', git: true, config: { verify: [noisy] } });
  const v = p.cli('verify');
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /# tests 80/);
  assert.match(v.stdout, /# pass 80/);
  assert.match(v.stdout, /verification GREEN/);
  assert.ok(!v.stdout.includes('ok 5 - case 5'), 'noise is filtered');
  assert.ok(v.stdout.split('\n').length < 25, `too long: ${v.stdout.split('\n').length} lines`);
  const full = p.cli('verify', '--full');
  assert.ok(full.stdout.includes('ok 5 - case 5'));
  const red = project({ stage: 'build', git: true, config: { verify: [`"${process.execPath}" -e "for(let i=0;i<80;i++)console.log('ok '+i);console.log('not ok 81 - total');console.log('  AssertionError: expected 2 got 3');console.log('# fail 1');process.exit(1)"`] } });
  const r = red.cli('verify');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /not ok 81 - total/);
  assert.match(r.stdout, /AssertionError: expected 2 got 3/);
  assert.match(r.stdout, /--- tail/);
  assert.match(r.stdout, /verification RED/);
});

test('commits outside build, or without verify commands, are not gated by the receipt', () => {
  const vision = project({ stage: 'vision', git: true, config: { verify: ['false'] } });
  assert.equal(bash(vision, 'git commit -m "docs: project vision"').decision, 'allow');
  const unconfigured = project({ stage: 'build', git: true });
  assert.equal(bash(unconfigured, 'git commit -m x').decision, 'allow');
  const v = unconfigured.cli('verify');
  assert.equal(v.status, 1);
  assert.match(v.stderr, /no verify commands/);
});

test('without pipeline state the stage rules are inert but freeze and secrets still apply', () => {
  const p = project();
  assert.equal(write(p, 'src/app.ts').decision, 'allow');
  assert.equal(write(p, '.env').decision, 'ask');
  p.cli('freeze', 'tests/**');
  assert.equal(edit(p, 'tests/a.test.ts').decision, 'deny');
  assert.match(p.cli('status').stdout, /stage: none/);
});

test('off switches: guard.json enabled false, or ACDEV_GUARD=off', () => {
  const off = project({ stage: 'mvp', config: { enabled: false } });
  assert.equal(write(off, 'src/app.ts').decision, 'allow');
  assert.match(off.cli('status').stdout, /DISABLED/);
  const p = project({ stage: 'mvp' });
  const r = spawnSync(process.execPath, [p.hook], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: join(p.root, 'src/app.ts') } }),
    encoding: 'utf8', env: { ...p.env, ACDEV_GUARD: 'off' }
  });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('hook mode fails open on malformed input and on an unreadable config', () => {
  const p = project({ stage: 'mvp' });
  const r = spawnSync(process.execPath, [p.hook], { input: 'not json', encoding: 'utf8', env: p.env });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /failed open/);
  writeFileSync(join(p.root, '.acdev', 'guard.json'), '{ broken');
  const d = write(p, 'src/app.ts');
  assert.equal(d.decision, 'deny', 'defaults still apply when the config is unreadable');
  assert.match(d.stderr, /unreadable/);
});

test('config extends the allowlist and the protected set', () => {
  const p = project({ stage: 'mvp', config: { allow_before_build: ['prototype/**'], protected: [{ glob: 'docs/PRICING.md', after: 'mvp', what: 'the pricing model' }] } });
  assert.equal(write(p, 'prototype/x.ts').decision, 'allow');
  assert.equal(write(p, 'src/x.ts').decision, 'deny');
  assert.equal(edit(p, 'docs/PRICING.md').decision, 'allow');
  const build = project({ stage: 'build', config: { protected: [{ glob: 'docs/PRICING.md', after: 'mvp', what: 'the pricing model' }] } });
  const r = edit(build, 'docs/PRICING.md');
  assert.equal(r.decision, 'ask');
  assert.match(r.reason, /the pricing model/);
});

test('paths outside the repository are ignored', () => {
  const p = project({ stage: 'mvp' });
  assert.equal(p.hookCall('Write', { file_path: join(tmpdir(), 'elsewhere.ts') }).decision, 'allow');
});
