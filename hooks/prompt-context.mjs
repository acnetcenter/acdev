#!/usr/bin/env node
// UserPromptSubmit hook: injects one line of routing context per prompt,
// but only inside a project that runs the pipeline (.acdev/state.md with a
// stage). Silent everywhere else — zero cost outside acdev projects.
// Deterministic half of routing: the model still reads intent, but the
// project STATE it must route against is read from disk, fresh, every turn.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  // CLAUDE_PROJECT_DIR points at the project root even when the session was
  // launched from a subdirectory; cwd is the fallback outside Claude Code.
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const state = readFileSync(join(root, '.acdev', 'state.md'), 'utf8');
  const stage = state.match(/^stage:\s*(.+)$/m)?.[1]?.trim();
  if (!stage) process.exit(0);
  console.log(
    `acdev: this project is at pipeline stage "${stage}". Pipeline skills outrank process skills when both match. In doubt or ambiguity about which skill applies, offer the matching /acdev commands and let the user choose instead of picking silently.`
  );
} catch {
  // Not an acdev project (or unreadable state): inject nothing.
}
