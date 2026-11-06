// migrate: move a project started before 0.5.0 over to the current layout.
// A dry run by default: it lists what would change and touches nothing.
// With apply it makes the changes in the working tree and commits nothing,
// so `git diff` shows them and `git checkout` undoes them.
//   1. docs/VISION.md -> docs/PRODUCT.md (git mv when tracked)
//   2. references to the old file name in CLAUDE.md, AGENTS.md and docs/
//   3. stage "vision" -> "product" in .acdev/state.md
//   4. the per-project guard copy and its settings entries (the guard
//      ships with the plugin now)
// What it cannot decide for the user is reported as a note and left alone.
import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join, relative } from 'node:path';
import { git, isGitRepo, listMd, slashes } from './project.mjs';

const OLD = 'docs/VISION.md';
const NEW = 'docs/PRODUCT.md';
const LEGACY_GUARD = '.claude/hooks/acdev-guard.mjs';
const SETTINGS = '.claude/settings.json';
const UNREAD = ['.acdev/profile.json', '.acdev/lessons.md', '.acdev/freeze.json', '.acdev/cost.jsonl'];
// Allow rules the 0.4 guard settings added for its headless loop.
const LEGACY_ALLOW = ['Bash(node *)', 'Bash(git *)'];
// The file name wherever it stands in a path; a longer word that merely
// ends in VISION.md is left alone.
const NAME = /(?<![\w-])VISION\.md\b/g;
// Text an old CLAUDE.md may still carry: commands and skills 0.5.0 removed.
const STALE_ROUTER = /acdev\.mjs"?\s+(?:next|pack|checklist|lessons|run|cost)\b|acdev-guard\.mjs|scripts\/lessons\.mjs|<plugin-root>|\/acdev:(?:ship|operate|tdd|planning|debugging|verifying|designing)\b/;

const read = (root, rel) => readFileSync(join(root, ...rel.split('/')), 'utf8');
const has = (root, rel) => existsSync(join(root, ...rel.split('/')));

function referenceFiles(root) {
  const docs = listMd(join(root, 'docs')).map((p) => slashes(relative(root, p)))
    .filter((d) => !d.startsWith('docs/plans/') && d !== OLD && d !== NEW);
  return [...['CLAUDE.md', 'AGENTS.md'].filter((f) => has(root, f)), ...docs];
}

// References to the old file name, rewritten; a URL that points at some
// other repository's VISION.md is not this project's file and stays.
export function rewriteRefs(text) {
  let count = 0;
  const out = text.replace(NAME, (match, offset) => {
    const lineStart = text.lastIndexOf('\n', offset) + 1;
    const token = text.slice(lineStart, offset).match(/\S*$/)[0];
    if (token.includes('://')) return match;
    count++;
    return 'PRODUCT.md';
  });
  return { out, count };
}

// The old per-project hook, removed from the settings without touching
// anything else: a user's own hook in the same entry stays, and containers
// left empty are dropped. `removed` counts the hook commands taken out.
export function stripLegacyHook(settings) {
  let removed = 0;
  const pre = settings?.hooks?.PreToolUse;
  if (!Array.isArray(pre)) return { settings, removed };
  const isLegacy = (h) => String(h?.command ?? '').includes('acdev-guard.mjs');
  const kept = [];
  for (const entry of pre) {
    const hooks = Array.isArray(entry?.hooks) ? entry.hooks : [];
    const legacy = hooks.filter(isLegacy).length;
    if (!legacy) {
      kept.push(entry);
      continue;
    }
    removed += legacy;
    if (legacy < hooks.length) kept.push({ ...entry, hooks: hooks.filter((h) => !isLegacy(h)) });
  }
  if (!removed) return { settings, removed };
  const next = { ...settings, hooks: { ...settings.hooks, PreToolUse: kept } };
  if (!kept.length) delete next.hooks.PreToolUse;
  if (!Object.keys(next.hooks).length) delete next.hooks;
  return { settings: next, removed };
}

