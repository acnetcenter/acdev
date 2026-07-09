#!/usr/bin/env node
// Structure and budget lint for acdev skills. Approximation: 1 token = 4 chars.
// With ACDEV_SKILLS_DIR set (test fixtures), only the skills-dir checks run;
// against the real tree it also lints shared/, the manifests and README drift.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = process.env.ACDEV_SKILLS_DIR ?? join(ROOT, 'skills');
const REPO_CHECKS = !process.env.ACDEV_SKILLS_DIR;
const DESCRIPTION_MAX_CHARS = 400;   // ~100 tokens
const BODY_MAX_LINES = 500;
const BODY_MAX_CHARS = 20000;        // ~5k tokens
const GATEWAY_MAX_CHARS = 1600;      // ~400 tokens, whole file
// Extended_Pictographic plus the pieces it does not cover: regional
// indicators (country flags), VS16 and the keycap combiner. The lookahead
// exempts (c) (r) (tm), which are text, not emoji.
const EMOJI = /(?![©®™])(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}])/u;
const LAYER_REQUIRED_HEADINGS = ['## Production checklist', '## Pitfalls', '## How to verify'];
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const norm = (s) => s.replace(/\r\n/g, '\n');
const fmt = (n) => n.toLocaleString('en-US');

const errors = [];
if (!existsSync(SKILLS_DIR)) {
  console.error(`lint-budgets: skills dir not found: ${SKILLS_DIR}`);
  process.exit(1);
}

function mdFilesUnder(base) {
  if (!existsSync(base)) return [];
  const out = [];
  const stack = [base];
  while (stack.length) {
    const d = stack.pop();
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.name.endsWith('.md')) out.push(p);
    }
  }
  return out;
}
const label = (p, base) => relative(base, p).replaceAll('\\', '/');

const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
if (dirs.length === 0) errors.push('skills dir contains no skill directories');

const skills = []; // { name, desc } for repo-level drift checks
for (const dir of dirs) {
  const path = join(SKILLS_DIR, dir.name, 'SKILL.md');
  const lbl = `skills/${dir.name}`;
  if (!existsSync(path)) {
    errors.push(`${lbl}: missing SKILL.md`);
    continue;
  }
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(FRONTMATTER);
  if (!m) {
    errors.push(`${lbl}: missing frontmatter`);
    continue;
  }
  const fm = m[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name) errors.push(`${lbl}: frontmatter missing "name"`);
  else if (name !== dir.name) errors.push(`${lbl}: name "${name}" != directory "${dir.name}"`);
  if (!desc) errors.push(`${lbl}: frontmatter missing "description"`);
  else if (desc.length > DESCRIPTION_MAX_CHARS) errors.push(`${lbl}: description ${desc.length} chars > ${DESCRIPTION_MAX_CHARS}`);
  const body = raw.slice(m[0].length);
  const lines = body.split('\n').length;
  if (lines > BODY_MAX_LINES) errors.push(`${lbl}: body ${lines} lines > ${BODY_MAX_LINES}`);
  if (norm(body).length > BODY_MAX_CHARS) errors.push(`${lbl}: body ${norm(body).length} chars > ${BODY_MAX_CHARS}`);
  if (dir.name === 'using-acdev' && norm(raw).length > GATEWAY_MAX_CHARS) errors.push(`${lbl}: gateway ${norm(raw).length} chars > ${GATEWAY_MAX_CHARS}`);
  if (EMOJI.test(raw)) errors.push(`${lbl}: contains emoji`);
  if (dir.name.startsWith('layer-')) {
    for (const h of LAYER_REQUIRED_HEADINGS) {
      if (!body.includes(h)) errors.push(`${lbl}: missing required heading "${h}"`);
    }
  }
  if (name && desc) skills.push({ name, desc, raw, body, dir: dir.name });
}

