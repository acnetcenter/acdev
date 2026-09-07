#!/usr/bin/env node
// Structure and budget lint for acdev skills. Approximation: 1 token = 4 chars.
// With ACDEV_SKILLS_DIR set (test fixtures), only the skills-dir checks run;
// against the real tree it also lints shared/, the manifests and README drift.
// ACDEV_STEPS_DIR (test fixtures) points the per-file step checks at another
// directory; the completeness check (every dispenser id present) stays
// repo-only. Pointers are always resolved against the real tree.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = process.env.ACDEV_SKILLS_DIR ?? join(ROOT, 'skills');
const REPO_CHECKS = !process.env.ACDEV_SKILLS_DIR;
const STEPS_DIR = process.env.ACDEV_STEPS_DIR ?? join(ROOT, 'scripts', 'steps');
const STEP_CHECKS = REPO_CHECKS || Boolean(process.env.ACDEV_STEPS_DIR);
const DESCRIPTION_MAX_CHARS = 400;   // ~100 tokens
const BODY_MAX_LINES = 250;
const BODY_MAX_CHARS = 8000;         // ~2k tokens; procedure lives in scripts/steps, detail in references
const GATEWAY_MAX_CHARS = 1600;      // ~400 tokens, whole file
const STEP_MAX_CHARS = 1500;         // ~375 tokens, one step of the dispenser
const STEP_IDS = ['no-project', 'stage-intake', 'stage-vision', 'stage-mvp', 'stage-mockups', 'stage-blueprint', 'build-plan', 'build-construct', 'build-blocked', 'build-incident', 'build-phase-exit', 'build-change'];
// The pre-build bodies were thinned by classification: procedure moved to
// the steps and references, rules stayed. A body's cap is its thinned size
// plus about 10 percent, so procedure cannot creep back in; the phrases are
// the gates, user-challenge triggers and format contracts that must stay in
// the body verbatim (the gate evals paste the body and expect them to
// decide). Compared whitespace-collapsed, since line wrapping differs.
const PIPELINE_BODY_MAX = { 'new-project': 5400, mockups: 5500, blueprint: 6000, onboard: 5600 };
const REQUIRED_PHRASES = {
  'new-project': [
    'Do you approve this VISION document?',
    'Ask for explicit approval of the full MVP.md document, the same way as stage 1.',
    'Zero product code',
    'No placeholders anywhere in generated documents.'
  ],
  mockups: [
    'Do you approve these mockups?',
    'The freeze is normative for what the mockups actually draw',
    'is illustrative: `build` decides those as taste-class decisions',
    'Reopening the contract after approval requires re-approval'
  ],
  blueprint: [
    'user-challenge',
    'asked, never assumed',
    'The Decision section is what the pack quotes to every build slice',
    'Only this write unlocks product code',
    "It starts ONLY on the user's explicit order"
  ],
  onboard: [
    'declared gap',
    'Ask for explicit confirmation that the map is accurate before proposing anything.',
    'Never rewrite an existing doc without showing the diff'
  ]
};
// Extended_Pictographic plus the pieces it does not cover: regional
// indicators (country flags), VS16 and the keycap combiner. The lookahead
// exempts (c) (r) (tm), which are text, not emoji.
const EMOJI = /(?![©®™])(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}])/u;
// A layer SKILL.md is a stub (the gate plus how to verify); its items live
// in references/checklist.md, which the checklist command and the pack read.
const LAYER_REQUIRED_HEADINGS = ['## Before advising', '## How to verify'];
const LAYER_CHECKLIST_HEADINGS = ['## Production checklist', '## Pitfalls'];
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

