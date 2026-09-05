#!/usr/bin/env node
// The lessons ratchet: mistakes the agent repeats in a project become rules
// in that project's CLAUDE.md, deterministically, instead of living in the
// memory of whoever noticed them.
//
// Ledger: .acdev/lessons.md (committed with the repo). A lesson enters as a
// candidate on its first occurrence; its second occurrence promotes it to a
// bullet under "## Lessons" in CLAUDE.md, mirrored to AGENTS.md when the
// project keeps one. The Lessons section is never hand-edited.
//
//   lessons.mjs add "<one-line lesson>" [--source <plan path or slice>]
//   lessons.mjs add --id N [--source ...]        second occurrence: promotes
//   lessons.mjs promote --id N                   promote without waiting
//   lessons.mjs list
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const cwd = process.cwd();
const LEDGER = join(cwd, '.acdev', 'lessons.md');
const ROUTER = join(cwd, 'CLAUDE.md');
const MIRROR = join(cwd, 'AGENTS.md');
const SECTION = '## Lessons';
const INTRO = 'Rules earned from mistakes repeated in this repo, promoted by acdev\'s lessons script (`.acdev/lessons.md` holds the ledger). Never hand-edit this section. A lesson that can be checked mechanically also lives as a test or a `scripts/verify/` probe; the bullet names it.';
const PROMOTE_AT = 2;
const BUDGET = 12;
const today = () => new Date().toISOString().slice(0, 10);
const cell = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

function readLedger() {
  if (!existsSync(LEDGER)) return [];
  const rows = [];
  for (const line of readFileSync(LEDGER, 'utf8').split('\n')) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|\s*(.*?)\s*\|\s*$/);
    if (m) rows.push({ id: Number(m[1]), seen: Number(m[2]), first: m[3].trim(), last: m[4].trim(), status: m[5].trim(), source: m[6].trim(), lesson: m[7].trim() });
  }
  return rows;
}
function writeLedger(rows) {
  mkdirSync(join(cwd, '.acdev'), { recursive: true });
  const lines = [
    '# Lessons ledger',
    '',
    `Candidates become rules in CLAUDE.md on occurrence ${PROMOTE_AT}. Maintained by acdev's lessons script; do not edit by hand.`,
    '',
    '| id | seen | first | last | status | source | lesson |',
    '|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.seen} | ${r.first} | ${r.last} | ${r.status} | ${cell(r.source)} | ${cell(r.lesson)} |`),
    ''
  ];
  writeFileSync(LEDGER, lines.join('\n'));
}

// Append one bullet under the Lessons section of a router file, creating the
// section at the end when missing. Idempotent: an existing identical bullet
// is left alone.
function appendLesson(file, bullet) {
  let text = existsSync(file) ? readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
  if (text.includes(bullet)) return countLessons(text);
  const at = text.indexOf(`\n${SECTION}`) >= 0 ? text.indexOf(`\n${SECTION}`) + 1 : text.startsWith(SECTION) ? 0 : -1;
  if (at < 0) {
    text = `${text.trimEnd()}\n\n${SECTION}\n\n${INTRO}\n\n${bullet}\n`.replace(/^\n+/, '');
  } else {
    const next = text.indexOf('\n## ', at + SECTION.length);
    const end = next < 0 ? text.length : next;
    const section = text.slice(at, end).trimEnd();
    text = `${text.slice(0, at)}${section}\n${bullet}\n${next < 0 ? '' : '\n' + text.slice(end + 1)}`;
  }
  writeFileSync(file, text);
  return countLessons(text);
}
function countLessons(text) {
  const at = text.indexOf(SECTION);
  if (at < 0) return 0;
  const next = text.indexOf('\n## ', at + SECTION.length);
  return (text.slice(at, next < 0 ? text.length : next).match(/^- /gm) ?? []).length;
}

function promote(rows, row) {
  row.status = 'promoted';
  const bullet = `- ${cell(row.lesson)} (${row.last}${row.source ? `, ${cell(row.source)}` : ''})`;
  const count = appendLesson(ROUTER, bullet);
  const mirrored = existsSync(MIRROR);
  if (mirrored) appendLesson(MIRROR, bullet);
  writeLedger(rows);
  console.log(`promoted #${row.id} to CLAUDE.md${mirrored ? ' and AGENTS.md' : ''}: ${bullet}`);
  if (count > BUDGET) console.log(`warning: ${count} promoted lessons > budget ${BUDGET}; consolidate the Lessons section with the user (merge, or move detail into an ADR) in the next close`);
}

const [cmd, ...rest] = process.argv.slice(2);
let a, positional;
try {
  ({ values: a, positionals: positional } = parseArgs({
    args: rest,
    options: { id: { type: 'string' }, source: { type: 'string' } },
    allowPositionals: true
  }));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
const rows = readLedger();
const byId = (id) => {
  const row = rows.find((r) => r.id === Number(id));
  if (!row) {
    console.error(`no lesson #${id} in .acdev/lessons.md`);
    process.exit(1);
  }
  return row;
};

if (cmd === 'add' && a.id) {
  const row = byId(a.id);
  row.seen += 1;
  row.last = today();
  if (a.source) row.source = a.source;
  if (row.status === 'promoted') {
    writeLedger(rows);
    console.log(`#${row.id} seen ${row.seen} times; already promoted. A promoted lesson that recurs needs a mechanical check, not another sentence.`);
  } else if (row.seen >= PROMOTE_AT) promote(rows, row);
  else {
    writeLedger(rows);
    console.log(`#${row.id} seen ${row.seen} times (candidate)`);
  }
} else if (cmd === 'add' && positional[0]) {
  const id = rows.length ? Math.max(...rows.map((r) => r.id)) + 1 : 1;
  rows.push({ id, seen: 1, first: today(), last: today(), status: 'candidate', source: a.source ?? '', lesson: positional[0] });
  writeLedger(rows);
  console.log(`candidate #${id} recorded (seen 1): ${cell(positional[0])}`);
} else if (cmd === 'promote' && a.id) {
  const row = byId(a.id);
  if (row.status === 'promoted') console.log(`#${row.id} is already promoted`);
  else {
    row.last = today();
    promote(rows, row);
  }
} else if (cmd === 'list') {
  if (!rows.length) console.log('no lessons recorded');
  for (const r of rows) console.log(`#${r.id} [${r.status}, seen ${r.seen}, ${r.first}..${r.last}] ${r.lesson}${r.source ? ` (${r.source})` : ''}`);
} else {
  console.error('usage: lessons.mjs add "<lesson>" [--source S] | add --id N [--source S] | promote --id N | list');
  process.exit(1);
}
