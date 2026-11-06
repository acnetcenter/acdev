import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeProject, PLUGIN } from './fixtures/project.mjs';
import { scaffold, splitTemplate } from '../scripts/lib/scaffold.mjs';

const T = (name) => join(PLUGIN, 'shared', 'references', 'templates', name);
const bytes = (p) => readFileSync(p);
const at = (root, rel) => join(root, ...rel.split('/'));
const run = (root, opts) => scaffold(root, { pluginRoot: PLUGIN, ...opts });

test('init writes the guard config and ignores the receipt; nothing else is installed', () => {
  const p = makeProject({ commit: false });
  rmSync(at(p.root, '.acdev/guard.json'));
  p.write('.gitignore', 'node_modules/\n');
  const r = run(p.root, { what: 'init' });
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^written: \.acdev\/guard\.json$/m);
  assert.match(r.text, /^appended: \.gitignore \(\.acdev\/verify-receipt\.json\)$/m);
  assert.deepEqual(bytes(at(p.root, '.acdev/guard.json')), bytes(T('guard.json')));
  assert.ok(!existsSync(at(p.root, '.claude/hooks/acdev-guard.mjs')), 'the guard ships with the plugin');
  assert.ok(!existsSync(at(p.root, '.claude/settings.json')), 'no settings are touched');
  // Idempotent: a second run changes nothing; --force recopies the config.
  p.write('.acdev/guard.json', '{ "enabled": true, "verify": ["npm test"] }\n');
  const again = run(p.root, { what: 'init' });
  assert.match(again.text, /^skipped: \.acdev\/guard\.json \(exists; --force overwrites\)$/m);
  assert.match(again.text, /^unchanged: \.gitignore/m);
  assert.match(readFileSync(at(p.root, '.acdev/guard.json'), 'utf8'), /npm test/);
  assert.equal(run(p.root, { what: 'init', force: true }).ok, true);
  assert.deepEqual(bytes(at(p.root, '.acdev/guard.json')), bytes(T('guard.json')));
});

test('init keeps the .gitignore line terminator (CRLF stays CRLF)', () => {
  const p = makeProject({ commit: false });
  p.write('.gitignore', 'node_modules/\r\ndist/\r\n');
  run(p.root, { what: 'init' });
  assert.equal(readFileSync(at(p.root, '.gitignore'), 'utf8'), 'node_modules/\r\ndist/\r\n.acdev/verify-receipt.json\r\n');
});

test('renamed and retired scaffold targets say what replaced them', () => {
  const p = makeProject({ commit: false });
  assert.match(run(p.root, { what: 'vision', target: 'docs/X.md' }).text, /renamed: use scaffold product/);
  assert.match(run(p.root, { what: 'router', target: 'CLAUDE.md' }).text, /renamed: use scaffold claude-md/);
  assert.match(run(p.root, { what: 'guard' }).text, /ships with the plugin/);
  assert.ok(!existsSync(at(p.root, 'docs/X.md')));
});

