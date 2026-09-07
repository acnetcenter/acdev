// The resume snapshot in one command: state, latest checkpoint, open plans
// and the current ROADMAP phase, about 1k tokens, so a status check costs
// the model one tool call instead of a checkpoint read, a ROADMAP read and
// a plans grep. Read-only; never scans the code.
import { readState, latestCheckpoint, openPlans, roadmapPhase, slashes, norm } from './project.mjs';

// Same cap as pack.mjs: kept local so status does not pull the checklist
// rendering that pack imports.
const cap = (text, maxLines) => {
  const lines = norm(text).split('\n');
  return lines.length <= maxLines ? lines.join('\n') : `${lines.slice(0, maxLines).join('\n')}\n  (+${lines.length - maxLines} more lines, open the file if needed)`;
};

export function renderStatus(root, { pluginRoot } = {}) {
  const state = readState(root);
  const out = ['# acdev status'];
  if (!state) {
    out.push('no .acdev/ in this project: nothing to report and no stage to infer from the code. Offer /acdev:onboard (existing code) or /acdev:new-project (empty repo).');
    return out.join('\n');
  }
  const version = state.raw.match(/^acdev_version:\s*(.+)$/m)?.[1]?.trim() ?? '?';
  out.push(`state: stage ${state.stage ?? '?'} | updated ${state.updated ?? '?'} | acdev_version ${version} | language ${state.language ?? 'unknown'}`);
  const ckpt = latestCheckpoint(root, state);
  if (ckpt) {
    const f = ckpt.fields;
    out.push('', `## checkpoint (${ckpt.path})`, `branch: ${f.branch ?? '?'} | slice: ${f.slice || '(none)'} | plan: ${f.plan ?? 'null'}`, `next_step: ${f.next_step ?? '?'}`, `blocked_on: ${f.blocked_on ?? 'null'}`);
    if (f.files_modified?.length) out.push(`files_modified: ${f.files_modified.join(', ')}`);
    if (ckpt.prose) out.push(cap(ckpt.prose, 10));
  } else out.push('', '## checkpoint', '(none)');
  const plans = openPlans(root);
  out.push('', `## open plans (${plans.length}; incidents first)`, ...(plans.length ? plans.map((p) => `- ${p}`) : ['(none)']));
  const phase = roadmapPhase(root);
  out.push('', '## roadmap phase');
  out.push(phase ? `${phase.heading}\n${cap(phase.body, 40)}` : '(docs/ROADMAP.md missing or without phase headings)');
  out.push('', `to continue: node "${slashes(pluginRoot ?? '<plugin-root>')}/scripts/acdev.mjs" next`);
  return out.join('\n');
}
