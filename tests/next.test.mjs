import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chooseStep } from '../scripts/lib/next.mjs';
import { makeProject, PLUGIN } from './fixtures/project.mjs';

const ck = (fields) => ({ fields });

test('chooseStep maps every situation to one step file', () => {
  const base = { hasAcdev: true, stage: 'build', checkpoint: ck({ next_step: 'slice 2' }), plans: [], dirty: false, change: null };
  assert.equal(chooseStep({ ...base, hasAcdev: false }), 'no-project');
  assert.equal(chooseStep({ ...base, stage: 'nonsense' }), 'no-project');
  for (const s of ['intake', 'vision', 'mvp', 'mockups', 'blueprint']) assert.equal(chooseStep({ ...base, stage: s }), `stage-${s}`);
  assert.equal(chooseStep(base), 'build-plan');
  assert.equal(chooseStep({ ...base, dirty: true }), 'build-construct');
  assert.equal(chooseStep({ ...base, checkpoint: ck({ blocked_on: 'tenant model?' }) }), 'build-blocked');
  assert.equal(chooseStep({ ...base, plans: ['docs/plans/2026-09-06-incident-500s.md'] }), 'build-incident');
  assert.equal(chooseStep({ ...base, checkpoint: ck({ next_step: 'phase exit: run the gate' }) }), 'build-phase-exit');
  assert.equal(chooseStep({ ...base, change: 'rounding' }), 'build-change');
  // An incident outranks a block, a block outranks a change.
  assert.equal(chooseStep({ ...base, plans: ['docs/plans/x-incident-y.md'], checkpoint: ck({ blocked_on: 'q' }) }), 'build-incident');
  assert.equal(chooseStep({ ...base, checkpoint: ck({ blocked_on: 'q' }), change: 'x' }), 'build-blocked');
  const steps = new Set(readdirSync(join(PLUGIN, 'scripts', 'steps')).map((f) => f.replace(/\.md$/, '')));
  for (const id of ['no-project', 'stage-intake', 'stage-vision', 'stage-mvp', 'stage-mockups', 'stage-blueprint', 'build-plan', 'build-construct', 'build-blocked', 'build-incident', 'build-phase-exit', 'build-change']) {
    assert.ok(steps.has(id), `missing step file ${id}.md`);
  }
});

test('next prints the step with the plugin root filled in and the state header', () => {
  const p = makeProject({ plans: [{ name: '2026-09-06-slice-1-skeleton.md' }] });
  const clean = p.cli(['next']);
  assert.equal(clean.status, 0, clean.stderr);
  assert.match(clean.stdout, /^acdev next: build-plan\nstage build/);
  assert.match(clean.stdout, /open plans: docs\/plans\/2026-09-06-slice-1-skeleton\.md/);
  assert.ok(!clean.stdout.includes('<plugin-root>'));
  assert.ok(clean.stdout.includes('/scripts/acdev.mjs" pack'));
  assert.ok(!/[A-Za-z]:\\/.test(clean.stdout.split('\n').find((l) => l.includes('acdev.mjs')) ?? ''), 'plugin root uses forward slashes');
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  const dirty = p.cli(['next']);
  assert.match(dirty.stdout, /^acdev next: build-construct\nstage build \| uncommitted changes/);
  assert.match(dirty.stdout, /close --check/);
  const change = p.cli(['next', '--change', 'invoice rounding']);
  assert.match(change.stdout, /^acdev next: build-change/);
  assert.match(change.stdout, /"invoice rounding"/);
  p.checkpoint(['--next', 'slice 2', '--blocked', 'tenant isolation strategy?']);
  assert.match(p.cli(['next']).stdout, /^acdev next: build-blocked\n[\s\S]*blocked_on: tenant isolation strategy\?/);
});

test('next outside a project offers the user-run entry points', () => {
  const p = makeProject({ git: false });
  const r = p.cli(['next'], { cwd: join(p.root, 'src') });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no-project/);
  assert.match(r.stdout, /\/acdev:onboard/);
});

test('step files stay under budget and carry no emoji', () => {
  const dir = join(PLUGIN, 'scripts', 'steps');
  for (const f of readdirSync(dir)) {
    const raw = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(raw.length <= 1500, `${f}: ${raw.length} chars > 1500`);
    assert.doesNotMatch(raw, /\p{Extended_Pictographic}/u, `${f}: emoji`);
  }
});
