// Shared readers for the acdev CLI: where the project and the plugin are,
// what .acdev/ says, what git says. Every function is read-only and
// returns null instead of throwing when the thing is simply not there.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const STAGES = ['intake', 'vision', 'mvp', 'mockups', 'blueprint', 'build'];
export const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n');
export const slashes = (p) => String(p).replace(/\\/g, '/');
export const tokens = (chars) => Math.round(chars / 4);

export function pluginRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}
// CLAUDE_PROJECT_DIR points at the project root even when the session was
// launched from a subdirectory; cwd is the fallback outside Claude Code.
export function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
}
export function readIf(path) {
  try {
    return existsSync(path) ? norm(readFileSync(path, 'utf8')) : null;
  } catch {
    return null;
  }
}
export function readJsonIf(path) {
  const raw = readIf(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readState(root) {
  const raw = readIf(join(root, '.acdev', 'state.md'));
  if (raw === null) return null;
  const field = (k) => raw.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
  return { raw, stage: field('stage'), updated: field('updated'), language: field('language'), latest_checkpoint: field('latest_checkpoint') };
}

// Checkpoint frontmatter values are JSON-encoded by checkpoint.mjs; a hand
// written checkpoint may hold bare text, which is kept as is.
const unjson = (v) => {
  if (v === undefined || v === null) return null;
  const t = v.trim();
  if (t === 'null') return null;
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
};
export function parseCheckpoint(raw) {
  const text = norm(raw);
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fields: {}, prose: text.trim() };
  const fields = {};
  for (const line of m[1].split('\n')) {
    const f = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!f) continue;
    if (f[1] === 'files_modified') {
      fields.files_modified = unjson(f[2]) ?? [];
      if (!Array.isArray(fields.files_modified)) fields.files_modified = [];
    } else fields[f[1]] = unjson(f[2]);
  }
  return { fields, prose: text.slice(m[0].length).trim() };
}
export function latestCheckpoint(root, state = readState(root)) {
  const dir = join(root, '.acdev', 'checkpoints');
  let file = null;
  if (state?.latest_checkpoint && existsSync(join(root, state.latest_checkpoint))) file = join(root, state.latest_checkpoint);
  if (!file && existsSync(dir)) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.md'))
      .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs })).sort((x, y) => x.t - y.t);
    if (files.length) file = join(dir, files.at(-1).f);
  }
  if (!file) return null;
  const raw = readIf(file);
  if (raw === null) return null;
  return { path: slashes(relative(root, file)), raw, ...parseCheckpoint(raw) };
}

// Open plans by name, incidents first: an open incident outranks any slice.
export function openPlans(root) {
  const dir = join(root, 'docs', 'plans');
  if (!existsSync(dir)) return [];
  const names = readdirSync(dir).filter((f) => f.endsWith('.md')).filter((f) => {
    const raw = readIf(join(dir, f)) ?? '';
    return /^status:\s*active\s*$/m.test(raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '');
  });
  const isIncident = (f) => /-incident-/.test(f);
  return names.sort((a, b) => Number(isIncident(b)) - Number(isIncident(a)) || a.localeCompare(b)).map((f) => `docs/plans/${f}`);
}

export function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}
export function isGitRepo(root) {
  return git(root, ['rev-parse', '--is-inside-work-tree']).status === 0;
}
export function currentBranch(root) {
  const r = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : null;
}
// Tracked changes versus HEAD plus untracked files, forward slashes.
export function changedFiles(root) {
  const out = new Set();
  const diff = git(root, ['diff', '--name-only', 'HEAD']);
  if (diff.status === 0) diff.stdout.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => out.add(slashes(f)));
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']);
  if (untracked.status === 0) untracked.stdout.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => out.add(slashes(f)));
  return [...out].sort();
}

// The current ROADMAP phase: the first phase heading without a completion
// marker in the heading itself ("Phase 1 (complete)"), else the first one.
const PHASE_HEADING = /^(#{2,4})\s+.*\b(phase|fase|etapa)\b.*$/i;
const COMPLETE = /\b(complete|completed|done|shipped|completad[ao]|terminad[ao]|cerrad[ao])\b/i;
export function roadmapPhase(root) {
  const raw = readIf(join(root, 'docs', 'ROADMAP.md'));
  if (raw === null) return null;
  const lines = raw.split('\n');
  const heads = [];
  lines.forEach((l, i) => {
    const m = l.match(PHASE_HEADING);
    if (m) heads.push({ i, level: m[1].length, text: l.trim() });
  });
  if (!heads.length) return null;
  const pick = heads.find((h) => !COMPLETE.test(h.text)) ?? heads[0];
  const end = lines.findIndex((l, i) => i > pick.i && /^#{1,6}\s/.test(l) && (l.match(/^#+/)[0].length <= pick.level));
  const body = lines.slice(pick.i + 1, end < 0 ? lines.length : end).join('\n').trim();
  return { heading: pick.text, body, complete: COMPLETE.test(pick.text) };
}

export function listMd(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  }
  return out.sort();
}
