import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseResult, stopReason, claudeCommand } from '../scripts/lib/run.mjs';
import { renderCost, summarizeLedger } from '../scripts/lib/cost.mjs';
import { makeProject, PLUGIN } from './fixtures/project.mjs';

// The fake sits in the plugin tree (no spaces in its path on CI); the
// command string travels through a shell on Windows exactly as `claude` does.
const FAKE = `node ${join(PLUGIN, 'tests', 'fixtures', 'fake-claude.mjs').replace(/\\/g, '/')}`;
const runWith = (p, mode, extra = []) => p.cli(['run', '--claude', FAKE, ...extra], { env: { ...process.env, FAKE_CLAUDE_MODE: mode } });

test('parseResult takes the last JSON object on stdout', () => {
  assert.equal(parseResult(''), null);
  assert.equal(parseResult('prose only'), null);
  assert.deepEqual(parseResult('{"a":1}'), { a: 1 });
  assert.deepEqual(parseResult('banner\n{"a":1}\n{"b":2}\n'), { b: 2 });
});

test('stopReason covers error, blocked, no progress, phase exit and the slice cap', () => {
  const before = { path: 'a.md', fields: {} };
  const after = { path: 'b.md', fields: { next_step: 'slice 3' } };
  assert.match(stopReason({ result: null, before, after, iteration: 1, maxSlices: 5 }), /no result/);
  assert.match(stopReason({ result: { is_error: true, result: 'boom' }, before, after, iteration: 1, maxSlices: 5 }), /error: boom/);
  assert.match(stopReason({ result: {}, before, after: { path: 'b.md', fields: { blocked_on: 'q?' } }, iteration: 1, maxSlices: 5 }), /blocked: q\?/);
  assert.match(stopReason({ result: {}, before, after: before, iteration: 1, maxSlices: 5 }), /no progress/);
  assert.match(stopReason({ result: {}, before, after: { path: 'b.md', fields: { next_step: 'phase exit: gate' } }, iteration: 1, maxSlices: 5 }), /phase exit reached/);
  assert.match(stopReason({ result: {}, before, after, iteration: 5, maxSlices: 5 }), /max slices \(5\)/);
  assert.equal(stopReason({ result: {}, before, after, iteration: 1, maxSlices: 5 }), null);
});

test('claudeCommand puts the prompt on stdin and passes model and extra flags', () => {
  const c = claudeCommand({ claude: 'claude', model: 'sonnet', extra: '--permission-mode acceptEdits' });
  const flat = `${c.cmd} ${c.args.join(' ')}`;
  assert.match(flat, /-p --output-format json --model sonnet --permission-mode acceptEdits/);
});

test('run loops one fresh session per slice, records cost, and stops on the checkpoint it reads back', () => {
  const p = makeProject({});
  const r = runWith(p, 'progress', ['--max-slices', '2', '--model', 'haiku']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /run 1: 1: fake slice \| 7 turns \| in 1200 out 300 \| \$0\.250\n/);
  assert.match(r.stdout, /run 2: 1: fake slice .* stop: max slices \(2\) reached/);
  const ledger = readFileSync(join(p.root, '.acdev', 'cost.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].cost_usd, 0.25);
  assert.equal(ledger[0].cache_read, 9000);
  assert.equal(ledger[0].turns, 7);
  assert.equal(ledger[1].stop, 'max slices (2) reached');
  const cost = p.cli(['cost']);
  assert.match(cost.stdout, /total: 2 run\(s\)/);
  assert.match(cost.stdout, /\$0\.500/);
  assert.match(p.cli(['cost', '--json']).stdout, /"iteration": 2/);
});

test('run stops on a blocked checkpoint, on the phase exit, on no progress and on an error result', () => {
  assert.match(runWith(makeProject({}), 'blocked').stdout, /stop: blocked: tenant model/);
  assert.match(runWith(makeProject({}), 'phase').stdout, /stop: phase exit reached \(phase exit: run the gate\)/);
  assert.match(runWith(makeProject({}), 'stuck').stdout, /stop: no progress/);
  assert.match(runWith(makeProject({}), 'error').stdout, /stop: error: boom/);
  assert.match(runWith(makeProject({}), 'nojson').stdout, /stop: no result/);
});

test('run --dry-run prints the command and the default prompt without calling anything', () => {
  const p = makeProject({});
  const r = p.cli(['run', '--dry-run', '--model', 'sonnet']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /run \(dry\): claude -p --output-format json --model sonnet/);
  assert.match(r.stdout, /prompt on stdin: Run: node ".+\/scripts\/acdev\.mjs" next/);
  assert.match(r.stdout, /Build exactly one slice/);
});

test('cost summary counts closed slices by commit movement', () => {
  const entries = [
    { iteration: 1, slice: '1: a', turns: 5, input_tokens: 100, output_tokens: 50, cache_read: 0, cost_usd: 0.1, commit_before: 'a', commit_after: 'b', stop: null },
    { iteration: 2, slice: '2: b', turns: 5, input_tokens: 100, output_tokens: 50, cache_read: 0, cost_usd: 0.1, commit_before: 'b', commit_after: 'b', stop: 'no progress' }
  ];
  const s = summarizeLedger(entries);
  assert.equal(s.closed, 1);
  assert.equal(s.total.cost_usd, 0.2);
  assert.match(renderCost(entries), /per closed slice: \$0\.200, 300 tokens/);
  assert.match(renderCost([]), /no \.acdev\/cost\.jsonl yet/);
});
