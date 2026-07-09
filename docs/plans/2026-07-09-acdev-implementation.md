# acdev Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the acdev Claude Code plugin — a gated, documentation-first, token-disciplined pipeline (21 skills, 1 hook, 2 scripts) — per the approved spec `docs/specs/2026-07-09-acdev-design.md`.

**Architecture:** Flat toolbox of 21 auto-invocable skills in 4 groups (gateway / pipeline / process / layers), one SessionStart hook that prints the gateway skill, deterministic Node scripts for checkpoints and budget linting, shared references for cross-skill content. No MCP, no custom agents, no classic commands.

**Tech Stack:** Markdown skills (Claude Code plugin schema), Node.js ≥ 20 ESM scripts with zero dependencies, `node --test` for tests, GitHub Actions CI.

## Global Constraints

- All plugin content in English; no emojis anywhere (lint-enforced).
- Skill frontmatter: `name` must equal directory name; `description` ≤ 400 chars (~100 tokens), written as a trigger ("Use when...").
- Skill body: < 500 lines and < 20,000 chars (~5k tokens). Depth goes to `references/`.
- Gateway skill (`using-acdev`): entire file ≤ 1,600 chars (~400 tokens).
- Every `layer-*` skill must contain headings exactly: `## Production checklist`, `## Pitfalls`, `## How to verify`.
- Layer checklists are stack-agnostic and use goal + verify format ("X must hold — verify: observable probe").
- Scripts: Node ESM (`.mjs`), zero external dependencies, cross-platform (Windows paths supported).
- Skills never re-teach native Claude Code behavior (plan mode, Agent tool, worktrees, /code-review, /resume) — reference in one line instead.
- Artifacts generated inside user projects are written in the project language chosen at intake (skills must say this where they generate docs).
- Commits: conventional, English. Plugin version starts at 0.1.0. License MIT.
- Spec section references (§N) point to `docs/specs/2026-07-09-acdev-design.md`.

---

### Task 1: Plugin foundation

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `package.json`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `CHANGELOG.md`

**Interfaces:**
- Produces: plugin identity `acdev@0.1.0`; `npm`-less test/lint entry points (`node --test`, `node scripts/lint-budgets.mjs`) that CI (Task 19) and all skill tasks use.

- [ ] **Step 1: Write `.claude-plugin/plugin.json`**

```json
{
  "name": "acdev",
  "version": "0.1.0",
  "description": "Systematic, gated, documentation-first pipeline that takes a software project from idea to production - or adopts an existing one - with strict token discipline.",
  "author": {
    "name": "acnetcenter",
    "url": "https://github.com/acnetcenter"
  },
  "homepage": "https://github.com/acnetcenter/acdev",
  "repository": "https://github.com/acnetcenter/acdev",
  "license": "MIT",
  "keywords": ["pipeline", "documentation-first", "production", "token-economy"]
}
```

- [ ] **Step 2: Write `.claude-plugin/marketplace.json`**

```json
{
  "name": "acnetcenter",
  "owner": {
    "name": "acnetcenter",
    "url": "https://github.com/acnetcenter"
  },
  "plugins": [
    {
      "name": "acdev",
      "source": "./",
      "description": "Systematic, gated, documentation-first pipeline that takes a software project from idea to production - or adopts an existing one - with strict token discipline."
    }
  ]
}
```

- [ ] **Step 3: Write `package.json` (tooling only, not published)**

```json
{
  "name": "acdev",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "lint": "node scripts/lint-budgets.mjs"
  }
}
```

- [ ] **Step 4: Write `.gitignore`**

```gitignore
node_modules/
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 5: Write `LICENSE`** — standard MIT text, year 2026, holder `acnetcenter`.

- [ ] **Step 6: Write `CHANGELOG.md`**

```markdown
# Changelog

## [Unreleased]

## [0.1.0] - TBD on first release
- Initial release: 21 skills (gateway, 7 pipeline, 5 process, 8 layers), SessionStart gateway hook, checkpoint and budget-lint scripts.
```

- [ ] **Step 7: Verify JSON validity**

Run: `node -e "['.claude-plugin/plugin.json','.claude-plugin/marketplace.json','package.json'].forEach(f=>JSON.parse(require('fs').readFileSync(f,'utf8'))); console.log('json ok')"`
Expected: `json ok`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: plugin foundation (manifest, marketplace, tooling)"
```

---

### Task 2: Budget lint script (the plugin's test suite)

**Files:**
- Create: `scripts/lint-budgets.mjs`
- Create: `tests/lint-budgets.test.mjs`
- Create: `tests/fixtures/skills-valid/demo/SKILL.md`
- Create: `tests/fixtures/skills-invalid/layer-broken/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `node scripts/lint-budgets.mjs` (exit 0 = clean, exit 1 = violations listed; honors env `ACDEV_SKILLS_DIR` for tests). Every later task runs this after adding skills. Enforces Global Constraints budgets exactly.

- [ ] **Step 1: Write the failing test `tests/lint-budgets.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'lint-budgets.mjs');

function runLint(fixtureDir) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ACDEV_SKILLS_DIR: join(here, 'fixtures', fixtureDir) },
    encoding: 'utf8'
  });
}

