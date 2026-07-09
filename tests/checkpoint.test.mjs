import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'checkpoint.mjs');

const write = (proj, extra) => spawnSync(process.execPath, [script, 'write',
  '--stage', 'build', '--branch', 'feat/slice-1', '--next', 'wire the UI list', ...extra],
  { cwd: proj, encoding: 'utf8' });

test('write then read roundtrip', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-ckpt-'));
  const w = write(proj, ['--slice', '1: walking skeleton', '--files', 'src/a.ts,src/b.ts', '--notes', 'context line']);
  assert.equal(w.status, 0, w.stderr);
  assert.ok(existsSync(join(proj, '.acdev', 'state.md')));
  const state = readFileSync(join(proj, '.acdev', 'state.md'), 'utf8');
  assert.match(state, /acdev_version: \d+\.\d+\.\d+/);
  const files = readdirSync(join(proj, '.acdev', 'checkpoints'));
  assert.equal(files.length, 1);
  const ckpt = readFileSync(join(proj, '.acdev', 'checkpoints', files[0]), 'utf8');
  assert.match(ckpt, /stage: build/);
  assert.match(ckpt, /branch: "feat\/slice-1"/);
  assert.match(ckpt, /files_modified: \["src\/a\.ts", "src\/b\.ts"\]/);
  assert.match(ckpt, /blocked_on: null/);
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /stage: build/);
  assert.match(r.stdout, /latest checkpoint/);
});

test('rapid same-slice writes never overwrite each other', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-collide-'));
  for (const n of ['first', 'second', 'third']) {
    const w = write(proj, ['--slice', '3: same slice', '--notes', n]);
    assert.equal(w.status, 0, w.stderr);
  }
  const files = readdirSync(join(proj, '.acdev', 'checkpoints'));
  assert.equal(files.length, 3);
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.match(r.stdout, /third/); // state.md pointer wins over name sort
  // Without state.md the fallback must still pick the newest write (by
  // mtime): collision suffixes sort lexicographically BEFORE the base name.
  rmSync(join(proj, '.acdev', 'state.md'));
  const r2 = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.match(r2.stdout, /third/);
});

test('yaml-hostile values are escaped in the checkpoint frontmatter', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-yaml-'));
  const w = spawnSync(process.execPath, [script, 'write',
    '--stage', 'build', '--branch', 'release: "hot" fix',
    '--files', 'src/a b.ts,src/#c.ts', '--next', 'n'],
    { cwd: proj, encoding: 'utf8' });
  assert.equal(w.status, 0, w.stderr);
  const files = readdirSync(join(proj, '.acdev', 'checkpoints'));
  const ckpt = readFileSync(join(proj, '.acdev', 'checkpoints', files[0]), 'utf8');
  assert.ok(ckpt.includes(`branch: ${JSON.stringify('release: "hot" fix')}`));
  assert.ok(ckpt.includes('files_modified: ["src/a b.ts", "src/#c.ts"]'));
});

test('language is set via --lang and sticky across later writes', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-lang-'));
  const w1 = write(proj, ['--lang', 'spanish']);
  assert.equal(w1.status, 0, w1.stderr);
  assert.match(readFileSync(join(proj, '.acdev', 'state.md'), 'utf8'), /language: spanish/);
  const w2 = write(proj, []);
  assert.equal(w2.status, 0, w2.stderr);
  assert.match(readFileSync(join(proj, '.acdev', 'state.md'), 'utf8'), /language: spanish/);
});

test('write without required flags fails', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-bad-'));
  const r = spawnSync(process.execPath, [script, 'write', '--stage', 'build'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing --branch/);
});

test('write with an unknown stage fails and names the valid set', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-stage-'));
  const r = spawnSync(process.execPath, [script, 'write',
    '--stage', 'biuld', '--branch', 'main', '--next', 'n'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /invalid --stage "biuld"/);
  assert.match(r.stderr, /blueprint, build/);
});

test('read with no .acdev is friendly', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-empty-'));
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no checkpoints/);
});
