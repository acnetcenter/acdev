// The outer loop: continuous build as one fresh headless session per
// slice. Memory is git plus the checkpoints; nothing is carried between
// iterations, so no context grows and nothing is compacted. Each session's
// cost lands in .acdev/cost.jsonl, which is where the plugin's token claims
// get their numbers.
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { latestCheckpoint, git, slashes, readJsonIf } from './project.mjs';
import { readLedger } from './cost.mjs';

const PHASE_EXIT = /\b(phase[- ]exit|phase gate|exit criteria|salida de fase|fin de fase|cierre de fase)\b/i;
// The per-iteration cap when the ledger has nothing to derive one from.
export const DEFAULT_BUDGET_USD = 5;
const MCP_CONFIG = '.acdev/headless-mcp.json';

export function defaultPrompt(pluginRoot) {
  return [
    `Run: node "${slashes(pluginRoot)}/scripts/acdev.mjs" next`,
    'Follow the step it prints. Build exactly one slice and close it with the close command the step names, or write a --blocked checkpoint if a user-challenge decision or a plan-invalidating trap stops you.',
    'Then stop. Do not start another slice in this session.'
  ].join(' ');
}

// The headless result is the last JSON object on stdout; anything before
// it (a banner, a warning) is ignored.
export function parseResult(stdout) {
  const s = String(stdout ?? '').trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    const lines = s.split('\n').reverse();
    for (const l of lines) {
      const t = l.trim();
      if (!t.startsWith('{')) continue;
      try {
        return JSON.parse(t);
      } catch {
        // keep looking
      }
    }
    return null;
  }
}

// Twice the median iteration cost in the ledger, never below the default:
// a normal slice never trips it, a looping one cannot run for two hours.
export function defaultBudget(root) {
  const costs = readLedger(root).map((e) => e.cost_usd).filter((c) => typeof c === 'number' && c > 0).sort((a, b) => a - b);
  if (!costs.length) return DEFAULT_BUDGET_USD;
  const mid = Math.floor(costs.length / 2);
  const median = costs.length % 2 ? costs[mid] : (costs[mid - 1] + costs[mid]) / 2;
  return Math.max(DEFAULT_BUDGET_USD, Math.round(median * 2 * 100) / 100);
}

export function claudeCommand({ claude = 'claude', model = null, extra = '', budgetUsd = null, isolate = true, mcpConfig = null }) {
  const flags = ['-p', '--output-format', 'json', ...(model ? ['--model', model] : []), ...extra.split(' ').filter(Boolean)];
  if (budgetUsd) flags.push('--max-budget-usd', String(budgetUsd));
  // The static system prompt stays a cache read across iterations when the
  // per-session sections (cwd, git status, date) live in the first user
  // message instead; the step and the pack already carry the tree state.
  if (isolate) flags.push('--exclude-dynamic-system-prompt-sections');
  // Only the MCP servers the build needs, never the whole environment.
  if (mcpConfig) flags.push('--strict-mcp-config', '--mcp-config', mcpConfig);
  // The claude CLI installs as a .cmd shim on Windows, which needs a shell;
  // a single string avoids DEP0190. The prompt always travels on stdin.
  if (process.platform === 'win32') return { cmd: `${claude} ${flags.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(' ')}`, args: [], shell: true };
  const [c, ...rest] = claude.split(' ').filter(Boolean);
  return { cmd: c, args: [...rest, ...flags], shell: false };
}

const sum = (...vals) => (vals.some((v) => typeof v === 'number') ? vals.reduce((n, v) => n + (typeof v === 'number' ? v : 0), 0) : null);

export function usageOf(result) {
  const u = result?.usage ?? {};
  const input = u.input_tokens ?? null;
  const output = u.output_tokens ?? null;
  const read = u.cache_read_input_tokens ?? null;
  const create = u.cache_creation_input_tokens ?? null;
  return {
    cost_usd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
    input_tokens: input,
    output_tokens: output,
    cache_read: read,
    cache_create: create,
    // total is every token the session processed (each turn re-reads the
    // context); fresh is what was not a cache read.
    total_tokens: sum(input, output, read, create),
    fresh_tokens: sum(input, output, create),
    model_usage: result?.modelUsage ?? null,
    turns: result?.num_turns ?? null,
    duration_ms: result?.duration_ms ?? null,
    session_id: result?.session_id ?? null
  };
}

const BUDGET = /max.?budget|budget.*(exceed|reach)/i;

export function stopReason({ result, before, after, iteration, maxSlices }) {
  if (!result) return 'no result (claude printed no JSON)';
  if (result.is_error && (BUDGET.test(String(result.subtype ?? '')) || BUDGET.test(String(result.result ?? '')))) {
    return `budget exceeded: ${String(result.result ?? result.subtype ?? '').slice(0, 200)}`;
  }
  if (result.is_error) return `error: ${String(result.result ?? '').slice(0, 200)}`;
  if (after?.fields?.blocked_on) return `blocked: ${after.fields.blocked_on}`;
  if (!after || after.path === before?.path) return 'no progress (no new checkpoint; the slice did not close)';
  if (after.fields?.next_step && PHASE_EXIT.test(after.fields.next_step)) return `phase exit reached (${after.fields.next_step})`;
  if (iteration >= maxSlices) return `max slices (${maxSlices}) reached`;
  return null;
}

