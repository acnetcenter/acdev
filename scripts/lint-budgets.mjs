#!/usr/bin/env node
// Structure and budget lint for acdev. Approximation: 1 token = 4 chars.
// With ACDEV_SKILLS_DIR set (test fixtures), only the skills-dir checks
// run; against the real tree it also lints shared/, the manifests, the
// hooks, the CLI shims, the eval cases and README and manual drift.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = process.env.ACDEV_SKILLS_DIR ?? join(ROOT, 'skills');
const REPO_CHECKS = !process.env.ACDEV_SKILLS_DIR;
const DESCRIPTION_MAX_CHARS = 400;   // ~100 tokens, loaded in every session
const BODY_MAX_LINES = 250;
const BODY_MAX_CHARS = 6000;         // ~1.5k tokens; detail lives in references/
// The gates, the user-challenge triggers and the contracts the scripts
// rely on must stay in the body verbatim: the evals read the body and
// expect these to decide. Compared whitespace-collapsed, since line
// wrapping differs.
const REQUIRED_PHRASES = {
  'new-project': [
    'Do you approve this PRODUCT document?',
    'Ask for explicit approval of the full MVP.md document',
    'Zero product code',
    'No placeholders anywhere in generated documents.'
  ],
  mockups: [
    'Do you approve these mockups?',
    'The freeze is normative for what the mockups actually draw',
    'Reopening the contract after approval requires re-approval'
  ],
  blueprint: [
    'user-challenge',
    'asked, never assumed',
    'Only this write unlocks product code',
    "It starts only on the user's explicit order"
  ],
  onboard: [
    'declared gap',
    'Ask for explicit confirmation that the map is accurate before proposing anything.',
    'Never rewrite an existing doc without showing the diff'
  ],
  build: [
    'A guard denial is a gate',
    'asked, never auto-decided and never delegated',
    'It verifies first and refuses on red'
  ]
};
// Extended_Pictographic plus the pieces it does not cover: regional
// indicators (country flags), VS16 and the keycap combiner. The lookahead
// exempts (c) (r) (tm), which are text, not emoji.
const EMOJI = /(?![©®™])(?:\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{20E3}])/u;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const norm = (s) => s.replace(/\r\n/g, '\n');
// A double-quoted YAML scalar, unwrapped; anything else is returned as is.
const unquote = (v) => {
  const m = v.match(/^"(.*)"$/);
  return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : v;
};

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

