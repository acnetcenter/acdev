// Layer checklists filtered by the project's profile. A checklist item that
// opens with a tag marker ("[multi-tenant] ...", "[payments,jobs] ...")
// applies only when .acdev/profile.json lists one of those tags. Untagged
// items always apply. No profile file means everything applies: filtering
// is opt-in per project, never a silent loss of a rule.
import { join } from 'node:path';
import { readIf, readJsonIf, norm } from './project.mjs';

export const LAYERS = ['frontend', 'api', 'data', 'auth', 'security', 'performance', 'delivery', 'cicd'];
const TAG_MARKER = /^\[([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*)\]\s*/;

export function loadProfile(root) {
  const p = readJsonIf(join(root, '.acdev', 'profile.json'));
  if (!p || !Array.isArray(p.tags)) return null;
  return { tags: p.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean), notes: p.notes ?? null };
}

// Bullets under a heading, multi-line continuations joined with a space.
function bullets(body, heading) {
  const section = norm(body).split(/^## /m).map((s) => `## ${s}`).find((s) => s.startsWith(`## ${heading}`));
  if (!section) return [];
  const out = [];
  for (const line of section.split('\n').slice(1)) {
    if (/^- /.test(line)) out.push(line.slice(2).trim());
    else if (/^\s+\S/.test(line) && out.length) out[out.length - 1] += ` ${line.trim()}`;
  }
  return out.map((text) => {
    const m = text.match(TAG_MARKER);
    return { text: m ? text.slice(m[0].length) : text, tags: m ? m[1].split(',').map((t) => t.trim().toLowerCase()) : [] };
  });
}

export function parseLayerSkill(raw) {
  return { items: bullets(raw, 'Production checklist'), pitfalls: bullets(raw, 'Pitfalls') };
}

export function filterItems(items, profile) {
  if (!profile) return { kept: items, skipped: [] };
  const has = new Set(profile.tags);
  const kept = [];
  const skipped = [];
  for (const it of items) (it.tags.length === 0 || it.tags.some((t) => has.has(t)) ? kept : skipped).push(it);
  return { kept, skipped };
}

export function renderChecklists(pluginRoot, layers, profile, { pitfalls = false } = {}) {
  const out = [];
  const unknown = layers.filter((l) => !LAYERS.includes(l));
  if (unknown.length) throw new Error(`unknown layer(s): ${unknown.join(', ')} (expected ${LAYERS.join(', ')})`);
  out.push(profile ? `profile tags: ${profile.tags.join(', ') || '(none)'}` : 'profile: none (.acdev/profile.json missing; every item applies)');
  for (const layer of layers) {
    const raw = readIf(join(pluginRoot, 'skills', `layer-${layer}`, 'SKILL.md'));
    if (raw === null) throw new Error(`skills/layer-${layer}/SKILL.md not found`);
    const { items, pitfalls: pits } = parseLayerSkill(raw);
    const { kept, skipped } = filterItems(items, profile);
    const skippedTags = [...new Set(skipped.flatMap((s) => s.tags))];
    out.push('', `## layer-${layer} checklist (${kept.length} of ${items.length} items${skipped.length ? `; skipped by profile: ${skippedTags.join(', ')}` : ''})`);
    for (const it of kept) out.push(`- ${it.text}`);
    if (pitfalls && pits.length) {
      out.push('', `## layer-${layer} pitfalls`);
      for (const p of pits) out.push(`- ${p.text}`);
    }
  }
  return out.join('\n');
}
