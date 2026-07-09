import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'checkpoint.mjs');

test('write then read roundtrip', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-ckpt-'));
  const w = spawnSync(process.execPath, [script, 'write',
    '--stage', 'build', '--branch', 'feat/slice-1',
    '--slice', '1: walking skeleton', '--files', 'src/a.ts,src/b.ts',
    '--next', 'wire the UI list', '--notes', 'context line'],
    { cwd: proj, encoding: 'utf8' });
  assert.equal(w.status, 0, w.stderr);
  assert.ok(existsSync(join(proj, '.acdev', 'state.md')));
  const files = readdirSync(join(proj, '.acdev', 'checkpoints'));
  assert.equal(files.length, 1);
  const ckpt = readFileSync(join(proj, '.acdev', 'checkpoints', files[0]), 'utf8');
  assert.match(ckpt, /stage: build/);
  assert.match(ckpt, /files_modified: \[src\/a\.ts, src\/b\.ts\]/);
  assert.match(ckpt, /blocked_on: null/);
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /stage: build/);
  assert.match(r.stdout, /latest checkpoint/);
});

test('read with no .acdev is friendly', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-empty-'));
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no checkpoints/);
});

test('write without required flags fails', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-bad-'));
  const r = spawnSync(process.execPath, [script, 'write', '--stage', 'build'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing --branch/);
});
