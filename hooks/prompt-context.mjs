#!/usr/bin/env node
// UserPromptSubmit hook: one short line per prompt, only inside a project
// that runs the pipeline (.acdev/state.md with a stage). Silent everywhere
// else. The line carries the stage and nothing more: the step command and
// the plugin root live in the gateway (injected at session start and
// re-injected after every compaction), and every injected line stays in
// the transcript for the rest of the session, so a path repeated here
// would be re-read on every later turn.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  // CLAUDE_PROJECT_DIR points at the project root even when the session was
  // launched from a subdirectory; cwd is the fallback outside Claude Code.
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const state = readFileSync(join(root, '.acdev', 'state.md'), 'utf8');
  const stage = state.match(/^stage:\s*(.+)$/m)?.[1]?.trim();
  if (!stage) process.exit(0);
  console.log(`acdev: stage ${stage}.`);
} catch {
  // Not an acdev project (or unreadable state): inject nothing.
}