test('valid skills pass', () => {
  const r = runLint('skills-valid');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('invalid skills fail with named violations', () => {
  const r = runLint('skills-invalid');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /layer-broken/);
  assert.match(r.stderr, /name "wrong-name"/);
  assert.match(r.stderr, /description .* chars/);
  assert.match(r.stderr, /missing required heading/);
  assert.match(r.stderr, /contains emoji/);
});
```

- [ ] **Step 2: Write fixture `tests/fixtures/skills-valid/demo/SKILL.md`**

```markdown
---
name: demo
description: Use when testing the acdev lint with a minimal valid skill.
---

# Demo

One short valid body.
```

- [ ] **Step 3: Write fixture `tests/fixtures/skills-invalid/layer-broken/SKILL.md`** — must trip four rules: wrong name, oversized description, missing layer headings, emoji.

```markdown
---
name: wrong-name
description: Use when testing violations. <PAD THIS DESCRIPTION WITH REPEATED TEXT UNTIL IT EXCEEDS 400 CHARACTERS - write the literal padding out in the fixture file, e.g. the sentence "This description is intentionally far too long for the acdev budget lint." repeated 8 times.>
---

# Broken layer skill

Body with an emoji: 🚀

No required headings here.
```

Note for the implementer: replace the `<PAD...>` instruction with the actual repeated sentence so the description is really > 400 chars. The fixture must contain a literal emoji character.

- [ ] **Step 4: Run tests to verify they fail**

Run: `node --test`
Expected: FAIL (`scripts/lint-budgets.mjs` does not exist yet).

- [ ] **Step 5: Write `scripts/lint-budgets.mjs`**

```js
#!/usr/bin/env node
// Structure and budget lint for acdev skills. Approximation: 1 token = 4 chars.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = process.env.ACDEV_SKILLS_DIR ?? join(ROOT, 'skills');
const DESCRIPTION_MAX_CHARS = 400;   // ~100 tokens
const BODY_MAX_LINES = 500;
const BODY_MAX_CHARS = 20000;        // ~5k tokens
const GATEWAY_MAX_CHARS = 1600;      // ~400 tokens, whole file
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const LAYER_REQUIRED_HEADINGS = ['## Production checklist', '## Pitfalls', '## How to verify'];

const errors = [];
if (!existsSync(SKILLS_DIR)) {
  console.error(`lint-budgets: skills dir not found: ${SKILLS_DIR}`);
  process.exit(1);
}
const dirs = readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
for (const dir of dirs) {
  const path = join(SKILLS_DIR, dir.name, 'SKILL.md');
  const label = `skills/${dir.name}`;
  if (!existsSync(path)) {
    errors.push(`${label}: missing SKILL.md`);
    continue;
  }
  const raw = readFileSync(path, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    errors.push(`${label}: missing frontmatter`);
    continue;
  }
  const fm = m[1];
  const name = fm.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const desc = fm.match(/^description:\s*(.+)$/m)?.[1]?.trim();
  if (!name) errors.push(`${label}: frontmatter missing "name"`);
  else if (name !== dir.name) errors.push(`${label}: name "${name}" != directory "${dir.name}"`);
  if (!desc) errors.push(`${label}: frontmatter missing "description"`);
  else if (desc.length > DESCRIPTION_MAX_CHARS) errors.push(`${label}: description ${desc.length} chars > ${DESCRIPTION_MAX_CHARS}`);
  const body = raw.slice(m[0].length);
  const lines = body.split('\n').length;
  if (lines > BODY_MAX_LINES) errors.push(`${label}: body ${lines} lines > ${BODY_MAX_LINES}`);
  if (body.length > BODY_MAX_CHARS) errors.push(`${label}: body ${body.length} chars > ${BODY_MAX_CHARS}`);
  if (dir.name === 'using-acdev' && raw.length > GATEWAY_MAX_CHARS) errors.push(`${label}: gateway ${raw.length} chars > ${GATEWAY_MAX_CHARS}`);
  if (EMOJI.test(raw)) errors.push(`${label}: contains emoji`);
  if (dir.name.startsWith('layer-')) {
    for (const h of LAYER_REQUIRED_HEADINGS) {
      if (!body.includes(h)) errors.push(`${label}: missing required heading "${h}"`);
    }
  }
}
if (errors.length) {
  console.error(`lint-budgets: ${errors.length} violation(s)\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`lint-budgets: OK (${dirs.length} skills checked)`);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `node --test`
Expected: 2 passing tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/lint-budgets.mjs tests/
git commit -m "feat: budget lint with fixtures (skill structure test suite)"
```

---

### Task 3: Checkpoint script

**Files:**
- Create: `scripts/checkpoint.mjs`
- Create: `tests/checkpoint.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: CLI used by `status` and `ship` skills (Tasks 10-11):
  - `node <plugin>/scripts/checkpoint.mjs write --stage <s> --branch <b> --next <text> [--slice <text>] [--files "a,b"] [--blocked <text>] [--notes <text>]` → creates `.acdev/checkpoints/YYYYMMDD-HHmm-<slug>.md` + rewrites `.acdev/state.md`, prints created path.
  - `node <plugin>/scripts/checkpoint.mjs read` → prints `state.md` + latest checkpoint (or a friendly "no checkpoints" line). Operates on `process.cwd()` (the user project).

- [ ] **Step 1: Write the failing test `tests/checkpoint.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'checkpoint.mjs');

test('write then read roundtrip', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-ckpt-'));
  const w = spawnSync(process.execPath, [script, 'write',
    '--stage', 'build', '--branch', 'feat/slice-1',
    '--slice', '1: walking skeleton', '--files', 'src/a.ts,src/b.ts',
    '--next', 'wire the UI list', '--notes', 'context line'],
    { cwd: proj, encoding: 'utf8' });
  assert.equal(w.status, 0, w.stderr);
  assert.ok(existsSync(join(proj, '.acdev', 'state.md')));
  const files = readdirSync(join(proj, '.acdev', 'checkpoints'));
  assert.equal(files.length, 1);
  const ckpt = readFileSync(join(proj, '.acdev', 'checkpoints', files[0]), 'utf8');
  assert.match(ckpt, /stage: build/);
  assert.match(ckpt, /files_modified: \[src\/a\.ts, src\/b\.ts\]/);
  assert.match(ckpt, /blocked_on: null/);
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /stage: build/);
  assert.match(r.stdout, /latest checkpoint/);
});

test('read with no .acdev is friendly', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-empty-'));
  const r = spawnSync(process.execPath, [script, 'read'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /no checkpoints/);
});

