#!/usr/bin/env node
// Read/write acdev checkpoints and pipeline state in the current project.
// write: checkpoint.mjs write --stage S --branch B --next TEXT [--slice T] [--files "a,b"] [--blocked T] [--notes T]
// read:  checkpoint.mjs read
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const cwd = process.cwd();
const DIR = join(cwd, '.acdev');
const CKPT_DIR = join(DIR, 'checkpoints');
const STATE = join(DIR, 'state.md');
const STAGES = ['intake', 'vision', 'mvp', 'mockups', 'blueprint', 'build'];

function pluginVersion() {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(here, '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return {
    file: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`,
    human: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  };
}
const slug = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'checkpoint';

const [cmd] = process.argv.slice(2);
if (cmd === 'write') {
  let a;
  try {
    ({ values: a } = parseArgs({
      args: process.argv.slice(3),
      options: {
        stage: { type: 'string' },
        branch: { type: 'string' },
        next: { type: 'string' },
        slice: { type: 'string' },
        files: { type: 'string' },
        blocked: { type: 'string' },
        notes: { type: 'string' },
        lang: { type: 'string' }
      }
    }));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  for (const k of ['stage', 'branch', 'next']) {
    if (!a[k]) {
      console.error(`missing --${k}`);
      process.exit(1);
    }
  }
  if (!STAGES.includes(a.stage)) {
    console.error(`invalid --stage "${a.stage}" (expected one of: ${STAGES.join(', ')})`);
    process.exit(1);
  }
  mkdirSync(CKPT_DIR, { recursive: true });
  const t = stamp();
  const files = (a.files ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const fm = [
    '---',
    `date: ${t.human}`,
    `stage: ${a.stage}`,
    `branch: ${JSON.stringify(a.branch)}`,
    `slice: ${JSON.stringify(a.slice ?? '')}`,
    `files_modified: [${files.map((f) => JSON.stringify(f)).join(', ')}]`,
    `next_step: ${JSON.stringify(a.next)}`,
    `blocked_on: ${a.blocked ? JSON.stringify(a.blocked) : 'null'}`,
    '---',
    ''
  ].join('\n');
  const base = `${t.file}-${slug(a.slice ?? a.next)}`;
  let file = join(CKPT_DIR, `${base}.md`);
  for (let n = 2; existsSync(file); n++) file = join(CKPT_DIR, `${base}-${n}.md`);
  writeFileSync(file, fm + (a.notes ?? '') + '\n');
  const rel = relative(cwd, file).replaceAll('\\', '/');
  // language is sticky: set once (usually at onboard), preserved by later writes.
  let lang = a.lang;
  if (!lang && existsSync(STATE)) {
    lang = readFileSync(STATE, 'utf8').match(/^language:\s*(.+)$/m)?.[1]?.trim();
  }
  writeFileSync(STATE, `# acdev state\n\nstage: ${a.stage}\nupdated: ${t.human}\nacdev_version: ${pluginVersion()}\nlanguage: ${lang ?? 'unknown'}\nlatest_checkpoint: ${rel}\n`);
  console.log(rel);
} else if (cmd === 'read') {
  if (!existsSync(CKPT_DIR)) {
    console.log('no checkpoints: .acdev/ not found in this project');
    process.exit(0);
  }
  // state.md's latest_checkpoint pointer is authoritative; the name sort is a
  // fallback for a missing or stale state file.
  let latest = null;
  if (existsSync(STATE)) {
    const state = readFileSync(STATE, 'utf8');
    console.log(state);
    const m = state.match(/^latest_checkpoint:\s*(.+)$/m);
    if (m && existsSync(join(cwd, m[1].trim()))) latest = join(cwd, m[1].trim());
  }
  if (!latest) {
    // mtime, not name sort: collision suffixes (base-2.md) sort before base.md
    // lexicographically, which would present the oldest write as the latest.
    const files = readdirSync(CKPT_DIR).filter((f) => f.endsWith('.md'))
      .map((f) => ({ f, t: statSync(join(CKPT_DIR, f)).mtimeMs }))
      .sort((x, y) => x.t - y.t);
    if (files.length) latest = join(CKPT_DIR, files.at(-1).f);
  }
  if (latest) {
    console.log('--- latest checkpoint ---');
    console.log(readFileSync(latest, 'utf8'));
  }
} else {
  console.error('usage: checkpoint.mjs write|read [flags]');
  process.exit(1);
}
