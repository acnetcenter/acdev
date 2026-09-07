// scaffold: copy the plugin's mechanical files into the project verbatim,
// so the model never retypes a template (a copy costs one tool call; a
// retype costs the template's length in output tokens and invites drift).
//   guard                         hook, guard.json, profile.json, settings merge, gitignore lines
//   verify --layers a,b [--canary] scripts/verify/<layer>.mjs per layer, design-tells for frontend, canary
//   <template> <target>           the template's fenced markdown block (or the whole file) at target
//   mockup-variant <page> <state> mockups/<page>-<state>.html: the page with its <main> reduced to one marker line
// Copies are byte-identical to the template; existing files are skipped
// unless force is set. Returns { ok, text }; never throws on a bad request.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { LAYERS } from './checklist.mjs';
import { slashes } from './project.mjs';

const TEMPLATES = {
  runbook: 'runbook.md',
  incident: 'incident.md',
  router: 'claude-md-router.md',
  'docs-index': 'docs-index.md',
  vision: 'vision.md',
  mvp: 'mvp.md',
  'mockups-inventory': 'mockups-inventory.md',
  adr: 'adr.md'
};
const GITIGNORE_LINES = ['.acdev/verify-receipt.json', '.acdev/freeze.json', '.acdev/cost.jsonl'];
// The prose templates carry <...> placeholders (runbook, incident, router,
// adr) or <!-- ... --> guidance comments (vision, mvp, mockups-inventory);
// both must be gone before the gate.
const PLACEHOLDER_RULE = 'replace each <...> placeholder and each <!-- ... --> guidance comment with real content; grep for < and <!-- before the gate';
const MOCKUP_STATES = ['empty', 'error', 'loading'];

const tpl = (pluginRoot, name) => join(pluginRoot, 'shared', 'references', 'templates', name);
// A file keeps its own line terminator; mixing CRLF and LF is the drift the copy exists to avoid.
const eolOf = (text) => (text.includes('\r\n') ? '\r\n' : '\n');

// Writes bytes at root/rel unless the file exists and force is off; the
// returned line is the report entry either way.
function place(root, rel, bytes, force, lines) {
  const path = join(root, ...rel.split('/'));
  if (existsSync(path) && !force) {
    lines.push(`skipped: ${rel} (exists; --force overwrites)`);
    return false;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  lines.push(`written: ${rel}`);
  return true;
}
const copy = (root, pluginRoot, template, rel, force, lines) => place(root, rel, readFileSync(tpl(pluginRoot, template)), force, lines);

// The settings merge is a set union per block: a pattern or a hook entry
// already present is left alone, every other key survives untouched.
function mergeSettings(root, pluginRoot, lines) {
  const rel = '.claude/settings.json';
  const path = join(root, '.claude', 'settings.json');
  const template = JSON.parse(readFileSync(tpl(pluginRoot, 'guard-settings.json'), 'utf8'));
  let settings = {};
  if (existsSync(path)) {
    try {
      settings = JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
      lines.push(`error: ${rel} is not valid JSON (${err.message}); fix it and rerun`);
      return false;
    }
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      lines.push(`error: ${rel} is not a JSON object; fix it and rerun`);
      return false;
    }
  }
  let added = { allow: 0, hooks: 0 };
  if (typeof settings.permissions !== 'object' || settings.permissions === null) settings.permissions = {};
  if (!Array.isArray(settings.permissions.allow)) settings.permissions.allow = [];
  for (const pattern of template.permissions.allow) {
    if (!settings.permissions.allow.includes(pattern)) {
      settings.permissions.allow.push(pattern);
      added.allow++;
    }
  }
  if (typeof settings.hooks !== 'object' || settings.hooks === null) settings.hooks = {};
  if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = [];
  const commands = (entry) => (Array.isArray(entry?.hooks) ? entry.hooks : []).map((h) => h?.command);
  for (const entry of template.hooks.PreToolUse) {
    const wanted = commands(entry);
    const present = settings.hooks.PreToolUse.some((e) => e?.matcher === entry.matcher && wanted.every((c) => commands(e).includes(c)));
    if (!present) {
      settings.hooks.PreToolUse.push(entry);
      added.hooks++;
    }
  }
  if (added.allow + added.hooks === 0 && existsSync(path)) {
    lines.push(`unchanged: ${rel} (allow patterns and hooks already present)`);
    return true;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + '\n');
  lines.push(`merged: ${rel} (${added.allow} allow pattern(s), ${added.hooks} PreToolUse hook(s) added)`);
  return true;
}

