import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'run-evals.mjs');
// ACDEV_EVAL_CMD splits on spaces, so the judge command must contain
// none: "node" resolves via PATH (process.execPath often has spaces on
// Windows) and the fixture path is repo-relative, resolved against the
// cwd that run() pins to the repo root below.
const fakeJudge = 'node tests/fixtures/fake-judge.mjs';
const fixtureCases = join(here, 'fixtures', 'evals');

const run = (args, env = {}) =>
  spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: join(here, '..'),
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
  assert.match(r.stdout, /routing: 1\/3 passed/);
  assert.match(r.stdout, /FAIL fx-tdd: expected tdd, got NONE/);
});

test('a pass through the accept list is reported as such', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-accept'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'designing'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /accept fx-accept: passed via designing/);
  assert.match(r.stdout, /routing: 1\/1 passed \(1 via accept: fx-accept\)/);
});

test('--ablate strips the governing text and only measures, never gates', () => {
  const dry = run(['--ablate', '--dry-run', '--cases-dir', fixtureCases]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /\(ablated\)/);
  assert.match(dry.stdout, /no governing text provided/);
  assert.ok(!dry.stdout.includes('--- skills/'));
  const r = run(['--ablate', '--cases-dir', fixtureCases], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'B'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /gates ablation: 1\/1 answerable without context/);
});

test('accept discipline holds across the real routing cases', () => {
  const { cases } = JSON.parse(readFileSync(join(here, '..', 'evals', 'routing.cases.json'), 'utf8'));
  for (const c of cases) {
    const accept = c.accept ?? [];
    assert.ok(accept.length <= 2, `${c.id}: accept has ${accept.length} entries (cap is 2)`);
    assert.ok(!accept.includes('OFFER'), `${c.id}: OFFER must be expected strictly, never an accept escape`);
    assert.ok(!accept.includes(c.expect), `${c.id}: accept repeats its own expect`);
  }
  const strict = (pred) => cases.some((c) => pred(c) && !(c.accept ?? []).length);
  assert.ok(strict((c) => c.expect === 'OFFER'), 'no strict OFFER case: the in-doubt rule is unenforced');
  assert.ok(strict((c) => c.expect === 'NONE'), 'no strict NONE case');
  assert.ok(strict((c) => c.expect.startsWith('RECOMMEND:')), 'no strict RECOMMEND case');
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
  assert.match(r.stdout, /routing: 1\/1 passed \(1 on retry: fx-tdd\)/);
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

test('a NONE answer above a skill name is scored, not skipped', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd', '--retries', '0'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'NONE\ntdd'
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL fx-tdd: expected tdd, got NONE/);
});

test('a lone non-skill word is skipped until a real answer appears', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'Sure.\ntdd'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /routing: 1\/1 passed/);
});

test('a hung judge hits the injectable timeout instead of wedging the run', () => {
  const r = run(['--suite', 'gates', '--cases-dir', fixtureCases, '--retries', '0'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_HANG: '1',
    ACDEV_EVAL_TIMEOUT_MS: '1500'
  });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /judge timeout after 1500ms/);
});

test('a judge that exits nonzero is one per-case FAIL, not a crash', () => {
  const r = run(['--suite', 'gates', '--cases-dir', fixtureCases, '--retries', '0'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_EXIT: '3'
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /judge exit 3/);
});

test('an unspawnable judge is reported, not thrown', () => {
  const r = run(['--suite', 'gates', '--cases-dir', fixtureCases, '--retries', '0'], {
    ACDEV_EVAL_CMD: 'definitely-not-a-real-binary-acdev'
  });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /judge (spawn failed|exit)/);
});

test('a filter that matches nothing fails instead of passing over zero cases', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'zzz-typo'], {
    ACDEV_EVAL_CMD: fakeJudge
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /matched no cases/);
  const dry = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'zzz-typo', '--dry-run']);
  assert.equal(dry.status, 1);
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
  const b = run(['--dry-run', '--suite', 'budget']);
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, /budget: \d+ case\(s\), dry run only/);
  assert.match(b.stdout, /cwd: .*budget-project/);
  assert.ok(!b.stdout.includes('<plugin-root>'), 'the plugin root is substituted into budget prompts');
});

test('dry run prints the real judge command: isolated for routing and gates, cached prefix for budget', () => {
  const routing = run(['--dry-run', '--suite', 'routing', '--cases-dir', fixtureCases]);
  assert.equal(routing.status, 0, routing.stderr);
  assert.match(routing.stdout, /^judge: claude -p --model haiku --safe-mode --tools ""$/m);
  const gates = run(['--dry-run', '--suite', 'gates', '--cases-dir', fixtureCases, '--model', 'sonnet']);
  assert.equal(gates.status, 0, gates.stderr);
  assert.match(gates.stdout, /^judge: claude -p --model sonnet --safe-mode --tools ""$/m);
  const ablate = run(['--ablate', '--dry-run', '--cases-dir', fixtureCases]);
  assert.match(ablate.stdout, /^judge: claude -p --model haiku --safe-mode --tools ""$/m);
  const budget = run(['--dry-run', '--suite', 'budget', '--cases-dir', fixtureCases]);
  assert.equal(budget.status, 0, budget.stderr);
  assert.match(budget.stdout, /^judge: claude -p --model haiku --output-format json --exclude-dynamic-system-prompt-sections$/m);
  const judgeLine = budget.stdout.match(/^judge: .*$/m)[0];
  assert.ok(!judgeLine.includes('--safe-mode'), `budget judge must keep the full environment: ${judgeLine}`);
  for (const r of [routing, gates, ablate, budget]) assert.ok(!r.stdout.includes('--bare'), '--bare skips OAuth and is never used');
});

