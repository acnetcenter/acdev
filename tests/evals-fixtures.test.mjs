import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The eval cases are judged by a model, but what each fixture sets up is
// deterministic: this runs every fixture and checks, without a model, that
// the plugin behaves on it the way the case expects. A fixture that drifts
// from the code fails here instead of producing a confusing eval score.
const here = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(here, '..');
const EVALS = join(PLUGIN, 'evals');
const NODE = process.execPath;
const shell = ['bash', 'sh'].find((s) => spawnSync(s, ['-c', 'git --version'], { encoding: 'utf8' }).status === 0);
const skip = shell ? false : 'no POSIX shell with git on PATH';

function build(name) {
  const root = mkdtempSync(join(tmpdir(), `acdev-eval-${name}-`));
  const r = spawnSync(shell, [join(EVALS, name, 'fixture.sh').replaceAll('\\', '/')], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, `${name}/fixture.sh failed: ${r.stderr}`);
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  delete env.ACDEV_GUARD;
  // A fixture whose verify command is itself a node --test run must not
  // inherit this runner's context, or it reports to it instead of failing.
  delete env.NODE_TEST_CONTEXT;
  const cli = (args) => spawnSync(NODE, [join(PLUGIN, 'scripts', 'acdev.mjs'), ...args], { cwd: root, encoding: 'utf8', env });
  const hook = (tool_name, tool_input) => {
    const h = spawnSync(NODE, [join(PLUGIN, 'hooks', 'guard.mjs')], { input: JSON.stringify({ tool_name, tool_input, cwd: root }), encoding: 'utf8', env });
    return h.stdout.trim() ? JSON.parse(h.stdout).hookSpecificOutput.permissionDecision : 'allow';
  };
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout;
  return { root, cli, hook, git };
}

test('every eval case has a fixture, and every fixture is listed here', { skip }, () => {
  const cases = readdirSync(EVALS, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'results').map((e) => e.name).sort();
  assert.deepEqual(cases, ['close-refuses-on-red', 'guard-blocks-product-code-before-build', 'mockups-gate-needs-explicit-approval', 'small-fix-needs-no-plan', 'status-is-one-call']);
  for (const c of cases) assert.ok(existsSync(join(EVALS, c, 'fixture.sh')), `${c}/fixture.sh`);
});

test('guard-blocks-product-code-before-build: the write the prompt asks for is denied', { skip }, () => {
  const p = build('guard-blocks-product-code-before-build');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'src', 'server.js'), content: 'x' }), 'deny');
  assert.equal(p.hook('Bash', { command: 'echo "x" > src/server.js' }), 'deny');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'docs', 'MVP.md'), content: 'x' }), 'allow');
});

test('mockups-gate-needs-explicit-approval: the gate is open and the stack cannot be scaffolded yet', { skip }, () => {
  const p = build('mockups-gate-needs-explicit-approval');
  assert.match(p.cli(['status']).stdout, /state: stage mockups[\s\S]*to continue: docs\/MVP\.md is approved; the mockups skill/);
  assert.equal(p.hook('Edit', { file_path: join(p.root, 'mockups', 'index.html'), old_string: 'a', new_string: 'b' }), 'allow', 'not frozen before the approval');
  assert.equal(p.hook('Write', { file_path: join(p.root, 'package.json'), content: '{}' }), 'deny', 'repo mechanics open at blueprint');
});

test('close-refuses-on-red: the close stops at the red test and commits nothing', { skip }, () => {
  const p = build('close-refuses-on-red');
  const r = p.cli(['close', '--slice', '2: totals', '--next', 'phase exit', '--changelog', 'invoice totals']);
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /verify: RED/);
  assert.match(r.stdout, /BLOCKED: verification is red/);
  assert.ok(!existsSync(join(p.root, 'CHANGELOG.md')));
  assert.equal(p.git(['log', '--oneline']).trim().split('\n').length, 1);
  assert.equal(p.hook('Bash', { command: 'git commit -am "feat: totals"' }), 'deny', 'and a commit by hand is denied too');
});

test('small-fix-needs-no-plan: nothing stands between the request and the edit', { skip }, () => {
  const p = build('small-fix-needs-no-plan');
  assert.equal(p.hook('Edit', { file_path: join(p.root, 'README.md'), old_string: 'Invocie', new_string: 'Invoice' }), 'allow');
  assert.equal(p.hook('Bash', { command: 'git commit -am "fix: typo"' }), 'allow', 'no verify commands, no receipt needed');
});

test('status-is-one-call: one command carries the stage, the next slice and the phase', { skip }, () => {
  const p = build('status-is-one-call');
  const out = p.cli(['status']).stdout;
  assert.match(out, /state: stage build/);
  assert.match(out, /next_step: slice 3: export an invoice as PDF/);
  assert.match(out, /## roadmap phase\n## Phase 1: MVP/);
  assert.ok(out.length < 2000, `one small snapshot: ${out.length} chars`);
});
