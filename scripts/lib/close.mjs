// The slice close as two commands. `close --check` reports what the close
// will need (drift candidates, changelog, plan) without running anything
// expensive; `close` verifies, does the bookkeeping, writes the checkpoint
// and commits, refusing on any red.
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readIf, readState, git, isGitRepo, currentBranch, changedFiles, slashes } from './project.mjs';
import { loadGuardConfig, verify } from './guard.mjs';
import { driftCandidates, renderDrift } from './drift.mjs';

// The close is where a context can be dropped safely: the state, the plan
// and the commit hold everything the next slice needs.
export const CUT_NOTE = 'context: this slice is on disk (state, plan, commit); a fresh session (/clear) resumes from the session-start line and costs less than carrying this one';

// A file is written back with the line terminator it had: a one-line
// change must not turn into a whole-file line-ending diff.
const readRaw = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);
const eolOf = (raw) => (raw?.includes('\r\n') ? '\r\n' : '\n');

// Adds one bullet under the section, newest first. Idempotent: a close
// that failed after this point and is run again does not add it twice.
export function appendChangelog(root, line, cfg = loadGuardConfig(root)) {
  const path = join(root, cfg.changelog.path);
  const section = cfg.changelog.section;
  const raw = readRaw(path);
  const lines = (raw === null ? `# Changelog\n\n${section}\n` : raw.replace(/\r\n/g, '\n')).split('\n');
  // The section is a whole line, never a substring of another heading.
  let at = lines.findIndex((l) => l.trim() === section);
  if (at < 0) {
    const h1 = lines.findIndex((l) => /^# /.test(l));
    const tail = lines.slice(h1 + 1);
    while (tail.length && !tail[0].trim()) tail.shift();
    lines.splice(0, lines.length, ...lines.slice(0, h1 + 1), ...(h1 < 0 ? [] : ['']), section, '', ...tail);
    at = lines.findIndex((l) => l.trim() === section);
  }
  let first = at + 1;
  while (first < lines.length && !lines[first].trim()) first++;
  const rest = lines.slice(first);
  const bullet = `- ${line}`;
  let end = 0;
  while (end < rest.length && rest[end].startsWith('- ')) end++;
  if (!rest.slice(0, end).includes(bullet)) {
    // Directly above the existing bullets; a blank line before anything
    // else (a subsection, the next release heading).
    const gap = rest.some((l) => l.trim()) && !rest[0].startsWith('- ') ? [''] : [];
    lines.splice(at + 1, lines.length - (at + 1), '', bullet, ...gap, ...rest);
  }
  writeFileSync(path, lines.join('\n').replace(/\n*$/, '\n').replace(/\n/g, eolOf(raw)));
  return slashes(relative(root, path));
}

// The plan's state, read-only: the close checks it before it writes
// anything, so a plan that cannot be flipped stops the close clean.
export function planState(root, plan) {
  const raw = readRaw(join(root, plan));
  if (raw === null) return { ok: false, note: `${plan} not found` };
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { ok: false, note: `${plan} has no frontmatter (expected status: active)` };
  if (/^status:\s*shipped\s*$/m.test(fm[1])) return { ok: true, shipped: true, note: `${plan} already shipped` };
  if (!/^status:\s*active\s*$/m.test(fm[1])) return { ok: false, note: `${plan} status is not active` };
  return { ok: true, shipped: false, raw };
}
export function flipPlan(root, plan) {
  const s = planState(root, plan);
  if (!s.ok || s.shipped) return s;
  writeFileSync(join(root, plan), s.raw.replace(/^(status:\s*)active([ \t]*\r?)$/m, '$1shipped$2'));
  return { ok: true, note: `${plan}: status active -> shipped` };
}

// An acdev AGENTS.md is a copy of CLAUDE.md, never a hand-kept mirror: the
// close regenerates it. The copy is recognized by the template's "## Mirror
// note" heading or an explicit marker comment; an AGENTS.md an onboarded
// repo keeps for other agents carries neither and is left alone.
export const MIRROR_MARKERS = [/^## Mirror note\s*$/m, /<!--\s*acdev:\s*copy of CLAUDE\.md\s*-->/];
export function isRouterCopy(text) {
  return typeof text === 'string' && MIRROR_MARKERS.some((re) => re.test(text));
}
export function mirrorAgents(root) {
  const claude = join(root, 'CLAUDE.md');
  const agents = join(root, 'AGENTS.md');
  if (!existsSync(agents)) return null;
  if (!existsSync(claude)) return 'agents: AGENTS.md kept as is (no CLAUDE.md to copy)';
  if (!isRouterCopy(readIf(agents))) return 'agents: AGENTS.md kept as is (not an acdev copy: no "## Mirror note" heading or <!-- acdev: copy of CLAUDE.md --> marker)';
  copyFileSync(claude, agents);
  return 'agents: AGENTS.md regenerated from CLAUDE.md';
}

function commitMessage(slice, message) {
  if (message) return message;
  const n = slice?.match(/^(\d+)\s*:\s*(.+)$/);
  if (n) return `feat: ${n[2].trim()} (slice ${n[1]})`;
  const c = slice?.match(/^change\s*:\s*(.+)$/i);
  if (c) return `fix: ${c[1].trim()} (change)`;
  return `feat: ${slice ?? 'slice'}`;
}

function preconditions(root) {
  const errors = [];
  if (!isGitRepo(root)) errors.push('not a git repository');
  const state = readState(root);
  if (!state) errors.push('no .acdev/state.md (not an acdev project)');
  else if (state.stage !== 'build') errors.push(`stage is "${state.stage}", close is for build slices; gates at other stages commit with their own message`);
  return { errors, state };
}

export function closeCheck(root, opts = {}) {
  const { errors } = preconditions(root);
  const out = ['close --check'];
  if (errors.length) return { ok: false, text: [...out, ...errors.map((e) => `  error: ${e}`)].join('\n') };
  out.push(`  branch: ${currentBranch(root)}`);
  const files = changedFiles(root);
  const stat = git(root, ['diff', '--stat', 'HEAD']).stdout.trim().split('\n').filter(Boolean);
  out.push(`  changed: ${files.length} file(s)`, ...stat.slice(-Math.min(stat.length, 15)).map((l) => `    ${l.trim()}`));
  const cfg = loadGuardConfig(root);
  out.push(`  verify: ${cfg.verify.length ? `${cfg.verify.length} command(s) in .acdev/guard.json` : 'NOT CONFIGURED (closes unverified; fill "verify" in .acdev/guard.json)'}; runs at close`);
  if (opts.verify) {
    const v = verify(root, { full: opts.full, tail: opts.tail });
    out.push(`  verify now: ${v.ok ? (v.unconfigured ? 'UNCONFIGURED' : 'GREEN') : 'RED'}`, ...v.evidence.split('\n').map((l) => `    ${l}`));
  }
  out.push(renderDrift(driftCandidates(root, files)).split('\n').map((l) => `  ${l}`).join('\n'));
  const cl = readIf(join(root, cfg.changelog.path));
  out.push(`  changelog: ${cl === null ? `${cfg.changelog.path} will be created` : cl.includes(cfg.changelog.section) ? `${cfg.changelog.path} has ${cfg.changelog.section}` : `${cfg.changelog.section} will be added to ${cfg.changelog.path}`}; pass --changelog "<what shipped>"`);
  if (opts.plan) {
    const raw = readIf(join(root, opts.plan));
    out.push(`  plan: ${raw === null ? `${opts.plan} NOT FOUND` : `${opts.plan} status ${raw.match(/^status:\s*(.+)$/m)?.[1] ?? 'missing'}`}`);
  } else out.push('  plan: pass --plan <docs/plans/...> (omit only for a small fix that needed no plan)');
  return { ok: true, text: out.join('\n') };
}

export function closeSlice(root, opts) {
  const { errors } = preconditions(root);
  const out = ['close'];
  const fail = (msg) => ({ ok: false, text: [...out, `  BLOCKED: ${msg}`].join('\n') });
  if (errors.length) return fail(errors.join('; '));
  for (const k of ['slice', 'next', 'changelog']) if (!opts[k]) return fail(`missing --${k}`);
  const branch = currentBranch(root);
  const files = changedFiles(root);
  if (!files.length) return fail('nothing to commit (no changes versus HEAD)');
  // Everything that can refuse is checked before anything is written, so a
  // refused close leaves the tree as it found it.
  if (opts.plan) {
    const p = planState(root, opts.plan);
    if (!p.ok) return fail(p.note);
  }
  // 1. verification, first and always: nothing below runs on a red tree.
  const v = verify(root, { full: opts.full, tail: opts.tail });
  out.push(`  verify: ${v.ok ? (v.unconfigured ? 'UNCONFIGURED' : 'GREEN') : 'RED'}`, ...v.evidence.split('\n').map((l) => `    ${l}`));
  if (!v.ok) return fail('verification is red; fix it and run close again, or write a --blocked checkpoint');
  // 2. docs bookkeeping; the receipt ignores these paths so nothing stales.
  const cfg = loadGuardConfig(root);
  const clLine = opts.plan ? `${opts.changelog} ([plan](${opts.plan}))` : opts.changelog;
  out.push(`  changelog: appended to ${appendChangelog(root, clLine, cfg)} under ${cfg.changelog.section}`);
  if (opts.plan) {
    const p = flipPlan(root, opts.plan);
    if (!p.ok) return fail(p.note);
    out.push(`  plan: ${p.note}`);
  } else out.push('  plan: none (small fix; the CHANGELOG line is its trace)');
  const mirrored = mirrorAgents(root);
  if (mirrored) out.push(`  ${mirrored}`);
  // The files list was computed before the mirror: a regenerated AGENTS.md
  // is committed below, so the checkpoint must list it too.
  if (mirrored && !files.includes('AGENTS.md')) {
    const st = git(root, ['status', '--porcelain', '--', 'AGENTS.md']);
    if (st.status === 0 && st.stdout.trim()) files.push('AGENTS.md');
  }
  // 3. checkpoint, through the script that owns the format.
  const ckptScript = join(opts.pluginRoot, 'scripts', 'checkpoint.mjs');
  // --flag=value, so a value that starts with a dash is not read as a flag.
  const args = [ckptScript, 'write', '--stage=build', `--branch=${branch ?? 'HEAD'}`, `--slice=${opts.slice}`, `--files=${files.join(',')}`, `--next=${opts.next}`];
  if (opts.plan) args.push(`--plan=${opts.plan}`);
  if (opts.notes) args.push(`--notes=${opts.notes}`);
  const ck = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  if (ck.status !== 0) return fail(`checkpoint write failed: ${(ck.stderr || ck.stdout).trim()}`);
  out.push(`  checkpoint: ${ck.stdout.trim()}`);
  // 4. one commit per slice.
  const add = git(root, ['add', '-A']);
  if (add.status !== 0) return fail(`git add failed: ${add.stderr.trim()}`);
  const msg = commitMessage(opts.slice, opts.message);
  const commit = git(root, ['commit', '-q', '-m', msg]);
  if (commit.status !== 0) return fail(`git commit failed: ${(commit.stderr || commit.stdout).trim()}`);
  const hash = git(root, ['rev-parse', '--short', 'HEAD']).stdout.trim();
  out.push(`  commit: ${hash} ${msg}`, `  next: ${opts.next}`);
  // A planned slice or change is a natural place to drop the context; a
  // small fix closed without a plan is not worth a new session.
  if (opts.plan) out.push(`  ${CUT_NOTE}`);
  return { ok: true, text: out.join('\n') };
}