// Text that names something 0.5.0 removed. A skill that still says it
// sends the model hunting for a command, a skill or a path that is gone.
// The patterns look for the forms a stale instruction really takes (a
// backticked name, a slash command, an invocation) and leave ordinary
// prose alone ("each acdev run of the evals").
const GONE_SKILLS = 'tdd|debugging|planning|verifying|designing|ship|operate|using-acdev|layer-[a-z]+';
const GONE_COMMANDS = 'next|pack|checklist|lessons|run|cost';
const STALE = [
  [/<plugin-root>/g, () => 'the <plugin-root> placeholder is gone: write `acdev <command>` (the CLI is on PATH)'],
  [new RegExp(`(?:^[ \\t]*|\`|/)acdev(?:\\.mjs"?)?[ \\t]+(${GONE_COMMANDS})\\b|(?<![\\w/."-])acdev (${GONE_COMMANDS})(?=\\s+--?[a-z])`, 'gm'), (m) => `"acdev ${m[1] ?? m[2]}" was removed; \`acdev status\` says what continues`],
  [new RegExp(`(?<!alias )\`(${GONE_SKILLS})\``, 'g'), (m) => `${m[0]} names a skill that no longer exists`],
  [new RegExp(`(?<![\\w-])/?acdev:(${GONE_SKILLS}|acdev-builder(?:-capable)?)\\b`, 'g'), (m) => `"${m[0]}" names a skill or an agent that no longer exists`],
  [new RegExp(`\\bthe (${GONE_SKILLS}) skill\\b`, 'gi'), (m) => `"${m[0]}" names a skill that no longer exists`],
  [/acdev-guard\.mjs|scaffold (?:guard|verify|vision|router)\b/g, (m) => `"${m[0]}" is gone: the guard ships with the plugin (\`acdev init\`, \`acdev verify\`)`],
  [/scripts\/lessons\.mjs|\.acdev\/(?:profile\.json|lessons\.md|freeze\.json|cost\.jsonl)/g, (m) => `"${m[0]}" is no longer written or read`]
];
// The product document is PRODUCT.md. The old name may appear only on a
// line that is about moving an old project over.
// "vision" as an ordinary word is fine; the upper-case name, the file
// name in any case and "the vision document" are not.
const OLD_DOC_NAME = /\bVISION\b/;
const OLD_DOC_FILE = /vision\.md\b|\bthe vision document\b/i;
const MIGRATION_NOTE = /migra|legacy|renam|renombr/i;
function staleMentions(raw) {
  const text = norm(raw);
  const out = [];
  for (const [re, say] of STALE) for (const m of text.matchAll(re)) out.push(say(m));
  for (const line of text.split('\n')) {
    if ((OLD_DOC_NAME.test(line) || OLD_DOC_FILE.test(line)) && !MIGRATION_NOTE.test(line)) {
      out.push('"VISION" outside a migration note: the product document is docs/PRODUCT.md');
    }
  }
  return out;
}
// A pointer into references/ must resolve from the file that names it.
function danglingPointers(file, raw) {
  const out = [];
  for (const m of norm(raw).matchAll(/(?<![\w/.-])((?:\.\.\/)*(?:[a-z-]+\/)*references\/[A-Za-z0-9_./-]*[A-Za-z0-9_-]\.md)/g)) {
    if (!existsSync(resolve(dirname(file), m[1]))) out.push(m[1]);
  }
  return out;
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
  const descRaw = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  const desc = descRaw === undefined ? undefined : unquote(descRaw);
  // Claude Code parses the frontmatter as strict YAML: an unquoted value
  // that holds ": " (or another indicator) fails to parse and the whole
  // skill is dropped silently.
  if (descRaw && !/^".*"$/.test(descRaw) && /(:\s|\s#|^[&*!|>'%@`[\]{},])/.test(descRaw)) errors.push(`${lbl}: description must be double-quoted for YAML (it holds ": " or another indicator)`);
  if (!name) errors.push(`${lbl}: frontmatter missing "name"`);
  else if (name !== dir.name) errors.push(`${lbl}: name "${name}" != directory "${dir.name}"`);
  if (!desc) errors.push(`${lbl}: frontmatter missing "description"`);
  else if (desc.length > DESCRIPTION_MAX_CHARS) errors.push(`${lbl}: description ${desc.length} chars > ${DESCRIPTION_MAX_CHARS}`);
  const body = raw.slice(m[0].length);
  const lines = body.split('\n').length;
  if (lines > BODY_MAX_LINES) errors.push(`${lbl}: body ${lines} lines > ${BODY_MAX_LINES}`);
  if (norm(body).length > BODY_MAX_CHARS) errors.push(`${lbl}: body ${norm(body).length} chars > ${BODY_MAX_CHARS} (detail goes to references/)`);
  if (dir.name in REQUIRED_PHRASES) {
    const flat = norm(body).replace(/\s+/g, ' ');
    for (const phrase of REQUIRED_PHRASES[dir.name]) {
      if (!flat.includes(phrase)) errors.push(`${lbl}: body is missing the required phrase "${phrase}"`);
    }
  }
  const noModel = /^disable-model-invocation:\s*true$/m.test(fm);
  if (name && desc) skills.push({ name, desc, dir: dir.name, noModel });
}

// Lexical overlap between model-invocable descriptions: two skills whose
// trigger vocabularies overlap heavily will collide at activation time.
// The shared-words floor keeps tiny vocabularies from false-positiving.
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
      errors.push(`description overlap ${jaccard.toFixed(2)} > ${OVERLAP_MAX} between "${invocable[i].dir}" and "${invocable[j].dir}": their triggers will collide`);
    }
  }
}

// Every markdown file under skills/: no emoji, nothing stale, no dangling
// pointer into references/.
for (const p of mdFilesUnder(SKILLS_DIR)) {
  const raw = readFileSync(p, 'utf8');
  const lbl = `skills/${label(p, SKILLS_DIR)}`;
  if (EMOJI.test(raw)) errors.push(`${lbl.replace(/\/SKILL\.md$/, '')}: contains emoji`);
  for (const s of staleMentions(raw)) errors.push(`${lbl}: ${s}`);
  for (const d of danglingPointers(p, raw)) errors.push(`${lbl}: pointer ${d} does not resolve`);
}