function appendGitignore(root, lines) {
  const path = join(root, '.gitignore');
  const raw = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const have = new Set(raw.split(/\r?\n/).map((l) => l.trim()));
  const missing = GITIGNORE_LINES.filter((l) => !have.has(l));
  if (!missing.length) {
    lines.push('unchanged: .gitignore (guard session state already ignored)');
    return;
  }
  const eol = eolOf(raw);
  const sep = raw.length && !raw.endsWith('\n') ? eol : '';
  writeFileSync(path, raw + sep + missing.join(eol) + eol);
  lines.push(`${raw.length ? 'appended' : 'written'}: .gitignore (${missing.join(', ')})`);
}

function scaffoldGuard(root, pluginRoot, force) {
  const lines = [];
  copy(root, pluginRoot, 'guard-hook.mjs', '.claude/hooks/acdev-guard.mjs', force, lines);
  copy(root, pluginRoot, 'guard.json', '.acdev/guard.json', force, lines);
  copy(root, pluginRoot, 'profile.json', '.acdev/profile.json', force, lines);
  const ok = mergeSettings(root, pluginRoot, lines);
  appendGitignore(root, lines);
  lines.push('next: node .claude/hooks/acdev-guard.mjs status (paste its output as evidence)');
  return { ok, text: lines.join('\n') };
}

function scaffoldVerify(root, pluginRoot, layers, canary, force) {
  const unknown = layers.filter((l) => !LAYERS.includes(l));
  if (unknown.length) return { ok: false, text: `unknown layer(s): ${unknown.join(', ')} (expected ${LAYERS.join(', ')})` };
  if (!layers.length && !canary) return { ok: false, text: 'verify: pass --layers a,b (and/or --canary)' };
  const lines = [];
  for (const layer of layers) copy(root, pluginRoot, 'verify-script-stub.mjs', `scripts/verify/${layer}.mjs`, force, lines);
  if (layers.includes('frontend')) copy(root, pluginRoot, 'verify-design-tells.mjs', 'scripts/verify/design-tells.mjs', force, lines);
  if (canary) copy(root, pluginRoot, 'canary-stub.mjs', 'scripts/verify/canary.mjs', force, lines);
  const next = ['replace each stub body with the concrete probe'];
  if (layers.includes('frontend')) next.push('adjust the design-tells targets');
  if (canary) next.push('adjust the canary checks to docs/RUNBOOK.md');
  lines.push(`next: ${next.join(', ')}; then list the commands in .acdev/guard.json verify`);
  return { ok: true, text: lines.join('\n') };
}