export function migrate(root, { apply = false } = {}) {
  const steps = []; // { text, run }
  const notes = [];
  if (!has(root, '.acdev/state.md')) {
    return { ok: false, changes: 0, text: 'migrate: no .acdev/state.md here (not an acdev project); nothing to migrate' };
  }

  if (has(root, OLD) && has(root, NEW)) {
    notes.push(`conflict: both ${OLD} and ${NEW} exist; merge them by hand, then delete ${OLD}`);
  } else if (has(root, OLD)) {
    const tracked = isGitRepo(root) && git(root, ['ls-files', '--error-unmatch', OLD]).status === 0;
    steps.push({
      text: `rename ${OLD} -> ${NEW}${tracked ? ' (git mv)' : ''}; its sections stay as they are`,
      run: () => {
        if (tracked) {
          const r = git(root, ['mv', OLD, NEW]);
          if (r.status !== 0) throw new Error(`git mv failed: ${r.stderr.trim()}`);
        } else renameSync(join(root, OLD), join(root, NEW));
      }
    });
    notes.push(`${NEW} keeps the sections it had; the current schema is the plugin's shared/references/templates/product.md. Restructuring it changes an approved document, so do it with the user or leave it: the skills read either shape`);
  }

  for (const rel of referenceFiles(root)) {
    const { out, count } = rewriteRefs(read(root, rel));
    if (!count) continue;
    steps.push({ text: `${rel}: ${count} reference(s) to VISION.md -> PRODUCT.md`, run: () => writeFileSync(join(root, ...rel.split('/')), out) });
  }

  const state = read(root, '.acdev/state.md');
  if (/^stage:\s*vision\s*$/m.test(state)) {
    steps.push({
      text: '.acdev/state.md: stage vision -> product',
      run: () => writeFileSync(join(root, '.acdev', 'state.md'), state.replace(/^(stage:\s*)vision([ \t]*\r?)$/m, '$1product$2'))
    });
  }

  if (has(root, LEGACY_GUARD)) {
    steps.push({ text: `remove ${LEGACY_GUARD} (the guard ships with the plugin now)`, run: () => unlinkSync(join(root, ...LEGACY_GUARD.split('/'))) });
  }
  if (has(root, SETTINGS)) {
    try {
      const parsed = JSON.parse(read(root, SETTINGS).replace(/^﻿/, ''));
      const { settings, removed } = stripLegacyHook(parsed);
      if (removed) {
        steps.push({
          text: `${SETTINGS}: remove the old guard from ${removed} PreToolUse hook(s); every other hook and key is kept`,
          run: () => writeFileSync(join(root, ...SETTINGS.split('/')), JSON.stringify(settings, null, 2) + '\n')
        });
      }
      const allow = Array.isArray(parsed?.permissions?.allow) ? parsed.permissions.allow.filter((a) => LEGACY_ALLOW.includes(a)) : [];
      if (allow.length) {
        notes.push(`${SETTINGS} still allows ${allow.join(' and ')}; acdev 0.4 added those for its headless loop, and 0.5 no longer asks before inline node code. Remove them unless you added them yourself`);
      }
    } catch (err) {
      notes.push(`${SETTINGS} is not valid JSON (${err.message}); remove the acdev-guard.mjs hook entries by hand`);
    }
  }

  for (const f of ['CLAUDE.md', 'AGENTS.md']) {
    if (has(root, f) && STALE_ROUTER.test(read(root, f))) {
      notes.push(`${f} still names commands or skills removed in 0.5.0; it is your file, so review it by hand: the "How work closes here" block of the plugin's shared/references/templates/claude-md.md replaces those passages`);
    }
  }
  const unread = UNREAD.filter((f) => has(root, f));
  if (unread.length) notes.push(`no longer read, left in place: ${unread.join(', ')} (a lesson worth keeping belongs in CLAUDE.md)`);

  const out = [`migrate${apply ? '' : ' (dry run)'}: ${steps.length} change(s)`];
  if (apply) {
    for (const s of steps) {
      try {
        s.run();
        out.push(`  done: ${s.text}`);
      } catch (err) {
        out.push(`  FAILED: ${s.text} (${err.message})`);
        return { ok: false, changes: steps.length, text: [...out, ...notes.map((n) => `  note: ${n}`)].join('\n') };
      }
    }
  } else out.push(...steps.map((s) => `  would: ${s.text}`));
  out.push(...notes.map((n) => `  note: ${n}`));
  if (!steps.length) out.push('  nothing to do: this project already uses the current layout');
  else if (apply) out.push('  nothing was committed: review with `git status` and `git diff`, then commit (suggested: chore: migrate to acdev 0.5)');
  else out.push('  nothing was changed: run this command again with --apply to make these changes in the working tree');
  return { ok: true, changes: steps.length, text: out.join('\n') };
}
