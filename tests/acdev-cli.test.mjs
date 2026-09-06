import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeProject } from './fixtures/project.mjs';

test('usage on no command, exit 1 on an unknown one', () => {
  const p = makeProject({ git: false });
  const none = p.cli([]);
  assert.equal(none.status, 0);
  assert.match(none.stdout, /usage: acdev\.mjs <command>/);
  const bad = p.cli(['frobnicate']);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /unknown command "frobnicate"/);
  const badFlag = p.cli(['next', '--nope']);
  assert.equal(badFlag.status, 1);
  assert.match(badFlag.stderr, /usage:/);
});

test('checkpoint and lessons delegate to their scripts in the project', () => {
  const p = makeProject({ git: false });
  const r = p.cli(['checkpoint', 'read']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /stage: build/);
  assert.match(r.stdout, /latest checkpoint/);
  const l = p.cli(['lessons', 'list']);
  assert.equal(l.status, 0, l.stderr);
});
