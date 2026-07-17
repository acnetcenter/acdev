import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'run-evals.mjs');
// "node" resolves via PATH: process.execPath commonly contains spaces on
// Windows and ACDEV_EVAL_CMD splits on them.
const fakeJudge = `node ${join(here, 'fixtures', 'fake-judge.mjs')}`;
const fixtureCases = join(here, 'fixtures', 'evals');

const run = (args, env = {}) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });

test('dry run builds prompts from the real activation surface, no judge calls', () => {
  const r = run(['--dry-run', '--suite', 'routing']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /=== case route-/);
  assert.match(r.stdout, /dry run only/);
  // The gateway body the hook injects is part of every routing prompt.
  assert.match(r.stdout, /Pipeline skills outrank process skills/);
  // Model-invocable descriptions are listed...
  assert.match(r.stdout, /- tdd: Use when implementing any feature or bugfix/);
  // ...user-run entry points' descriptions are NOT (they never load).
  assert.ok(!r.stdout.includes('Use when starting a new software project from scratch'));
  assert.ok(!r.stdout.includes('Use when adopting an existing repo into acdev'));
});

test('gates dry run inlines the context files named by the case', () => {
  const r = run(['--dry-run', '--suite', 'gates', '--cases-dir', fixtureCases]);
  assert.equal(r.status, 0, r.stderr);
  // The tdd skill body travels into the prompt, frontmatter stripped.
  assert.match(r.stdout, /skills\/tdd\/SKILL\.md/);
  assert.match(r.stdout, /Write ONE failing test/);
  assert.ok(!r.stdout.includes('description: Use when implementing'));
  assert.match(r.stdout, /Reply with the single letter only\./);
});

test('scoring: wrong answers fail with expected vs got, right answers pass', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'NONE'
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /routing: 1\/2 passed/);
  assert.match(r.stdout, /FAIL fx-tdd: expected tdd, got NONE/);
});

test('a fully correct gates run exits green', () => {
  const r = run(['--suite', 'gates', '--cases-dir', fixtureCases], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'B'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /gates: 1\/1 passed/);
  assert.match(r.stdout, /evals: 1\/1 passed/);
});

test('noisy judge output still parses: last matching line wins', () => {
  const r = run(['--suite', 'gates', '--cases-dir', fixtureCases], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'The answer is:\nB.'
  });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /gates: 1\/1 passed/);
});

test('routing parse tolerates an answer followed by an explanation line', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'tdd\nBecause it is an implementation task.'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /routing: 1\/1 passed/);
});

test('--filter narrows to matching case ids', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-none'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'NONE'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /routing: 1\/1 passed/);
});

test('a wrong answer is retried and the retry pass is reported', () => {
  const state = join(mkdtempSync(join(tmpdir(), 'acdev-eval-')), 'count');
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_SEQ: 'OFFER,tdd',
    ACDEV_FAKE_STATE: state
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /retry fx-tdd: passed on attempt 2/);
  assert.match(r.stdout, /routing: 1\/1 passed/);
});

test('--retries 0 fails fast without a second attempt', () => {
  const state = join(mkdtempSync(join(tmpdir(), 'acdev-eval-')), 'count');
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd', '--retries', '0'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_SEQ: 'OFFER,tdd',
    ACDEV_FAKE_STATE: state
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL fx-tdd: expected tdd, got OFFER/);
});

test('invalid --suite fails naming the valid set', () => {
  const r = run(['--suite', 'bogus']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /invalid --suite "bogus"/);
});

test('the real case files load and validate', () => {
  const r = run(['--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /routing: \d+ case\(s\), dry run only/);
  assert.match(r.stdout, /gates: \d+ case\(s\), dry run only/);
});
