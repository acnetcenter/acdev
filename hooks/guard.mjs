#!/usr/bin/env node
// PreToolUse hook: the acdev guard. Reads the tool call on stdin and prints
// a permission decision only when a rule applies (allow is silent). Inert
// outside a project with .acdev/state.md. Fails open: an internal error
// allows the call and leaves a trace on stderr, so a broken guard can never
// take a session down with it.
import { dirname, isAbsolute, resolve } from 'node:path';

try {
  let payload = '';
  for await (const chunk of process.stdin) payload += chunk;
  const input = JSON.parse(payload);
  const { judge } = await import('../scripts/lib/guard.mjs');
  const { findProjectRoot } = await import('../scripts/lib/project.mjs');
  // The project is the nearest directory with .acdev/state.md above the
  // file being written, the shell's cwd, or the session's project dir: a
  // session opened in a subfolder or at a monorepo root is still guarded.
  const cwd = typeof input?.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
  const file = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
  const starts = [
    typeof file === 'string' && file ? dirname(isAbsolute(file) ? file : resolve(cwd, file)) : null,
    cwd,
    process.env.CLAUDE_PROJECT_DIR
  ].filter(Boolean);
  let root = null;
  for (const s of starts) {
    root = findProjectRoot(s);
    if (root) break;
  }
  const verdict = root ? judge(root, { ...input, cwd }) : null;
  if (verdict) {
    const [permissionDecision, permissionDecisionReason] = verdict;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason } }) + '\n');
  }
} catch (err) {
  console.error(`acdev guard: hook failed open: ${err.message}`);
}