// A judge that prints its own argv: `node -p EXPR --` evaluates EXPR with
// everything after `--` in process.argv, so the flags the runner appends
// to ACDEV_EVAL_CMD come back as the answer (joined without spaces so
// the whole list survives the runner's truncation).
const echoArgv = "node -p process.argv.slice(1).join('|') --";

test('routing and gates judges receive --safe-mode and --tools "" through ACDEV_EVAL_CMD', () => {
  const routing = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd', '--retries', '0'], { ACDEV_EVAL_CMD: echoArgv });
  assert.equal(routing.status, 1, routing.stdout + routing.stderr);
  assert.match(routing.stdout, /FAIL fx-tdd: expected tdd, got unparseable: --safe-mode\|--tools\|\r?\n/);
  const gates = run(['--suite', 'gates', '--cases-dir', fixtureCases, '--retries', '0'], { ACDEV_EVAL_CMD: echoArgv });
  assert.equal(gates.status, 1, gates.stdout + gates.stderr);
  assert.match(gates.stdout, /got unparseable: --safe-mode\|--tools\|\r?\n/);
  assert.ok(!routing.stdout.includes('exclude-dynamic') && !gates.stdout.includes('exclude-dynamic'));
});

test('the budget judge receives --exclude-dynamic-system-prompt-sections and no --safe-mode', () => {
  // The echoed argv rides in a headless-style error result so the budget
  // parser surfaces it verbatim.
  const echoJson = "node -p JSON.stringify({is_error:true,result:process.argv.slice(1).join('|')}) --";
  const r = run(['--suite', 'budget', '--cases-dir', fixtureCases, '--retries', '0'], { ACDEV_EVAL_CMD: echoJson });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /FAIL budget-fixture-next: session error: --exclude-dynamic-system-prompt-sections \(/);
  assert.ok(!r.stdout.includes('--safe-mode'), r.stdout);
});

test('the fake judge ignores the appended suite flags', () => {
  const r = run(['--suite', 'routing', '--cases-dir', fixtureCases, '--filter', 'fx-tdd'], {
    ACDEV_EVAL_CMD: fakeJudge,
    ACDEV_FAKE_ANSWER: 'tdd'
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /routing: 1\/1 passed/);
});

test('budget suite checks the headless usage against the case budget', () => {
  const usage = (over) => JSON.stringify({
    type: 'result', is_error: false, num_turns: over ? 9 : 3, total_cost_usd: over ? 0.5 : 0.01,
    usage: { input_tokens: over ? 4000 : 800, output_tokens: 200, cache_read_input_tokens: over ? 20000 : 1500, cache_creation_input_tokens: 300 }
  });
  const ok = run(['--suite', 'budget', '--cases-dir', fixtureCases, '--retries', '0'], { ACDEV_EVAL_CMD: fakeJudge, ACDEV_FAKE_JSON: usage(false) });
  assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  assert.match(ok.stdout, /ok budget-fixture-next: 3 turns, 2800 total \/ 1300 fresh tokens, \$0\.010/);
  assert.match(ok.stdout, /budget: 1\/1 passed/);
  const over = run(['--suite', 'budget', '--cases-dir', fixtureCases, '--retries', '0'], { ACDEV_EVAL_CMD: fakeJudge, ACDEV_FAKE_JSON: usage(true) });
  assert.equal(over.status, 1);
  assert.match(over.stdout, /FAIL budget-fixture-next: total 24500 > 5000, fresh 4500 > 2000, turns 9 > 4, cost \$0\.500 > \$0\.05/);
  const err = run(['--suite', 'budget', '--cases-dir', fixtureCases, '--retries', '0'], { ACDEV_EVAL_CMD: fakeJudge, ACDEV_FAKE_JSON: '{"is_error":true,"result":"boom"}' });
  assert.equal(err.status, 1);
  assert.match(err.stdout, /FAIL budget-fixture-next: session error: boom/);
  const none = run(['--suite', 'budget', '--cases-dir', fixtureCases, '--retries', '0'], { ACDEV_EVAL_CMD: fakeJudge, ACDEV_FAKE_ANSWER: 'prose only' });
  assert.equal(none.status, 1);
  assert.match(none.stdout, /FAIL budget-fixture-next: no JSON result/);
});
