import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { makeProject, ok, red } from './fixtures/project.mjs';
import { appendChangelog } from '../scripts/lib/close.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const PLAN = '2026-09-06-slice-1-skeleton.md';
const closeArgs = (extra = []) => ['close', '--slice', '1: walking skeleton', '--plan', `docs/plans/${PLAN}`, '--next', 'slice 2: create invoice', '--changelog', 'Walking skeleton deployed', ...extra];
// The checkpoint the close just wrote, by the path it printed. Reading the
// directory and taking the last name sorts wrong whenever the fixture's
// seed checkpoint lands in the same second: both names carry that stamp
// and "…-slice-1-walking-skeleton.md" sorts after "…-1-walking-skeleton.md".
const writtenCheckpoint = (p, stdout) => {
  const rel = stdout.match(/^ {2}checkpoint: (\S+)$/m)?.[1];
  assert.ok(rel, `the close printed no checkpoint path:\n${stdout}`);
  return readFileSync(join(p.root, ...rel.split('/')), 'utf8');
};
// A lessons ledger in the shape scripts/lessons.mjs writes, N promoted rows plus one candidate.
const ledger = (promoted) => [
  '# Lessons ledger', '', '| id | seen | first | last | status | source | lesson |', '|---|---|---|---|---|---|---|',
  ...Array.from({ length: promoted }, (_, i) => `| ${i + 1} | 2 | 2026-09-01 | 2026-09-06 | promoted | slice ${i + 1} | lesson ${i + 1} |`),
  `| ${promoted + 1} | 1 | 2026-09-06 | 2026-09-06 | candidate |  | a candidate |`, ''
].join('\n');

test('close --check reports what the close needs without committing', () => {
  const p = makeProject({ guard: true, verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('docs/NEW.md', '# new doc\n');
  const r = p.cli(['close', '--check', '--plan', `docs/plans/${PLAN}`]);
  assert.equal(r.status, 1, 'the index is stale, so the check is red');
  assert.match(r.stdout, /branch: main/);
  assert.match(r.stdout, /verify: guard installed \(1 command\(s\)\); runs at close/);
  assert.match(r.stdout, /drift: 1 code file\(s\) changed/);
  assert.match(r.stdout, /docs\/ARCHITECTURE\.md: src\/invoices\.js, invoices\n      3: The invoices module lives in src\/invoices\.js\./, 'candidate lines are printed');
  assert.match(r.stdout, /docs\/ROADMAP\.md: invoices\n      8: Exit criteria/);
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
  assert.match(r.stdout, /lessons: 0 candidate\(s\), 0 promoted/);
  assert.ok(!r.stdout.includes('agents:'), 'no AGENTS.md, nothing mirrored');
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
  const latest = writtenCheckpoint(p, r.stdout);
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

test('close --check and close refuse past twelve promoted lessons; twelve still closes', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('.acdev/lessons.md', ledger(13));
  const check = p.cli(['close', '--check', '--plan', `docs/plans/${PLAN}`]);
  assert.equal(check.status, 1, check.stdout);
  assert.match(check.stdout, /index: ok/);
  assert.match(check.stdout, /lessons: 13 promoted > 12: consolidate the section and \.acdev\/lessons\.md before close/);
  const r = p.cli(closeArgs());
  assert.equal(r.status, 1, r.stdout);
  assert.match(r.stdout, /verify: GREEN \(config\)/, 'verification still runs first');
  // The cap counts ledger rows, so the message names the ledger next to the section.
  assert.match(r.stdout, /BLOCKED: lessons: 13 promoted > 12; consolidate the Lessons section and its rows in \.acdev\/lessons\.md with the user \(merge rows and bullets, or move detail into an ADR\) before closing/);
  assert.ok(!existsSync(join(p.root, 'CHANGELOG.md')), 'no bookkeeping past the cap');
  assert.match(readFileSync(join(p.root, 'docs', 'plans', PLAN), 'utf8'), /status: active/);
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 1, 'nothing committed');
  p.write('.acdev/lessons.md', ledger(12));
  assert.match(p.cli(['close', '--check', '--plan', `docs/plans/${PLAN}`]).stdout, /lessons: 1 candidate\(s\), 12 promoted;/);
  const green = p.cli(closeArgs());
  assert.equal(green.status, 0, green.stdout);
  assert.match(green.stdout, /lessons: 1 candidate\(s\), 12 promoted/);
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 2);
});

test('close regenerates AGENTS.md from CLAUDE.md when the project keeps one, in the same commit', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  // The copy carries the router template's "## Mirror note" heading; that
  // is how close tells an acdev copy from an AGENTS.md kept by hand.
  p.write('CLAUDE.md', '# Router\n\n## Lessons\n\n- one\n- two\n\n## Mirror note\n\nAGENTS.md is a copy of this file.\n');
  p.write('AGENTS.md', '# Router\n\n## Lessons\n\n- one\n\n## Mirror note\n\nAGENTS.md is a copy of this file.\n');
  p.g(['add', '-A']);
  p.g(['commit', '-q', '-m', 'routers']);
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /agents: AGENTS\.md regenerated from CLAUDE\.md/);
  assert.equal(readFileSync(join(p.root, 'AGENTS.md'), 'utf8'), readFileSync(join(p.root, 'CLAUDE.md'), 'utf8'));
  assert.equal(p.g(['status', '--porcelain']).stdout.trim(), '', 'the regenerated mirror is in the commit');
  assert.match(p.g(['show', '--stat', '--oneline', 'HEAD']).stdout, /AGENTS\.md/);
  // The mirror runs after the changed files were computed; the checkpoint
  // still lists it, next to the slice's own files.
  const latest = writtenCheckpoint(p, r.stdout);
  const files = latest.match(/^files_modified:\s*\[([^\]]*)\]/m)?.[1] ?? '';
  assert.match(files, /"src\/invoices\.js"/);
  assert.match(files, /"AGENTS\.md"/, `the regenerated AGENTS.md is in the checkpoint files: ${files}`);
  assert.equal(files.match(/"AGENTS\.md"/g).length, 1, 'listed once');
});

