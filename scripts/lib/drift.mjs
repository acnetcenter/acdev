// Drift candidates: which docs mention the files this slice changed, and
// where. The close reads this list instead of diffing the slice against
// every normative document, and each candidate carries its matching lines
// (grep -n style, capped) so the close decides from the list instead of
// opening every doc. Over-inclusive by design: a false candidate costs a
// glance, a silent miss costs a stale document.
import { join, basename, extname, relative } from 'node:path';
import { readIf, listMd, slashes, changedFiles, roadmapPhase } from './project.mjs';

const DOC_PREFIXES = ['docs/', '.acdev/', 'mockups/', '.claude/'];
const GENERIC = new Set(['index', 'main', 'app', 'mod', 'lib', 'utils', 'util', 'types', 'test', 'tests', 'spec', 'config', 'setup', 'readme', 'package', 'src']);
// The routers name probes and files in promoted lesson bullets; a code
// change that renames one must surface there too.
const ROOT_DOCS = ['CLAUDE.md', 'AGENTS.md'];
const ROADMAP = 'docs/ROADMAP.md';
export const MAX_LINES = 3;
export const LINE_CUT = 120;

export function identifiersFor(files) {
  const ids = new Map(); // identifier -> files
  for (const f of files) {
    if (DOC_PREFIXES.some((p) => f.startsWith(p)) || f.endsWith('.md')) continue;
    const base = basename(f, extname(f)).replace(/\.(test|spec)$/, '');
    const add = (id) => {
      if (!ids.has(id)) ids.set(id, new Set());
      ids.get(id).add(f);
    };
    add(f);
    if (base.length >= 4 && !GENERIC.has(base.toLowerCase())) add(base);
  }
  return ids;
}

// The first lines of a doc that mention any identifier, numbered from 1,
// trimmed and cut so a candidate never costs more than three short lines.
export function matchingLines(text, ids, { max = MAX_LINES, cut = LINE_CUT } = {}) {
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && out.length < max; i++) {
    if (ids.some((id) => lines[i].includes(id))) out.push({ n: i + 1, text: lines[i].trim().slice(0, cut) });
  }
  return out;
}

// The current ROADMAP phase heading with its line number: what the close
// checks on the roadmap is the phase state, not a mention.
export function roadmapPhaseLine(root) {
  const phase = roadmapPhase(root);
  if (!phase) return [];
  const raw = readIf(join(root, ROADMAP)) ?? '';
  const n = raw.split('\n').findIndex((l) => l.trim() === phase.heading) + 1;
  return [{ n, text: phase.heading.slice(0, LINE_CUT) }];
}

export function driftCandidates(root, files = changedFiles(root)) {
  const ids = identifiersFor(files);
  const docs = [
    ...listMd(join(root, 'docs')).map((p) => slashes(relative(root, p))).filter((d) => !d.startsWith('docs/plans/') && d !== 'docs/README.md'),
    ...ROOT_DOCS.filter((d) => readIf(join(root, d)) !== null)
  ];
  const hits = [];
  for (const doc of docs) {
    const text = readIf(join(root, doc)) ?? '';
    const found = [...ids.keys()].filter((id) => text.includes(id));
    if (found.length) hits.push({ doc, ids: found, lines: matchingLines(text, found) });
  }
  if (docs.includes(ROADMAP) && !hits.some((h) => h.doc === ROADMAP)) hits.push({ doc: ROADMAP, ids: ['phase state, always'], lines: roadmapPhaseLine(root) });
  return { files, candidates: hits };
}

export function renderDrift({ files, candidates }) {
  const codeFiles = files.filter((f) => !DOC_PREFIXES.some((p) => f.startsWith(p)) && !f.endsWith('.md'));
  const out = [`drift: ${codeFiles.length} code file(s) changed`];
  if (!candidates.length) out.push('  no docs mention them (nothing to check)');
  for (const c of candidates) {
    out.push(`  ${c.doc}: ${c.ids.slice(0, 6).join(', ')}${c.ids.length > 6 ? `, +${c.ids.length - 6}` : ''}`);
    for (const l of c.lines ?? []) out.push(`    ${l.n}: ${l.text}`);
  }
  return out.join('\n');
}
