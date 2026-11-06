import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderStatus } from '../scripts/lib/status.mjs';
import { makeProject, ok } from './fixtures/project.mjs';

test('renderStatus carries state, checkpoint, open plans (incidents first), the current phase and the guard', () => {
  const p = makeProject({ plans: [{ name: '2026-09-06-slice-1.md' }, { name: '2026-09-05-incident-500s.md' }, { name: 'old.md', status: 'shipped' }] });
  const out = renderStatus(p.root);
  assert.match(out, /^# acdev status\nstate: stage build \| updated \S+.* \| acdev_version \d+\.\d+\.\d+ \| language english\n/);
  assert.match(out, /## checkpoint \(\.acdev\/checkpoints\/[^)]+\.md\)\nbranch: main \| slice: \(none\) \| plan: null\nnext_step: slice 1: walking skeleton\nblocked_on: null/);
  assert.match(out, /## open plans \(2; incidents first\)\n- docs\/plans\/2026-09-05-incident-500s\.md\n- docs\/plans\/2026-09-06-slice-1\.md/);
  assert.match(out, /## roadmap phase\n## Phase 1: MVP\n[\s\S]*Exit criteria: users can create invoices\./);
  assert.ok(!out.includes('team billing'), 'only the current phase section');
  assert.ok(!out.includes('Ignore me') && !out.includes('ADR-0001'), 'status never reads ADRs');
  assert.match(out, /^guard: enabled \| verify: none configured \| receipt: unconfigured$/m);
  assert.match(out.trim().split('\n').at(-1), /^to continue: an open incident outranks any slice: docs\/plans\/2026-09-05-incident-500s\.md/);
  assert.ok(out.length < 4000, `status stays small: ${out.length} chars`);
});

test('renderStatus shows a block, the files touched and the capped prose', () => {
  const p = makeProject();
  const ck = p.checkpoint(['--next', 'slice 2: create invoice', '--slice', '2: create invoice', '--plan', 'docs/plans/2026-09-06-slice-2.md', '--files', 'src/invoices.js,src/db.js', '--blocked', 'tenant isolation strategy?', '--notes', Array.from({ length: 14 }, (_, i) => `note line ${i + 1}`).join('\n')]);
  assert.equal(ck.status, 0, ck.stderr);
  const out = renderStatus(p.root);
  assert.match(out, /branch: main \| slice: 2: create invoice \| plan: docs\/plans\/2026-09-06-slice-2\.md\nnext_step: slice 2: create invoice\nblocked_on: tenant isolation strategy\?\nfiles_modified: src\/invoices\.js, src\/db\.js/);
  assert.ok(out.includes('note line 1') && !out.includes('note line 14'), 'prose capped at 10 lines');
  assert.match(out, /\(\+\d+ more lines, open the file if needed\)/);
  assert.match(out, /^to continue: blocked: put the question in blocked_on to the user and wait/m, 'a block outranks everything');
});

test('renderStatus says when the ROADMAP or the checkpoint is missing', () => {
  const p = makeProject({ roadmap: false, git: false });
  const out = renderStatus(p.root);
  assert.match(out, /## roadmap phase\n\(docs\/ROADMAP\.md missing or without phase headings\)/);
  assert.match(out, /## open plans \(0; incidents first\)\n\(none\)/);
  rmSync(join(p.root, '.acdev', 'checkpoints'), { recursive: true, force: true });
  p.write('.acdev/state.md', '# acdev state\n\nstage: build\nupdated: 2026-09-06\nacdev_version: 0.3.0\nlanguage: english\n');
  const bare = renderStatus(p.root);
  assert.match(bare, /state: stage build \| updated 2026-09-06 \| acdev_version 0\.3\.0 \| language english\n\n## checkpoint\n\(none\)/);
});

test('renderStatus without .acdev offers onboard or new-project and nothing else', () => {
  const p = makeProject({ git: false });
  const out = renderStatus(join(p.root, 'src'));
  assert.equal(out.split('\n').length, 2);
  assert.match(out, /^# acdev status\nno \.acdev\/ in this project[^\n]*\/acdev:onboard[^\n]*\/acdev:new-project/);
  assert.ok(!out.includes('## '), 'no sections invented from the code');
});

test('the last line says what continues from each stage, and a project not yet migrated is flagged', () => {
  const product = makeProject({ stage: 'product', git: false });
  assert.match(renderStatus(product.root), /to continue: docs\/PRODUCT\.md is being conversed[^\n]*the user runs \/acdev:new-project/);
  const mockups = makeProject({ stage: 'mockups', git: false });
  assert.match(renderStatus(mockups.root), /to continue: docs\/MVP\.md is approved; the mockups skill/);
  const build = makeProject({ git: false });
  assert.match(renderStatus(build.root), /to continue: the build skill: plan or continue the slice named in next_step$/);
  build.write('docs/VISION.md', '# VISION\n');
  assert.match(renderStatus(build.root), /\nlegacy: this project still keeps docs\/VISION\.md; `acdev migrate` shows what moving it/);
});

test('the guard line shows the verify commands and the receipt state', () => {
  const p = makeProject({ verify: [ok()] });
  assert.match(renderStatus(p.root), /^guard: enabled \| verify: .+ \| receipt: missing$/m);
  assert.equal(p.cli(['verify']).status, 0);
  assert.match(renderStatus(p.root), /\| receipt: fresh \(\d{4}-\d{2}-\d{2}T[^)]+\)$/m);
  p.write('.acdev/guard.json', JSON.stringify({ enabled: false, verify: [] }));
  assert.match(renderStatus(p.root), /^guard: DISABLED \| verify: none configured/m);
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
  assert.match(r.stdout, /^to continue: /m);
  assert.ok(!r.stdout.includes('<plugin-root>'));
  // From a subfolder the command still finds the project it is inside.
  const sub = p.cli(['status'], { cwd: join(p.root, 'src'), env });
  assert.match(sub.stdout, /^# acdev status\nstate: stage build/);
  const outside = p.cli(['status'], { cwd: mkdtempSync(join(tmpdir(), 'acdev-outside-')), env });
  assert.equal(outside.status, 0);
  assert.match(outside.stdout, /no \.acdev\//);
});
