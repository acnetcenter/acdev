// The slice context pack: everything a slice needs from the repo, in one
// command and about 2k tokens, instead of the orchestrator reading ADRs,
// ROADMAP, checkpoints and mockups wholesale. Decision lines, not documents.
import { join, relative, basename } from 'node:path';
import { readIf, readState, latestCheckpoint, openPlans, roadmapPhase, listMd, slashes, tokens, norm } from './project.mjs';
import { loadProfile, renderChecklists } from './checklist.mjs';
import { specSections } from './mockup-spec.mjs';

const cap = (text, maxLines) => {
  const lines = norm(text).split('\n');
  return lines.length <= maxLines ? lines.join('\n') : `${lines.slice(0, maxLines).join('\n')}\n  (+${lines.length - maxLines} more lines, open the file if needed)`;
};

export function adrDecisions(root, { max = 40 } = {}) {
  const dir = join(root, 'docs', 'adr');
  const out = [];
  for (const p of listMd(dir)) {
    const raw = readIf(p) ?? '';
    const title = raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? basename(p, '.md');
    const status = raw.match(/^-\s*Status:\s*(.+)$/m)?.[1]?.trim() ?? 'unknown';
    if (/superseded/i.test(status)) continue;
    const decision = raw.match(/^##\s+Decision\s*\n([\s\S]*?)(?=\n##\s|\s*$)/m)?.[1]?.trim().replace(/\s+/g, ' ') ?? '(no Decision section)';
    out.push(`- ${title} [${status}]: ${decision}`);
    if (out.length >= max) {
      out.push(`- (+more ADRs beyond ${max}; open docs/adr/ if a decision is missing)`);
      break;
    }
  }
  return out;
}

export function specEntries(root, screens) {
  const spec = readIf(join(root, 'mockups', 'SPEC.md'));
  const sections = specSections(spec);
  const out = [];
  for (const s of screens) {
    const name = s.replace(/\.html$/, '');
    if (spec === null) out.push(`## ${name}.html\n  (mockups/SPEC.md missing; run mockup-spec --write at the freeze, or open mockups/${name}.html)`);
    else {
      const body = sections.get(`${name}.html`) ?? sections.get(name);
      out.push(body ? `## ${name}.html\n${body}` : `## ${name}.html\n  (not in mockups/SPEC.md; open mockups/${name}.html)`);
    }
  }
  return out;
}

// The first `:root { ... }` block of mockups/styles.css, capped: the frontend
// copies the file into the stack's token file, so the pack shows the values
// instead of UI-DESIGN transcribing them. Comments go first: a brace inside
// one would otherwise end the block early.
export function designTokens(root, { maxLines = 60 } = {}) {
  const css = readIf(join(root, 'mockups', 'styles.css'));
  if (css === null) return null;
  const block = norm(css).replace(/\/\*[\s\S]*?\*\//g, '').match(/:root\s*\{[^}]*\}/);
  if (!block) return '(mockups/styles.css has no :root block)';
  return cap(block[0], maxLines);
}

export function buildPack(root, { pluginRoot, screens = [], layers = [], pitfalls = false } = {}) {
  const state = readState(root);
  const out = ['# acdev pack'];
  if (!state) {
    out.push('no .acdev/ in this project: nothing to pack. Offer /acdev:onboard (existing code) or /acdev:new-project (empty repo).');
    return out.join('\n');
  }
  out.push(`state: stage ${state.stage ?? '?'}, language ${state.language ?? 'unknown'}`);
  const ckpt = latestCheckpoint(root, state);
  if (ckpt) {
    const f = ckpt.fields;
    out.push('', `## checkpoint (${ckpt.path})`, `branch: ${f.branch ?? '?'} | slice: ${f.slice || '(none)'} | plan: ${f.plan ?? 'null'}`, `next_step: ${f.next_step ?? '?'}`, `blocked_on: ${f.blocked_on ?? 'null'}`);
    if (f.files_modified?.length) out.push(`files_modified: ${f.files_modified.join(', ')}`);
    if (ckpt.prose) out.push(cap(ckpt.prose, 10));
  } else out.push('', '## checkpoint', '(none)');
  const plans = openPlans(root);
  out.push('', `## open plans (${plans.length})`, ...(plans.length ? plans.map((p) => `- ${p}`) : ['(none)']));
  const phase = roadmapPhase(root);
  out.push('', '## roadmap phase');
  out.push(phase ? `${phase.heading}\n${cap(phase.body, 40)}` : '(docs/ROADMAP.md missing or without phase headings)');
  const adrs = adrDecisions(root);
  out.push('', `## adr decisions (${adrs.length})`, ...(adrs.length ? adrs : ['(no docs/adr/)']));
  const profile = loadProfile(root);
  out.push('', `## profile`, profile ? `tags: ${profile.tags.join(', ') || '(none)'}` : '(no .acdev/profile.json; every checklist item applies)');
  if (screens.length) out.push('', '## mockup spec', ...specEntries(root, screens));
  if (layers.includes('frontend')) {
    const tokensBlock = designTokens(root);
    if (tokensBlock !== null) out.push('', '## design tokens (mockups/styles.css)', tokensBlock);
  }
  if (layers.length) out.push('', renderChecklists(pluginRoot, layers, profile, { pitfalls }));
  const text = out.join('\n');
  return `${text}\n\npack: ${text.length} chars (~${tokens(text.length)} tokens)`;
}