// There is no `acdev` executable: an invocation shape (a subcommand, then
// optional positional tokens, then a flag) written that way sends a
// subagent hunting for a binary. A flag (`--layers`, `-x`) may follow
// positional tokens (`checkpoint write --stage`); the bare `--` separator
// counts only directly after the subcommand (`q -- npm test`), so prose
// such as "acdev close clears the freeze -- and the receipt" stays legal,
// and a closing backtick ends the token walk ("`acdev close` clears it").
const BARE_COMMAND = /(?<![\w/."-])acdev (next|pack|q|close|checklist|drift|run|cost|checkpoint|lessons|mockup-spec|status|scaffold)\b(?=(?: [^\s`-][^\s`]*)* --?[a-z]| --(?![^\s]))/g;
function bareCommands(raw) {
  return [...norm(raw).matchAll(BARE_COMMAND)].map((m) => m[0]);
}

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
  if (dir.name in PIPELINE_BODY_MAX && norm(body).length > PIPELINE_BODY_MAX[dir.name]) {
    errors.push(`${lbl}: body ${norm(body).length} chars > ${PIPELINE_BODY_MAX[dir.name]} (thinned pipeline body; procedure goes to scripts/steps or references/)`);
  }
  if (dir.name in REQUIRED_PHRASES) {
    const flat = norm(body).replace(/\s+/g, ' ');
    for (const phrase of REQUIRED_PHRASES[dir.name]) {
      if (!flat.includes(phrase)) errors.push(`${lbl}: body is missing the required phrase "${phrase}"`);
    }
  }
  if (dir.name === 'using-acdev' && norm(raw).length > GATEWAY_MAX_CHARS) errors.push(`${lbl}: gateway ${norm(raw).length} chars > ${GATEWAY_MAX_CHARS}`);
  if (EMOJI.test(raw)) errors.push(`${lbl}: contains emoji`);
  if (dir.name.startsWith('layer-')) {
    for (const h of LAYER_REQUIRED_HEADINGS) {
      if (!body.includes(h)) errors.push(`${lbl}: missing required heading "${h}"`);
    }
    const checklist = join(SKILLS_DIR, dir.name, 'references', 'checklist.md');
    if (!existsSync(checklist)) errors.push(`${lbl}: missing references/checklist.md (the checklist command reads it)`);
    else {
      const text = readFileSync(checklist, 'utf8');
      for (const h of LAYER_CHECKLIST_HEADINGS) {
        if (!text.includes(h)) errors.push(`${lbl}/references/checklist.md: missing required heading "${h}"`);
      }
    }
  }
  const noModel = /^disable-model-invocation:\s*true$/m.test(fm);
  if (name && desc) skills.push({ name, desc, raw, body, dir: dir.name, noModel });
}

// Lexical overlap between model-invocable descriptions: two skills whose
// trigger vocabularies overlap heavily will collide at activation time.
// Threshold calibrated against the real tree (max legitimate pair: 0.143,
// ship ~ status). The shared-words floor keeps tiny vocabularies from
// false-positiving; an empty union is skipped, not treated as identical.
const OVERLAP_MAX = 0.25;
const MIN_SHARED = 3;
const STOPWORDS = new Set('use when the a an or and to of for with on in is are it this that any every before after from into'.split(' '));
const descWords = (d) => new Set(d.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOPWORDS.has(w)));
const invocable = skills.filter((s) => !s.noModel);
for (let i = 0; i < invocable.length; i++) {
  for (let j = i + 1; j < invocable.length; j++) {
    const a = descWords(invocable[i].desc);
    const b = descWords(invocable[j].desc);
    const inter = [...a].filter((w) => b.has(w)).length;
    const union = a.size + b.size - inter;
    if (union === 0) continue;
    const jaccard = inter / union;
    if (inter >= MIN_SHARED && jaccard > OVERLAP_MAX) {
      errors.push(`description overlap ${jaccard.toFixed(2)} > ${OVERLAP_MAX} between "${invocable[i].dir}" and "${invocable[j].dir}" — their triggers will collide`);
    }
  }
}