// `claude plugin eval` refuses a case with an unknown frontmatter key, an
// unknown grader type or no grader, and only says so on a machine that can
// run it (not native Windows), so the lint says it first.
const CASE_KEYS = new Set(['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'append_system_prompt', 'env']);
const GRADER_TYPES = new Set(['regex', 'tool_used', 'tool_order', 'file_exists', 'llm', 'baseline']);
const EVALS_DIR = process.env.ACDEV_EVALS_DIR ?? (REPO_CHECKS ? join(ROOT, 'evals') : null);
if (EVALS_DIR && existsSync(EVALS_DIR)) {
  for (const d of readdirSync(EVALS_DIR, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'results')) {
    const dir = join(EVALS_DIR, d.name);
    const lbl = `evals/${d.name}`;
    const yaml = existsSync(join(dir, 'case.yaml')) ? readFileSync(join(dir, 'case.yaml'), 'utf8') : '';
    // A case is a prompt.md, or a case.yaml that carries the prompt itself.
    if (!existsSync(join(dir, 'prompt.md')) && !/^\s+prompt:/m.test(yaml)) errors.push(`${lbl}: no prompt (prompt.md, or execution.prompt in case.yaml)`);
    if (existsSync(join(dir, 'prompt.md'))) {
      const fm = norm(readFileSync(join(dir, 'prompt.md'), 'utf8')).match(FRONTMATTER)?.[1] ?? '';
      for (const m of fm.matchAll(/^([A-Za-z_-]+):/gm)) if (!CASE_KEYS.has(m[1])) errors.push(`${lbl}/prompt.md: unknown frontmatter key "${m[1]}"`);
    }
    const graders = mdFilesUnder(join(dir, 'graders'));
    if (!graders.length) errors.push(`${lbl}: no grader under graders/`);
    for (const g of graders) {
      const raw = norm(readFileSync(g, 'utf8'));
      const type = raw.match(/^type:\s*(\S+)/m)?.[1];
      if (!GRADER_TYPES.has(type)) errors.push(`${lbl}/graders/${label(g, join(dir, 'graders'))}: unknown grader type "${type}"`);
      if (raw.includes('(?i')) errors.push(`${lbl}/graders/${label(g, join(dir, 'graders'))}: inline (?i) is not supported; use flags: i`);
    }
    const script = yaml.match(/scaffold_script:\s*(\S+)/)?.[1];
    if (script && !existsSync(join(dir, script))) errors.push(`${lbl}: scaffold_script ${script} does not exist`);
  }
}

if (REPO_CHECKS) {
  for (const p of mdFilesUnder(join(ROOT, 'shared'))) {
    const raw = readFileSync(p, 'utf8');
    if (EMOJI.test(raw)) errors.push(`${label(p, ROOT)}: contains emoji`);
    for (const s of staleMentions(raw)) errors.push(`${label(p, ROOT)}: ${s}`);
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

  // The hooks and the CLI shims are what make the plugin work without
  // anything installed in the project: every file they name must exist.
  const hooks = manifest('hooks/hooks.json');
  for (const m of JSON.stringify(hooks ?? {}).matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+)/g)) {
    if (!existsSync(join(ROOT, m[1]))) errors.push(`hooks/hooks.json: ${m[1]} does not exist`);
  }
  for (const f of ['bin/acdev', 'bin/acdev.cmd', 'scripts/acdev.mjs']) {
    if (!existsSync(join(ROOT, f))) errors.push(`${f}: missing (the skills call the CLI as \`acdev\`)`);
  }

  // README drift: the skill table and the count must match the tree.
  const readme = norm(readFileSync(join(ROOT, 'README.md'), 'utf8'));
  const names = new Set(skills.map((s) => s.name));
  for (const s of skills) {
    const row = `| \`${s.name}\` | ${s.desc} |`;
    if (!readme.includes(row)) errors.push(`README.md: skill table row for "${s.name}" missing or out of date`);
  }
  // The reverse direction: a table row whose skill no longer exists on disk.
  for (const m of readme.matchAll(/^\| `([a-z][a-z0-9-]*)` \| Use when/gm)) {
    if (!names.has(m[1])) errors.push(`README.md: skill table row for "${m[1]}" refers to a skill that does not exist`);
  }
  if (!readme.includes(`## The ${skills.length} skills`)) errors.push(`README.md: stale skill count (expected "## The ${skills.length} skills")`);
  for (const s of staleMentions(readme)) errors.push(`README.md: ${s}`);

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
    for (const s of staleMentions(t)) errors.push(`${rel}: ${s}`);
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