// The layer skills repeat two shared blocks by design (each skill loads in
// isolation); this guards that an edit to one of them reaches all of them.
const layerSkills = skills.filter((s) => s.dir.startsWith('layer-'));
if (layerSkills.length > 1) {
  const variants = new Map();
  for (const l of layerSkills) {
    const t = norm(l.body).match(/## Before advising\n([\s\S]*?)(?=\n## )/)?.[1]?.trim() ?? '<missing>';
    if (!variants.has(t)) variants.set(t, []);
    variants.get(t).push(l.dir);
  }
  if (variants.size > 1) {
    const groups = [...variants.values()].map((v) => v.join(', ')).join('  vs  ');
    errors.push(`layer skills "Before advising" blocks diverge: ${groups}`);
  }
}
// "How to verify" may vary per layer, but every variant must keep the shared
// verify-probe mechanism sentence (whitespace-collapsed: line wrapping differs).
const PROBE_SENTENCE = 'run the `verify:` probe attached to each checklist item';
for (const l of layerSkills) {
  if (!norm(l.body).replace(/\s+/g, ' ').includes(PROBE_SENTENCE)) {
    errors.push(`skills/${l.dir}: "How to verify" is missing the shared verify-probe sentence`);
  }
}

// The no-emoji rule covers references and templates too, not only SKILL.md.
const scanned = new Set(dirs.map((d) => join(SKILLS_DIR, d.name, 'SKILL.md')));
for (const p of mdFilesUnder(SKILLS_DIR)) {
  if (scanned.has(p)) continue; // already scanned above
  if (EMOJI.test(readFileSync(p, 'utf8'))) errors.push(`skills/${label(p, SKILLS_DIR)}: contains emoji`);
}

if (REPO_CHECKS) {
  for (const p of mdFilesUnder(join(ROOT, 'shared'))) {
    if (EMOJI.test(readFileSync(p, 'utf8'))) errors.push(`${label(p, ROOT)}: contains emoji`);
  }

  // Manifests must parse, and the values duplicated across them must agree.
  const manifest = (rel) => {
    try {
      return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
    } catch (err) {
      errors.push(`${rel}: invalid JSON (${err.message})`);
      return null;
    }
  };
  const plugin = manifest('.claude-plugin/plugin.json');
  const marketplace = manifest('.claude-plugin/marketplace.json');
  const pkg = manifest('package.json');
  if (plugin && pkg && plugin.version !== pkg.version) {
    errors.push(`version drift: plugin.json ${plugin.version} != package.json ${pkg.version}`);
  }
  if (plugin && marketplace && plugin.description !== marketplace.plugins?.[0]?.description) {
    errors.push('description drift: plugin.json != marketplace.json plugins[0]');
  }

  // README drift: the skill tables and the token ledger must match the tree.
  const readme = norm(readFileSync(join(ROOT, 'README.md'), 'utf8'));
  const names = new Set(skills.map((s) => s.name));
  for (const s of skills) {
    const row = `| \`${s.name}\` | ${s.desc} |`;
    if (!readme.includes(row)) errors.push(`README.md: skill table row for "${s.name}" missing or out of date`);
  }
  // The reverse direction: a table row whose skill no longer exists on disk.
  for (const m of readme.matchAll(/^\| `([a-z][a-z0-9-]*)` \|/gm)) {
    if (!names.has(m[1])) errors.push(`README.md: skill table row for "${m[1]}" refers to a skill that does not exist`);
  }
  for (const needle of [`## The ${skills.length} skills`, `the ${skills.length} \`description:\` frontmatter lines`]) {
    if (!readme.includes(needle)) errors.push(`README.md: stale skill count (expected "${needle}")`);
  }
  const gateway = skills.find((s) => s.name === 'using-acdev');
  if (gateway) {
    const sumDesc = skills.reduce((n, s) => n + s.desc.length, 0);
    // Measure what the hook actually injects: the body, frontmatter stripped.
    const gatewayLen = norm(gateway.body).trim().length;
    const total = sumDesc + gatewayLen;
    const ledger = [
      [`Sum of the ${skills.length} \`description:\` values: **${fmt(sumDesc)} characters**`, 'description sum'],
      [`gateway body as injected by the hook (frontmatter stripped): **${fmt(gatewayLen)} characters**`, 'gateway size'],
      [`Total fixed cost: **${fmt(total)} characters**`, 'total fixed cost'],
      [`**~${fmt(Math.round(total / 4))} tokens/session**`, 'token estimate']
    ];
    for (const [needle, what] of ledger) {
      if (!readme.includes(needle)) errors.push(`README.md: token ledger ${what} is stale (expected "${needle}")`);
    }
  } else {
    errors.push('skills/using-acdev: gateway skill missing (SessionStart hook and README ledger depend on it)');
  }
}

if (errors.length) {
  console.error(`lint-budgets: ${errors.length} violation(s)\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`lint-budgets: OK (${dirs.length} skills checked)`);
