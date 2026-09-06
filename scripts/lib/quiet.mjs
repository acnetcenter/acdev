// The quiet runner: a command's output enters the context as its verdict,
// never as its log. Green prints the summary lines a test runner, linter or
// typechecker ends with, plus the last lines; red prints the failure lines
// and a tail. --full streams everything. The same filter, inlined, lives in
// the guard template's verify (the guard is self-contained by design).
import { spawnSync } from 'node:child_process';

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
export const stripAnsi = (s) => String(s ?? '').replace(ANSI, '');

// Lines a runner prints as its verdict: counts, totals, TAP summaries.
const SUMMARY = /\b\d+\s+(passed|passing|failed|failing|pending|skipped|todo|problems?|errors?|warnings?|tests?|specs?|examples?)\b|^#\s+(tests|pass|fail|suites|skipped|todo|cancelled)\s+\d+|\bTests?:|\bTest Files\b|\bTest Suites:|\btest result:|\bPassed!|\bFailed!|^ok\s+\S|^FAIL\b|^PASS\b|✖|\bDuration\b|\bTime:/i;
// Lines that explain a red run: the assertion, the error, the stack head.
const FAILURE = /\b(fail|failed|failing|error|errors|exception|assert|assertion|expected|received|actual|not ok|panic|traceback|denied|cannot|unhandled)\b|✗|×|✖|^\s+at\s+\S+\s+\(/i;

const dedupe = (lines) => {
  const seen = new Set();
  return lines.filter((l) => {
    const k = l.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

export function summarize(output, { ok, exit, tail = 30, ms = null, full = false } = {}) {
  const text = stripAnsi(output).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim());
  const meta = `exit ${exit ?? (ok ? 0 : 1)}, ${lines.length} line(s)${ms !== null ? `, ${(ms / 1000).toFixed(1)}s` : ''}`;
  if (full) return `${text.trimEnd()}\nq: ${ok ? 'OK' : 'FAIL'} (${meta})`;
  if (ok) {
    const summary = dedupe(lines.filter((l) => SUMMARY.test(l))).slice(-12);
    const last = dedupe(lines.slice(-3).filter((l) => !summary.includes(l)));
    const body = [...summary, ...last].map((l) => `  ${l.trim()}`);
    return [`q: OK (${meta})`, ...body].join('\n');
  }
  const failures = dedupe(lines.filter((l) => FAILURE.test(l))).slice(0, 40);
  const tailLines = lines.slice(-tail);
  const out = [`q: FAIL (${meta})`];
  if (failures.length) out.push(`--- failure lines (first ${failures.length}) ---`, ...failures.map((l) => `  ${l.trimEnd()}`));
  out.push(`--- tail (last ${tailLines.length} line(s)) ---`, ...tailLines.map((l) => `  ${l.trimEnd()}`));
  return out.join('\n');
}

// Runs one shell command, captures stdout+stderr together, returns the
// verdict text. The child gets no stdin so an interactive prompt fails fast.
export function runQuiet(command, { cwd = process.cwd(), tail = 30, full = false, env = process.env } = {}) {
  const started = Date.now();
  const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const ms = Date.now() - started;
  const output = `${r.stdout ?? ''}${r.stderr ? `\n${r.stderr}` : ''}${r.error ? `\nspawn error: ${r.error.message}` : ''}`;
  const status = r.status ?? 1;
  return { status, output, ms, summary: summarize(output, { ok: status === 0, exit: status, tail, ms, full }) };
}
