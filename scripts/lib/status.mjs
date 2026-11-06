// The resume snapshot in one command: state, latest checkpoint, open plans,
// the current ROADMAP phase, the guard and what continues from here. About
// 1k tokens, so a status check costs the model one tool call instead of a
// checkpoint read, a ROADMAP read and a plans grep. Read-only; never scans
// the code.
import { readState, latestCheckpoint, openPlans, roadmapPhase, productDoc, norm } from './project.mjs';
import { guardStatusLine } from './guard.mjs';

const cap = (text, maxLines) => {
  const lines = norm(text).split('\n');
  return lines.length <= maxLines ? lines.join('\n') : `${lines.slice(0, maxLines).join('\n')}\n  (+${lines.length - maxLines} more lines, open the file if needed)`;
};

// What continues from each stage. new-project and onboard are user-run:
// the model names the command, the user types it.
function continueLine(stage, { doc, plans, blocked }) {
  if (blocked) return 'blocked: put the question in blocked_on to the user and wait; nothing is planned, built or closed until they answer';
  if (plans.some((p) => /-incident-/.test(p))) return `an open incident outranks any slice: ${plans.find((p) => /-incident-/.test(p))} (build skill, incidents)`;
  switch (stage) {
    case 'intake':
    case 'product':
      return `${doc} is being conversed and its gate is open; the user runs /acdev:new-project to continue`;
    case 'mvp':
      return `${doc} is approved; docs/MVP.md is being cut. The user runs /acdev:new-project to continue`;
    case 'mockups':
      return 'docs/MVP.md is approved; the mockups skill builds and gates the visual contract';
    case 'blueprint':
      return 'the blueprint skill records the decisions, the ROADMAP and the repo mechanics, then gates';
    case 'build':
      return 'the build skill: plan or continue the slice named in next_step';
    default:
      return 'unknown stage; the user runs /acdev:onboard (existing code) or /acdev:new-project (empty repo)';
  }
}

export function renderStatus(root) {
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
  out.push('', guardStatusLine(root));
  out.push(`to continue: ${continueLine(state.stage, { doc: productDoc(root), plans, blocked: ckpt?.fields?.blocked_on })}`);
  if (productDoc(root) === 'docs/VISION.md') out.push('legacy: this project still keeps docs/VISION.md; `acdev migrate` shows what moving it to docs/PRODUCT.md would change');
  return out.join('\n');
}
