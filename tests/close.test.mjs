import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { makeProject, ok, red } from './fixtures/project.mjs';
import { appendChangelog } from '../scripts/lib/close.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const PLAN = '2026-09-06-slice-1-skeleton.md';
const closeArgs = (extra = []) => ['close', '--slice', '1: walking skeleton', '--plan', `docs/plans/${PLAN}`, '--next', 'slice 2: create invoice', '--changelog', 'Walking skeleton deployed', ...extra];

test('close --check reports what the close needs without committing', () => {
  const p = makeProject({ guard: true, verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('docs/NEW.md', '# new doc\n');
  const r = p.cli(['close', '--check', '--plan', `docs/plans/${PLAN}`]);
  assert.equal(r.status, 1, 'the index is stale, so the check is red');
  assert.match(r.stdout, /branch: main/);
  assert.match(r.stdout, /verify: guard installed \(1 command\(s\)\); runs at close/);
  assert.match(r.stdout, /drift: 1 code file\(s\) changed/);
  assert.match(r.stdout, /docs\/ARCHITECTURE\.md: src\/invoices\.js/);
  assert.match(r.stdout, /changelog: CHANGELOG\.md will be created/);
  assert.match(r.stdout, /plan: docs\/plans\/2026-09-06-slice-1-skeleton\.md status active/);
  assert.match(r.stdout, /index: NEEDS UPDATE \(docs\/README\.md not updated after adding\/removing docs\/NEW\.md\)/);
  assert.match(r.stdout, /freeze: none/);
  assert.match(r.stdout, /lessons: 0 candidate\(s\)/);
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 1, 'nothing committed');
  // --verify runs the verification now and shows the verdict.
  const v = p.cli(['close', '--check', '--verify']);
  assert.match(v.stdout, /verify now: GREEN/);
  assert.match(v.stdout, /# pass 3/);
});

test('close verifies first and refuses on red, leaving the tree untouched', () => {
  const p = makeProject({ verify: [red()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 1);
  assert.match(r.stdout, /verify: RED \(config\)/);
  assert.match(r.stdout, /AssertionError: expected 2 got 3/);
  assert.match(r.stdout, /BLOCKED: verification is red/);
  assert.ok(!existsSync(join(p.root, 'CHANGELOG.md')), 'no bookkeeping on red');
  assert.match(readFileSync(join(p.root, 'docs', 'plans', PLAN), 'utf8'), /status: active/);
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 1);
});

test('close does the whole bookkeeping and one commit on green', () => {
  const p = makeProject({ guard: true, verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n\n- older entry\n\n## [0.1.0]\n\n- init\n');
  p.write('.acdev/freeze.json', JSON.stringify({ paths: ['tests/total.test.js'], reason: 'rounding bug', since: '2026-09-06' }));
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /verify: GREEN \(guard\)/);
  assert.match(r.stdout, /verification GREEN/);
  assert.match(r.stdout, /changelog: appended to CHANGELOG\.md under ## \[Unreleased\]/);
  assert.match(r.stdout, /plan: docs\/plans\/2026-09-06-slice-1-skeleton\.md: status active -> shipped/);
  assert.match(r.stdout, /freeze: cleared \(tests\/total\.test\.js\)/);
  assert.match(r.stdout, /checkpoint: \.acdev\/checkpoints\/\d{8}-\d{6}-1-walking-skeleton\.md/);
  assert.match(r.stdout, /commit: [0-9a-f]{7} feat: walking skeleton \(slice 1\)/);
  const changelog = readFileSync(join(p.root, 'CHANGELOG.md'), 'utf8');
  assert.match(changelog, /## \[Unreleased\]\n\n- Walking skeleton deployed \(\[plan\]\(docs\/plans\/2026-09-06-slice-1-skeleton\.md\)\)\n- older entry\n\n## \[0\.1\.0\]/);
  assert.match(readFileSync(join(p.root, 'docs', 'plans', PLAN), 'utf8'), /status: shipped/);
  assert.ok(!existsSync(join(p.root, '.acdev', 'freeze.json')));
  const log = p.g(['log', '--oneline']).stdout.trim().split('\n');
  assert.equal(log.length, 2);
  assert.match(log[0], /feat: walking skeleton \(slice 1\)/);
  assert.equal(p.g(['status', '--porcelain']).stdout.trim(), '', 'everything committed');
  const ckpts = readdirSync(join(p.root, '.acdev', 'checkpoints'));
  const latest = readFileSync(join(p.root, '.acdev', 'checkpoints', ckpts.sort().at(-1)), 'utf8');
  assert.match(latest, /slice: "1: walking skeleton"/);
  assert.match(latest, /plan: "docs\/plans\/2026-09-06-slice-1-skeleton\.md"/);
  assert.match(latest, /files_modified: \[[^\]]*"src\/invoices\.js"/);
  assert.match(latest, /next_step: "slice 2: create invoice"/);
  // A change closes with its own message shape.
  p.write('src/invoices.js', 'export const invoices = [1, 2];\n');
  const c = p.cli(['close', '--slice', 'change: invoice rounding', '--next', 'resume slice 2', '--changelog', 'Invoice totals round half up']);
  assert.equal(c.status, 0, c.stdout);
  assert.match(c.stdout, /plan: none \(trivial fix/);
  assert.match(c.stdout, /commit: [0-9a-f]{7} fix: invoice rounding \(change\)/);
});

test('close refuses a stale docs index, a missing flag, a clean tree and the wrong stage', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  assert.match(p.cli(closeArgs()).stdout, /BLOCKED: nothing to commit/);
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('docs/NEW.md', '# new\n');
  const idx = p.cli(closeArgs());
  assert.equal(idx.status, 1);
  assert.match(idx.stdout, /BLOCKED: docs\/README\.md not updated after adding\/removing docs\/NEW\.md/);
  const missing = p.cli(['close', '--slice', '1: x', '--next', 'y']);
  assert.match(missing.stdout, /BLOCKED: missing --changelog/);
  const wrongStage = makeProject({ stage: 'mvp' });
  wrongStage.write('docs/MVP.md', '# mvp\n');
  assert.match(wrongStage.cli(closeArgs()).stdout, /stage is "mvp"/);
});

test('close without configured verification warns and still closes, as the hook allows', () => {
  const p = makeProject({ plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /verify: UNCONFIGURED \(none\)/);
  assert.match(r.stdout, /closing unverified/);
});

test('appendChangelog creates the file and the section, and inserts newest first', () => {
  const root = mkdtempSync(join(tmpdir(), 'acdev-cl-'));
  const cfg = { changelog: { path: 'CHANGELOG.md', section: '## [Unreleased]' } };
  appendChangelog(root, 'first', cfg);
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), '# Changelog\n\n## [Unreleased]\n\n- first\n');
  appendChangelog(root, 'second', cfg);
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), '# Changelog\n\n## [Unreleased]\n\n- second\n- first\n');
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [1.0.0]\n\n- released\n');
  appendChangelog(root, 'third', cfg);
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), '# Changelog\n\n## [Unreleased]\n\n- third\n\n## [1.0.0]\n\n- released\n');
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\n## [Unreleased]\n\n### Added\n- x\n');
  appendChangelog(root, 'fourth', cfg);
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), '# Changelog\n\n## [Unreleased]\n\n- fourth\n\n### Added\n- x\n');
});
