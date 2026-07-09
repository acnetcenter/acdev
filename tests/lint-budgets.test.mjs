import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'lint-budgets.mjs');

function runLint(skillsDir) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ACDEV_SKILLS_DIR: skillsDir },
    encoding: 'utf8'
  });
}

test('valid skills pass', () => {
  const r = runLint(join(here, 'fixtures', 'skills-valid'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('the real skill tree passes, including README drift checks', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('invalid skills fail with named violations', () => {
  const r = runLint(join(here, 'fixtures', 'skills-invalid'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /layer-broken/);
  assert.match(r.stderr, /name "wrong-name"/);
  assert.match(r.stderr, /description .* chars/);
  assert.match(r.stderr, /missing required heading/);
  assert.match(r.stderr, /layer-broken: contains emoji/);
  assert.match(r.stderr, /no-frontmatter: missing frontmatter/);
  assert.match(r.stderr, /missing-file: missing SKILL\.md/);
  assert.match(r.stderr, /body-too-long: body \d+ lines > 500/);
  assert.match(r.stderr, /layer-broken\/references\/note\.md: contains emoji/);
  assert.match(r.stderr, /layer-broken\/references\/flag\.md: contains emoji/);
  assert.match(r.stderr, /layer-broken\/references\/keycap\.md: contains emoji/);
});

test('an empty skills dir fails instead of passing green', () => {
  const empty = mkdtempSync(join(tmpdir(), 'acdev-noskills-'));
  const r = runLint(empty);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no skill directories/);
});
