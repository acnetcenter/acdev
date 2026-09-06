// The step dispenser: reads the project's state and prints only the step
// that applies now, from scripts/steps/<id>.md, with <plugin-root> filled
// in. A skill body used to carry every step of every situation; this
// carries one, about 300 tokens, chosen deterministically.
import { join } from 'node:path';
import { readIf, readState, latestCheckpoint, openPlans, changedFiles, isGitRepo, slashes, STAGES } from './project.mjs';

const PHASE_EXIT = /\b(phase[- ]exit|phase gate|exit criteria|salida de fase|fin de fase|cierre de fase)\b/i;

// Pure: the situation -> the step id. Kept separate so it is testable
// without a project on disk.
export function chooseStep({ hasAcdev, stage, checkpoint, plans, dirty, change }) {
  if (!hasAcdev) return 'no-project';
  if (!STAGES.includes(stage)) return 'no-project';
  if (stage !== 'build') return `stage-${stage}`;
  if (plans.some((p) => /-incident-/.test(p))) return 'build-incident';
  const f = checkpoint?.fields ?? {};
  if (f.blocked_on) return 'build-blocked';
  if (change) return 'build-change';
  if (f.next_step && PHASE_EXIT.test(f.next_step)) return 'build-phase-exit';
  return dirty ? 'build-construct' : 'build-plan';
}

export function situation(root, { change = null } = {}) {
  const state = readState(root);
  const checkpoint = state ? latestCheckpoint(root, state) : null;
  const plans = state ? openPlans(root) : [];
  const dirty = state && isGitRepo(root) ? changedFiles(root).some((f) => !f.startsWith('.acdev/')) : false;
  return { hasAcdev: Boolean(state), stage: state?.stage ?? null, state, checkpoint, plans, dirty, change };
}

export function renderNext(root, { pluginRoot, change = null } = {}) {
  const s = situation(root, { change });
  const id = chooseStep(s);
  const step = readIf(join(pluginRoot, 'scripts', 'steps', `${id}.md`));
  if (step === null) return `acdev next: step file missing: scripts/steps/${id}.md`;
  const head = [`acdev next: ${id}`];
  if (s.state) {
    const f = s.checkpoint?.fields ?? {};
    head.push(`stage ${s.stage}${f.slice ? ` | slice ${f.slice}` : ''}${f.plan ? ` | plan ${f.plan}` : ''}${s.dirty ? ' | uncommitted changes' : ''}`);
    if (f.next_step) head.push(`next_step: ${f.next_step}`);
    if (f.blocked_on) head.push(`blocked_on: ${f.blocked_on}`);
    if (s.plans.length) head.push(`open plans: ${s.plans.join(', ')}`);
    if (change) head.push(`change: ${change}`);
  }
  const body = step.replaceAll('<plugin-root>', slashes(pluginRoot)).replaceAll('<change>', change ?? '<topic>').trim();
  return `${head.join('\n')}\n\n${body}`;
}
