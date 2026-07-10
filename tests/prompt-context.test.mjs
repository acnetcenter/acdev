import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, '..', 'hooks', 'prompt-context.mjs');

const run = (cwd) => spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8' });

test('silent (exit 0, no output) outside an acdev project', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-noctx-'));
  const r = run(proj);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});

test('injects the stage and routing rules inside an acdev project', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-ctx-'));
  mkdirSync(join(proj, '.acdev'));
  writeFileSync(join(proj, '.acdev', 'state.md'),
    '# acdev state\n\nstage: build\nupdated: 2026-07-09 12:00\nacdev_version: 0.1.1\nlanguage: spanish\nlatest_checkpoint: .acdev/checkpoints/x.md\n');
  const r = run(proj);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /stage "build"/);
  assert.match(r.stdout, /Pipeline skills outrank process skills/);
  assert.match(r.stdout, /offer the matching \/acdev commands/);
});

test('finds the project via CLAUDE_PROJECT_DIR when cwd is a subdirectory', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-sub-'));
  mkdirSync(join(proj, '.acdev'));
  mkdirSync(join(proj, 'src'));
  writeFileSync(join(proj, '.acdev', 'state.md'), '# acdev state\n\nstage: mvp\n');
  const r = spawnSync(process.execPath, [hook], {
    cwd: join(proj, 'src'),
    env: { ...process.env, CLAUDE_PROJECT_DIR: proj },
    encoding: 'utf8'
  });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /stage "mvp"/);
});

test('silent when state.md exists but has no stage line', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-nostage-'));
  mkdirSync(join(proj, '.acdev'));
  writeFileSync(join(proj, '.acdev', 'state.md'), '# acdev state\n\nnothing here\n');
  const r = run(proj);
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
