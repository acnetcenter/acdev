import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { renderStatus } from '../scripts/lib/status.mjs';
import { makeProject, PLUGIN } from './fixtures/project.mjs';

test('renderStatus carries state, checkpoint, open plans (incidents first) and the current phase only', () => {
  const p = makeProject({ plans: [{ name: '2026-09-06-slice-1.md' }, { name: '2026-09-05-incident-500s.md' }, { name: 'old.md', status: 'shipped' }] });
  const out = renderStatus(p.root, { pluginRoot: PLUGIN });
  assert.match(out, /^# acdev status\nstate: stage build \| updated \S+.* \| acdev_version \d+\.\d+\.\d+ \| language english\n/);
  assert.match(out, /## checkpoint \(\.acdev\/checkpoints\/[^)]+\.md\)\nbranch: main \| slice: \(none\) \| plan: null\nnext_step: slice 1: walking skeleton\nblocked_on: null/);
  assert.match(out, /## open plans \(2; incidents first\)\n- docs\/plans\/2026-09-05-incident-500s\.md\n- docs\/plans\/2026-09-06-slice-1\.md/);
  assert.match(out, /## roadmap phase\n## Phase 1: MVP\n[\s\S]*Exit criteria: users can create invoices\./);
  assert.ok(!out.includes('team billing'), 'only the current phase section');
  assert.ok(!out.includes('Ignore me') && !out.includes('ADR-0001'), 'status never reads ADRs');
  const last = out.trim().split('\n').at(-1);
  assert.match(last, /^to continue: node ".+\/scripts\/acdev\.mjs" next$/);
  assert.ok(!/[A-Za-z]:\\/.test(last), 'plugin root uses forward slashes');
  assert.ok(out.length < 4000, `status stays small: ${out.length} chars`);
});

test('renderStatus shows a block, the files touched and the capped prose', () => {
  const p = makeProject();
  const ck = p.checkpoint(['--next', 'slice 2: create invoice', '--slice', '2: create invoice', '--plan', 'docs/plans/2026-09-06-slice-2.md', '--files', 'src/invoices.js,src/db.js', '--blocked', 'tenant isolation strategy?', '--notes', Array.from({ length: 14 }, (_, i) => `note line ${i + 1}`).join('\n')]);
  assert.equal(ck.status, 0, ck.stderr);
  const out = renderStatus(p.root, { pluginRoot: PLUGIN });
  assert.match(out, /branch: main \| slice: 2: create invoice \| plan: docs\/plans\/2026-09-06-slice-2\.md\nnext_step: slice 2: create invoice\nblocked_on: tenant isolation strategy\?\nfiles_modified: src\/invoices\.js, src\/db\.js/);
  assert.ok(out.includes('note line 1') && !out.includes('note line 14'), 'prose capped at 10 lines');
  assert.match(out, /\(\+\d+ more lines, open the file if needed\)/);
});

test('renderStatus says when the ROADMAP or the checkpoint is missing', () => {
  const p = makeProject({ roadmap: false, git: false });
  const out = renderStatus(p.root, { pluginRoot: PLUGIN });
  assert.match(out, /## roadmap phase\n\(docs\/ROADMAP\.md missing or without phase headings\)/);
  assert.match(out, /## open plans \(0; incidents first\)\n\(none\)/);
  rmSync(join(p.root, '.acdev', 'checkpoints'), { recursive: true, force: true });
  p.write('.acdev/state.md', '# acdev state\n\nstage: build\nupdated: 2026-09-06\nacdev_version: 0.3.0\nlanguage: english\n');
  const bare = renderStatus(p.root, { pluginRoot: PLUGIN });
  assert.match(bare, /state: stage build \| updated 2026-09-06 \| acdev_version 0\.3\.0 \| language english\n\n## checkpoint\n\(none\)/);
});

test('renderStatus without .acdev offers onboard or new-project and nothing else', () => {
  const p = makeProject({ git: false });
  const out = renderStatus(join(p.root, 'src'), { pluginRoot: PLUGIN });
  assert.equal(out.split('\n').length, 2);
  assert.match(out, /^# acdev status\nno \.acdev\/ in this project[^\n]*\/acdev:onboard[^\n]*\/acdev:new-project/);
  assert.ok(!out.includes('## '), 'no sections invented from the code');
});

test('the status command prints the snapshot in one call', () => {
  const p = makeProject({ plans: [{ name: '2026-09-06-incident-timeouts.md' }] });
  // projectRoot() prefers CLAUDE_PROJECT_DIR over the cwd: the outside-the-
  // project case below only holds when the variable is unset for the child.
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  const r = p.cli(['status'], { env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^# acdev status\nstate: stage build/);
  assert.match(r.stdout, /- docs\/plans\/2026-09-06-incident-timeouts\.md/);
  assert.match(r.stdout, /## roadmap phase\n## Phase 1: MVP/);
  assert.ok(r.stdout.includes('/scripts/acdev.mjs" next'));
  assert.ok(!r.stdout.includes('<plugin-root>'));
  const outside = p.cli(['status'], { cwd: join(p.root, 'src'), env });
  assert.equal(outside.status, 0);
  assert.match(outside.stdout, /no \.acdev\//);
});
