import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseResult, stopReason, claudeCommand, defaultBudget, DEFAULT_BUDGET_USD } from '../scripts/lib/run.mjs';
import { renderCost, summarizeLedger } from '../scripts/lib/cost.mjs';
import { makeProject, PLUGIN } from './fixtures/project.mjs';

// The fake sits in the plugin tree (no spaces in its path on CI); the
// command string travels through a shell on Windows exactly as `claude` does.
const FAKE = `node ${join(PLUGIN, 'tests', 'fixtures', 'fake-claude.mjs').replace(/\\/g, '/')}`;
// `run` reads the installed plugin version from CLAUDE_CONFIG_DIR (default
// ~/.claude) and warns on a mismatch; an empty config dir keeps stdout the
// same on CI and on a dev machine with acdev installed.
const NO_PLUGINS = mkdtempSync(join(tmpdir(), 'acdev-config-empty-'));
const OWN_VERSION = JSON.parse(readFileSync(join(PLUGIN, 'package.json'), 'utf8')).version;
const runCli = (p, args, env = {}) => p.cli(['run', ...args], { env: { ...process.env, CLAUDE_CONFIG_DIR: NO_PLUGINS, ...env } });
const runWith = (p, mode, extra = []) => runCli(p, ['--claude', FAKE, ...extra], { FAKE_CLAUDE_MODE: mode });
// A Claude config dir whose installed_plugins.json holds one acdev entry.
const configWith = (entry) => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-config-'));
  mkdirSync(join(dir, 'plugins'));
  writeFileSync(join(dir, 'plugins', 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: { 'acdev@m': entry } }));
  return dir;
};

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

test('claudeCommand adds the budget cap, the cache-friendly isolation and the MCP allowlist, each switchable', () => {
  const on = claudeCommand({ claude: 'claude', model: 'sonnet', budgetUsd: 5, mcpConfig: '.acdev/headless-mcp.json' });
  const flat = `${on.cmd} ${on.args.join(' ')}`;
  assert.match(flat, /--model sonnet --max-budget-usd 5 --exclude-dynamic-system-prompt-sections --strict-mcp-config --mcp-config \.acdev\/headless-mcp\.json/);
  const off = claudeCommand({ claude: 'claude', isolate: false });
  const flatOff = `${off.cmd} ${off.args.join(' ')}`;
  assert.doesNotMatch(flatOff, /exclude-dynamic|max-budget|mcp-config/);
});

test('stopReason names a budget cap before a generic error', () => {
  const before = { path: 'a.md', fields: {} };
  assert.match(stopReason({ result: { is_error: true, subtype: 'error_max_budget_usd', result: 'Reached max budget of $5' }, before, after: before, iteration: 1, maxSlices: 5 }), /^budget exceeded: Reached max budget/);
  assert.match(stopReason({ result: { is_error: true, result: 'max budget reached' }, before, after: before, iteration: 1, maxSlices: 5 }), /^budget exceeded/);
});

test('defaultBudget is twice the ledger median, never below the constant', () => {
  const p = makeProject({});
  assert.equal(defaultBudget(p.root), DEFAULT_BUDGET_USD);
  p.write('.acdev/cost.jsonl', [1, 2, 3].map((c) => JSON.stringify({ cost_usd: c })).join('\n') + '\n');
  assert.equal(defaultBudget(p.root), DEFAULT_BUDGET_USD);
  p.write('.acdev/cost.jsonl', [4, 4, 4, 9].map((c) => JSON.stringify({ cost_usd: c })).join('\n') + '\n');
  assert.equal(defaultBudget(p.root), 8);
});