test('close leaves a hand-kept AGENTS.md alone: no mirror marker, no rewrite', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  const kept = '# Agents\n\nHand-written guidance for other agents.\n';
  p.write('CLAUDE.md', '# Router\n\n## Lessons\n\n- one\n');
  p.write('AGENTS.md', kept);
  p.g(['add', '-A']);
  p.g(['commit', '-q', '-m', 'routers']);
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /agents: AGENTS\.md kept as is \(not an acdev router copy: no "## Mirror note" heading or <!-- acdev: copy of CLAUDE\.md --> marker\)/);
  assert.equal(readFileSync(join(p.root, 'AGENTS.md'), 'utf8'), kept);
  assert.doesNotMatch(p.g(['show', '--stat', '--oneline', 'HEAD']).stdout, /AGENTS\.md/);
});

test('close keeps AGENTS.md as is when there is no CLAUDE.md to copy', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  // A router copy by its marker, but nothing to regenerate it from: the
  // copy stays, and the close says why.
  const agents = '# Router\n\n## Mirror note\n\nAGENTS.md is a copy of CLAUDE.md.\n';
  p.write('AGENTS.md', agents);
  p.g(['add', '-A']);
  p.g(['commit', '-q', '-m', 'agents']);
  assert.ok(!existsSync(join(p.root, 'CLAUDE.md')));
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /^  agents: AGENTS\.md kept as is \(no CLAUDE\.md to copy\)$/m);
  assert.equal(readFileSync(join(p.root, 'AGENTS.md'), 'utf8'), agents);
  assert.ok(!existsSync(join(p.root, 'CLAUDE.md')), 'the close does not invent a CLAUDE.md');
  assert.doesNotMatch(p.g(['show', '--stat', '--oneline', 'HEAD']).stdout, /AGENTS\.md/);
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 3);
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
