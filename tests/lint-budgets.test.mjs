import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'lint-budgets.mjs');

function runLint(fixtureDir) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ACDEV_SKILLS_DIR: join(here, 'fixtures', fixtureDir) },
    encoding: 'utf8'
  });
}

test('valid skills pass', () => {
  const r = runLint('skills-valid');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('invalid skills fail with named violations', () => {
  const r = runLint('skills-invalid');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /layer-broken/);
  assert.match(r.stderr, /name "wrong-name"/);
  assert.match(r.stderr, /description .* chars/);
  assert.match(r.stderr, /missing required heading/);
  assert.match(r.stderr, /contains emoji/);
});