test('scaffold <template> materializes the fenced block with its preamble, creating parent dirs', () => {
  const p = makeProject({ commit: false });
  const r = run(p.root, { what: 'runbook', target: 'docs/ops/RUNBOOK.md' });
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^written: docs\/ops\/RUNBOOK\.md \(from runbook\.md\)$/m);
  assert.match(r.text, /Cap:\s+about 100 lines/, 'the preamble carries the cap');
  assert.ok(r.text.trimEnd().endsWith('grep for < and <!-- before the gate'), r.text);
  const out = readFileSync(at(p.root, 'docs/ops/RUNBOOK.md'), 'utf8');
  const raw = readFileSync(T('runbook.md'), 'utf8');
  assert.equal(out, splitTemplate(raw).body);
  // The terminator is the template's own (see the CRLF test below): a
  // Windows checkout with core.autocrlf=true hands runbook.md back as CRLF.
  assert.match(out, /^# Runbook\r?\n/, 'the file starts at the block, not at the template heading');
  assert.doesNotMatch(out, /^```/m, 'no fence survives');
  assert.ok(raw.includes(out.trimEnd()), 'the body is a verbatim slice of the template');
  assert.match(out, /<url>/);
});

test('scaffold <template> copies a template without a fence whole, and every template name resolves', () => {
  const p = makeProject({ commit: false });
  const r = run(p.root, { what: 'product', target: 'docs/PRODUCT.md' });
  assert.equal(r.ok, true, r.text);
  assert.deepEqual(bytes(at(p.root, 'docs/PRODUCT.md')), bytes(T('product.md')));
  // The schema marker and the headings design tools read, then acdev's two.
  const product = readFileSync(at(p.root, 'docs/PRODUCT.md'), 'utf8');
  assert.match(product, /^# Product\r?\n\r?\n<!-- impeccable:product-schema 1 -->\r?\n/, 'the marker sits under the title, where Impeccable writes it');
  assert.match(r.text, /keep the `impeccable:product-schema` line as it is/);
  const heads = [...product.matchAll(/^## (.+?)\r?$/gm)].map((m) => m[1]);
  assert.deepEqual(heads, ['Platform', 'Stack', 'Users', 'Product Purpose', 'Positioning', 'Operating Context', 'Capabilities and Constraints', 'Brand Commitments', 'Evidence on Hand', 'Product Principles', 'Accessibility & Inclusion', 'Model', 'Critical Flows']);
  assert.doesNotMatch(r.text, /\n\n[^\n]+\n\nreplace each/, 'no preamble when the file has no fence');
  assert.ok(r.text.trimEnd().endsWith('grep for < and <!-- before the gate'), 'the closing line names the guidance comments the product template carries');
  for (const [name, target] of [['incident', 'docs/plans/2026-09-06-incident-x.md'], ['claude-md', 'CLAUDE.md'], ['canary', 'scripts/verify/canary.mjs'], ['mvp', 'docs/MVP.md'], ['mockups-inventory', 'mockups/INVENTORY.md'], ['adr', 'docs/adr/0009-x.md']]) {
    const x = run(p.root, { what: name, target, force: true });
    assert.equal(x.ok, true, x.text);
    assert.ok(readFileSync(at(p.root, target), 'utf8').length > 100, `${name} produced content`);
  }
  assert.ok(readFileSync(at(p.root, 'CLAUDE.md'), 'utf8').startsWith('# <Project name>'));
});

test('splitTemplate keeps the template line terminator: a CRLF template yields a CRLF file with no lone LF', () => {
  const crlf = '# Template\r\n\r\nCap: 10 lines.\r\n\r\n```markdown\r\n# <Name>\r\n\r\n- <item>\r\n```\r\n\r\nAfter.\r\n';
  const { preamble, body } = splitTemplate(crlf);
  assert.equal(preamble, '# Template\r\n\r\nCap: 10 lines.');
  assert.equal(body, '# <Name>\r\n\r\n- <item>\r\n');
  const lf = crlf.replace(/\r\n/g, '\n');
  assert.equal(splitTemplate(lf).body, '# <Name>\n\n- <item>\n');
  // Every template in the tree materializes with one terminator, whichever it uses.
  const p = makeProject({ commit: false });
  for (const [name, target] of [['claude-md', 'CLAUDE.md'], ['runbook', 'docs/RUNBOOK.md'], ['adr', 'docs/adr/0001-x.md']]) {
    assert.equal(run(p.root, { what: name, target }).ok, true);
    const out = readFileSync(at(p.root, target), 'utf8');
    const crlfCount = (out.match(/\r\n/g) ?? []).length;
    const loneLf = (out.match(/(^|[^\r])\n/g) ?? []).length;
    assert.ok(crlfCount === 0 || loneLf === 0, `${target}: ${crlfCount} CRLF and ${loneLf} lone LF mixed`);
  }
});

test('scaffold <template> refuses to overwrite without --force and needs a target', () => {
  const p = makeProject({ commit: false });
  p.write('docs/RUNBOOK.md', '# mine\n');
  const r = run(p.root, { what: 'runbook', target: 'docs/RUNBOOK.md' });
  assert.equal(r.ok, false);
  assert.match(r.text, /^refused: docs\/RUNBOOK\.md exists; pass --force/m);
  assert.equal(readFileSync(at(p.root, 'docs/RUNBOOK.md'), 'utf8'), '# mine\n');
  const f = run(p.root, { what: 'runbook', target: 'docs/RUNBOOK.md', force: true });
  assert.equal(f.ok, true);
  assert.match(readFileSync(at(p.root, 'docs/RUNBOOK.md'), 'utf8'), /^# Runbook/);
  const n = run(p.root, { what: 'runbook' });
  assert.equal(n.ok, false);
  assert.match(n.text, /target path is required/);
  const u = run(p.root, { what: 'nonsense', target: 'x.md' });
  assert.equal(u.ok, false);
  assert.match(u.text, /unknown scaffold target "nonsense"/);
  for (const inherited of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
    const i = run(p.root, { what: inherited, target: 'x.md' });
    assert.equal(i.ok, false, inherited);
    assert.match(i.text, new RegExp(`unknown scaffold target "${inherited}"`));
  }
  assert.ok(!existsSync(at(p.root, 'x.md')));
  for (const abs of [join(p.root, 'docs', 'adr', 'abs.md'), '/tmp/adr.md', 'C:/x/adr.md']) {
    const a = run(p.root, { what: 'adr', target: abs });
    assert.equal(a.ok, false, abs);
    assert.match(a.text, /target must be a path relative to the project root/);
  }
  assert.ok(!existsSync(at(p.root, 'docs/adr/abs.md')));
});

const PAGE = [
  '<!doctype html>', '<html lang="en">', '<head>', '  <title>Invoices</title>', '  <style>main { padding: 1rem; }</style>', '</head>', '<body>',
  '  <nav><a href="dashboard.html">Dashboard</a><a href="invoice-list.html">Invoices</a></nav>',
  '  <main id="content" class="list">', '    <h1>Invoices</h1>', '    <table><tr><th>Number</th><th>Client</th></tr><tr><td>INV-1</td><td>Acme</td></tr></table>', '  </main>',
  '  <footer>Demo Corp</footer>', '</body>', '</html>', ''
].join('\n');
const MARKED = (state) => `<main id="content" class="list">\n    <!-- ${state} state: write only this block -->\n  </main>`;
const around = (html) => ({ head: html.slice(0, html.indexOf('<main')), tail: html.slice(html.indexOf('</main>') + '</main>'.length) });

test('scaffold mockup-variant copies the page with only its <main> content replaced by the marker line', () => {
  const p = makeProject({ commit: false });
  p.write('mockups/invoice-list.html', PAGE);
  const r = run(p.root, { what: 'mockup-variant', target: 'mockups/invoice-list.html', state: 'empty' });
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^written: mockups\/invoice-list-empty\.html \(from mockups\/invoice-list\.html; <main> reduced to one marker line\)$/m);
  assert.match(r.text, /^next: Edit the marker line in mockups\/invoice-list-empty\.html/m);
  const out = readFileSync(at(p.root, 'mockups/invoice-list-empty.html'), 'utf8');
  assert.deepEqual(around(out), around(PAGE), 'head, nav and footer are byte-identical');
  assert.ok(out.includes(MARKED('empty')), out);
  assert.doesNotMatch(out, /INV-1|<table>|<h1>/, 'the old main content is gone');
  assert.equal((out.match(/<main\b/g) ?? []).length, 1);
  assert.equal(readFileSync(at(p.root, 'mockups/invoice-list.html'), 'utf8'), PAGE, 'the source page is untouched');
  // A page on one line keeps its own terminator convention: the marker still lands on its own line.
  p.write('mockups/one-line.html', '<html><head><title>x</title></head><body><nav>n</nav><main><p>old</p></main><footer>f</footer></body></html>');
  const one = run(p.root, { what: 'mockup-variant', target: 'mockups/one-line.html', state: 'error' });
  assert.equal(one.ok, true, one.text);
  assert.equal(readFileSync(at(p.root, 'mockups/one-line-error.html'), 'utf8'), '<html><head><title>x</title></head><body><nav>n</nav><main>\n<!-- error state: write only this block -->\n</main><footer>f</footer></body></html>');
  // CRLF pages get CRLF around the marker and nothing else changes.
  p.write('mockups/crlf.html', PAGE.replace(/\n/g, '\r\n'));
  const crlf = run(p.root, { what: 'mockup-variant', target: 'mockups/crlf.html', state: 'loading' });
  assert.equal(crlf.ok, true, crlf.text);
  const c = readFileSync(at(p.root, 'mockups/crlf-loading.html'), 'utf8');
  assert.doesNotMatch(c, /[^\r]\n/, 'no lone LF');
  assert.ok(c.includes('<main id="content" class="list">\r\n    <!-- loading state: write only this block -->\r\n  </main>'), c);
});

test('scaffold mockup-variant refuses a page without <main>, an existing variant without --force, a bad state and a missing page', () => {
  const p = makeProject({ commit: false });
  p.write('mockups/plain.html', '<html><body><h1>No main here</h1></body></html>');
  const noMain = run(p.root, { what: 'mockup-variant', target: 'mockups/plain.html', state: 'empty' });
  assert.equal(noMain.ok, false);
  assert.match(noMain.text, /^refused: mockups\/plain\.html has no <main> element/);
  assert.ok(!existsSync(at(p.root, 'mockups/plain-empty.html')));
  p.write('mockups/invoice-list.html', PAGE);
  p.write('mockups/invoice-list-empty.html', '<html><body><main>mine</main></body></html>');
  const exists = run(p.root, { what: 'mockup-variant', target: 'mockups/invoice-list.html', state: 'empty' });
  assert.equal(exists.ok, false);
  assert.match(exists.text, /^refused: mockups\/invoice-list-empty\.html exists; pass --force/);
  assert.match(readFileSync(at(p.root, 'mockups/invoice-list-empty.html'), 'utf8'), /mine/);
  const forced = run(p.root, { what: 'mockup-variant', target: 'mockups/invoice-list.html', state: 'empty', force: true });
  assert.equal(forced.ok, true, forced.text);
  assert.ok(readFileSync(at(p.root, 'mockups/invoice-list-empty.html'), 'utf8').includes(MARKED('empty')));
  const badState = run(p.root, { what: 'mockup-variant', target: 'mockups/invoice-list.html', state: 'broken' });
  assert.equal(badState.ok, false);
  assert.match(badState.text, /unknown state "broken" \(expected empty, error, loading\)/);
  const noState = run(p.root, { what: 'mockup-variant', target: 'mockups/invoice-list.html' });
  assert.equal(noState.ok, false);
  assert.match(noState.text, /a state is required, as a third positional or --state/);
  const noPage = run(p.root, { what: 'mockup-variant', state: 'empty' });
  assert.equal(noPage.ok, false);
  assert.match(noPage.text, /a page path is required/);
  const missing = run(p.root, { what: 'mockup-variant', target: 'mockups/nope.html', state: 'empty' });
  assert.equal(missing.ok, false);
  assert.match(missing.text, /mockups\/nope\.html not found/);
  const notHtml = run(p.root, { what: 'mockup-variant', target: 'docs/PRODUCT.md', state: 'empty' });
  assert.equal(notHtml.ok, false);
  assert.match(notHtml.text, /must be an \.html file/);
  const abs = run(p.root, { what: 'mockup-variant', target: join(p.root, 'mockups', 'invoice-list.html'), state: 'empty' });
  assert.equal(abs.ok, false);
  assert.match(abs.text, /relative to the project root/);
});

test('the CLI passes the variant state as a third positional or as --state', () => {
  const p = makeProject({ commit: false });
  p.write('mockups/invoice-list.html', PAGE);
  const positional = p.cli(['scaffold', 'mockup-variant', 'mockups/invoice-list.html', 'empty']);
  assert.equal(positional.status, 0, positional.stderr + positional.stdout);
  assert.match(positional.stdout, /written: mockups\/invoice-list-empty\.html/);
  const flag = p.cli(['scaffold', 'mockup-variant', 'mockups/invoice-list.html', '--state', 'error']);
  assert.equal(flag.status, 0, flag.stderr + flag.stdout);
  assert.match(flag.stdout, /written: mockups\/invoice-list-error\.html/);
  assert.ok(readFileSync(at(p.root, 'mockups/invoice-list-error.html'), 'utf8').includes(MARKED('error')));
  const again = p.cli(['scaffold', 'mockup-variant', 'mockups/invoice-list.html', 'error']);
  assert.equal(again.status, 1);
  assert.match(again.stdout, /refused: mockups\/invoice-list-error\.html exists/);
});

test('the CLI dispatches scaffold and exits non-zero on refusal', () => {
  const p = makeProject({ commit: false });
  const ok = p.cli(['scaffold', 'canary', 'scripts/verify/canary.mjs']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /written: scripts\/verify\/canary\.mjs \(from canary-stub\.mjs\)/);
  assert.match(ok.stdout, /next: adjust the checks to the bands in docs\/RUNBOOK\.md/);
  const init = p.cli(['init']);
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /\.acdev\/guard\.json/);
  const bad = p.cli(['scaffold', 'runbook']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /target path is required/);
  const none = p.cli(['scaffold']);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /say what to scaffold/);
});
