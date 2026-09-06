// Drift candidates: which docs mention the files this slice changed. The
// close reads this list instead of diffing the slice against every
// normative document. Over-inclusive by design: a false candidate costs a
// glance, a silent miss costs a stale document.
import { join, basename, extname, relative } from 'node:path';
import { readIf, listMd, slashes, changedFiles } from './project.mjs';

const DOC_PREFIXES = ['docs/', '.acdev/', 'mockups/', '.claude/'];
const GENERIC = new Set(['index', 'main', 'app', 'mod', 'lib', 'utils', 'util', 'types', 'test', 'tests', 'spec', 'config', 'setup', 'readme', 'package', 'src']);

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

export function driftCandidates(root, files = changedFiles(root)) {
  const ids = identifiersFor(files);
  const docs = listMd(join(root, 'docs')).map((p) => slashes(relative(root, p)))
    .filter((d) => !d.startsWith('docs/plans/') && d !== 'docs/README.md');
  const hits = [];
  for (const doc of docs) {
    const text = readIf(join(root, doc)) ?? '';
    const found = [...ids.keys()].filter((id) => text.includes(id));
    if (found.length) hits.push({ doc, ids: found });
  }
  const roadmap = 'docs/ROADMAP.md';
  if (docs.includes(roadmap) && !hits.some((h) => h.doc === roadmap)) hits.push({ doc: roadmap, ids: ['phase state, always'] });
  return { files, candidates: hits };
}

export function renderDrift({ files, candidates }) {
  const codeFiles = files.filter((f) => !DOC_PREFIXES.some((p) => f.startsWith(p)) && !f.endsWith('.md'));
  const out = [`drift: ${codeFiles.length} code file(s) changed`];
  if (!candidates.length) out.push('  no docs mention them (nothing to check)');
  for (const c of candidates) out.push(`  ${c.doc}: ${c.ids.slice(0, 6).join(', ')}${c.ids.length > 6 ? `, +${c.ids.length - 6}` : ''}`);
  return out.join('\n');
}
