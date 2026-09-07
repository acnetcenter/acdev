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
const settingsOf = (root) => JSON.parse(readFileSync(at(root, '.claude/settings.json'), 'utf8'));
const run = (root, opts) => scaffold(root, { pluginRoot: PLUGIN, ...opts });

test('scaffold guard copies the hook and configs byte for byte, merges settings and extends .gitignore', () => {
  const p = makeProject({ commit: false });
  rmSync(at(p.root, '.acdev/guard.json'));
  const r = run(p.root, { what: 'guard' });
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^written: \.claude\/hooks\/acdev-guard\.mjs$/m);
  assert.match(r.text, /^written: \.acdev\/guard\.json$/m);
  assert.match(r.text, /^written: \.acdev\/profile\.json$/m);
  assert.match(r.text, /^merged: \.claude\/settings\.json \(2 allow pattern\(s\), 2 PreToolUse hook\(s\) added\)$/m);
  assert.match(r.text, /^appended: \.gitignore \(\.acdev\/cost\.jsonl\)$/m);
  assert.match(r.text, /acdev-guard\.mjs status/);
  assert.deepEqual(bytes(at(p.root, '.claude/hooks/acdev-guard.mjs')), bytes(T('guard-hook.mjs')));
  assert.deepEqual(bytes(at(p.root, '.acdev/guard.json')), bytes(T('guard.json')));
  assert.deepEqual(bytes(at(p.root, '.acdev/profile.json')), bytes(T('profile.json')));
  assert.deepEqual(settingsOf(p.root), JSON.parse(readFileSync(T('guard-settings.json'), 'utf8')));
  const ignore = readFileSync(at(p.root, '.gitignore'), 'utf8');
  assert.equal(ignore, '.acdev/verify-receipt.json\n.acdev/freeze.json\n.acdev/cost.jsonl\n');
  // The copy is runnable from its installed path.
  const s = spawnSync(process.execPath, [at(p.root, '.claude/hooks/acdev-guard.mjs'), 'status'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(s.status, 0, s.stderr);
  assert.match(s.stdout, /^acdev guard: enabled$/m);
  assert.match(s.stdout, /^stage: build$/m);
});

test('scaffold guard keeps the .gitignore line terminator (CRLF stays CRLF)', () => {
  const p = makeProject({ commit: false });
  p.write('.gitignore', 'node_modules/\r\n.acdev/verify-receipt.json\r\n');
  const r = run(p.root, { what: 'guard' });
  assert.equal(r.ok, true, r.text);
  const out = readFileSync(at(p.root, '.gitignore'), 'utf8');
  assert.equal(out, 'node_modules/\r\n.acdev/verify-receipt.json\r\n.acdev/freeze.json\r\n.acdev/cost.jsonl\r\n');
  assert.doesNotMatch(out, /[^\r]\n/, 'no lone LF');
});

test('scaffold guard is idempotent: a second run changes nothing, --force recopies', () => {
  const p = makeProject({ commit: false });
  p.write('.acdev/guard.json', '{ "enabled": true, "verify": ["npm test"] }\n');
  run(p.root, { what: 'guard' });
  const before = { settings: readFileSync(at(p.root, '.claude/settings.json'), 'utf8'), ignore: readFileSync(at(p.root, '.gitignore'), 'utf8') };
  const r = run(p.root, { what: 'guard' });
  assert.equal(r.ok, true);
  assert.match(r.text, /^skipped: \.claude\/hooks\/acdev-guard\.mjs \(exists; --force overwrites\)$/m);
  assert.match(r.text, /^skipped: \.acdev\/guard\.json/m);
  assert.match(r.text, /^skipped: \.acdev\/profile\.json/m);
  assert.match(r.text, /^unchanged: \.claude\/settings\.json/m);
  assert.match(r.text, /^unchanged: \.gitignore/m);
  assert.equal(readFileSync(at(p.root, '.claude/settings.json'), 'utf8'), before.settings);
  assert.equal(readFileSync(at(p.root, '.gitignore'), 'utf8'), before.ignore);
  assert.match(readFileSync(at(p.root, '.acdev/guard.json'), 'utf8'), /npm test/, 'the project policy survives');
  const f = run(p.root, { what: 'guard', force: true });
  assert.match(f.text, /^written: \.acdev\/guard\.json$/m);
  assert.deepEqual(bytes(at(p.root, '.acdev/guard.json')), bytes(T('guard.json')));
});

test('scaffold guard merges into a settings.json that already has other keys and one of the hooks', () => {
  const p = makeProject({ commit: false });
  const existing = {
    model: 'sonnet',
    permissions: { allow: ['Bash(npm test)', 'Bash(git *)'], deny: ['Read(.env)'] },
    hooks: {
      PreToolUse: [
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'node "${CLAUDE_PROJECT_DIR}/.claude/hooks/acdev-guard.mjs"', timeout: 30 }] },
        { matcher: 'Bash', hooks: [{ type: 'command', command: 'node lint-bash.mjs' }] }
      ],
      Stop: [{ hooks: [{ type: 'command', command: 'echo done' }] }]
    }
  };
  p.write('.claude/settings.json', JSON.stringify(existing, null, 2) + '\n');
  const r = run(p.root, { what: 'guard' });
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^merged: \.claude\/settings\.json \(1 allow pattern\(s\), 1 PreToolUse hook\(s\) added\)$/m);
  const s = settingsOf(p.root);
  assert.equal(s.model, 'sonnet');
  assert.deepEqual(s.permissions.deny, ['Read(.env)']);
  assert.deepEqual(s.permissions.allow, ['Bash(npm test)', 'Bash(git *)', 'Bash(node *)']);
  assert.deepEqual(s.hooks.Stop, existing.hooks.Stop);
  assert.equal(s.hooks.PreToolUse.length, 3);
  assert.equal(s.hooks.PreToolUse[2].matcher, 'Edit|Write|MultiEdit|NotebookEdit');
  assert.equal(s.hooks.PreToolUse.filter((e) => e.matcher === 'Bash').length, 2, 'the existing Bash guard entry is not duplicated');
  const again = run(p.root, { what: 'guard' });
  assert.match(again.text, /^unchanged: \.claude\/settings\.json/m);
  assert.equal(settingsOf(p.root).hooks.PreToolUse.length, 3);
});

