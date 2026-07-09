#!/usr/bin/env node
// Structure and budget lint for acdev skills. Approximation: 1 token = 4 chars.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = process.env.ACDEV_SKILLS_DIR ?? join(ROOT, 'skills');
const DESCRIPTION_MAX_CHARS = 400;   // ~100 tokens
const BODY_MAX_LINES = 500;
const BODY_MAX_CHARS = 20000;        // ~5k tokens
const GATEWAY_MAX_CHARS = 1600;      // ~400 tokens, whole file
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const LAYER_REQUIRED_HEADINGS = ['## Production checklist', '## Pitfalls', '## How to verify'];

const errors = [];
if (!existsSync(SKILLS_DIR)) {
  console.error(`lint-budgets: skills dir not found: ${SKILLS_DIR}`);
  process.exit(1);
}
const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
for (const dir of dirs) {
  const path = join(SKILLS_DIR, dir.name, 'SKILL.md');
  const label = `skills/${dir.name}`;
  if (!existsSync(path)) {
    errors.push(`${label}: missing SKILL.md`);
    continue;
  }
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    errors.push(`${label}: missing frontmatter`);
    continue;
  }
  const fm = m[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name) errors.push(`${label}: frontmatter missing "name"`);
  else if (name !== dir.name) errors.push(`${label}: name "${name}" != directory "${dir.name}"`);
  if (!desc) errors.push(`${label}: frontmatter missing "description"`);
  else if (desc.length > DESCRIPTION_MAX_CHARS) errors.push(`${label}: description ${desc.length} chars > ${DESCRIPTION_MAX_CHARS}`);
  const body = raw.slice(m[0].length);
  const lines = body.split('\n').length;
  if (lines > BODY_MAX_LINES) errors.push(`${label}: body ${lines} lines > ${BODY_MAX_LINES}`);
  if (body.length > BODY_MAX_CHARS) errors.push(`${label}: body ${body.length} chars > ${BODY_MAX_CHARS}`);
  if (dir.name === 'using-acdev' && raw.length > GATEWAY_MAX_CHARS) errors.push(`${label}: gateway ${raw.length} chars > ${GATEWAY_MAX_CHARS}`);
  if (EMOJI.test(raw)) errors.push(`${label}: contains emoji`);
  if (dir.name.startsWith('layer-')) {
    for (const h of LAYER_REQUIRED_HEADINGS) {
      if (!body.includes(h)) errors.push(`${label}: missing required heading "${h}"`);
    }
  }
}
if (errors.length) {
  console.error(`lint-budgets: ${errors.length} violation(s)\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`lint-budgets: OK (${dirs.length} skills checked)`);
