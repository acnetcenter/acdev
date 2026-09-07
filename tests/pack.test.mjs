import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject } from './fixtures/project.mjs';
import { parseLayerSkill, filterItems, LAYERS } from '../scripts/lib/checklist.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN } from './fixtures/project.mjs';

test('pack carries decisions, phase, checkpoint, plans, spec entries and filtered checklists in one output', () => {
  const p = makeProject({ mockups: true, profile: { tags: ['db', 'deploys'] }, plans: [{ name: '2026-09-06-slice-1.md' }, { name: '2026-09-05-incident-500s.md' }, { name: 'old.md', status: 'shipped' }] });
  assert.equal(p.cli(['mockup-spec', '--write']).status, 0);
  const r = p.cli(['pack', '--screens', 'invoice-list,missing', '--layers', 'data,security']);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /state: stage build, language english/);
  assert.match(out, /next_step: slice 1: walking skeleton/);
  // incidents first, shipped plans excluded
  assert.match(out, /## open plans \(2\)\n- docs\/plans\/2026-09-05-incident-500s\.md\n- docs\/plans\/2026-09-06-slice-1\.md/);
  assert.match(out, /## roadmap phase\n## Phase 1: MVP/);
  assert.ok(!out.includes('team billing'), 'only the current phase section');
  assert.match(out, /## adr decisions \(1\)\n- ADR-0001: Stack \[accepted\]: Node 22 plus SQLite, deployed on Fly\./);
  assert.ok(!out.includes('Ignore me'), 'superseded ADRs are skipped');
  assert.match(out, /## invoice-list\.html\nTitle: Invoices/);
  assert.match(out, /## missing\.html\n\s+\(not in mockups\/SPEC\.md/);
  assert.match(out, /profile tags: db, deploys/);
  // multi-tenant items are tagged and the profile has no such tag
  assert.match(out, /## layer-data checklist \(\d+ of \d+ items; skipped by profile: [a-z, -]*multi-tenant/);
  assert.ok(!out.includes('tenant-owned tables must carry the tenant key'));
  assert.match(out, /pack: \d+ chars \(~\d+ tokens\)/);
});

test('pack prints the :root block of mockups/styles.css before the checklists when --layers includes frontend', () => {
  const p = makeProject({ mockups: true });
  p.write('mockups/styles.css', 'body { margin: 0; }\n:root {\n  --color-bg: #ffffff;\n  --color-primary: #2563eb;\n  --space-md: 16px;\n}\n.card { padding: var(--space-md); }\n:root { --late: 1; }\n');
  const r = p.cli(['pack', '--layers', 'frontend,api']);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /## design tokens \(mockups\/styles\.css\)\n:root \{\n  --color-bg: #ffffff;\n  --color-primary: #2563eb;\n  --space-md: 16px;\n\}\n/);
  assert.ok(!out.includes('--late'), 'only the first :root block');
  assert.ok(!out.includes('.card'), 'rules outside :root are not printed');
  assert.ok(out.indexOf('## design tokens') < out.indexOf('## layer-frontend checklist'), 'tokens come before the checklists');
  // without frontend in --layers the section is absent; without the file it is absent too
  assert.ok(!p.cli(['pack', '--layers', 'api']).stdout.includes('## design tokens'));
  const q = makeProject({ mockups: true });
  assert.ok(!q.cli(['pack', '--layers', 'frontend']).stdout.includes('## design tokens'));
});

test('pack strips CSS comments before reading :root, so a brace inside a comment does not cut the block', () => {
  const p = makeProject({ mockups: true });
  p.write('mockups/styles.css', '/* tokens { start */\n:root {\n  --color-bg: #ffffff; /* was #fff } once */\n  /* spacing\n     scale } */\n  --space-md: 16px;\n}\n.card { padding: var(--space-md); }\n');
  const r = p.cli(['pack', '--layers', 'frontend']);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout;
  assert.match(out, /## design tokens \(mockups\/styles\.css\)\n:root \{\n  --color-bg: #ffffff; \n  \n  --space-md: 16px;\n\}\n/);
  assert.ok(!out.includes('was #fff'), 'comments are not printed');
  assert.ok(!out.includes('.card'), 'the block ends at its real closing brace');
});

test('pack without a project says so instead of inventing state', () => {
  const p = makeProject({ git: false });
  const r = p.cli(['pack'], { cwd: join(p.root, 'src') });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no \.acdev\//);
});

test('every layer checklist file parses into a non-empty checklist and tagged items filter by profile', () => {
  for (const layer of LAYERS) {
    const raw = readFileSync(join(PLUGIN, 'skills', `layer-${layer}`, 'references', 'checklist.md'), 'utf8');
    const { items, pitfalls } = parseLayerSkill(raw);
    assert.ok(items.length >= 5, `layer-${layer}: ${items.length} items`);
    assert.ok(pitfalls.length >= 3, `layer-${layer}: ${pitfalls.length} pitfalls`);
    for (const it of items) assert.ok(!/^\[/.test(it.text), `layer-${layer}: tag marker left in text: ${it.text.slice(0, 40)}`);
  }
  const items = [{ text: 'a', tags: [] }, { text: 'b', tags: ['payments'] }, { text: 'c', tags: ['jobs', 'external-apis'] }];
  assert.deepEqual(filterItems(items, null).kept.map((i) => i.text), ['a', 'b', 'c']);
  assert.deepEqual(filterItems(items, { tags: ['external-apis'] }).kept.map((i) => i.text), ['a', 'c']);
  assert.deepEqual(filterItems(items, { tags: [] }).skipped.map((i) => i.text), ['b', 'c']);
});

test('checklist command needs --layers and rejects unknown layers', () => {
  const p = makeProject({ git: false });
  assert.equal(p.cli(['checklist']).status, 1);
  const bad = p.cli(['checklist', '--layers', 'api,nope']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown layer\(s\): nope/);
  const good = p.cli(['checklist', '--layers', 'api', '--pitfalls']);
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /profile: none/);
  assert.match(good.stdout, /## layer-api checklist \(\d+ of \d+ items\)/);
  assert.match(good.stdout, /## layer-api pitfalls/);
});