test('write without required flags fails', () => {
  const proj = mkdtempSync(join(tmpdir(), 'acdev-bad-'));
  const r = spawnSync(process.execPath, [script, 'write', '--stage', 'build'], { cwd: proj, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /missing --branch/);
});
```

- [ ] **Step 2: Run tests to verify the new file fails**

Run: `node --test`
Expected: checkpoint tests FAIL (script missing); lint tests still pass.

- [ ] **Step 3: Write `scripts/checkpoint.mjs`**

```js
#!/usr/bin/env node
// Read/write acdev checkpoints and pipeline state in the current project.
// write: checkpoint.mjs write --stage S --branch B --next TEXT [--slice T] [--files "a,b"] [--blocked T] [--notes T]
// read:  checkpoint.mjs read
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const DIR = join(cwd, '.acdev');
const CKPT_DIR = join(DIR, 'checkpoints');
const STATE = join(DIR, 'state.md');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return {
    file: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`,
    human: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  };
}
const slug = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'checkpoint';

const [cmd] = process.argv.slice(2);
if (cmd === 'write') {
  const a = parseArgs(process.argv.slice(3));
  for (const k of ['stage', 'branch', 'next']) {
    if (!a[k]) {
      console.error(`missing --${k}`);
      process.exit(1);
    }
  }
  mkdirSync(CKPT_DIR, { recursive: true });
  const t = stamp();
  const files = (a.files ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const fm = [
    '---',
    `date: ${t.human}`,
    `stage: ${a.stage}`,
    `branch: ${a.branch}`,
    `slice: ${JSON.stringify(a.slice ?? '')}`,
    `files_modified: [${files.join(', ')}]`,
    `next_step: ${JSON.stringify(a.next)}`,
    `blocked_on: ${a.blocked ? JSON.stringify(a.blocked) : 'null'}`,
    '---',
    ''
  ].join('\n');
  const file = join(CKPT_DIR, `${t.file}-${slug(a.slice ?? a.next)}.md`);
  writeFileSync(file, fm + (a.notes ?? '') + '\n');
  const rel = file.slice(cwd.length + 1).replaceAll('\\', '/');
  writeFileSync(STATE, `# acdev state\n\nstage: ${a.stage}\nupdated: ${t.human}\nlatest_checkpoint: ${rel}\n`);
  console.log(rel);
} else if (cmd === 'read') {
  if (!existsSync(CKPT_DIR)) {
    console.log('no checkpoints: .acdev/ not found in this project');
    process.exit(0);
  }
  if (existsSync(STATE)) console.log(readFileSync(STATE, 'utf8'));
  const files = readdirSync(CKPT_DIR).filter((f) => f.endsWith('.md')).sort();
  if (files.length) {
    console.log('--- latest checkpoint ---');
    console.log(readFileSync(join(CKPT_DIR, files.at(-1)), 'utf8'));
  }
} else {
  console.error('usage: checkpoint.mjs write|read [flags]');
  process.exit(1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test`
Expected: all tests pass (lint + 3 checkpoint tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/checkpoint.mjs tests/checkpoint.test.mjs
git commit -m "feat: checkpoint script (write/read project state)"
```

---

### Task 4: Gateway skill + SessionStart hook

**Files:**
- Create: `skills/using-acdev/SKILL.md`
- Create: `hooks/hooks.json`
- Create: `hooks/session-start.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: the gateway text every session sees; the hook contract (prints the gateway skill body). All skills listed here must exist by the end of Task 17 with exactly these names.

- [ ] **Step 1: Write `skills/using-acdev/SKILL.md`** (complete content; whole file must stay ≤ 1,600 chars — verify with lint)

```markdown
---
name: using-acdev
description: How and when to use every acdev skill; loaded at session start.
---

# Using acdev

Rule: if an acdev skill matches the task, invoke it before responding. Resuming work on a project? Run /acdev:status first.

Pipeline (also slash commands): new-project (start from zero: VISION, MVP gates) | mockups (MVP screens + skeleton) | blueprint (docs, ADRs, spikes, AI context) | onboard (adopt existing repo) | build (vertical slices, TDD) | ship (verify, drift check, commit) | status (where are we; ~2k tokens).

Process (auto): designing (before creative work) | planning (multi-step plans) | tdd (before implementing) | debugging (on any bug) | verifying (before claiming done).

Layers (auto when touching that layer): layer-frontend, layer-api, layer-data, layer-auth, layer-security, layer-performance, layer-delivery, layer-cicd.

Zero product code before build is ordered. Docs drift is fixed in the same commit.
```

- [ ] **Step 2: Write `hooks/session-start.mjs`**

```js
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
```

- [ ] **Step 3: Write `hooks/hooks.json`**

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs\""
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 4: Verify hook output and budgets**

Run: `node hooks/session-start.mjs`
Expected: gateway body printed, no frontmatter, no error.
Run: `node scripts/lint-budgets.mjs`
Expected: `lint-budgets: OK (1 skills checked)` — confirms gateway ≤ 1,600 chars.

- [ ] **Step 5: Commit**

```bash
git add skills/using-acdev hooks/
git commit -m "feat: gateway skill and SessionStart hook"
```

---

### Task 5: `new-project` skill (stages 0-2)

**Files:**
- Create: `skills/new-project/SKILL.md`
- Create: `skills/new-project/references/vision-questionnaire.md`
- Create: `skills/new-project/references/mvp-guide.md`
- Create: `shared/references/templates/vision.md`
- Create: `shared/references/templates/mvp.md`

**Interfaces:**
- Consumes: nothing (entry point).
- Produces: approved `docs/VISION.md` and `docs/MVP.md` in the user project; hands off to `mockups` (or `blueprint` when skip-by-scope applies). Templates used again by `onboard` (Task 8).

- [ ] **Step 1: Write `skills/new-project/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: new-project
description: Use when starting a new software project from scratch: intake interview, then VISION.md and MVP.md conversed section by section with hard approval gates. Zero product code.
---
```

Body outline (write in full, < 500 lines):
1. `# New project (stages 0-2)` — announce usage; state the pipeline position (stage 0-2 of 5) and the two hard gates ahead.
2. `## Stage 0 - Intake` — ask in ONE message, wait for answers: (1) project name + one sentence (what and for whom); (2) new repo or existing (if existing → switch to the `onboard` skill); (3) documentation language for all generated artifacts; (4) Claude-only or multi-AI (decides AGENTS.md mirror at blueprint).
3. `## Stage 1 - VISION.md` — converse the 7 sections one at a time using `references/vision-questionnaire.md`; propose drafts, user corrects; challenge weak answers ("for everyone" → who is NOT a customer); after the 7 sections agree, write `docs/VISION.md` from `shared/references/templates/vision.md`; **HARD GATE:** ask verbatim for explicit approval of the full document; iterate until approved; commit `docs: project vision`.
4. `## Stage 2 - MVP.md` — derive from approved VISION using `references/mvp-guide.md`: what is IN (numbered features), what is explicitly OUT (with the phase it moves to), verifiable success criteria (facts, not wishes); write `docs/MVP.md` from template; if the cut reveals a gap in VISION, STOP and fix VISION first (derivation rule); **HARD GATE:** explicit approval; commit `docs: mvp contract`.
5. `## Rules` — zero product code; no placeholders (ask or declare); artifacts in the intake language; next step: `mockups` if the MVP has UI, else propose skipping to `blueprint` and confirm (skip-by-scope, spec §6).

- [ ] **Step 2: Write `skills/new-project/references/vision-questionnaire.md`** — port of the proyecto-kike 7-section questionnaire, translated to English and updated: (1) What it is / what it is NOT; (2) Model — two axes: delivery/tenancy (public multi-tenant SaaS · single-tenant · on-premise · local/personal) and business (product for sale · internal tool · personal use), plus the note that this section activates whole subsystems (tenant isolation, roles, billing, support panel) and golden router rules at blueprint; (3) Who it is for (user vs payer); (4) Problem it solves (and how users solve it TODAY); (5) What it does — feature list with v1 marked + 3-5 critical end-to-end flows each ending in an observable result; (6) Approach at product level (2-4 sentences, NO architecture/stack — capture stack talk as blueprint input and steer back); (7) Full-product phase sketch, one line per phase (MVP detail now lives in MVP.md, stage 2). Include the procedure (one section at a time, summarize each block in 3-5 lines, challenge weak answers) and the complementary questions whose answers feed blueprint (preferred stack, integrations + third-party lead times, legal/privacy constraints, open decisions with owner).

- [ ] **Step 3: Write `skills/new-project/references/mvp-guide.md`** — how to cut a good MVP: smallest scope that delivers real value end-to-end; every IN item traces to a VISION §5 flow; OUT list is as explicit as IN (each OUT item names its target phase); success criteria are observable facts with numbers where possible ("10 real users complete flow X unaided"); the walking-skeleton slice (build stage) will be the thinnest path through the MVP; anti-patterns: "MVP" containing admin panels, theming, or settings screens nobody asked for.

- [ ] **Step 4: Write `shared/references/templates/vision.md`** — the 7 section headings with one-line guidance placeholders in comment form (`<!-- guidance -->`), footer rule verbatim: "Inconsistencies between documents and code are corrected in the documents or via ADR; this document only changes by explicit decision of the product owner."

- [ ] **Step 5: Write `shared/references/templates/mvp.md`** — header linking to VISION ("derived from VISION.md"), sections: `## In scope (v1)`, `## Explicitly out of scope` (item → target phase), `## Success criteria` (verifiable facts), `## Assumptions and open questions`.

- [ ] **Step 6: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/new-project shared/references/templates
git commit -m "feat: new-project skill (intake, VISION and MVP gates)"
```

---

### Task 6: `mockups` skill (stage 3)

**Files:**
- Create: `skills/mockups/SKILL.md`
- Create: `skills/mockups/references/mockups-guide.md`
- Create: `shared/references/templates/mockups-inventory.md`

**Interfaces:**
- Consumes: approved `docs/MVP.md` (Task 5).
- Produces: approved `mockups/` (frozen visual contract) + `docs/mockups-inventory.md` skeleton; consumed by `blueprint` (UI-DESIGN doc derives from mockups) and `build` (frontend replicates mockups).

- [ ] **Step 1: Write `skills/mockups/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: mockups
description: Use after MVP approval to build static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved.
---
```

Body outline (write in full):
1. Position (stage 3) and precondition: approved MVP.md; if the project has no UI this stage was skipped at new-project.
2. `## Build the MVP mockups` — follow `references/mockups-guide.md`; one HTML page per MVP screen; realistic sample data (never lorem ipsum); include empty, error and loading states for key screens; an `index.html` linking everything; every MVP critical flow walkable screen to screen; disposable HTML/CSS (design artifact, not product code — no frameworks, no build step).
3. `## Skeleton inventory` — write `docs/mockups-inventory.md` from the shared template: one line per post-MVP screen (name, purpose, phase) + where it will live in navigation; MVP navigation must visibly accommodate future modules (menu placement, not drawn screens).
4. `## Revision rounds` — present how to browse (`mockups/index.html`); apply user corrections in rounds, commit `docs: mockups revision N`; if a revision changes product scope, update VISION/MVP in the same commit (drift rule) and reconfirm.
5. `## Gate` — explicit approval of the set; approved mockups are FROZEN as the visual contract for the MVP build; later changes reopen the gate (and ADR if VISION/MVP change). Post-MVP phases get their mockups just-in-time during build, phase by phase, through this same skill.

- [ ] **Step 2: Write `skills/mockups/references/mockups-guide.md`** — concrete authoring guide: flat `mockups/` directory, kebab-case filenames per screen (`dashboard.html`, `invoice-list.html`); one shared `styles.css` with CSS custom properties for palette/typography/spacing (these become UI-DESIGN tokens at blueprint); semantic HTML; realistic data rules (names, amounts, dates in the project language); state variants as separate pages (`invoice-list-empty.html`, `invoice-list-error.html`) linked from the main page; `index.html` grouped by flow; no JS beyond trivial navigation; accessibility floor (labels, contrast, focus order) because the real frontend inherits decisions from these pages.

- [ ] **Step 3: Write `shared/references/templates/mockups-inventory.md`** — table template: Screen | Purpose (one line) | Phase | Navigation placement; plus a "Navigation notes" section for how the MVP nav will host future modules.

- [ ] **Step 4: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/mockups shared/references/templates/mockups-inventory.md
git commit -m "feat: mockups skill (MVP visual contract and skeleton inventory)"
```

---

### Task 7: `blueprint` skill (stage 4) + decision classification

**Files:**
- Create: `skills/blueprint/SKILL.md`
- Create: `skills/blueprint/references/docs-catalog.md`
- Create: `skills/blueprint/references/spike-protocol.md`
- Create: `shared/references/decision-classification.md`
- Create: `shared/references/templates/adr.md`
- Create: `shared/references/templates/claude-md-router.md`
- Create: `shared/references/templates/verify-script-stub.mjs`

**Interfaces:**
- Consumes: approved VISION.md, MVP.md, mockups (Tasks 5-6).
- Produces: the full documentation package + `docs/adr/` (stack decided here) + `scripts/verify/` stubs + `CLAUDE.md`/`AGENTS.md` in the user project; `shared/references/decision-classification.md` also consumed by `build` (Task 9). Layer skills (Tasks 14-17) require ADRs to exist — their preamble reads them.

- [ ] **Step 1: Write `skills/blueprint/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: blueprint
description: Use after mockup approval to produce the normative docs, ADRs (stack decided here), technical spikes for unproven dependencies, the AI context system and repo mechanics.
---
```

Body outline (write in full):
1. Position (stage 4); inputs: VISION + MVP + frozen mockups only.
2. `## Normative docs` — choose from `references/docs-catalog.md`, present the proposed list with reasons; ALWAYS `docs/ROADMAP.md` (phase 1 = the MVP from MVP.md, later phases from VISION §7, each with verifiable exit criteria and external lead times); UI-DESIGN derives tokens/components from the approved mockups' `styles.css`.
3. `## ADRs and spikes` — one ~10-line ADR per closed decision (stack, hosting, data store, auth approach, tenancy) from `shared/references/templates/adr.md`; while drafting, flag any decision depending on something unproven → run `references/spike-protocol.md` (success criterion first, timebox 2-6h, `spikes/NNN-question/`, result recorded in the ADR, code never merges); classify every decision per `shared/references/decision-classification.md` and keep the audit table in the blueprint summary.
4. `## AI context system` — generate `CLAUDE.md` router from `shared/references/templates/claude-md-router.md` (golden rules derived from VISION §2 Model + chosen stack, e.g. multi-tenant → "every table change proves isolation"); mirror to `AGENTS.md` if multi-AI was chosen at intake; both stay under one page.
5. `## Repo mechanics` — `.gitignore` (secrets, `.env*`), `.env.example` with every variable named in ADRs, CI skeleton (lint/typecheck/test jobs matching the chosen stack), `scripts/verify/` generated from `shared/references/templates/verify-script-stub.mjs` — one concrete verification command per applicable layer (auth, security/RLS, migrations, smoke). The plugin is agnostic; the project gets concrete commands.
6. `## Gate` — user reviews the whole package; corrections applied; commit `docs: full project blueprint and ai context system`; next: `build` starts ONLY on explicit order.

- [ ] **Step 2: Write `skills/blueprint/references/docs-catalog.md`** — port of the proyecto-kike catalog, English, updated: almost-always table (ROADMAP always; ARCHITECTURE for non-trivial software; ADRs always) + conditional table (DATA-MODEL if database — tenant-owned tables and PII marked; SECURITY if auth/multi-tenant/PII/payments/roles — permission matrix resource x role, isolation, encryption/secrets, retention, incident response; UI-DESIGN if relevant UI — derived from approved mockups; INTEGRATIONS if third-party APIs — scope, rate limits, credentials lead times, sandbox vs production; central-domain doc if ONE concept defines the product) + never-at-blueprint list (future-phase specs, speculative domain skills, hollow "complete" documents) + coherence rules (VISION wins conflicts; every child links to VISION in its header; future decision changes → ADR).

- [ ] **Step 3: Write `skills/blueprint/references/spike-protocol.md`** — the spike contract from spec §6.1 expanded with a worked example: question "can the accounting API X export invoices?"; success criterion "obtain OAuth token and read 10 real invoices with line items"; timebox 4h; folder `spikes/001-x-api-invoices/`; outcome template (works / does not / works with limits + evidence snippet); ADR update line; disposal rule (never merged, folder kept as evidence).

- [ ] **Step 4: Write `shared/references/decision-classification.md`** — the three classes with definitions and 5 examples each: mechanical (lockfile dedupe, obvious index on FK, formatting config) auto-decided silently; taste (folder naming, minor lib pick between equivalents, error copy tone) auto-decided and shown; user-challenge (anything touching money, security posture, data model shape, product behavior, vendor lock-in, > 1 day reversal cost) never auto-decided; plus the audit table format: `| Decision | Class | Choice | Reason |`.

- [ ] **Step 5: Write `shared/references/templates/adr.md`**

```markdown
# ADR-NNNN: <decision title>

- Status: accepted | superseded by ADR-NNNN
- Date: YYYY-MM-DD
- Class: mechanical | taste | user-challenge

## Context
<2-4 lines: the forces at play, link to VISION/MVP section or spike>

## Decision
<1-2 lines: what was decided>

## Consequences
<2-4 lines: what becomes easier, what becomes harder, revisit trigger>
```

- [ ] **Step 6: Write `shared/references/templates/claude-md-router.md`** — one-page router template: project one-liner + link to VISION; golden rules block (filled from Model section: tenancy/payments/PII implications); stack line (from ADRs); "read before working" list (ROADMAP current phase, latest checkpoint via `/acdev:status`); verification commands (`scripts/verify/`); drift rule verbatim; mirror note ("keep AGENTS.md identical").

- [ ] **Step 7: Write `shared/references/templates/verify-script-stub.mjs`**

```js
#!/usr/bin/env node
// acdev verification stub - blueprint copies this per layer and fills the TODO
// with the project's real probe (e.g. RLS isolation query, health check curl).
// Contract: exit 0 = verified, exit 1 = violation, print one evidence line.
const CHECK_NAME = 'REPLACE: what this verifies, one line';
async function main() {
  throw new Error(`not implemented: ${CHECK_NAME} - blueprint must replace this body`);
}
main().then(
  () => { console.log(`ok: ${CHECK_NAME}`); },
  (err) => { console.error(`fail: ${err.message}`); process.exit(1); }
);
```

- [ ] **Step 8: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/blueprint shared/references
git commit -m "feat: blueprint skill (docs, adrs, spikes, ai context, repo mechanics)"
```

---

### Task 8: `onboard` skill

**Files:**
- Create: `skills/onboard/SKILL.md`
- Create: `skills/onboard/references/situation-map.md`

**Interfaces:**
- Consumes: templates from Tasks 5-7 (vision, mvp, adr, router) to fill gaps it finds.
- Produces: `docs/SITUATION.md` + adopted pipeline state (`.acdev/state.md` via checkpoint script) in an existing repo; hands off to the stage the project actually needs.

- [ ] **Step 1: Write `skills/onboard/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: onboard
description: Use when adopting an existing repo into acdev: build a truthful situation map of what exists and what is missing, with declared gaps, then propose adopting the pipeline.
---
```

Body outline (write in full):
1. `## Read before writing` — inventory the repo cheaply and in this order of precedence (source precedence, spec-inherited): (1) explicit user statements this session; (2) existing docs (VISION/README/ADRs — including proyecto-kike-era docs, which are compatible); (3) code and config reality (package manifests, migrations, CI files, deploy configs); (4) git history (recent activity, cadence). Facts must cite their source class. Anything not found is a **declared gap** ("no deploy configuration found") — NEVER a guess. Use subagents for wide scans; read conclusions, not file dumps.
2. `## Situation map` — write `docs/SITUATION.md` using `references/situation-map.md`: what the product does (observed), stack (observed), layer-by-layer state table (the 8 acdev layers: present / partial / absent / unknown, one evidence line each), docs state, test/CI state, gaps list, risks list.
3. `## Confirm and adopt` — present the map, user corrects; GATE: confirm the map; then propose the adoption plan: which pipeline artifacts are missing and worth creating (VISION retroactively if absent — conversed, not autogenerated; MVP.md only if unbuilt scope remains worth gating; blueprint deltas: missing ADRs for decisions already embodied in code are recorded as "as-built" ADRs); write initial `.acdev/state.md` + first checkpoint via `node "${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.mjs" write`.
4. `## Rules` — never rewrite existing docs without showing the diff and confirming; existing conventions win over acdev defaults where they conflict (record the conflict); commit `docs: acdev onboarding and situation map`.

- [ ] **Step 2: Write `skills/onboard/references/situation-map.md`** — the SITUATION.md template: `## Product (observed)`, `## Stack (observed)`, `## Layer state` (table: Layer | State | Evidence), `## Documentation state`, `## Tests and CI`, `## Declared gaps`, `## Risks`, `## Recommended adoption plan`. Every factual line ends with its source tag: `[user]`, `[docs]`, `[code]`, `[git]`, or `[gap]`.

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/onboard
git commit -m "feat: onboard skill (situation map with declared gaps)"
```

---

### Task 9: `build` skill (stage 5)

**Files:**
- Create: `skills/build/SKILL.md`
- Create: `skills/build/references/slice-guide.md`

**Interfaces:**
- Consumes: approved blueprint (ROADMAP, ADRs), frozen mockups, `shared/references/decision-classification.md`; layer skills (Tasks 14-17) injected into slice subagents; `tdd`/`verifying` process skills (Tasks 12-13).
- Produces: built slices; calls `ship` (Task 10) to close each one.

- [ ] **Step 1: Write `skills/build/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: build
description: Use when constructing an approved project: vertical slices end to end, just-in-time spec and plan per slice, TDD loop, decision classification, narrow subagents per layer.
---
```

Body outline (write in full):
1. `## Preconditions` — blueprint approved and explicit user order to build (stage 5 gate). Read ROADMAP current phase + ADRs + latest checkpoint; do NOT re-derive the stack.
2. `## Slice planning` — decompose the current phase into vertical slices: each crosses every applicable layer end to end (UI → API → data → auth → deploy) and ends in something a user can observe; slice 1 of phase 1 is the **walking skeleton** (thinnest end-to-end path INCLUDING deploy — it validates the whole delivery pipeline while the codebase is tiny); write the slice plan just-in-time (never for future slices); classify every plan decision per `shared/references/decision-classification.md` with the audit table; GATE: present the plan only if it contains user-challenge decisions, otherwise proceed and keep the table reviewable.
3. `## Slice construction loop` — for each slice: frontend replicates the frozen mockups (no redesigning on the fly); TDD loop per the `tdd` skill (test first, red, green, refactor); narrow subagents per layer where parallelism helps — each subagent prompt includes ONLY the `layer-*` skill bodies its work touches (never all eight) plus the relevant ADR lines; verification per the `verifying` skill before calling the slice done.
4. `## Close` — every slice ends by invoking `ship` (one commit per slice). Discovered trap → record it in the affected layer's project notes or as an ADR; product-behavior change discovered mid-slice → user-challenge gate, then VISION/MVP updated in the same commit (drift rule).
5. `## Post-MVP phases` — when a phase beyond the MVP starts: its screens get mockups just-in-time via the `mockups` skill (same gate), then its slices follow this same loop.

- [ ] **Step 2: Write `skills/build/references/slice-guide.md`** — how to cut good slices with a worked example (invoice SaaS phase 1 → slices: 1 walking skeleton "log in, see empty invoice list, deployed"; 2 "create invoice happy path"; 3 "invoice list with pagination and empty/error states"; 4 "PDF export"); slice smells (a slice that touches only one layer is a horizontal task, not a slice; a slice without an observable result; a slice > ~1 day); the audit-table example filled for slice 2; subagent prompt template: goal, slice spec excerpt, ADR lines, injected layer checklist names, "return a summary and the diff, not the whole files".

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/build
git commit -m "feat: build skill (vertical slices with decision-classified gates)"
```

---

### Task 10: `ship` skill

**Files:**
- Create: `skills/ship/SKILL.md`

**Interfaces:**
- Consumes: `verifying` skill (Task 13), `scripts/verify/` of the project, checkpoint script (Task 3).
- Produces: closed slice/phase — green verification, drift-checked docs, checkpoint, commit/PR, updated ROADMAP.

- [ ] **Step 1: Write `skills/ship/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: ship
description: Use when closing a slice or phase: run full verification in green, check docs drift, write a checkpoint, commit or PR, and update the ROADMAP.
---
```

Body outline (write in full):
1. `## Verification gate` — run the project's verification (`scripts/verify/` + test suite) and show the evidence (per `verifying` skill); a red check blocks the close, no exceptions; use native `/code-review` for review when the change warrants it (one line, do not re-teach).
2. `## Drift check` — diff reality vs docs touched by this slice: ROADMAP phase state, ARCHITECTURE, DATA-MODEL, permission matrix, UI-DESIGN; fix drift in the SAME commit; new decision discovered → ADR (`shared/references/templates/adr.md`).
3. `## Checkpoint` — write it via `node "${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.mjs" write --stage build --branch <branch> --slice "<n: name>" --files "<changed>" --next "<next slice or phase gate>"`; `.acdev/` is committed with the slice.
4. `## Close` — one commit per slice (conventional message naming the slice); PR when the project uses PRs (native `gh`, one line); phase exit: verify the ROADMAP exit criteria for the phase, mark it, and stop for the next-phase gate.

- [ ] **Step 2: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/ship
git commit -m "feat: ship skill (verified close with drift check and checkpoint)"
```

---

### Task 11: `status` skill

**Files:**
- Create: `skills/status/SKILL.md`
- Create: `shared/references/templates/state.md`
- Create: `shared/references/templates/checkpoint.md`

**Interfaces:**
- Consumes: checkpoint script (Task 3), `.acdev/` of the project, `docs/ROADMAP.md`.
- Produces: the resume snapshot (< 2k tokens); manual checkpoint writing.

- [ ] **Step 1: Write `skills/status/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: status
description: Use when resuming work or asking where the project stands: read state, latest checkpoint and current ROADMAP phase for about 2k tokens; can also write a manual checkpoint.
---
```

Body outline (write in full):
1. `## Read` — run `node "${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.mjs" read`; then read ONLY the current phase section of `docs/ROADMAP.md` (not the whole file); report: stage, branch, last slice, next step, blockers, phase progress. Budget: the whole status answer stays under ~2k tokens — no repo scanning, no file dumps. If `.acdev/` is missing: say so and offer `onboard` (existing repo) or `new-project` (empty repo).
2. `## Write (manual checkpoint)` — when the user asks to save state mid-work: gather stage/branch/slice/files/next from the session and call the script's `write` command; confirm the created path.
3. `## Trust rule` — checkpoints reflect what was true when written; if the checkpoint contradicts repo reality (branch gone, files moved), say what differs and trust reality (drift rule).

- [ ] **Step 2: Write `shared/references/templates/state.md` and `checkpoint.md`** — exact copies of the formats produced by `checkpoint.mjs` (state: stage/updated/latest_checkpoint; checkpoint: the spec §7.1 frontmatter + ≤ 10 lines of prose), so blueprint and docs can reference the canonical shape.

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/status shared/references/templates
git commit -m "feat: status skill (2k-token resume snapshot)"
```

---

### Task 12: Process skills `designing` + `planning`

**Files:**
- Create: `skills/designing/SKILL.md`
- Create: `skills/planning/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: standalone process discipline; `build` (Task 9) references `planning` for slice plans.

- [ ] **Step 1: Write `skills/designing/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: designing
description: Use before any creative or feature work outside the pipeline stages: converse the design until an approved design doc exists. Inside the pipeline, defer to the VISION and MVP stages.
---
```

Body (write in full, compact): purpose (understand before building); if the work belongs to a pipeline project → route to the pipeline stage instead (new-project/mockups/blueprint); otherwise: explore current state first; ask ONE question at a time (multiple choice when possible); challenge weak answers; propose 2-3 approaches with a recommendation; present the design in sections scaled to complexity; write `docs/designs/YYYY-MM-DD-<topic>.md`; GATE: explicit approval before any implementation; then hand to `planning`. Self-review before the gate: placeholders, contradictions, scope, ambiguity.

- [ ] **Step 2: Write `skills/planning/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: planning
description: Use when a task needs a multi-step plan with verifiable completion criteria, including per-slice plans during build.
---
```

Body (write in full, compact): plans state the goal + verify pair for every step ("do X — verify: observable check"), exact paths and commands, no placeholders ("TBD", "handle errors appropriately" are plan failures); right-size tasks (smallest unit with its own verify cycle); include the decision audit table when decisions were classified; store plans at `docs/plans/YYYY-MM-DD-<topic>.md`; execution tracks steps as todos; a plan is done when every verify has evidence, not when the code is written.

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/designing skills/planning
git commit -m "feat: designing and planning process skills"
```

---

### Task 13: Process skills `tdd` + `debugging` + `verifying`

**Files:**
- Create: `skills/tdd/SKILL.md`
- Create: `skills/debugging/SKILL.md`
- Create: `skills/verifying/SKILL.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the loop `build` runs (tdd) and the gate `ship` runs (verifying).

- [ ] **Step 1: Write `skills/tdd/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: tdd
description: Use when implementing any feature or bugfix: write the failing test first, watch it fail, make it pass minimally, refactor. No implementation before a red test.
---
```

Body (write in full, compact): the loop — (1) write ONE failing test expressing the next behavior; (2) run it, confirm it fails for the expected reason (a test that passes immediately tests nothing); (3) minimal code to green (resist speculative structure — YAGNI); (4) run full suite; (5) refactor on green only; (6) commit small. Bug fixes start with the reproducing test. Anti-patterns: writing tests after code "to cover it"; asserting implementation details instead of behavior; skipping the red run. When the project has no test runner yet: setting one up IS the first slice task (blueprint's CI skeleton names it).

- [ ] **Step 2: Write `skills/debugging/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: debugging
description: Use on any bug, failing test or unexpected behavior before proposing fixes: reproduce it, form hypotheses, find the root cause, fix with a test.
---
```

Body (write in full, compact): the sequence — (1) reproduce reliably (a bug you cannot reproduce is not understood; capture the exact command and output); (2) read the actual error, not the assumed one; (3) form 2-3 ranked hypotheses BEFORE editing; (4) test the cheapest hypothesis with evidence (log, probe, bisect — git bisect for regressions); (5) fix the root cause, never the symptom; (6) add the regression test (tdd skill) and verify green; (7) one line: what was learned — if it is a project trap, record it (ADR or layer note). Red flags: "quick fix while I am here", stacking speculative fixes, fixing without reproducing.

- [ ] **Step 3: Write `skills/verifying/SKILL.md`**

Frontmatter (exact):

```markdown
---
name: verifying
description: Use before claiming anything is done, fixed or passing: run the verification and show the evidence. No green claim without command output.
---
```

Body (write in full, compact): evidence before assertions — run the project's checks (`scripts/verify/`, test suite, lint/typecheck) and paste the decisive lines (budgeted: the verdict lines, never full logs); claims map to evidence ("tests pass" requires the passing run in this session, after the last edit); partial completion is reported as partial; delegate code review to native `/code-review` when the change is significant (one line, not re-taught); receiving review feedback: verify technically before implementing, push back with evidence when the feedback is wrong.

- [ ] **Step 4: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/tdd skills/debugging skills/verifying
git commit -m "feat: tdd, debugging and verifying process skills"
```

---

### Tasks 14-17: The 8 layer skills

Common contract for ALL layer skills (spec §9) — every `SKILL.md` follows this exact section order, < 300 lines:

```markdown
---
name: layer-<x>
description: <from the table below>
---

# Layer: <name>

<one scope line>

## Before advising
Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided; never re-derive or second-guess it here. If no ADRs exist, say so and route to blueprint (new projects) or onboard (existing repos).

## Production checklist
<goal + verify items, stack-agnostic>

## Pitfalls
<one-line traps with the failure they cause>

## How to verify
<pointers to the project's scripts/verify/ + generic probes>
```

Checklist items use goal + verify format. Items below are the required minimum content per skill — the implementer writes each as a full checklist line with its verify probe.

---

### Task 14: `layer-frontend` + `layer-api`

**Files:**
- Create: `skills/layer-frontend/SKILL.md`
- Create: `skills/layer-api/SKILL.md`

**Interfaces:**
- Consumes: contract above; ADRs and UI-DESIGN/mockups of the project.
- Produces: injectable checklists for `build` subagents.

- [ ] **Step 1: Write `skills/layer-frontend/SKILL.md`**

Description (exact): `Use when building or changing UI: structure, state, routing, accessibility, performance, and design tokens from the approved mockups.`

Checklist must cover (each as goal + verify): UI replicates frozen mockups, tokens come from UI-DESIGN (no ad-hoc colors/spacing — verify: no hardcoded hex outside the token file); every screen handles empty/error/loading states (verify: each state reachable and rendered); routing guards match the permission matrix (verify: direct URL to a forbidden route redirects/403s); forms validate client-side AND rely on server validation as source of truth; accessibility floor: labels, keyboard navigation, focus management, contrast (verify: tab through the critical flow); state boundaries: server state vs UI state separated (no server data duplicated in local stores without invalidation); performance: code-split routes, image sizing, no blocking third-party scripts (verify: bundle report or route-level check); i18n-ready if VISION says multiple languages (all copy through the i18n layer).
Pitfalls (one line each): redesigning during build instead of reopening the mockup gate; global mutable stores for server data (stale UI bugs); disabled-button-only validation (bypassable); z-index/overlay arms race; fetch in components without cancellation (race conditions on fast navigation).

- [ ] **Step 2: Write `skills/layer-api/SKILL.md`**

Description (exact): `Use when designing or changing APIs and backend logic: contracts, validation, errors, pagination, idempotency, N+1, transactions, background jobs.`

Checklist must cover: every endpoint validates input at the boundary with a schema (verify: malformed payload returns 400 with field errors, never 500); consistent error envelope with stable machine-readable codes; pagination on every list endpoint from day one (verify: list endpoint with 1000+ rows returns a page, not everything); idempotency for mutations that money or external side effects depend on (verify: same idempotency key twice → one effect); multi-step writes are transactional (verify: forced mid-failure leaves no partial state); N+1 checked on relation-heavy endpoints (verify: query count constant as list size grows); slow/external work goes to background jobs with retry + dead-letter (verify: job failure retries and lands in DLQ, not silently lost); API versioning or additive-only evolution declared in an ADR; timeouts and retries with backoff on all outbound calls.
Pitfalls: business logic in controllers/handlers (untestable); returning ORM entities directly (leaks fields — use explicit DTOs); catching exceptions to log-and-continue (corrupt state); pagination added "later" (breaking change); retry without idempotency (double effects).

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/layer-frontend skills/layer-api
git commit -m "feat: frontend and api layer skills"
```

---

### Task 15: `layer-data` + `layer-auth`

**Files:**
- Create: `skills/layer-data/SKILL.md`
- Create: `skills/layer-auth/SKILL.md`

- [ ] **Step 1: Write `skills/layer-data/SKILL.md`**

Description (exact): `Use when touching the database or storage: modeling, reversible migrations, indexes, PII, backups, object storage.`

Checklist must cover: every schema change is a migration, never manual (verify: fresh clone + migrate reproduces the schema); migrations reversible or explicitly marked irreversible with a documented recovery path (verify: down migration or the marker exists); FKs and constraints in the database, not only in app code (verify: violating insert fails at the DB); indexes justified by real queries — FKs and frequent WHERE/ORDER BY columns first (verify: EXPLAIN on the hot queries shows index use); PII columns marked in DATA-MODEL with retention rule (verify: the table exists and matches); tenant-owned tables carry the tenant key and it is NOT nullable (multi-tenant projects); backups automated AND restore tested (verify: a restore drill note exists — an untested backup is not a backup); object storage: private by default, signed URLs, size/type limits at upload (verify: direct unsigned URL fails).
Pitfalls: soft-delete everywhere by default (query complexity + index bloat without a requirement); JSON columns as a schema escape hatch (unqueryable, unvalidated); UUIDv4 PKs on huge hot tables without considering locality; "temporary" tables/columns without an owner (permanent); running migrations only forward in dev (down path rots).

- [ ] **Step 2: Write `skills/layer-auth/SKILL.md`**

Description (exact): `Use when touching authentication or authorization: sessions or JWT, RBAC, multi-tenancy, permission matrix, auth flows.`

Checklist must cover: session/token strategy matches the ADR (server sessions vs short-lived JWT + refresh — never both improvised); tokens/sessions expire and revoke server-side (verify: expired/revoked token returns 401 on a protected route); authorization enforced at the API boundary for EVERY route, not in the UI (verify: forbidden role calling the endpoint directly gets 403); permission matrix in SECURITY.md is the source of truth and tests mirror it (verify: one test per matrix row minimum on critical resources); multi-tenant: tenant resolved from the session server-side, never from client input (verify: forged tenant id in the payload cannot cross tenants); complete flows: signup, verify, reset, logout-everywhere (verify: reset token single-use and expiring); secrets for auth (signing keys) rotated per documented procedure; OAuth providers: state + PKCE where applicable.
Pitfalls: JWT in localStorage (XSS-readable — prefer httpOnly cookies per ADR); role checks sprinkled as string comparisons (drifts from the matrix — centralize); "admin" flag checked in the UI only; long-lived refresh tokens without rotation/reuse detection; permission checks after data load (leaks existence via timing/errors).

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/layer-data skills/layer-auth
git commit -m "feat: data and auth layer skills"
```

---

### Task 16: `layer-security` + `layer-performance`

**Files:**
- Create: `skills/layer-security/SKILL.md`
- Create: `skills/layer-performance/SKILL.md`

- [ ] **Step 1: Write `skills/layer-security/SKILL.md`**

Description (exact): `Use when touching security-sensitive code: row-level security verified with tests, rate limiting on a shared store, input validation, secrets, headers, OWASP.`

Checklist must cover: RLS (or equivalent row filtering) active on every tenant/user-owned table AND proven by an isolation test (verify: authenticated as A, query for B's rows returns empty — the test exists and runs in CI); default-deny — new tables/routes start closed (verify: a table created without policies is inaccessible, not open); rate limiting on auth endpoints and expensive routes, counters in a SHARED store, never per-process memory (verify: two app instances share the limit; limit-exceeded returns 429 with Retry-After); input validated at every trust boundary (API, webhooks, file uploads, queue consumers); secrets only in env/secret manager — repo scanned (verify: no secrets in git history; `.env.example` lists names only); security headers: CSP, HSTS, X-Content-Type-Options, frame-ancestors (verify: response headers on the deployed app); webhooks verified by signature + replay window; dependency audit in CI with a triage rule; OWASP top 10 pass over the permission matrix and injection surfaces at each phase exit.
Pitfalls: RLS enabled but service-role/admin client used in app queries (bypasses everything silently); rate limit only at the edge/CDN while the origin is open; CORS `*` with credentials; SSRF via user-supplied URLs (fetchers, importers, webhooks); error messages leaking internals (stack traces, SQL) to clients.

- [ ] **Step 2: Write `skills/layer-performance/SKILL.md`**

Description (exact): `Use when working on caching or performance: cache-aside and invalidation, TTLs, CDN, compression, performance budgets.`

Checklist must cover: cache only proven-hot reads (measure first — verify: the metric or slow query that justified each cache exists in a comment/ADR); cache-aside with explicit invalidation on write + TTL as backstop (verify: write-then-read shows fresh data; TTL set on every key); cache keys include every variance dimension (tenant, locale, role) (verify: user A never sees B's cached payload); static assets through CDN with immutable hashed filenames (verify: cache-control headers on assets vs HTML); HTML/APIs: no-store or short private cache unless deliberately public (verify: authenticated response is not CDN-cached); compression enabled (verify: response content-encoding); performance budgets stated in blueprint (p95 API latency, page weight) and checked at phase exits; DB before cache: missing index is fixed by an index, not a cache.
Pitfalls: caching to hide an N+1 (fix the query); invalidation by "wait for TTL" on user-visible writes (stale UI reports); per-process in-memory caches behind a load balancer (inconsistent responses); caching error responses; forgetting Vary/tenant in keys (data leak, the worst failure mode of this layer).

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK.
```bash
git add skills/layer-security skills/layer-performance
git commit -m "feat: security and performance layer skills"
```

---

### Task 17: `layer-delivery` + `layer-cicd`

**Files:**
- Create: `skills/layer-delivery/SKILL.md`
- Create: `skills/layer-cicd/SKILL.md`

- [ ] **Step 1: Write `skills/layer-delivery/SKILL.md`**

Description (exact): `Use when working on hosting, deployment or environments: deploy with rollback, health checks, config and secrets per environment, minimal observability.`

Checklist must cover: at least two environments (staging/production) with config via env, never code branches (verify: same artifact deploys to both); deploys reproducible from a clean checkout by CI, not from a laptop (verify: the pipeline is the only deploy path); rollback exists and is TESTED (verify: a rollback drill was run — deploy N-1 restores service); health endpoint checked by the platform before traffic (verify: failing health blocks the rollout); migrations coordinated with deploy order (expand-migrate-contract for breaking changes — verify: old code runs against new schema during the window); secrets per environment in the platform's secret store; observability minimum: structured logs with request/tenant ids, error tracking wired, one uptime alert to a human channel (verify: a forced test error appears in the tracker and alerts); walking-skeleton rule: deploy pipeline exists from slice 1, not "at the end".
Pitfalls: config drift edited in the dashboard and never recorded (record as ADR/env docs); migrations auto-run on boot of every instance (races — run as a deploy step); "roll forward only" as an unexamined default; logs without correlation ids (undebuggable incidents); staging pointing at production services (test traffic corrupting real data).

- [ ] **Step 2: Write `skills/layer-cicd/SKILL.md`**

Description (exact): `Use when setting up or changing CI/CD or repo workflow: lint, typecheck, test and build pipeline, branch protection, conventional commits, releases.`

Checklist must cover: CI runs on every push/PR: lint + typecheck + tests + build, and the project's `scripts/verify/` where cheap (verify: a failing test blocks the merge); pipeline fast enough to respect (< ~10 min or split — verify: measure and record); main is protected: PRs + green CI required (verify: direct push rejected); conventional commits enforced or at least documented in CLAUDE.md; every slice = one commit (acdev rule) and CI green before `ship` closes it; releases tagged with changelog entries; CI caches dependencies (verify: second run visibly faster); secrets in CI via the platform's secret store, never in workflow files; deploy job separated from test job with an environment gate for production.
Pitfalls: tests skipped in CI "temporarily" (permanent); flaky tests retried-until-green instead of fixed (they are bugs); CI config duplicating commands that differ from local scripts (drift — one source of truth); workflow files with inline secrets; unpinned third-party actions (supply-chain risk).

- [ ] **Step 3: Lint and commit**

Run: `node scripts/lint-budgets.mjs` — Expected: OK (21 skills checked).
```bash
git add skills/layer-delivery skills/layer-cicd
git commit -m "feat: delivery and cicd layer skills"
```

---

### Task 18: README + CHANGELOG

**Files:**
- Create: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: everything built.
- Produces: install/usage documentation; the fixed-cost ledger (spec §8.7).

- [ ] **Step 1: Write `README.md`** with these sections (write in full):
1. `# acdev` — one paragraph: what it is (gated, documentation-first, token-disciplined pipeline from idea to production), what it replaces for the author (superpowers + proyecto-kike), core principle (cover only the delta over native Claude Code).
2. `## Install` — `/plugin marketplace add acnetcenter/acdev` then `/plugin install acdev@acnetcenter`; requirements: Claude Code with plugins enabled, Node ≥ 20 on PATH for the hook and scripts (without Node the plugin still works, with description-only activation).
3. `## Quickstart` — new project: `/acdev:new-project`; existing repo: `/acdev:onboard`; resume: `/acdev:status`; the pipeline map (stage table from spec §6 condensed).
4. `## The 21 skills` — the 4-group table with one line each (copy descriptions from frontmatter).
5. `## Token cost ledger` — the honest fixed cost: 21 descriptions + gateway hook ≈ 2.3k tokens/session; what is NOT loaded (bodies, references, scripts) and the budgets enforced by lint.
6. `## Migration from superpowers / proyecto-kike` — uninstall superpowers, remove the personal proyecto-kike skill, why (duplicate hooks/skills competing); kike-era projects are compatible via `/acdev:onboard`.
7. `## Development` — `node --test`, `node scripts/lint-budgets.mjs`, CI badge, contribution rule (budgets are hard, no emojis, English).

- [ ] **Step 2: Update `CHANGELOG.md`** — replace the `TBD on first release` line with today's date and the real summary.

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: readme with install, ledger and migration"
```

---

### Task 19: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `node --test` + lint entry points (Tasks 1-3).
- Produces: green CI required by the repo's own layer-cicd standards.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: node --test
      - run: node scripts/lint-budgets.mjs
```

- [ ] **Step 2: Verify locally (CI parity)**

Run: `node --test && node scripts/lint-budgets.mjs`
Expected: all tests pass; `lint-budgets: OK (21 skills checked)`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: tests and budget lint on push and pr"
```

---

### Task 20: Local acceptance

**Files:**
- Modify: whatever the acceptance reveals (fixes only).

**Interfaces:**
- Consumes: the whole plugin.
- Produces: release readiness evidence (spec §14.3).

- [ ] **Step 1: Install the plugin locally from the working tree**

In a Claude Code session: `/plugin marketplace add C:\githubRepositories\Kike-AI-Project` then `/plugin install acdev@acnetcenter`. Restart the session.
Expected: plugin listed as installed; no load errors.

- [ ] **Step 2: Verify the SessionStart hook on Windows**

Start a fresh session in any directory.
Expected: the using-acdev gateway text appears in context (the model references acdev skills unprompted when asked "what acdev skills do you have?").

- [ ] **Step 3: Smoke `/acdev:status` outside a project**

Run `/acdev:status` in an empty directory.
Expected: friendly "no checkpoints" answer offering new-project/onboard; well under 2k tokens.

- [ ] **Step 4: Dry-run stage 0-1 on a toy project**

In a scratch directory: `/acdev:new-project`, answer the intake, converse VISION section 1 only, then abort.
Expected: intake asks the 4 questions in ONE message; questionnaire flows one section at a time; no code files created.

- [ ] **Step 5: Onboard smoke on a real existing repo**

Run `/acdev:onboard` on an existing repository (read-only steps only; stop before writing SITUATION.md).
Expected: inventory follows source precedence; gaps declared with `[gap]` tags; no invented facts.

- [ ] **Step 6: Record results and fix**

Any failure: fix, re-run the failed step, then commit fixes as `fix: <what>`. When all steps pass:

```bash
git add -A
git commit -m "chore: local acceptance fixes"
```

---

## Self-Review (run after writing, before execution)

1. **Spec coverage:** §5.1 inventory (21 skills) → Tasks 4-17. §6 pipeline+gates → Tasks 5-11. §6.1 spikes → Task 7. §6.2 classification → Tasks 7, 9. §6.3 slices → Task 9. §7 artifacts+checkpoint → Tasks 3, 5-8, 11. §8 economy → Task 2 (lint), budgets in every task, ledger in Task 18. §9 layer contract → Tasks 14-17. §10 process contract → Tasks 12-13. §11 hook → Task 4. §12 layout → Tasks 1-19. §13 distribution/migration → Tasks 1, 18. §14 verification → Tasks 2, 19, 20.
2. **Placeholder scan:** the only intentional implementer instruction is the fixture padding note in Task 2 Step 3 (explicitly marked). Layer checklist items are enumerated with substance, not "add appropriate checks".
3. **Type consistency:** script flags (`--stage/--branch/--next/--slice/--files/--blocked/--notes`) match between Task 3 code, Task 10 ship usage and Task 11 status usage. Skill names in Task 4 gateway match directory names in Tasks 5-17. Lint constants match Global Constraints.
