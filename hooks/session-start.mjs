#!/usr/bin/env node
// Prints the using-acdev gateway skill (frontmatter stripped) into session
// context, plus the plugin root path that pipeline skills substitute for
// <plugin-root> when running scripts/checkpoint.mjs or reading templates.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  const raw = readFileSync(join(root, 'skills', 'using-acdev', 'SKILL.md'), 'utf8');
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').replace(/\r\n/g, '\n');
  console.log(body.trim());
  console.log(`\nacdev plugin root: ${root}`);
} catch (err) {
  // Degrade to description-only activation (spec section 11), but leave a
  // trace on stderr so the failure is visible in hook debug output.
  console.error(`acdev session-start hook failed: ${err.message}`);
  process.exit(0);
}