test('scaffold guard refuses a settings.json that does not parse and leaves it alone', () => {
  const p = makeProject({ commit: false });
  p.write('.claude/settings.json', '{ not json');
  const r = run(p.root, { what: 'guard' });
  assert.equal(r.ok, false);
  assert.match(r.text, /^error: \.claude\/settings\.json is not valid JSON/m);
  assert.equal(readFileSync(at(p.root, '.claude/settings.json'), 'utf8'), '{ not json');
});

test('scaffold verify writes one stub per layer, design-tells for frontend and the canary on request', () => {
  const p = makeProject({ commit: false });
  const r = run(p.root, { what: 'verify', layers: ['api', 'frontend'], canary: true });
  assert.equal(r.ok, true, r.text);
  for (const [rel, template] of [['scripts/verify/api.mjs', 'verify-script-stub.mjs'], ['scripts/verify/frontend.mjs', 'verify-script-stub.mjs'], ['scripts/verify/design-tells.mjs', 'verify-design-tells.mjs'], ['scripts/verify/canary.mjs', 'canary-stub.mjs']]) {
    assert.match(r.text, new RegExp(`^written: ${rel.replace(/[./]/g, '\\$&')}$`, 'm'));
    assert.deepEqual(bytes(at(p.root, rel)), bytes(T(template)), `${rel} is a byte copy of ${template}`);
  }
  assert.ok(!existsSync(at(p.root, 'scripts/verify/data.mjs')));
  const again = run(p.root, { what: 'verify', layers: ['api'] });
  assert.match(again.text, /^skipped: scripts\/verify\/api\.mjs \(exists; --force overwrites\)$/m);
  assert.ok(!existsSync(at(p.root, 'scripts/verify/design-tells.mjs.bak')));
  const data = run(p.root, { what: 'verify', layers: ['data'] });
  assert.match(data.text, /^written: scripts\/verify\/data\.mjs$/m);
  assert.doesNotMatch(data.text, /design-tells|canary/);
});

