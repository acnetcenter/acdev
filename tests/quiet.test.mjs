import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../scripts/lib/quiet.mjs';
import { makeProject, ok, red } from './fixtures/project.mjs';

const noisy = Array.from({ length: 200 }, (_, i) => `  ✓ test case ${i} passes`).join('\n');

test('green output condenses to the verdict lines and the last lines', () => {
  const out = summarize(`${noisy}\n\n# tests 200\n# pass 200\n# fail 0\n`, { ok: true, exit: 0, ms: 1234 });
  assert.match(out, /^q: OK \(exit 0, 203 line\(s\), 1\.2s\)/);
  assert.match(out, /# tests 200/);
  assert.match(out, /# pass 200/);
  assert.match(out, /# fail 0/);
  assert.ok(out.split('\n').length <= 17, `too many lines: ${out.split('\n').length}`);
  assert.ok(!out.includes('test case 5 passes'));
});

test('red output keeps the failure lines and a tail', () => {
  const log = `${noisy}\nnot ok 201 - total is wrong\n  AssertionError: expected 2 got 3\n    at Object.<anonymous> (test.js:4:5)\n# tests 201\n# pass 200\n# fail 1\n`;
  const out = summarize(log, { ok: false, exit: 1, tail: 5 });
  assert.match(out, /^q: FAIL \(exit 1/);
  assert.match(out, /failure lines/);
  assert.match(out, /not ok 201 - total is wrong/);
  assert.match(out, /AssertionError: expected 2 got 3/);
  assert.match(out, /tail \(last 5 line\(s\)\)/);
  assert.ok(!out.includes('test case 5 passes'));
});

test('full keeps everything and strips ansi', () => {
  const out = summarize('\x1b[32mall good\x1b[0m\n# pass 1\n', { ok: true, exit: 0, full: true });
  assert.match(out, /^all good\n# pass 1\nq: OK/);
  assert.ok(!out.includes('\x1b'));
});

test('q runs a command from the project and exits with its status', () => {
  const p = makeProject({ git: false });
  const green = p.cli(['q', '--', ok()]);
  assert.equal(green.status, 0, green.stderr);
  assert.match(green.stdout, /q: OK/);
  assert.match(green.stdout, /# pass 3/);
  const r = p.cli(['q', '--tail', '3', '--', red()]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /q: FAIL \(exit 1/);
  assert.match(r.stdout, /AssertionError/);
  const none = p.cli(['q']);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /no command given/);
});