// The layer skills repeat two shared blocks by design (each skill loads in
// isolation); this guards that an edit to one of them reaches all of them.
// The only legitimate difference inside "Before advising" is the layer's
// own name in the checklist command, normalized away before comparing.
const layerSkills = skills.filter((s) => s.dir.startsWith('layer-'));
if (layerSkills.length > 1) {
  const variants = new Map();
  for (const l of layerSkills) {
    const t = norm(l.body).match(/## Before advising\n([\s\S]*?)(?=\n## )/)?.[1]?.trim().replace(/--layers [a-z-]+/g, '--layers X') ?? '<missing>';
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
  const raw = readFileSync(p, 'utf8');
  if (!scanned.has(p) && EMOJI.test(raw)) errors.push(`skills/${label(p, SKILLS_DIR)}: contains emoji`);
  for (const bare of bareCommands(raw)) errors.push(`skills/${label(p, SKILLS_DIR)}: "${bare}" names no executable; write node "<plugin-root>/scripts/acdev.mjs" ${bare.slice(6)}`);
}

// The step dispenser: one file per situation `scripts/lib/next.mjs` can
// pick, each under its budget, none with emoji, no orphans.
const stepFiles = STEP_CHECKS && existsSync(STEPS_DIR) ? readdirSync(STEPS_DIR).filter((f) => f.endsWith('.md')) : [];
if (REPO_CHECKS) {
  for (const id of STEP_IDS) {
    if (!stepFiles.includes(`${id}.md`)) errors.push(`scripts/steps/${id}.md: missing (the dispenser can select it)`);
  }
}
if (STEP_CHECKS) {
  for (const f of stepFiles) {
    const raw = norm(readFileSync(join(STEPS_DIR, f), 'utf8'));
    if (!STEP_IDS.includes(f.replace(/\.md$/, ''))) errors.push(`scripts/steps/${f}: not a step the dispenser selects (orphan)`);
    if (raw.length > STEP_MAX_CHARS) errors.push(`scripts/steps/${f}: ${raw.length} chars > ${STEP_MAX_CHARS}`);
    if (EMOJI.test(raw)) errors.push(`scripts/steps/${f}: contains emoji`);
    // A step is read in a headless session with no skill directory in
    // sight: every pointer into the plugin must be absolute (next fills
    // <plugin-root> in) and must resolve, or the model spends turns
    // searching for it. The path class cannot end in a dot, so the full
    // stop of a sentence ("...SKILL.md.") is not captured as part of it.
    for (const m of raw.matchAll(/<plugin-root>\/((?:skills|shared)\/[A-Za-z0-9_./-]*[A-Za-z0-9_/-])/g)) {
      if (!existsSync(join(ROOT, m[1]))) errors.push(`scripts/steps/${f}: pointer <plugin-root>/${m[1]} does not resolve`);
    }
    for (const m of raw.matchAll(/(?<![\w/])references\/[a-z-]+\.md/g)) {
      errors.push(`scripts/steps/${f}: relative pointer "${m[0]}"; write <plugin-root>/skills/<skill>/${m[0]}`);
    }
    for (const bare of bareCommands(raw)) errors.push(`scripts/steps/${f}: "${bare}" names no executable; write node "<plugin-root>/scripts/acdev.mjs" ${bare.slice(6)}`);
  }
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
  for (const needle of [`## The ${skills.length} skills`, `the ${invocable.length} model-invocable \`description:\` frontmatter lines`]) {
    if (!readme.includes(needle)) errors.push(`README.md: stale skill count (expected "${needle}")`);
  }
  const gateway = skills.find((s) => s.name === 'using-acdev');
  if (gateway) {
    // Only model-invocable descriptions load into context; user-run entry
    // points (disable-model-invocation) cost nothing per session.
    const sumDesc = invocable.reduce((n, s) => n + s.desc.length, 0);
    // Measure what the hook actually injects: the body, frontmatter stripped.
    const gatewayLen = norm(gateway.body).trim().length;
    const total = sumDesc + gatewayLen;
    const ledger = [
      [`Sum of the ${invocable.length} model-invocable \`description:\` values: **${fmt(sumDesc)} characters**`, 'description sum'],
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

  // The manual and its Spanish mirror must keep the same structure: a
  // section, table, code block or FAQ entry added to one without the other
  // is drift. Prose is translated, so structure is what can be compared.
  const helpPair = ['docs/help.md', 'docs/help.es.md'];
  const profile = (text) => ({
    'sections (##)': (text.match(/^## /gm) ?? []).length,
    'subsections (###)': (text.match(/^### /gm) ?? []).length,
    'table rows': (text.match(/^\|/gm) ?? []).length,
    'code fences': (text.match(/^```/gm) ?? []).length,
    'FAQ entries': (text.match(/^\*\*[^*].*\*\*$/gm) ?? []).length,
    'numbered contents entries': (text.match(/^\d+\. \[/gm) ?? []).length
  });
  const helpTexts = helpPair.map((rel) => {
    const p = join(ROOT, rel);
    if (!existsSync(p)) {
      errors.push(`${rel}: missing (docs/help.md and docs/help.es.md are mirrors; both must exist)`);
      return null;
    }
    const t = norm(readFileSync(p, 'utf8'));
    if (EMOJI.test(t)) errors.push(`${rel}: contains emoji`);
    return t;
  });
  if (helpTexts.every(Boolean)) {
    const [en, es] = helpTexts.map(profile);
    for (const k of Object.keys(en)) {
      if (en[k] !== es[k]) errors.push(`help mirror drift: ${k} differ (docs/help.md ${en[k]}, docs/help.es.md ${es[k]}); update both files in the same commit`);
    }
  }
}

if (errors.length) {
  console.error(`lint-budgets: ${errors.length} violation(s)\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`lint-budgets: OK (${dirs.length} skills checked)`);
