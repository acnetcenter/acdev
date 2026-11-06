import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, chmodSync, rmSync } from 'node:fs';
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
test('close --check reports what the close needs without committing', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(['close', '--check', '--plan', `docs/plans/${PLAN}`]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /branch: main/);
  assert.match(r.stdout, /verify: 1 command\(s\) in \.acdev\/guard\.json; runs at close/);
  assert.match(r.stdout, /drift: 1 code file\(s\) changed/);
  assert.match(r.stdout, /docs\/ARCHITECTURE\.md: src\/invoices\.js, invoices\n      3: The invoices module lives in src\/invoices\.js\./, 'candidate lines are printed');
  assert.match(r.stdout, /docs\/ROADMAP\.md: invoices\n      8: Exit criteria/);
  assert.match(r.stdout, /changelog: CHANGELOG\.md will be created/);
  assert.match(r.stdout, /plan: docs\/plans\/2026-09-06-slice-1-skeleton\.md status active/);
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
  assert.match(r.stdout, /verify: RED/);
  assert.match(r.stdout, /AssertionError: expected 2 got 3/);
  assert.match(r.stdout, /BLOCKED: verification is red/);
  assert.ok(!existsSync(join(p.root, 'CHANGELOG.md')), 'no bookkeeping on red');
  assert.match(readFileSync(join(p.root, 'docs', 'plans', PLAN), 'utf8'), /status: active/);
  assert.equal(p.g(['log', '--oneline']).stdout.trim().split('\n').length, 1);
});

test('close does the whole bookkeeping and one commit on green', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n\n- older entry\n\n## [0.1.0]\n\n- init\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^  verify: GREEN$/m);
  assert.match(r.stdout, /verify: GREEN \(1 command\(s\)\); receipt written for tree [0-9a-f]{12}/);
  assert.match(r.stdout, /changelog: appended to CHANGELOG\.md under ## \[Unreleased\]/);
  assert.match(r.stdout, /plan: docs\/plans\/2026-09-06-slice-1-skeleton\.md: status active -> shipped/);
  assert.ok(!r.stdout.includes('agents:'), 'no AGENTS.md, nothing mirrored');
  assert.match(r.stdout, /checkpoint: \.acdev\/checkpoints\/\d{8}-\d{6}-1-walking-skeleton\.md/);
  assert.match(r.stdout, /commit: [0-9a-f]{7} feat: walking skeleton \(slice 1\)/);
  const changelog = readFileSync(join(p.root, 'CHANGELOG.md'), 'utf8');
  assert.match(changelog, /## \[Unreleased\]\n\n- Walking skeleton deployed \(\[plan\]\(docs\/plans\/2026-09-06-slice-1-skeleton\.md\)\)\n- older entry\n\n## \[0\.1\.0\]/);
  assert.match(readFileSync(join(p.root, 'docs', 'plans', PLAN), 'utf8'), /status: shipped/);
  // The close ends by saying the context can be dropped: the state is on disk.
  assert.match(r.stdout, /context: this slice is on disk[^\n]*fresh session/);
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
  assert.match(c.stdout, /plan: none \(small fix/);
  assert.match(c.stdout, /commit: [0-9a-f]{7} fix: invoice rounding \(change\)/);
});

test('close refuses a missing flag, a clean tree and the wrong stage', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  assert.match(p.cli(closeArgs()).stdout, /BLOCKED: nothing to commit/);
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const missing = p.cli(['close', '--slice', '1: x', '--next', 'y']);
  assert.match(missing.stdout, /BLOCKED: missing --changelog/);
  const wrongStage = makeProject({ stage: 'mvp' });
  wrongStage.write('docs/MVP.md', '# mvp\n');
  assert.match(wrongStage.cli(closeArgs()).stdout, /stage is "mvp"/);
});

test('close without configured verification says so and still closes, as the guard allows', () => {
  const p = makeProject({ plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /verify: UNCONFIGURED/);
  assert.match(r.stdout, /no commands configured[^\n]*nothing ran/);
});

test('close regenerates AGENTS.md from CLAUDE.md when the project keeps one, in the same commit', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  // The copy carries the CLAUDE.md template's "## Mirror note" heading; that
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
  assert.match(r.stdout, /agents: AGENTS\.md kept as is \(not an acdev copy: no "## Mirror note" heading or <!-- acdev: copy of CLAUDE\.md --> marker\)/);
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

test('a refused close leaves the tree as it found it, and a re-run adds nothing twice', () => {
  // A plan that cannot be flipped stops the close before anything is written.
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN, status: 'draft' }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const refused = p.cli(closeArgs());
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /BLOCKED: docs\/plans\/2026-09-06-slice-1-skeleton\.md status is not active/);
  assert.ok(!existsSync(join(p.root, 'CHANGELOG.md')), 'no CHANGELOG line for a close that did not happen');
  // A commit that fails after the bookkeeping (a pre-commit hook), then a
  // second run: one CHANGELOG line, not two.
  const q = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  q.write('src/invoices.js', 'export const invoices = [1];\n');
  q.write('.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n');
  chmodSync(join(q.root, '.git', 'hooks', 'pre-commit'), 0o755);
  const failed = q.cli(closeArgs());
  assert.equal(failed.status, 1, failed.stdout);
  assert.match(failed.stdout, /BLOCKED: git commit failed/);
  rmSync(join(q.root, '.git', 'hooks', 'pre-commit'));
  const again = q.cli(closeArgs());
  assert.equal(again.status, 0, again.stdout);
  const changelog = readFileSync(join(q.root, 'CHANGELOG.md'), 'utf8');
  assert.equal((changelog.match(/Walking skeleton deployed/g) ?? []).length, 1, changelog);
  assert.match(again.stdout, /plan: docs\/plans\/2026-09-06-slice-1-skeleton\.md already shipped/);
});

test('a --next or --changelog that starts with a dash is a value, not a flag', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(['close', '--slice=1: walking skeleton', `--plan=docs/plans/${PLAN}`, '--next=-> slice 2', '--changelog=- skeleton']);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(writtenCheckpoint(p, r.stdout), /next_step: "-> slice 2"/);
});

