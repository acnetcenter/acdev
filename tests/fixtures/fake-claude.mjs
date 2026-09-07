#!/usr/bin/env node
// Stands in for `claude -p --output-format json` in the run-loop tests.
// Reads the prompt on stdin, acts on the project in cwd per
// FAKE_CLAUDE_MODE, and prints a headless-style JSON result.
//   progress (default): writes a new checkpoint (a slice closed)
//   blocked: writes a --blocked checkpoint
//   phase: writes a checkpoint whose next step is the phase exit
//   stuck: writes nothing (no progress)
//   error: prints an is_error result and exits 1
//   nojson: prints prose only
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendFileSync } from 'node:fs';

const mode = process.env.FAKE_CLAUDE_MODE ?? 'progress';
const here = dirname(fileURLToPath(import.meta.url));
const checkpoint = join(here, '..', '..', 'scripts', 'checkpoint.mjs');
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
if (process.env.FAKE_CLAUDE_LOG) appendFileSync(process.env.FAKE_CLAUDE_LOG, `${process.argv.slice(2).join(' ')}\n${prompt}\n---\n`);
const n = Number(process.env.FAKE_CLAUDE_N ?? '1');
const write = (args) => spawnSync(process.execPath, [checkpoint, 'write', '--stage', 'build', '--branch', 'main', ...args], { cwd: process.cwd(), encoding: 'utf8' });
const result = (extra = {}) => JSON.stringify({
  type: 'result', subtype: 'success', is_error: false, duration_ms: 1500, num_turns: 7, session_id: `fake-${n}`, total_cost_usd: 0.25,
  usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 9000, cache_creation_input_tokens: 400 },
  modelUsage: { 'claude-haiku-4-5-20251001': { inputTokens: 1200, outputTokens: 300, cacheReadInputTokens: 9000, cacheCreationInputTokens: 400, costUSD: 0.25 } },
  result: 'done', ...extra
});
if (mode === 'hang') {
  // A stuck session: the loop's timeout must kill it, on Windows too.
  await new Promise((r) => setTimeout(r, 20000));
  console.log(result());
} else if (mode === 'budget') {
  console.log(result({ is_error: true, subtype: 'error_max_budget_usd', result: 'Reached max budget of $5' }));
  process.exit(1);
} else if (mode === 'progress') {
  write(['--slice', `${n}: fake slice`, '--next', `slice ${n + 1}`]);
  console.log('some banner line');
  console.log(result());
} else if (mode === 'blocked') {
  write(['--next', 'slice 2', '--blocked', 'tenant model: schema or row level?']);
  console.log(result());
} else if (mode === 'phase') {
  write(['--slice', '9: last', '--next', 'phase exit: run the gate']);
  console.log(result());
} else if (mode === 'stuck') {
  console.log(result());
} else if (mode === 'error') {
  console.log(result({ is_error: true, result: 'boom' }));
  process.exit(1);
} else {
  console.log('no json here');
}
