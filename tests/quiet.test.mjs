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

test('red output keeps the failure lines and a tail that does not repeat them', () => {
  const log = `${noisy}\nnot ok 201 - total is wrong\n  AssertionError: expected 2 got 3\n    at Object.<anonymous> (test.js:4:5)\n# tests 201\n# pass 200\n# fail 1\n`;
  const out = summarize(log, { ok: false, exit: 1, tail: 5 });
  assert.match(out, /^q: FAIL \(exit 1/);
  assert.match(out, /failure lines \(first 4\)/);
  assert.match(out, /not ok 201 - total is wrong/);
  assert.match(out, /AssertionError: expected 2 got 3/);
  // The last five lines minus the three already printed as failure lines.
  assert.match(out, /tail \(last 2 line\(s\)\) ---\n  # tests 201\n  # pass 200$/);
  assert.equal(out.match(/AssertionError/g).length, 1, 'a failure line is printed once');
  assert.ok(!out.includes('test case 5 passes'));
});

test('red drops vendor frames, caps project frames at two per failing test, keeps one vendor frame as the only lead', () => {
  const log = [
    'not ok 1 - total',
    '  AssertionError: expected 2 got 3',
    '    at TestContext.<anonymous> (C:\\proj\\tests\\total.test.mjs:12:10)',
    '    at Test.runInAsyncScope (node:async_hooks:90:14)',
    '    at Test.run (node:internal/test_runner/test:632:25)',
    '    at run (C:\\proj\\node_modules\\vitest\\dist\\runner.js:88:3)',
    '    at helper (/proj/src/total.js:40:7)',
    '    at deeper (/proj/src/sum.js:9:2)',
    'not ok 2 - vendor only',
    '  Error: boom',
    '    at first (/proj/node_modules/lib/dist/index.js:1:1)',
    '    at second (/proj/node_modules/lib/dist/index.js:2:2)',
    '# fail 2'
  ].join('\n');
  const out = summarize(log, { ok: false, exit: 1 });
  const failures = out.split('\n--- tail')[0].split('\n').slice(2);
  assert.deepEqual(failures, [
    '  not ok 1 - total',
    '    AssertionError: expected 2 got 3',
    '      at TestContext.<anonymous> (C:\\proj\\tests\\total.test.mjs:12:10)',
    '      at helper (/proj/src/total.js:40:7)',
    '  not ok 2 - vendor only',
    '    Error: boom',
    '      at first (/proj/node_modules/lib/dist/index.js:1:1)',
    '  # fail 2'
  ]);
  // The tail (last ten lines minus what the failure section printed) drops
  // the vendor frames too; the project frame past the cap is the only line
  // left, so a vendor frame never resurfaces below the failure section.
  const tail = out.split('--- tail')[1].split('\n');
  assert.equal(tail[0], ' (last 1 line(s)) ---');
  assert.deepEqual(tail.slice(1), ['      at deeper (/proj/src/sum.js:9:2)']);
  assert.ok(!out.includes('node:async_hooks') && !out.includes('at second ('), 'no vendor frame in the tail');
});

test('red tail is capped at ten lines whatever --tail says, and stays deduped', () => {
  const lines = Array.from({ length: 50 }, (_, i) => `line ${i}`);
  const log = [...lines, 'not ok 1 - x', 'dup', 'dup', 'dup', 'last'].join('\n');
  const out = summarize(log, { ok: false, exit: 1, tail: 30 });
  const tail = out.split('--- tail')[1].split('\n').slice(1);
  assert.ok(tail.length <= 10, `tail too long: ${tail.length}`);
  // The last ten lines minus the failure line and the repeated "dup".
  assert.deepEqual(tail, ['  line 45', '  line 46', '  line 47', '  line 48', '  line 49', '  dup', '  last']);
  assert.match(out, /tail \(last 7 line\(s\)\)/);
  const three = summarize(log, { ok: false, exit: 1, tail: 3 });
  assert.match(three, /tail \(last 2 line\(s\)\) ---\n  dup\n  last$/);
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