test('the close keeps a CRLF file CRLF and touches only the lines it adds or flips', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }], commit: false });
  p.write('CHANGELOG.md', '# Changelog\r\n\r\n## [Unreleased]\r\n\r\n- older entry\r\n\r\n\r\n\r\n## [0.1.0]\r\n\r\n- init\r\n');
  p.write(`docs/plans/${PLAN}`, '---\r\ndate: 2026-09-06\r\nstatus: active\r\n---\r\n\r\n# plan\r\n');
  p.g(['add', '-A']);
  p.g(['-c', 'core.autocrlf=false', 'commit', '-q', '-m', 'init']);
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const r = p.cli(closeArgs());
  assert.equal(r.status, 0, r.stdout);
  const changelog = readFileSync(join(p.root, 'CHANGELOG.md'), 'utf8');
  assert.equal(changelog, `# Changelog\r\n\r\n## [Unreleased]\r\n\r\n- Walking skeleton deployed ([plan](docs/plans/${PLAN}))\r\n- older entry\r\n\r\n\r\n\r\n## [0.1.0]\r\n\r\n- init\r\n`, 'the blank lines further down are not the close\'s to tidy');
  assert.equal(readFileSync(join(p.root, 'docs', 'plans', PLAN), 'utf8'), '---\r\ndate: 2026-09-06\r\nstatus: shipped\r\n---\r\n\r\n# plan\r\n');
});

test('the context note follows a planned close, not a small fix', () => {
  const p = makeProject({ verify: [ok()], plans: [{ name: PLAN }] });
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  assert.match(p.cli(closeArgs()).stdout, /context: this slice is on disk/);
  p.write('README.md', '# fixture, fixed\n');
  const fix = p.cli(['close', '--slice', 'change: readme typo', '--next', 'slice 2', '--changelog', 'README typo']);
  assert.equal(fix.status, 0, fix.stdout);
  assert.ok(!fix.stdout.includes('context:'), fix.stdout);
});

test('appendChangelog finds the section as a whole line, not inside another heading', () => {
  const root = mkdtempSync(join(tmpdir(), 'acdev-cl-'));
  const cfg = { changelog: { path: 'CHANGELOG.md', section: '## [Unreleased]' } };
  writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n\nSee "### [Unreleased] notes" below.\n\n## [Unreleased]\n\n- x\n');
  appendChangelog(root, 'y', cfg);
  assert.equal(readFileSync(join(root, 'CHANGELOG.md'), 'utf8'), '# Changelog\n\nSee "### [Unreleased] notes" below.\n\n## [Unreleased]\n\n- y\n- x\n');
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
