// The slice close as two commands. `close --check` reports what the close
// will need (drift candidates, changelog, plan, index, freeze, lessons)
// without running anything expensive; `close` verifies, does the
// bookkeeping, writes the checkpoint and commits, refusing on any red.
// What used to be ten tool calls read out of a skill body is two.
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readIf, readJsonIf, readState, git, isGitRepo, currentBranch, changedFiles, latestCheckpoint, slashes, norm } from './project.mjs';
import { runQuiet, summarize } from './quiet.mjs';
import { driftCandidates, renderDrift } from './drift.mjs';

const GUARD = '.claude/hooks/acdev-guard.mjs';

export function guardConfig(root) {
  const cfg = readJsonIf(join(root, '.acdev', 'guard.json')) ?? {};
  return {
    verify: Array.isArray(cfg.verify) ? cfg.verify : [],
    changelog: { path: cfg.changelog?.path ?? 'CHANGELOG.md', section: cfg.changelog?.section ?? '## [Unreleased]' }
  };
}

// Verification: the guard's verify when the guard is installed (it writes
// the receipt the hook checks), else the configured commands through the
// quiet runner. Unconfigured warns and passes, exactly as the hook does.
export function verifyProject(root, { full = false, tail = 30 } = {}) {
  const cfg = guardConfig(root);
  const guard = join(root, GUARD);
  if (existsSync(guard)) {
    const r = spawnSync(process.execPath, [guard, 'verify', ...(full ? ['--full'] : [])], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    const out = `${r.stdout ?? ''}${r.stderr ? `\n${r.stderr}` : ''}`.trim();
    return { ok: r.status === 0, evidence: out || `(guard verify exited ${r.status})`, via: 'guard' };
  }
  if (!cfg.verify.length) return { ok: true, unconfigured: true, evidence: 'verify: no commands configured in .acdev/guard.json (fill "verify" at blueprint); closing unverified', via: 'none' };
  const lines = [];
  for (const cmd of cfg.verify) {
    const r = runQuiet(cmd, { cwd: root, full, tail });
    lines.push(`$ ${cmd}`, r.summary);
    if (r.status !== 0) return { ok: false, evidence: lines.join('\n'), via: 'config' };
  }
  return { ok: true, evidence: lines.join('\n'), via: 'config' };
}

export function appendChangelog(root, line, cfg = guardConfig(root)) {
  const path = join(root, cfg.changelog.path);
  const section = cfg.changelog.section;
  let text = readIf(path);
  if (text === null) text = `# Changelog\n\n${section}\n\n`;
  if (!text.includes(section)) {
    const h1 = text.match(/^# .*\n/m);
    text = h1 ? text.replace(h1[0], `${h1[0]}\n${section}\n\n`) : `${section}\n\n${text}`;
  }
  const at = text.indexOf(section) + section.length;
  const after = text.slice(at);
  const rest = after.replace(/^\n+/, '');
  // Newest first, directly above the existing bullets; a blank line before
  // anything else (a subsection, the next release heading, the end).
  const gap = rest.startsWith('- ') ? '\n' : rest ? '\n\n' : '\n';
  text = `${text.slice(0, at)}\n\n- ${line}${gap}${rest}`;
  writeFileSync(path, text.replace(/\n{3,}/g, '\n\n'));
  return slashes(relative(root, path));
}

export function flipPlan(root, plan) {
  const path = join(root, plan);
  const raw = readIf(path);
  if (raw === null) return { ok: false, note: `${plan} not found` };
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return { ok: false, note: `${plan} has no frontmatter (expected status: active)` };
  if (/^status:\s*shipped\s*$/m.test(m[1])) return { ok: true, note: `${plan} already shipped` };
  if (!/^status:\s*active\s*$/m.test(m[1])) return { ok: false, note: `${plan} status is not active` };
  writeFileSync(path, raw.replace(/^status:\s*active\s*$/m, 'status: shipped'));
  return { ok: true, note: `${plan}: status active -> shipped` };
}

// A singleton doc added or removed under docs/ needs the index touched in
// the same commit; series folders (plans, adr, designs, domain) never do.
export function indexStatus(root) {
  const index = join(root, 'docs', 'README.md');
  if (!existsSync(index)) return { ok: true, note: 'docs/README.md absent (no index convention); skipped' };
  const st = git(root, ['status', '--porcelain']);
  if (st.status !== 0) return { ok: true, note: 'git status unavailable; skipped' };
  const added = [];
  let indexTouched = false;
  for (const line of st.stdout.split('\n')) {
    if (!line.trim()) continue;
    const code = line.slice(0, 2);
    const file = slashes(line.slice(3).trim().replace(/^"|"$/g, ''));
    if (file === 'docs/README.md') indexTouched = true;
    else if (/^docs\/[^/]+\.md$/.test(file) && /[AD?]/.test(code)) added.push(file);
  }
  if (!added.length || indexTouched) return { ok: true, note: added.length ? 'docs/README.md updated with the new docs' : 'no singleton docs added or removed' };
  return { ok: false, note: `docs/README.md not updated after adding/removing ${added.join(', ')}` };
}

export function freezeStatus(root) {
  const f = readJsonIf(join(root, '.acdev', 'freeze.json'));
  return f?.paths?.length ? { active: true, paths: f.paths, reason: f.reason ?? '' } : { active: false };
}
export function lessonsStatus(root) {
  const raw = readIf(join(root, '.acdev', 'lessons.md')) ?? '';
  const rows = raw.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l));
  const promoted = rows.filter((l) => /\|\s*promoted\s*\|/i.test(l)).length;
  return { candidates: rows.length - promoted, promoted };
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
  const cfg = guardConfig(root);
  const guard = existsSync(join(root, GUARD));
  out.push(`  verify: ${guard ? `guard installed (${cfg.verify.length} command(s))` : cfg.verify.length ? `${cfg.verify.length} command(s) in guard.json` : 'NOT CONFIGURED (closes unverified; fill guard.json verify)'}; runs at close`);
  if (opts.verify) {
    const v = verifyProject(root, { full: opts.full, tail: opts.tail });
    out.push(`  verify now: ${v.ok ? 'GREEN' : 'RED'}`, ...v.evidence.split('\n').map((l) => `    ${l}`));
  }
  out.push(renderDrift(driftCandidates(root, files)).split('\n').map((l, i) => (i ? `  ${l}` : `  ${l}`)).join('\n'));
  const cl = readIf(join(root, cfg.changelog.path));
  out.push(`  changelog: ${cl === null ? `${cfg.changelog.path} will be created` : cl.includes(cfg.changelog.section) ? `${cfg.changelog.path} has ${cfg.changelog.section}` : `${cfg.changelog.section} will be added to ${cfg.changelog.path}`}; pass --changelog "<what shipped>"`);
  if (opts.plan) {
    const raw = readIf(join(root, opts.plan));
    out.push(`  plan: ${raw === null ? `${opts.plan} NOT FOUND` : `${opts.plan} status ${raw.match(/^status:\s*(.+)$/m)?.[1] ?? 'missing'}`}`);
  } else out.push('  plan: pass --plan <docs/plans/...> (omit only for a trivial fix)');
  const idx = indexStatus(root);
  out.push(`  index: ${idx.ok ? 'ok' : 'NEEDS UPDATE'} (${idx.note})`);
  const fz = freezeStatus(root);
  out.push(`  freeze: ${fz.active ? `active on ${fz.paths.join(', ')} (${fz.reason}); cleared at close` : 'none'}`);
  const ls = lessonsStatus(root);
  out.push(`  lessons: ${ls.candidates} candidate(s), ${ls.promoted} promoted; add or bump one before close if this slice repeated a mistake`);
  return { ok: idx.ok, text: out.join('\n') };
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
  // 1. verification, first and always: nothing below runs on a red tree.
  const v = verifyProject(root, { full: opts.full, tail: opts.tail });
  out.push(`  verify: ${v.ok ? (v.unconfigured ? 'UNCONFIGURED' : 'GREEN') : 'RED'} (${v.via})`, ...v.evidence.split('\n').map((l) => `    ${l}`));
  if (!v.ok) return fail('verification is red; fix it and run close again, or write a --blocked checkpoint');
  // 2. docs bookkeeping; the receipt ignores these paths so nothing stales.
  const idx = indexStatus(root);
  if (!idx.ok) return fail(`${idx.note}; update the index in this close`);
  out.push(`  index: ${idx.note}`);
  const cfg = guardConfig(root);
  const clLine = opts.plan ? `${opts.changelog} ([plan](${opts.plan}))` : opts.changelog;
  out.push(`  changelog: appended to ${appendChangelog(root, clLine, cfg)} under ${cfg.changelog.section}`);
  if (opts.plan) {
    const p = flipPlan(root, opts.plan);
    if (!p.ok) return fail(p.note);
    out.push(`  plan: ${p.note}`);
  } else out.push('  plan: none (trivial fix; the CHANGELOG line is its trace)');
  const fz = freezeStatus(root);
  if (fz.active) {
    unlinkSync(join(root, '.acdev', 'freeze.json'));
    out.push(`  freeze: cleared (${fz.paths.join(', ')})`);
  }
  const ls = lessonsStatus(root);
  out.push(`  lessons: ${ls.candidates} candidate(s), ${ls.promoted} promoted`);
  // 3. checkpoint, through the script that owns the format.
  const ckptScript = join(opts.pluginRoot, 'scripts', 'checkpoint.mjs');
  const args = [ckptScript, 'write', '--stage', 'build', '--branch', branch ?? 'HEAD', '--slice', opts.slice, '--files', files.join(','), '--next', opts.next];
  if (opts.plan) args.push('--plan', opts.plan);
  if (opts.notes) args.push('--notes', opts.notes);
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
  return { ok: true, text: out.join('\n') };
}

export { summarize, norm, readFileSync };
