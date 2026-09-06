import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifiersFor } from '../scripts/lib/drift.mjs';
import { makeProject } from './fixtures/project.mjs';

test('identifiers come from code paths and meaningful basenames only', () => {
  const ids = identifiersFor(['src/invoices.js', 'src/index.js', 'docs/ARCHITECTURE.md', 'lib/pricing.test.ts', 'README.md']);
  assert.deepEqual([...ids.keys()].sort(), ['lib/pricing.test.ts', 'pricing', 'src/index.js', 'src/invoices.js', 'invoices'].sort());
  assert.ok(!ids.has('index'), 'generic basenames are not identifiers');
});

test('drift lists the docs that mention the changed files, ROADMAP always, plans never', () => {
  const p = makeProject({ plans: [{ name: '2026-09-06-slice-1.md' }] });
  p.write('docs/plans/2026-09-06-slice-1.md', '---\ndate: 2026-09-06\nstatus: active\n---\n\nTouches src/invoices.js\n');
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('src/pricing.js', 'export const price = 1;\n');
  const r = p.cli(['drift']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^drift: 2 code file\(s\) changed/);
  assert.match(r.stdout, /docs\/ARCHITECTURE\.md: src\/invoices\.js, invoices/);
  assert.match(r.stdout, /docs\/ROADMAP\.md: invoices/, 'the fixture roadmap mentions invoices');
  p.write('docs/ROADMAP.md', '# Roadmap\n\n## Phase 1\n\n- nothing named\n');
  assert.match(p.cli(['drift']).stdout, /docs\/ROADMAP\.md: phase state, always/);
  assert.ok(!r.stdout.includes('docs/plans/'), 'plans are not drift targets');
  assert.ok(!r.stdout.includes('docs/README.md'), 'the index has its own check');
});
