#!/usr/bin/env node
// UserPromptSubmit hook: one short line per prompt, only inside a project
// that runs the pipeline (.acdev/state.md with a stage). Silent everywhere
// else. The line carries the stage and the step command; the routing rules
// live in the gateway (injected at session start) and are not repeated
// here, because every injected line stays in the transcript for the rest
// of the session.
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  // CLAUDE_PROJECT_DIR points at the project root even when the session was
  // launched from a subdirectory; cwd is the fallback outside Claude Code.
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const state = readFileSync(join(root, '.acdev', 'state.md'), 'utf8');
  const stage = state.match(/^stage:\s*(.+)$/m)?.[1]?.trim();
  if (!stage) process.exit(0);
  const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..').replace(/\\/g, '/');
  console.log(`acdev: stage ${stage}. Step: node "${plugin}/scripts/acdev.mjs" next`);
} catch {
  // Not an acdev project (or unreadable state): inject nothing.
}