// The fenced block is the document; the text before it is the rule set
// (reader, cap, constraints) the model needs without opening the template.
export function splitTemplate(raw) {
  const m = raw.match(/^```markdown[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*(?:\r?\n|$)/m);
  if (!m) return { preamble: '', body: raw };
  return { preamble: raw.slice(0, m.index).trim(), body: m[1] + (m[1].endsWith('\n') ? '' : eolOf(raw)) };
}

function scaffoldTemplate(root, pluginRoot, what, target, force) {
  if (!target) return { ok: false, text: `${what}: a target path is required (e.g. scaffold ${what} docs/${what.toUpperCase()}.md)` };
  if (isAbsolute(target) || /^[A-Za-z]:/.test(target)) return { ok: false, text: `${what}: target must be a path relative to the project root, not ${target}` };
  const rel = slashes(target).replace(/^\.\//, '');
  const path = join(root, ...rel.split('/'));
  if (existsSync(path) && !force) return { ok: false, text: `refused: ${rel} exists; pass --force to overwrite it` };
  const { preamble, body } = splitTemplate(readFileSync(tpl(pluginRoot, TEMPLATES[what]), 'utf8'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  const lines = [`written: ${rel} (from ${TEMPLATES[what]})`];
  if (preamble) lines.push('', preamble, '');
  lines.push(PLACEHOLDER_RULE);
  return { ok: true, text: lines.join('\n') };
}

// A state variant is the page with its <main> content replaced by one
// marker line, everything else byte-identical (head, nav, footer). The
// model then edits that single line instead of re-emitting the page: the
// Edit tool needs the old text, so a full copy edited by hand would put
// the whole main back through the output.
function scaffoldMockupVariant(root, target, state, force) {
  if (!target) return { ok: false, text: 'mockup-variant: a page path is required (e.g. scaffold mockup-variant mockups/invoice-list.html empty)' };
  if (!state) return { ok: false, text: `mockup-variant: a state is required, as a third positional or --state (one of ${MOCKUP_STATES.join(', ')})` };
  if (!MOCKUP_STATES.includes(state)) return { ok: false, text: `mockup-variant: unknown state "${state}" (expected ${MOCKUP_STATES.join(', ')})` };
  if (isAbsolute(target) || /^[A-Za-z]:/.test(target)) return { ok: false, text: `mockup-variant: page must be a path relative to the project root, not ${target}` };
  const rel = slashes(target).replace(/^\.\//, '');
  if (!/\.html?$/i.test(rel)) return { ok: false, text: `mockup-variant: page must be an .html file, not ${rel}` };
  const src = join(root, ...rel.split('/'));
  if (!existsSync(src)) return { ok: false, text: `mockup-variant: ${rel} not found` };
  const out = rel.replace(/(\.html?)$/i, `-${state}$1`);
  const dest = join(root, ...out.split('/'));
  if (existsSync(dest) && !force) return { ok: false, text: `refused: ${out} exists; pass --force to overwrite it` };
  const page = readFileSync(src, 'utf8');
  const m = page.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
  if (!m) return { ok: false, text: `refused: ${rel} has no <main> element; the variant replaces only its content` };
  const eol = eolOf(page);
  const open = m[0].match(/^<main\b[^>]*>/i)[0];
  const close = m[0].match(/<\/main\s*>$/i)[0];
  // The marker keeps the indentation of the first inner line and the
  // closing tag that of the opening one, so the variant diffs against the
  // page as one block.
  const inner = m[1].match(/^\r?\n([ \t]*)/)?.[1] ?? '';
  const outer = page.slice(page.lastIndexOf('\n', m.index) + 1, m.index).match(/^[ \t]*$/)?.[0] ?? '';
  const marker = `${eol}${inner}<!-- ${state} state: write only this block -->${eol}${outer}`;
  const text = `${page.slice(0, m.index)}${open}${marker}${close}${page.slice(m.index + m[0].length)}`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
  return { ok: true, text: [`written: ${out} (from ${rel}; <main> reduced to one marker line)`, `next: Edit the marker line in ${out} with the ${state} state's content; leave the rest of the page as is, and link the variant from ${rel}`].join('\n') };
}

export function scaffold(root, { pluginRoot, what, target = null, state = null, layers = [], canary = false, force = false }) {
  if (what === 'guard') return scaffoldGuard(root, pluginRoot, force);
  if (what === 'verify') return scaffoldVerify(root, pluginRoot, layers, canary, force);
  if (what === 'mockup-variant') return scaffoldMockupVariant(root, target, state, force);
  if (Object.hasOwn(TEMPLATES, what)) return scaffoldTemplate(root, pluginRoot, what, target, force);
  return { ok: false, text: `unknown scaffold target "${what}" (expected guard, verify, mockup-variant, or one of ${Object.keys(TEMPLATES).join(', ')})` };
}