test('run loops one fresh session per slice, records cost, and stops on the checkpoint it reads back', () => {
  const p = makeProject({});
  const r = runWith(p, 'progress', ['--max-slices', '2', '--model', 'haiku']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /run 1: 1: fake slice \| 7 turns \| in 1200 out 300 total 10900 \| \$0\.250\n/);
  assert.match(r.stdout, /run 2: 1: fake slice .* stop: max slices \(2\) reached/);
  const ledger = readFileSync(join(p.root, '.acdev', 'cost.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].cost_usd, 0.25);
  assert.equal(ledger[0].cache_read, 9000);
  assert.equal(ledger[0].total_tokens, 10900);
  assert.equal(ledger[0].fresh_tokens, 1900);
  assert.equal(ledger[0].model_usage['claude-haiku-4-5-20251001'].costUSD, 0.25);
  assert.equal(ledger[0].budget_usd, DEFAULT_BUDGET_USD);
  assert.equal(ledger[0].turns, 7);
  assert.equal(ledger[1].stop, 'max slices (2) reached');
  const cost = p.cli(['cost']);
  assert.match(cost.stdout, /total: 2 run\(s\), 0 closed slice\(s\), 14 turns, total 21,800 fresh 3,800 out 600 tokens, \$0\.500/);
  assert.match(cost.stdout, /models: claude-haiku-4-5-20251001 \$0\.500 \(100%\)/);
  assert.match(p.cli(['cost', '--json']).stdout, /"iteration": 2/);
});

test('run stops on a blocked checkpoint, on the phase exit, on no progress, on an error result and on the budget cap', () => {
  assert.match(runWith(makeProject({}), 'blocked').stdout, /stop: blocked: tenant model/);
  assert.match(runWith(makeProject({}), 'phase').stdout, /stop: phase exit reached \(phase exit: run the gate\)/);
  assert.match(runWith(makeProject({}), 'stuck').stdout, /stop: no progress/);
  assert.match(runWith(makeProject({}), 'error').stdout, /stop: error: boom/);
  assert.match(runWith(makeProject({}), 'nojson').stdout, /stop: no result/);
  assert.match(runWith(makeProject({}), 'budget').stdout, /stop: budget exceeded: Reached max budget/);
});

test('run kills the whole process tree at the timeout and records it', () => {
  const started = Date.now();
  const r = runWith(makeProject({}), 'hang', ['--timeout-min', '0.05']);
  assert.match(r.stdout, /stop: error: timeout after 0\.05 min \(process tree killed\)/);
  assert.ok(Date.now() - started < 15000, 'the hung fake (20s) was not killed at the 3s timeout');
});

test('run --dry-run prints the command, the default prompt and the budget without calling anything', () => {
  const p = makeProject({});
  const r = runCli(p, ['--dry-run', '--model', 'sonnet']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^run \(dry\): claude -p --output-format json --model sonnet --max-budget-usd 5 --exclude-dynamic-system-prompt-sections/);
  assert.match(r.stdout, /prompt on stdin: Run: node ".+\/scripts\/acdev\.mjs" next/);
  assert.match(r.stdout, /Build exactly one slice/);
  assert.match(r.stdout, /budget: \$5 per iteration/);
  assert.doesNotMatch(r.stdout, /^mcp:/m, 'no MCP line without a config');
  p.write('.acdev/headless-mcp.json', '{"mcpServers":{}}\n');
  const mcp = runCli(p, ['--dry-run']);
  assert.match(mcp.stdout, /--strict-mcp-config --mcp-config \.acdev\/headless-mcp\.json/);
  assert.match(mcp.stdout, /^mcp: \.acdev\/headless-mcp\.json \(auto-detected; --strict-mcp-config\)$/m);
  p.write('mcp/build.json', '{"mcpServers":{}}\n');
  const flag = runCli(p, ['--dry-run', '--mcp-config', 'mcp/build.json']);
  assert.match(flag.stdout, /--strict-mcp-config --mcp-config mcp\/build\.json/);
  assert.match(flag.stdout, /^mcp: mcp\/build\.json \(--mcp-config\)$/m);
  assert.doesNotMatch(flag.stdout, /auto-detected/);
  const off = runCli(p, ['--dry-run', '--no-isolate', '--budget-usd', '0']);
  assert.doesNotMatch(off.stdout, /exclude-dynamic|max-budget|mcp-config/);
  assert.match(off.stdout, /budget: none/);
  assert.doesNotMatch(off.stdout, /^mcp:/m, '--no-isolate drops the auto-detected config');
});

test('run rejects a --budget-usd that is not a number >= 0; 0 still disables the cap', () => {
  const p = makeProject({});
  // A negative value must travel as --budget-usd=-1: parseArgs reads a
  // separate "-1" as another option and refuses it itself (also exit 1).
  for (const args of [['--budget-usd', 'abc'], ['--budget-usd=-1'], ['--budget-usd', ''], ['--budget-usd', 'NaN'], ['--budget-usd', 'Infinity'], ['--budget-usd', '1e400']]) {
    const r = runCli(p, ['--dry-run', ...args]);
    assert.equal(r.status, 1, `${args.join(' ')} must exit 1`);
    assert.match(r.stderr, /^run: --budget-usd must be a number >= 0$/m, args.join(' '));
    assert.equal(r.stdout, '', 'nothing runs on a bad cap');
  }
  const dash = runCli(p, ['--dry-run', '--budget-usd', '-1']);
  assert.equal(dash.status, 1);
  assert.match(dash.stderr, /--budget-usd=-XYZ/, 'parseArgs names the = form');
  assert.equal(dash.stdout, '');
  const zero = runCli(p, ['--dry-run', '--budget-usd', '0']);
  assert.equal(zero.status, 0, zero.stderr);
  assert.match(zero.stdout, /budget: none/);
  const some = runCli(p, ['--dry-run', '--budget-usd', '2.5']);
  assert.equal(some.status, 0, some.stderr);
  assert.match(some.stdout, /--max-budget-usd 2\.5 /);
  assert.match(some.stdout, /budget: \$2\.5 per iteration/);
});

test('run warns first when the installed acdev plugin version differs from the CLI, in both installed_plugins.json shapes, and stays silent otherwise', () => {
  const p = makeProject({});
  const warning = new RegExp(`^run: warning: the installed acdev plugin is 0\\.0\\.1 but this CLI is ${OWN_VERSION.replace(/\./g, '\\.')}; the headless session loads the installed plugin's skills and hooks \\(update it with /plugin update acdev@m\\)\\nrun \\(dry\\): `);
  const asArray = runCli(p, ['--dry-run'], { CLAUDE_CONFIG_DIR: configWith([{ version: '0.0.1' }]) });
  assert.equal(asArray.status, 0, asArray.stderr);
  assert.match(asArray.stdout, warning);
  const asObject = runCli(p, ['--dry-run'], { CLAUDE_CONFIG_DIR: configWith({ version: '0.0.1' }) });
  assert.equal(asObject.status, 0, asObject.stderr);
  assert.match(asObject.stdout, warning);
  // Same version, no acdev entry at all, and no installed_plugins.json: no warning.
  for (const dir of [configWith([{ version: OWN_VERSION }]), configWith(undefined), NO_PLUGINS]) {
    const quiet = runCli(p, ['--dry-run'], { CLAUDE_CONFIG_DIR: dir });
    assert.equal(quiet.status, 0, quiet.stderr);
    assert.match(quiet.stdout, /^run \(dry\): /);
    assert.doesNotMatch(quiet.stdout, /warning/);
  }
});

test('cost summary counts closed slices by commit movement', () => {
  const entries = [
    { iteration: 1, slice: '1: a', turns: 5, input_tokens: 100, output_tokens: 50, cache_read: 0, cost_usd: 0.1, commit_before: 'a', commit_after: 'b', stop: null },
    { iteration: 2, slice: '2: b', turns: 5, input_tokens: 100, output_tokens: 50, cache_read: 0, cost_usd: 0.1, commit_before: 'b', commit_after: 'b', stop: 'no progress' }
  ];
  const s = summarizeLedger(entries);
  assert.equal(s.closed, 1);
  assert.equal(s.total.cost_usd, 0.2);
  assert.match(renderCost(entries), /per closed slice: \$0\.200, 300 total \/ 300 fresh tokens/);
  assert.match(renderCost([]), /no \.acdev\/cost\.jsonl yet/);
});
