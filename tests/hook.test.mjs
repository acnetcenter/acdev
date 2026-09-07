import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const hook = join(here, '..', 'hooks', 'session-start.mjs');

test('hook prints gateway body plus plugin root, frontmatter stripped', () => {
  const r = spawnSync(process.execPath, [hook], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /# Using acdev/);
  assert.match(r.stdout, /acdev plugin root: .+/);
  assert.doesNotMatch(r.stdout, /^---$/m);
  assert.doesNotMatch(r.stdout, /^name: using-acdev$/m);
  // Cache-friendly: the injected text sits in the stable prefix of every
  // turn, so two invocations must be byte-identical (no date, no git
  // state, no checkpoint excerpt).
  assert.equal(spawnSync(process.execPath, [hook], { encoding: 'utf8' }).stdout, r.stdout);
});

test('SessionStart fires on startup, clear and compact, not on resume or fork', () => {
  const hooks = JSON.parse(readFileSync(join(here, '..', 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.equal(hooks.SessionStart[0].matcher, 'startup|clear|compact');
  assert.equal(hooks.UserPromptSubmit[0].matcher, undefined);
});

test('hook degrades to exit 0 with a stderr trace when the gateway is missing', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'acdev-hook-'));
  mkdirSync(join(tmp, 'hooks'));
  const copy = join(tmp, 'hooks', 'session-start.mjs');
  copyFileSync(hook, copy);
  const r = spawnSync(process.execPath, [copy], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /session-start hook failed/);
});
