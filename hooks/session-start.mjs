#!/usr/bin/env node
// Prints the using-acdev gateway skill (frontmatter stripped) into session context.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = readFileSync(join(here, '..', 'skills', 'using-acdev', 'SKILL.md'), 'utf8');
  const body = raw.replace(/^---[\s\S]*?---\s*/, '');
  console.log(body.trim());
} catch {
  // Fail silently: acdev degrades to description-only activation (spec section 11).
  process.exit(0);
}
