import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { makeProject, PLUGIN } from './fixtures/project.mjs';

test('usage on no command, exit 1 on an unknown one', () => {
  const p = makeProject({ git: false });
  const none = p.cli([]);
  assert.equal(none.status, 0);
  assert.match(none.stdout, /usage: acdev <command>/);
  const bad = p.cli(['frobnicate']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown command "frobnicate"/);
  const badFlag = p.cli(['status', '--nope']);
  assert.equal(badFlag.status, 1);
  assert.match(badFlag.stderr, /usage:/);
});

test('a command removed in 0.5.0 says so instead of looking unknown', () => {
  const p = makeProject({ git: false });
  for (const gone of ['next', 'pack', 'checklist', 'run', 'cost', 'lessons']) {
    const r = p.cli([gone]);
    assert.equal(r.status, 1, gone);
    assert.match(r.stderr, new RegExp(`"${gone}" was removed in 0\\.5\\.0`));
  }
});

test('checkpoint delegates to its script in the project', () => {
  const p = makeProject({ git: false });
  const r = p.cli(['checkpoint', 'read']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /stage: build/);
  assert.match(r.stdout, /latest checkpoint/);
  // The stage that used to be called "vision" is written as product.
  const w = p.cli(['checkpoint', 'write', '--stage', 'vision', '--branch', 'main', '--next', 'interview']);
  assert.equal(w.status, 0, w.stderr);
  assert.match(p.cli(['checkpoint', 'read']).stdout, /^stage: product$/m);
});

test('the bin shims start the same CLI', () => {
  const p = makeProject({ git: false });
  const shim = process.platform === 'win32' ? join(PLUGIN, 'bin', 'acdev.cmd') : join(PLUGIN, 'bin', 'acdev');
  const r = process.platform === 'win32'
    ? spawnSync('cmd', ['/c', shim, 'status'], { cwd: p.root, encoding: 'utf8' })
    : spawnSync('sh', [shim, 'status'], { cwd: p.root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^# acdev status\nstate: stage build/);
});

test('q keeps an argument with spaces whole, whether it comes as words or as one command line', () => {
  const p = makeProject({ git: false });
  p.write('my dir/x y.js', "console.log('# tests 1');console.log('# pass 1');\n");
  const words = p.cli(['q', '--', process.execPath, 'my dir/x y.js']);
  assert.equal(words.status, 0, words.stdout + words.stderr);
  assert.match(words.stdout, /q: OK/);
  assert.match(words.stdout, /# pass 1/);
  const line = p.cli(['q', '--', `"${process.execPath}" "my dir/x y.js"`]);
  assert.equal(line.status, 0, line.stdout + line.stderr);
  assert.match(line.stdout, /# pass 1/);
});

test('a scaffold target cannot leave the project', () => {
  const p = makeProject({ git: false });
  // A name of its own: the parent is the shared temp dir.
  const name = `escaped-${process.pid}-${Date.now()}.md`;
  const r = p.cli(['scaffold', 'adr', `../${name}`]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /refused: \.\.\/escaped-\S+\.md leaves the project/);
  assert.ok(!existsSync(join(p.root, '..', name)));
  const v = p.cli(['scaffold', 'mockup-variant', '../x.html', 'empty']);
  assert.equal(v.status, 1);
  assert.match(v.stdout, /leaves the project/);
});

test('a file name with an accent reaches the checkpoint as it is', () => {
  const p = makeProject({ verify: [], plans: [] });
  p.write('src/cañón.js', 'export const x = 1;\n');
  const r = p.cli(['close', '--slice', 'change: cannon', '--next', 'slice 2', '--changelog', 'Cannon added']);
  assert.equal(r.status, 0, r.stdout);
  const rel = r.stdout.match(/^ {2}checkpoint: (\S+)$/m)[1];
  assert.match(readFileSync(join(p.root, ...rel.split('/')), 'utf8'), /files_modified: \[[^\]]*"src\/cañón\.js"/);
});
