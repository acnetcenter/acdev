// scaffold: copy the plugin's mechanical files into the project verbatim,
// so the model never retypes a template (a copy costs one tool call; a
// retype costs the template's length in output tokens and invites drift).
//   init                          .acdev/guard.json and the .gitignore line for the receipt
//   <template> <target>           the template's fenced markdown block (or the whole file) at target
//   mockup-variant <page> <state> mockups/<page>-<state>.html: the page with its <main> reduced to one marker line
// Copies are byte-identical to the template; existing files are skipped
// unless force is set. Returns { ok, text }; never throws on a bad request.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { slashes } from './project.mjs';

export const TEMPLATES = {
  product: 'product.md',
  mvp: 'mvp.md',
  adr: 'adr.md',
  runbook: 'runbook.md',
  incident: 'incident.md',
  'claude-md': 'claude-md.md',
  'mockups-inventory': 'mockups-inventory.md',
  canary: 'canary-stub.mjs'
};
// The receipt is session state, not history.
const GITIGNORE_LINES = ['.acdev/verify-receipt.json'];
// The prose templates carry <...> placeholders (runbook, incident, adr,
// claude-md) or <!-- ... --> guidance comments (product, mvp,
// mockups-inventory); both must be gone before the gate.
const PLACEHOLDER_RULE = 'replace each <...> placeholder and each <!-- ... --> guidance comment with real content, and keep the `impeccable:product-schema` line as it is (design tools look for it); grep for < and <!-- before the gate';
const CANARY_RULE = 'next: adjust the checks to the bands in docs/RUNBOOK.md, then run it after each deploy through `acdev q -- node <this file>`';
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

function appendGitignore(root, lines) {
  const path = join(root, '.gitignore');
  const raw = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const have = new Set(raw.split(/\r?\n/).map((l) => l.trim()));
  const missing = GITIGNORE_LINES.filter((l) => !have.has(l));
  if (!missing.length) {
    lines.push('unchanged: .gitignore (the verification receipt is already ignored)');
    return;
  }
  const eol = eolOf(raw);
  const sep = raw.length && !raw.endsWith('\n') ? eol : '';
  writeFileSync(path, raw + sep + missing.join(eol) + eol);
  lines.push(`${raw.length ? 'appended' : 'written'}: .gitignore (${missing.join(', ')})`);
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
  if (rel.split('/').includes('..')) return { ok: false, text: `refused: ${rel} leaves the project; the target must stay inside it` };
  const path = join(root, ...rel.split('/'));
  if (existsSync(path) && !force) return { ok: false, text: `refused: ${rel} exists; pass --force to overwrite it` };
  const { preamble, body } = splitTemplate(readFileSync(tpl(pluginRoot, TEMPLATES[what]), 'utf8'));
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  const lines = [`written: ${rel} (from ${TEMPLATES[what]})`];
  if (preamble) lines.push('', preamble, '');
  lines.push(what === 'canary' ? CANARY_RULE : PLACEHOLDER_RULE);
  return { ok: true, text: lines.join('\n') };
}

// The project's side of the guard: its config and the ignore line. The
// guard itself ships with the plugin; nothing else is installed.
function initProject(root, pluginRoot, force) {
  const lines = [];
  copy(root, pluginRoot, 'guard.json', '.acdev/guard.json', force, lines);
  appendGitignore(root, lines);
  lines.push('next: write the pipeline state (acdev checkpoint write --stage <stage> --branch <branch> --next "<text>" --lang "<language>"), then paste `acdev status`');
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
  if (rel.split('/').includes('..')) return { ok: false, text: `refused: ${rel} leaves the project; the target must stay inside it` };
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

export function scaffold(root, { pluginRoot, what, target = null, state = null, force = false }) {
  if (what === 'init') return initProject(root, pluginRoot, force);
  if (what === 'mockup-variant') return scaffoldMockupVariant(root, target, state, force);
  if (Object.hasOwn(TEMPLATES, what)) return scaffoldTemplate(root, pluginRoot, what, target, force);
  const RENAMED = { vision: 'product', router: 'claude-md' };
  const renamed = Object.hasOwn(RENAMED, what) ? RENAMED[what] : null;
  if (renamed) return { ok: false, text: `"${what}" was renamed: use scaffold ${renamed} <target>` };
  if (what === 'guard') return { ok: false, text: 'the guard ships with the plugin since 0.5.0; run `acdev init` for the project config' };
  return { ok: false, text: `unknown scaffold target "${what}" (expected mockup-variant or one of ${Object.keys(TEMPLATES).join(', ')})` };
}