// The whole process tree, because killing the direct child alone leaves
// whatever it spawned spending: on Windows the shell shim is the child and
// claude its grandchild (taskkill /t); elsewhere claude is spawned as the
// leader of its own process group (see runClaude) and the group is
// signalled, which reaches its test runners and MCP servers too.
export function killTree(pid) {
  if (!pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }
}

// One headless session: prompt on stdin, stdout collected, the tree killed
// at the timeout. Resolves, never rejects.
export function runClaude({ cmd, args, shell, cwd, input, env, timeoutMs }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let child;
    // A detached child no longer shares the terminal's process group, so
    // an interrupted loop must take its session down itself.
    const onSignal = (sig) => {
      killTree(child?.pid);
      process.exit(sig === 'SIGINT' ? 130 : 143);
    };
    const finish = (status, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      resolve({ stdout, stderr, status, error, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child?.pid);
    }, timeoutMs);
    try {
      // Own process group on POSIX so killTree can signal the whole tree;
      // on Windows the shell shim is the tree's root and taskkill /t walks it.
      child = spawn(cmd, args, { cwd, shell, env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    } catch (err) {
      finish(null, err);
      return;
    }
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => finish(null, err));
    child.on('close', (code) => finish(code, null));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

// The headless session loads whatever acdev is installed in Claude Code,
// not necessarily the tree this CLI runs from; say so when they differ.
export function versionMismatch(pluginRoot) {
  const own = readJsonIf(join(pluginRoot, 'package.json'))?.version;
  const dir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
  const installed = readJsonIf(join(dir, 'plugins', 'installed_plugins.json'))?.plugins ?? {};
  const key = Object.keys(installed).find((k) => k.startsWith('acdev@'));
  const entry = key ? installed[key] : null;
  const version = Array.isArray(entry) ? entry[0]?.version : entry?.version;
  if (!own || !version || own === version) return null;
  return `the installed acdev plugin is ${version} but this CLI is ${own}; the headless session loads the installed plugin's skills and hooks (update it with /plugin update ${key})`;
}

export async function runLoop(root, { pluginRoot, maxSlices = 10, model = null, claude = 'claude', extra = '', prompt = null, dryRun = false, timeoutMin = 120, budgetUsd = null, isolate = true, mcpConfig = null, log = console.log, env = process.env }) {
  const text = prompt ?? defaultPrompt(pluginRoot);
  const budget = budgetUsd === null ? defaultBudget(root) : budgetUsd > 0 ? budgetUsd : null;
  // An explicit --mcp-config always applies; the auto-detected one is part
  // of the isolation that --no-isolate switches off.
  const mcp = mcpConfig ?? (isolate && existsSync(join(root, MCP_CONFIG)) ? MCP_CONFIG : null);
  const { cmd, args, shell } = claudeCommand({ claude, model, extra, budgetUsd: budget, isolate, mcpConfig: mcp });
  const mismatch = versionMismatch(pluginRoot);
  if (mismatch) log(`run: warning: ${mismatch}`);
  if (dryRun) {
    log(`run (dry): ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`);
    log(`prompt on stdin: ${text}`);
    log(`budget: ${budget ? `$${budget} per iteration (--max-budget-usd)` : 'none'}`);
    if (mcpConfig) log(`mcp: ${mcpConfig} (--mcp-config)`);
    else if (mcp) log(`mcp: ${mcp} (auto-detected; --strict-mcp-config)`);
    return { iterations: 0, reason: 'dry run' };
  }
  mkdirSync(join(root, '.acdev'), { recursive: true });
  const ledger = join(root, '.acdev', 'cost.jsonl');
  let reason = null;
  let i = 0;
  while (!reason) {
    i++;
    const before = latestCheckpoint(root);
    const head = git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim() || null;
    const started = Date.now();
    const r = await runClaude({ cmd, args, shell, cwd: root, input: text, env, timeoutMs: timeoutMin * 60 * 1000 });
    const result = r.timedOut
      ? { is_error: true, result: `timeout after ${timeoutMin} min (process tree killed)` }
      : r.error ? { is_error: true, result: `spawn error: ${r.error.message}` } : parseResult(r.stdout);
    const after = latestCheckpoint(root);
    reason = stopReason({ result, before, after, iteration: i, maxSlices });
    const entry = {
      date: new Date().toISOString(), iteration: i, slice: after?.fields?.slice ?? null, plan: after?.fields?.plan ?? null,
      commit_before: head, commit_after: git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim() || null,
      ...usageOf(result), budget_usd: budget, wall_ms: Date.now() - started, stop: reason
    };
    if (entry.duration_ms === null) entry.duration_ms = entry.wall_ms;
    appendFileSync(ledger, JSON.stringify(entry) + '\n');
    const cost = entry.cost_usd === null ? 'cost n/a' : `$${entry.cost_usd.toFixed(3)}`;
    log(`run ${i}: ${after?.fields?.slice || '(no slice)'} | ${entry.turns ?? '?'} turns | in ${entry.input_tokens ?? '?'} out ${entry.output_tokens ?? '?'} total ${entry.total_tokens ?? '?'} | ${cost}${reason ? ` | stop: ${reason}` : ''}`);
    if (!reason && r.status !== 0) reason = `claude exited ${r.status}`;
  }
  return { iterations: i, reason };
}