test('scaffold verify rejects an unknown layer and an empty request', () => {
  const p = makeProject({ commit: false });
  const r = run(p.root, { what: 'verify', layers: ['api', 'blockchain'] });
  assert.equal(r.ok, false);
  assert.match(r.text, /unknown layer\(s\): blockchain \(expected frontend, api, data/);
  assert.ok(!existsSync(at(p.root, 'scripts/verify/api.mjs')), 'nothing written on a bad request');
  const e = run(p.root, { what: 'verify' });
  assert.equal(e.ok, false);
  assert.match(e.text, /--layers/);
});

test('scaffold <template> materializes the fenced block with its preamble, creating parent dirs', () => {
  const p = makeProject({ commit: false });
  const r = run(p.root, { what: 'runbook', target: 'docs/ops/RUNBOOK.md' });
  assert.equal(r.ok, true, r.text);
  assert.match(r.text, /^written: docs\/ops\/RUNBOOK\.md \(from runbook\.md\)$/m);
  assert.match(r.text, /Cap:\s+about 100 lines/, 'the preamble carries the cap');
  assert.ok(r.text.trimEnd().endsWith('replace each <...> placeholder and each <!-- ... --> guidance comment with real content; grep for < and <!-- before the gate'), r.text);
  const out = readFileSync(at(p.root, 'docs/ops/RUNBOOK.md'), 'utf8');
  const raw = readFileSync(T('runbook.md'), 'utf8');
  assert.equal(out, splitTemplate(raw).body);
  assert.ok(out.startsWith('# Runbook\n'), 'the file starts at the block, not at the template heading');
  assert.doesNotMatch(out, /^```/m, 'no fence survives');
  assert.ok(raw.includes(out.trimEnd()), 'the body is a verbatim slice of the template');
  assert.match(out, /<url>/);
});

test('scaffold <template> copies a template without a fence whole, and every template name resolves', () => {
  const p = makeProject({ commit: false });
  const r = run(p.root, { what: 'vision', target: 'docs/VISION.md' });
  assert.equal(r.ok, true, r.text);
  assert.deepEqual(bytes(at(p.root, 'docs/VISION.md')), bytes(T('vision.md')));
  assert.doesNotMatch(r.text, /\n\n[^\n]+\n\nreplace each/, 'no preamble when the file has no fence');
  assert.ok(r.text.trimEnd().endsWith('grep for < and <!-- before the gate'), 'the closing line names the guidance comments the vision template carries');
  for (const [name, target] of [['incident', 'docs/plans/2026-09-06-incident-x.md'], ['router', 'CLAUDE.md'], ['docs-index', 'docs/README.md'], ['mvp', 'docs/MVP.md'], ['mockups-inventory', 'mockups/INVENTORY.md'], ['adr', 'docs/adr/0009-x.md']]) {
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
  for (const [name, target] of [['router', 'CLAUDE.md'], ['runbook', 'docs/RUNBOOK.md'], ['adr', 'docs/adr/0001-x.md']]) {
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
  const notHtml = run(p.root, { what: 'mockup-variant', target: 'docs/VISION.md', state: 'empty' });
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
  const ok = p.cli(['scaffold', 'verify', '--layers', 'auth,security', '--canary']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /written: scripts\/verify\/auth\.mjs/);
  assert.match(ok.stdout, /written: scripts\/verify\/security\.mjs/);
  assert.match(ok.stdout, /written: scripts\/verify\/canary\.mjs/);
  const bad = p.cli(['scaffold', 'runbook']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /target path is required/);
  const none = p.cli(['scaffold']);
  assert.equal(none.status, 1);
  assert.match(none.stderr, /say what to scaffold/);
});
