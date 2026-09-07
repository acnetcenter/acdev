// The guard template carries a copy of quiet.mjs's verdict block (it is
// installed into projects file by file, no import allowed). This test feeds
// the same logs to both and requires the same text back, so the copies
// cannot drift apart unnoticed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../scripts/lib/quiet.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const template = join(here, '..', 'shared', 'references', 'templates', 'guard-hook.mjs');

const GREEN = [
  'ok 1 - creates an invoice',
  'ok 2 - totals the lines',
  'ok 2 - totals the lines',
  '# tests 2',
  '# pass 2',
  '# fail 0',
  'Duration 1.2s'
].join('\n') + '\n';

const RED = [
  'ok 1 - creates an invoice',
  'ok 2 - totals the lines',
  'not ok 3 - total is wrong',
  '  AssertionError [ERR_ASSERTION]: expected 2 got 3',
  '    at TestContext.<anonymous> (C:\\proj\\tests\\invoices.test.mjs:12:10)',
  '    at Test.runInAsyncScope (node:async_hooks:90:14)',
  '    at Test.run (node:internal/test_runner/test:632:25)',
  '    at Object.<anonymous> (C:\\proj\\node_modules\\vitest\\dist\\runner.js:88:3)',
  '    at helper (C:\\proj\\src\\invoices.js:40:7)',
  '    at deeper (C:\\proj\\src\\total.js:9:2)',
  '    at Test.processPendingSubtests (node:internal/test_runner/test:374:18)',
  'not ok 4 - vendor only',
  '  Error: boom',
  '    at run (C:\\proj\\node_modules\\lib\\dist\\index.js:1:1)',
  '    at again (C:\\proj\\node_modules\\lib\\dist\\index.js:2:2)',
  '# tests 4',
  '# pass 2',
  '# fail 2',
  '# tests 4',
  '# pass 2',
  '# fail 2'
].join('\n') + '\n';

// A git project with the guard installed whose single verify command prints
// the fixture log from a file (a shell-quoted log would not survive intact)
// and exits with the requested status.
function guardVerify(log, exit) {
  const root = mkdtempSync(join(tmpdir(), 'acdev-parity-'));
  mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
  mkdirSync(join(root, '.acdev'), { recursive: true });
  const hook = join(root, '.claude', 'hooks', 'acdev-guard.mjs');
  copyFileSync(template, hook);
  writeFileSync(join(root, 'fixture.log'), log);
  writeFileSync(join(root, '.acdev', 'state.md'), '# acdev state\n\nstage: build\n');
  const cmd = `"${process.execPath}" -e "process.stdout.write(require('fs').readFileSync('fixture.log','utf8'));process.exit(${exit})"`;
  writeFileSync(join(root, '.acdev', 'guard.json'), JSON.stringify({ verify: [cmd] }));
  const git = (args) => {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  git(['init', '-q']);
  git(['config', 'user.email', 'parity@test']);
  git(['config', 'user.name', 'parity']);
  git(['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(root, 'README.md'), '# t\n');
  git(['add', '-A']);
  git(['commit', '-q', '-m', 'init']);
  const env = { ...process.env };
  delete env.ACDEV_GUARD;
  const r = spawnSync(process.execPath, [hook, 'verify'], { cwd: root, encoding: 'utf8', env });
  assert.equal(r.status, exit, r.stderr + r.stdout);
  // The guard's own lines wrap the condensed body.
  return r.stdout.split('\n').filter((l) => l.trim() && !l.startsWith('acdev guard:')).join('\n');
}

const quietBody = (log, ok) => summarize(log, { ok, exit: ok ? 0 : 1 }).split('\n').slice(1).join('\n');

test('green: the guard verify and quiet summarize condense the same log to the same text', () => {
  const guard = guardVerify(GREEN, 0);
  const quiet = quietBody(GREEN, true);
  assert.equal(guard, quiet);
  assert.match(quiet, /# pass 2/);
  assert.equal(quiet.match(/totals the lines/g).length, 1, 'green dedupes too');
});

test('red: the guard verify and quiet summarize condense the same log to the same text', () => {
  const guard = guardVerify(RED, 1);
  const quiet = quietBody(RED, false);
  assert.equal(guard, quiet);
  // The shape both must produce: vendor frames gone unless they are the only
  // lead, two project frames per test, and a tail that repeats nothing and
  // carries no vendor frame either (the second vendor frame of test 4 sits
  // in the last ten lines and must not resurface there).
  assert.equal(quiet, [
    '--- failure lines (first 8) ---',
    '  not ok 3 - total is wrong',
    '    AssertionError [ERR_ASSERTION]: expected 2 got 3',
    '      at TestContext.<anonymous> (C:\\proj\\tests\\invoices.test.mjs:12:10)',
    '      at helper (C:\\proj\\src\\invoices.js:40:7)',
    '  not ok 4 - vendor only',
    '    Error: boom',
    '      at run (C:\\proj\\node_modules\\lib\\dist\\index.js:1:1)',
    '  # fail 2',
    '--- tail (last 2 line(s)) ---',
    '  # tests 4',
    '  # pass 2'
  ].join('\n'));
  assert.ok(!quiet.includes('at again ('), 'no vendor frame leaks through the tail');
});

test('the shared block is byte-identical in quiet.mjs and the guard template', async () => {
  const { readFileSync } = await import('node:fs');
  const block = (file) => {
    const text = readFileSync(file, 'utf8');
    const start = text.indexOf('// Lines a runner prints as its verdict');
    const end = text.indexOf('// --- end of the shared block ---');
    assert.ok(start > 0 && end > start, `shared block markers missing in ${file}`);
    return text.slice(start, end);
  };
  assert.equal(block(join(here, '..', 'scripts', 'lib', 'quiet.mjs')), block(template));
});
