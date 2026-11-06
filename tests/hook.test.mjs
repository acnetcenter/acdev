import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeProject } from './fixtures/project.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const hook = join(root, 'hooks', 'session-start.mjs');
const run = (cwd) => {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  return spawnSync(process.execPath, [hook], { cwd, encoding: 'utf8', env });
};

test('session start is silent outside a project that runs the pipeline', () => {
  const r = run(mkdtempSync(join(tmpdir(), 'acdev-plain-')));
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '', 'the plugin costs nothing in a session that does not use it');
});

test('inside a project it prints the stage, the next step and how to call the CLI', () => {
  const p = makeProject({ git: false });
  const r = run(p.root);
  assert.equal(r.status, 0, r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'acdev project: stage build | next: slice 1: walking skeleton');
  assert.match(lines[1], /^CLI: `acdev <command>` in the Bash tool; in PowerShell, node ".+\/scripts\/acdev\.mjs" <command>\. `acdev status` prints the full snapshot\.$/);
  assert.ok(!/[A-Za-z]:\\/.test(lines[1]), 'the fallback path uses forward slashes');
  assert.ok(r.stdout.length < 500, `two short lines: ${r.stdout.length} chars`);
  // Cache-friendly: the text sits in the stable prefix of every turn, so
  // two invocations must be byte-identical (no date, no git state).
  assert.equal(run(p.root).stdout, r.stdout);
});

test('a slice in progress and a block are part of the line', () => {
  const p = makeProject({ git: false });
  const ck = p.checkpoint(['--next', 'ask the user', '--slice', '2: create invoice', '--blocked', 'tenant isolation strategy?']);
  assert.equal(ck.status, 0, ck.stderr);
  assert.match(run(p.root).stdout, /^acdev project: stage build \| slice 2: create invoice \| next: ask the user \| BLOCKED: tenant isolation strategy\?$/m);
});

test('the plugin wires two hooks: the session line and the guard, and no per-prompt hook', () => {
  const hooks = JSON.parse(readFileSync(join(root, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.deepEqual(Object.keys(hooks).sort(), ['PreToolUse', 'SessionStart']);
  // resume too: the stage may have moved since the session was last open.
  assert.equal(hooks.SessionStart[0].matcher, 'startup|resume|clear|compact');
  const guard = hooks.PreToolUse[0];
  for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit', 'Bash', 'PowerShell']) {
    assert.ok(guard.matcher.split('|').includes(tool), `the guard sees ${tool}`);
  }
  for (const entry of [...hooks.SessionStart, ...hooks.PreToolUse]) {
    const file = entry.hooks[0].command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^"]+)/)?.[1];
    assert.ok(file && existsSync(join(root, file)), `${file} exists`);
  }
});
