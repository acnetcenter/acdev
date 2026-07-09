#!/usr/bin/env node
// Read/write acdev checkpoints and pipeline state in the current project.
// write: checkpoint.mjs write --stage S --branch B --next TEXT [--slice T] [--files "a,b"] [--blocked T] [--notes T]
// read:  checkpoint.mjs read
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const DIR = join(cwd, '.acdev');
const CKPT_DIR = join(DIR, 'checkpoints');
const STATE = join(DIR, 'state.md');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return {
    file: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,
    human: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  };
}
const slug = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'checkpoint';

const [cmd] = process.argv.slice(2);
if (cmd === 'write') {
  const a = parseArgs(process.argv.slice(3));
  for (const k of ['stage', 'branch', 'next']) {
    if (!a[k]) {
      console.error(`missing --${k}`);
      process.exit(1);
    }
  }
  mkdirSync(CKPT_DIR, { recursive: true });
  const t = stamp();
  const files = (a.files ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const fm = [
    '---',
    `date: ${t.human}`,
    `stage: ${a.stage}`,
    `branch: ${a.branch}`,
    `slice: ${JSON.stringify(a.slice ?? '')}`,
    `files_modified: [${files.join(', ')}]`,
    `next_step: ${JSON.stringify(a.next)}`,
    `blocked_on: ${a.blocked ? JSON.stringify(a.blocked) : 'null'}`,
    '---',
    ''
  ].join('\n');
  const file = join(CKPT_DIR, `${t.file}-${slug(a.slice ?? a.next)}.md`);
  writeFileSync(file, fm + (a.notes ?? '') + '\n');
  const rel = file.slice(cwd.length + 1).replaceAll('\\', '/');
  writeFileSync(STATE, `# acdev state\n\nstage: ${a.stage}\nupdated: ${t.human}\nlatest_checkpoint: ${rel}\n`);
  console.log(rel);
} else if (cmd === 'read') {
  if (!existsSync(CKPT_DIR)) {
    console.log('no checkpoints: .acdev/ not found in this project');
    process.exit(0);
  }
  if (existsSync(STATE)) console.log(readFileSync(STATE, 'utf8'));
  const files = readdirSync(CKPT_DIR).filter((f) => f.endsWith('.md')).sort();
  if (files.length) {
    console.log('--- latest checkpoint ---');
    console.log(readFileSync(join(CKPT_DIR, files.at(-1)), 'utf8'));
  }
} else {
  console.error('usage: checkpoint.mjs write|read [flags]');
  process.exit(1);
}
