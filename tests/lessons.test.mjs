import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'lessons.mjs');
const run = (proj, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: proj, encoding: 'utf8' });
const ROUTER = '# Demo\n\n## Golden rules\n\n- rule one\n\n## Stack\n\nNode. See [docs/adr/](docs/adr/).\n';

test('first occurrence is a candidate; second promotes into CLAUDE.md and the AGENTS.md mirror', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lessons-'));
  writeFileSync(join(proj, 'CLAUDE.md'), ROUTER);
  writeFileSync(join(proj, 'AGENTS.md'), ROUTER);
  const a = run(proj, 'add', 'Run migrations before the API tests, or the schema is stale', '--source', 'slice 2');
  assert.equal(a.status, 0, a.stderr);
  assert.match(a.stdout, /candidate #1 recorded \(seen 1\)/);
  assert.ok(existsSync(join(proj, '.acdev', 'lessons.md')));
  assert.doesNotMatch(readFileSync(join(proj, 'CLAUDE.md'), 'utf8'), /## Lessons/, 'one occurrence is not a rule yet');
  const b = run(proj, 'add', '--id', '1', '--source', 'slice 5');
  assert.equal(b.status, 0, b.stderr);
  assert.match(b.stdout, /promoted #1 to CLAUDE\.md and AGENTS\.md/);
  const claude = readFileSync(join(proj, 'CLAUDE.md'), 'utf8');
  const agents = readFileSync(join(proj, 'AGENTS.md'), 'utf8');
  assert.equal(claude, agents, 'the mirror stays identical');
  assert.match(claude, /## Lessons\n\nRules earned from mistakes repeated/);
  assert.match(claude, /^- Run migrations before the API tests, or the schema is stale \(\d{4}-\d{2}-\d{2}, slice 5\)$/m);
  assert.match(claude, /^## Golden rules/m, 'existing sections untouched');
  const ledger = readFileSync(join(proj, '.acdev', 'lessons.md'), 'utf8');
  assert.match(ledger, /\| 1 \| 2 \| \d{4}-\d{2}-\d{2} \| \d{4}-\d{2}-\d{2} \| promoted \| slice 5 \| Run migrations/);
  const l = run(proj, 'list');
  assert.match(l.stdout, /#1 \[promoted, seen 2/);
});

test('bullets append inside an existing Lessons section, before the next heading, without duplicates', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lessons-'));
  writeFileSync(join(proj, 'CLAUDE.md'), '# Demo\n\n## Lessons\n\nintro\n\n- old lesson (2026-01-01)\n\n## Drift rule\n\nRepo reality wins.\n');
  run(proj, 'add', 'new lesson');
  const p = run(proj, 'promote', '--id', '1');
  assert.equal(p.status, 0, p.stderr);
  const text = readFileSync(join(proj, 'CLAUDE.md'), 'utf8');
  assert.match(text, /- old lesson \(2026-01-01\)\n- new lesson \(\d{4}-\d{2}-\d{2}\)\n\n## Drift rule\n\nRepo reality wins\.\n$/);
  const again = run(proj, 'promote', '--id', '1');
  assert.match(again.stdout, /already promoted/);
  assert.equal((readFileSync(join(proj, 'CLAUDE.md'), 'utf8').match(/new lesson/g) ?? []).length, 1);
});

test('a promoted lesson that recurs asks for a mechanical check instead of another sentence', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lessons-'));
  writeFileSync(join(proj, 'CLAUDE.md'), ROUTER);
  run(proj, 'add', 'lesson');
  run(proj, 'add', '--id', '1');
  const r = run(proj, 'add', '--id', '1');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /seen 3 times; already promoted.*mechanical check/);
});

test('the budget warning fires past twelve promoted lessons', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lessons-'));
  writeFileSync(join(proj, 'CLAUDE.md'), ROUTER);
  let last = '';
  for (let i = 1; i <= 13; i++) {
    run(proj, 'add', `lesson ${i}`);
    last = run(proj, 'promote', '--id', String(i)).stdout;
    if (i < 13) assert.doesNotMatch(last, /warning/);
  }
  assert.match(last, /warning: 13 promoted lessons > budget 12/);
});

test('pipes in lesson text are neutralised so the ledger table stays parseable', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lessons-'));
  writeFileSync(join(proj, 'CLAUDE.md'), ROUTER);
  run(proj, 'add', 'use a | b, never c');
  const l = run(proj, 'list');
  assert.match(l.stdout, /#1 \[candidate, seen 1.*use a \/ b, never c/);
});

test('usage errors exit 1', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lessons-'));
  assert.equal(run(proj).status, 1);
  assert.equal(run(proj, 'add').status, 1);
  const r = run(proj, 'add', '--id', '9');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no lesson #9/);
});
