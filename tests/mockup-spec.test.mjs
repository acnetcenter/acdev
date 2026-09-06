import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractScreen } from '../scripts/lib/mockup-spec.mjs';
import { makeProject } from './fixtures/project.mjs';

test('extractScreen reads title, headings, nav, fields with labels, columns, buttons and page links', () => {
  const html = readFileSync(join(makeProject({ git: false, mockups: true }).root, 'mockups', 'invoice-list.html'), 'utf8');
  const x = extractScreen(html);
  assert.equal(x.title, 'Invoices');
  assert.deepEqual(x.headings, ['Invoices', 'Open']);
  assert.deepEqual(x.nav, ['Dashboard -> dashboard.html', 'Invoices -> invoice-list.html']);
  assert.deepEqual(x.fields, ['Search [q] (search)', 'status (select)']);
  assert.deepEqual(x.columns, ['Number', 'Client', 'Amount']);
  assert.deepEqual(x.buttons, ['New invoice', 'Filter']);
  assert.deepEqual(x.links, ['invoice-detail.html']);
});

test('mockup-spec --write produces one entry per screen with states and keeps hand-written intents', () => {
  const p = makeProject({ git: false, mockups: true });
  const first = p.cli(['mockup-spec', '--write']);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /wrote mockups\/SPEC\.md \(2 screen\(s\)/);
  let spec = readFileSync(join(p.root, 'mockups', 'SPEC.md'), 'utf8');
  assert.match(spec, /## dashboard\.html\nTitle: Dashboard\nHeadings: Dashboard\nIntent: <one line/);
  assert.match(spec, /## invoice-list\.html\n[\s\S]*States: invoice-list-empty\.html\nIntent: <one line/);
  assert.ok(!spec.includes('## index.html'));
  spec = spec.replace('## invoice-list.html\nTitle: Invoices', '## invoice-list.html\nTitle: Invoices').replace(/(## invoice-list\.html[\s\S]*?)Intent: <one line[^\n]*/, '$1Intent: the user finds an invoice by client and opens it.');
  p.write('mockups/SPEC.md', spec);
  p.write('mockups/invoice-list.html', readFileSync(join(p.root, 'mockups', 'invoice-list.html'), 'utf8').replace('<h2>Open</h2>', '<h2>Open</h2><h2>Paid</h2>'));
  assert.equal(p.cli(['mockup-spec', '--write']).status, 0);
  const again = readFileSync(join(p.root, 'mockups', 'SPEC.md'), 'utf8');
  assert.match(again, /Headings: Invoices \| Open \| Paid/);
  assert.match(again, /Intent: the user finds an invoice by client and opens it\./);
  assert.match(again, /## dashboard\.html[\s\S]*Intent: <one line/);
});

test('mockup-spec without mockups says so', () => {
  const p = makeProject({ git: false });
  assert.match(p.cli(['mockup-spec']).stdout, /no mockups\/\*\.html found/);
  const w = p.cli(['mockup-spec', '--write']);
  assert.equal(w.status, 1);
  assert.match(w.stderr, /mockups\/ not found/);
});
