// The outer loop: continuous build as one fresh headless session per
// slice. Memory is git plus the checkpoints; nothing is carried between
// iterations, so no context grows and nothing is compacted. Each session's
// cost lands in .acdev/cost.jsonl, which is where the plugin's token claims
// get their numbers.
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { latestCheckpoint, git, slashes } from './project.mjs';

const PHASE_EXIT = /\b(phase[- ]exit|phase gate|exit criteria|salida de fase|fin de fase|cierre de fase)\b/i;

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

export function claudeCommand({ claude = 'claude', model = null, extra = '' }) {
  const flags = ['-p', '--output-format', 'json', ...(model ? ['--model', model] : []), ...extra.split(' ').filter(Boolean)];
  // The claude CLI installs as a .cmd shim on Windows, which needs a shell;
  // a single string avoids DEP0190. The prompt always travels on stdin.
  if (process.platform === 'win32') return { cmd: `${claude} ${flags.join(' ')}`, args: [], shell: true };
  const [c, ...rest] = claude.split(' ').filter(Boolean);
  return { cmd: c, args: [...rest, ...flags], shell: false };
}

export function usageOf(result) {
  const u = result?.usage ?? {};
  return {
    cost_usd: typeof result?.total_cost_usd === 'number' ? result.total_cost_usd : null,
    input_tokens: u.input_tokens ?? null,
    output_tokens: u.output_tokens ?? null,
    cache_read: u.cache_read_input_tokens ?? null,
    cache_create: u.cache_creation_input_tokens ?? null,
    turns: result?.num_turns ?? null,
    duration_ms: result?.duration_ms ?? null,
    session_id: result?.session_id ?? null
  };
}

export function stopReason({ result, before, after, iteration, maxSlices }) {
  if (!result) return 'no result (claude printed no JSON)';
  if (result.is_error) return `error: ${String(result.result ?? '').slice(0, 200)}`;
  if (after?.fields?.blocked_on) return `blocked: ${after.fields.blocked_on}`;
  if (!after || after.path === before?.path) return 'no progress (no new checkpoint; the slice did not close)';
  if (after.fields?.next_step && PHASE_EXIT.test(after.fields.next_step)) return `phase exit reached (${after.fields.next_step})`;
  if (iteration >= maxSlices) return `max slices (${maxSlices}) reached`;
  return null;
}

export function runLoop(root, { pluginRoot, maxSlices = 10, model = null, claude = 'claude', extra = '', prompt = null, dryRun = false, timeoutMin = 120, log = console.log, env = process.env }) {
  const text = prompt ?? defaultPrompt(pluginRoot);
  const { cmd, args, shell } = claudeCommand({ claude, model, extra });
  if (dryRun) {
    log(`run (dry): ${cmd}${args.length ? ` ${args.join(' ')}` : ''}`);
    log(`prompt on stdin: ${text}`);
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
    const r = spawnSync(cmd, args, { cwd: root, shell, encoding: 'utf8', input: text, env, timeout: timeoutMin * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    const result = r.error?.code === 'ETIMEDOUT' ? { is_error: true, result: `timeout after ${timeoutMin} min` } : parseResult(r.stdout);
    const after = latestCheckpoint(root);
    reason = stopReason({ result, before, after, iteration: i, maxSlices });
    const entry = {
      date: new Date().toISOString(), iteration: i, slice: after?.fields?.slice ?? null, plan: after?.fields?.plan ?? null,
      commit_before: head, commit_after: git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim() || null,
      ...usageOf(result), wall_ms: Date.now() - started, stop: reason
    };
    if (entry.duration_ms === null) entry.duration_ms = entry.wall_ms;
    appendFileSync(ledger, JSON.stringify(entry) + '\n');
    const cost = entry.cost_usd === null ? 'cost n/a' : `$${entry.cost_usd.toFixed(3)}`;
    log(`run ${i}: ${after?.fields?.slice || '(no slice)'} | ${entry.turns ?? '?'} turns | in ${entry.input_tokens ?? '?'} out ${entry.output_tokens ?? '?'} | ${cost}${reason ? ` | stop: ${reason}` : ''}`);
    if (!reason && r.status !== 0) reason = `claude exited ${r.status}`;
  }
  return { iterations: i, reason };
}
