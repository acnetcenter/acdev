// The quiet runner: a command's output enters the context as its verdict,
// never as its log. Green prints the summary lines a test runner, linter or
// typechecker ends with, plus the last lines; red prints the failure lines
// and a tail. --full streams everything. The same filter, inlined, lives in
// the guard template's verify (the guard is self-contained by design).
import { spawnSync } from 'node:child_process';

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*[A-Za-z]/g;
export const stripAnsi = (s) => String(s ?? '').replace(ANSI, '');

// --- shared with shared/references/templates/guard-hook.mjs (verdictLines) ---
// The guard is copied into projects file by file, so this block is duplicated
// there instead of imported; tests/guard-quiet-parity.test.mjs keeps the two
// copies producing the same text. Change both or neither.
// Lines a runner prints as its verdict: counts, totals, TAP summaries.
const SUMMARY = /\b\d+\s+(passed|passing|failed|failing|pending|skipped|todo|problems?|errors?|warnings?|tests?|specs?|examples?)\b|^#\s+(tests|pass|fail|suites|skipped|todo|cancelled)\s+\d+|\bTests?:|\bTest Files\b|\bTest Suites:|\btest result:|\bPassed!|\bFailed!|^ok\s+\S|^FAIL\b|^PASS\b|✖|\bDuration\b|\bTime:/i;
// Lines that explain a red run: the assertion, the error, the stack head.
const FAILURE = /\b(fail|failed|failing|error|errors|exception|assert|assertion|expected|received|actual|not ok|panic|traceback|denied|cannot|unhandled)\b|✗|×|✖|^\s+at\s+\S+\s+\(/i;
// Stack frames, and the ones that point outside the project's own code.
const FRAME = /^\s+at\s/;
const VENDOR = /node_modules[\\/]|\bdist[\\/]|\bnode:/;

const dedupe = (lines) => {
  const seen = new Set();
  return lines.filter((l) => {
    const k = l.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// The failure lines of a red log. A failing test starts at a non-frame
// failure line; its frames follow. Project frames are capped at two per test
// because the third never names a new file; vendor frames are dropped, except
// the first one when the test has no project frame at all (the only lead).
function failureLines(lines) {
  const out = [];
  let project = 0;
  let vendor = null;
  const flush = () => {
    if (!project && vendor) out.push(vendor);
    project = 0;
    vendor = null;
  };
  for (const l of lines) {
    if (!FAILURE.test(l)) continue;
    if (!FRAME.test(l)) {
      flush();
      out.push(l);
    } else if (VENDOR.test(l)) {
      vendor ??= l;
    } else if (project < 2) {
      project++;
      out.push(l);
    }
  }
  flush();
  return out;
}

// Body lines of a verdict: green keeps the summary lines plus the last three;
// red keeps the failure lines and a tail of at most ten lines that the failure
// section has not already shown, so a red never repeats itself. Vendor frames
// stay out of the tail too: dropped above, they must not resurface below.
function verdictLines(lines, ok, tail) {
  if (ok) {
    const summary = dedupe(lines.filter((l) => SUMMARY.test(l))).slice(-12);
    const last = dedupe(lines.slice(-3).filter((l) => !summary.includes(l)));
    return [...summary, ...last].map((l) => `  ${l.trim()}`);
  }
  const failures = dedupe(failureLines(lines)).slice(0, 40);
  const printed = new Set(failures.map((l) => l.trim()));
  const tailLines = dedupe(lines.slice(-Math.min(tail, 10))).filter((l) => !printed.has(l.trim()) && !(FRAME.test(l) && VENDOR.test(l)));
  const out = [];
  if (failures.length) out.push(`--- failure lines (first ${failures.length}) ---`, ...failures.map((l) => `  ${l.trimEnd()}`));
  out.push(`--- tail (last ${tailLines.length} line(s)) ---`, ...tailLines.map((l) => `  ${l.trimEnd()}`));
  return out;
}
// --- end of the shared block ---

export function summarize(output, { ok, exit, tail = 30, ms = null, full = false } = {}) {
  const text = stripAnsi(output).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim());
  const meta = `exit ${exit ?? (ok ? 0 : 1)}, ${lines.length} line(s)${ms !== null ? `, ${(ms / 1000).toFixed(1)}s` : ''}`;
  if (full) return `${text.trimEnd()}\nq: ${ok ? 'OK' : 'FAIL'} (${meta})`;
  return [`q: ${ok ? 'OK' : 'FAIL'} (${meta})`, ...verdictLines(lines, ok, tail)].join('\n');
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
