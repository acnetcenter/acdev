#!/usr/bin/env node
// SessionStart hook: inside a project that runs the pipeline, two lines
// with where it stands and how to call the CLI. Silent everywhere else, so
// the plugin costs nothing in a session that does not use it. Runs again
// after /clear and after a compaction, which is what makes a fresh context
// cheap to resume: the state is on disk, not in the conversation.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const { readState, latestCheckpoint, slashes, projectRoot } = await import('../scripts/lib/project.mjs');
  // The same project the CLI and the guard find, also from a subfolder.
  const root = projectRoot();
  const state = readState(root);
  if (state?.stage) {
    const f = latestCheckpoint(root, state)?.fields ?? {};
    const parts = [`acdev project: stage ${state.stage}`];
    if (f.slice) parts.push(`slice ${f.slice}`);
    if (f.next_step) parts.push(`next: ${f.next_step}`);
    if (f.blocked_on) parts.push(`BLOCKED: ${f.blocked_on}`);
    const cli = slashes(resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'acdev.mjs'));
    console.log(parts.join(' | '));
    console.log(`CLI: \`acdev <command>\` in the Bash tool; in PowerShell, node "${cli}" <command>. \`acdev status\` prints the full snapshot.`);
  }
} catch (err) {
  // Never block a session over a status line.
  console.error(`acdev session-start hook failed: ${err.message}`);
}
