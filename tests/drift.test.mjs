import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identifiersFor, matchingLines, driftCandidates } from '../scripts/lib/drift.mjs';
import { makeProject } from './fixtures/project.mjs';

test('identifiers come from code paths and meaningful basenames only', () => {
  const ids = identifiersFor(['src/invoices.js', 'src/index.js', 'docs/ARCHITECTURE.md', 'lib/pricing.test.ts', 'README.md']);
  assert.deepEqual([...ids.keys()].sort(), ['lib/pricing.test.ts', 'pricing', 'src/index.js', 'src/invoices.js', 'invoices'].sort());
  assert.ok(!ids.has('index'), 'generic basenames are not identifiers');
});

test('matchingLines numbers from 1, keeps at most 3 lines and cuts each at 120 chars', () => {
  const long = `invoices ${'x'.repeat(200)}`;
  const text = ['# Doc', '  invoices first', 'nothing', long, 'invoices third', 'invoices fourth'].join('\n');
  const lines = matchingLines(text, ['invoices']);
  assert.deepEqual(lines.map((l) => l.n), [2, 4, 5], 'three hits, the fourth is dropped');
  assert.equal(lines[0].text, 'invoices first', 'trimmed');
  assert.equal(lines[1].text.length, 120);
  assert.deepEqual(matchingLines('no hit here', ['invoices']), []);
});

test('drift lists the docs that mention the changed files with their lines, ROADMAP always, plans never', () => {
  const p = makeProject({ plans: [{ name: '2026-09-06-slice-1.md' }] });
  p.write('docs/plans/2026-09-06-slice-1.md', '---\ndate: 2026-09-06\nstatus: active\n---\n\nTouches src/invoices.js\n');
  p.write('src/invoices.js', 'export const invoices = [1];\n');
  p.write('src/pricing.js', 'export const price = 1;\n');
  const r = p.cli(['drift']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^drift: 2 code file\(s\) changed/);
  assert.match(r.stdout, /docs\/ARCHITECTURE\.md: src\/invoices\.js, invoices\n    3: The invoices module lives in src\/invoices\.js\./, 'grep -n style line under the doc');
  assert.match(r.stdout, /docs\/ROADMAP\.md: invoices\n    8: Exit criteria: users can create invoices\./, 'the fixture roadmap mentions invoices');
  assert.ok(!r.stdout.includes('docs/plans/'), 'plans are not drift targets');
  assert.ok(!r.stdout.includes('docs/README.md'), 'the index has its own check');
  // The synthetic ROADMAP candidate shows the current phase heading, not a grep.
  p.write('docs/ROADMAP.md', '# Roadmap\n\n## Phase 1: MVP (complete)\n\n- nothing named\n\n## Phase 2: Teams\n\n- team billing\n');
  const again = p.cli(['drift']).stdout;
  assert.match(again, /docs\/ROADMAP\.md: phase state, always\n    7: ## Phase 2: Teams/);
  // A doc with many mentions is cut to three lines.
  p.write('docs/ARCHITECTURE.md', '# Architecture\n\ninvoices a\ninvoices b\ninvoices c\ninvoices d\n');
  const cut = p.cli(['drift']).stdout;
  assert.match(cut, /docs\/ARCHITECTURE\.md: invoices\n    3: invoices a\n    4: invoices b\n    5: invoices c\n  docs\/ROADMAP/);
  assert.ok(!cut.includes('invoices d'));
});

test('drift scans the root CLAUDE.md and AGENTS.md, so a probe named in a lesson surfaces when its file changes', () => {
  const p = makeProject();
  p.write('CLAUDE.md', '# Router\n\n## Lessons\n\n- Run scripts/verify/invoices-probe.mjs before the API tests (2026-09-06, slice 2)\n');
  p.write('AGENTS.md', '# Router\n\n## Lessons\n\n- Run scripts/verify/invoices-probe.mjs before the API tests (2026-09-06, slice 2)\n');
  p.g(['add', '-A']);
  p.g(['commit', '-q', '-m', 'routers']);
  p.write('scripts/verify/invoices-probe.mjs', 'process.exit(0);\n');
  const r = p.cli(['drift']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^drift: 1 code file\(s\) changed/);
  assert.match(r.stdout, /\n  CLAUDE\.md: scripts\/verify\/invoices-probe\.mjs, invoices-probe\n    5: - Run scripts\/verify\/invoices-probe\.mjs before the API tests/);
  assert.match(r.stdout, /\n  AGENTS\.md: scripts\/verify\/invoices-probe\.mjs, invoices-probe\n    5: /);
  const { candidates } = driftCandidates(p.root, ['scripts/verify/invoices-probe.mjs']);
  assert.deepEqual(candidates.map((c) => c.doc), ['CLAUDE.md', 'AGENTS.md', 'docs/ROADMAP.md'], 'matched docs first, the synthetic ROADMAP last');
  assert.deepEqual(candidates.at(-1).ids, ['phase state, always']);
  assert.deepEqual(candidates.at(-1).lines, [{ n: 3, text: '## Phase 1: MVP' }]);
  // Absent routers are simply not candidates.
  const bare = makeProject();
  bare.write('scripts/verify/invoices-probe.mjs', 'process.exit(0);\n');
  assert.ok(!bare.cli(['drift']).stdout.includes('CLAUDE.md'));
});
