# Shipyard — Claude Code Plugin Design

**Date:** 2026-07-09
**Status:** Approved in conversation; pending final review of this document
**License:** MIT
**Language:** Plugin content in English; artifacts generated inside user projects are written in the language chosen at project intake.

## 1. Purpose

Shipyard is a Claude Code plugin that takes a software project from idea to production — or adopts an existing one — through a systematic, gated, documentation-first pipeline. It covers every production layer (frontend, APIs, data, auth, security, performance, delivery, CI/CD) with strict token discipline.

It replaces two things in the author's environment:

- The personal `proyecto-kike` skill (a 5-stage documentation-first pipeline distilled from building a real SaaS), which Shipyard inherits as its backbone and extends.
- The `superpowers` plugin, whose process discipline Shipyard distills into 5 integrated skills.

**Core design principle — cover only the delta.** Claude Code natively provides plan mode, parallel subagents (Agent tool), worktrees, `/code-review`, `/resume`, `/rewind`, task tracking, and context management. Shipyard adds only what the harness does not have: the gated pipeline, production-layer knowledge, and cross-session project continuity. Anything that re-teaches native behavior is dead weight and is excluded.

## 2. Goals

1. One command starts a new project and drives it to production readiness through explicit user gates.
2. One command adopts an existing repo with a truthful situation map: declared gaps, never guessed facts.
3. Production-layer knowledge is available on demand and parameterized by per-project decisions (ADRs) — decided once, never re-derived.
4. Resuming work on a project costs ~2k tokens (checkpoint + state), not a repo re-scan.
5. The installed plugin's fixed context cost stays ≤ ~2,500 tokens per session, enforced by lint.

## 3. Non-goals (v1 exclusions)

| Excluded | Reason |
|---|---|
| Bundled MCP servers | ~500 tokens per tool schema, loaded always, used rarely |
| Per-tool-call hooks (format/lint on every edit) | Latency and noise; verification is concentrated in `build` and `ship` |
| Continuous-learning / "instincts" systems | Permanent observation cost, unproven value |
| Embedding-based memory | Git + markdown is the memory; no paid APIs, no infrastructure |
| Multi-harness packaging (Cursor, Codex, Gemini...) | Claude Code only. Note: generated projects remain multi-AI (CLAUDE.md + AGENTS.md mirror) |
| Stack packs | v1 is fully stack-agnostic; opinionated packs may come later as separate additions |
| Custom subagent definitions (`agents/`) | Each agent description is permanent context cost; narrow subagents are spawned via the native Agent tool with injected layer references |
| Classic `commands/` directory | Modern skills are both user-invocable (`/shipyard:<name>`) and model-invocable; a parallel command set would duplicate them |

Nothing here is banned forever. v1 refuses to pay fixed costs for speculative value — the number one lesson from every reference repo reviewed.

## 4. Influences

| Source | Adopted |
|---|---|
| `proyecto-kike` (author's skill) | The backbone: documentation-first stages with hard approval gates, VISION as source of truth, 7-section questionnaire, mockups as frozen visual contract, normative docs catalog, AI context system (router CLAUDE.md + AGENTS.md mirror), drift rule, zero product code before build |
| obra/superpowers | Process discipline model (design → plan → build → verify), gateway skill injected at SessionStart (rebuilt at <400 tokens vs ~2,000) |
| garrytan/gstack | Decision classification (mechanical / taste / user-challenge) with audit trail; markdown checkpoints with frontmatter; skip-by-scope detection; deterministic CLIs for mechanical work |
| garrytan/gbrain | Git as the only memory (derived indexes are regenerable); source precedence + declared gaps when onboarding |
| affaan-m/ecc | Vertical slices with gates and one commit per slice; narrow subagents receiving only the relevant layer skill; production-layer content seeds; size thresholds (skill > 400 lines = too big) |
| multica-ai/andrej-karpathy-skills | "Goal + verify" format for every pipeline step; one-line self-test per rule |
| ComposioHQ/awesome-claude-skills | Token economy as hard rules (description ≤100 tokens, body <5k, references on demand, scripts at zero cost); anti-pattern: skills per layer, never per technology |
| Graphify-Labs/graphify | Deterministic work offloaded to scripts outside the context; output budgets ("paste only sections X, Y, Z"); numeric gates that force a question instead of a silent model choice |
| Claude Fable 5 system prompt (leak) | Prompt-writing lessons: spend tokens only on hard limits, conflict priorities and edge cases; unconditional gates; ambiguity resolved with numbers and declared priorities |

## 5. Architecture: a disciplined toolbox

Shipyard is a flat toolbox of **21 skills in 4 groups** (user's chosen approach), plus one SessionStart hook and a set of deterministic scripts. Every skill auto-activates through its description; the 7 pipeline skills are also user-invocable as `/shipyard:<name>`.

What keeps the toolbox disciplined:

- The **gateway** skill is injected at session start, so activation does not depend on the model remembering the toolbox exists.
- Skill count is capped by design review, not open-ended growth.
- Depth always lives in `references/`, never in bodies.
- Budgets are enforced by a lint script, not by good intentions.

### 5.1 Skill inventory

| Group | Skill | Invocation | Trigger (description draft) |
|---|---|---|---|
| Gateway | `using-shipyard` | hook-injected | How and when to use every Shipyard skill; loaded each session |
| Pipeline | `new-project` | `/shipyard:new-project` + auto | Use when starting a new software project from scratch: intake interview, then VISION.md and MVP.md with approval gates |
| Pipeline | `mockups` | `/shipyard:mockups` + auto | Use after MVP approval to build the static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved |
| Pipeline | `blueprint` | `/shipyard:blueprint` + auto | Use after mockup approval to produce normative docs, ADRs (stack decided here), technical spikes for unproven dependencies, the AI context system and repo mechanics |
| Pipeline | `onboard` | `/shipyard:onboard` + auto | Use when adopting an existing repo: build a truthful situation map (what exists, what is missing, declared gaps) and propose adopting the pipeline |
| Pipeline | `build` | `/shipyard:build` + auto | Use when constructing an approved project: vertical slices, just-in-time spec/plan per slice, TDD loop, decision classification |
| Pipeline | `ship` | `/shipyard:ship` + auto | Use when closing a slice or phase: full verification in green, docs drift check, checkpoint, commit/PR, ROADMAP update |
| Pipeline | `status` | `/shipyard:status` + auto | Use when resuming work or asking where the project stands: reads state + latest checkpoint + ROADMAP for ~2k tokens; can also write a manual checkpoint |
| Process | `designing` | auto | Use before any creative/feature work outside the pipeline stages: conversational design until an approved design doc exists |
| Process | `planning` | auto | Use when a task needs a multi-step plan with verifiable completion criteria |
| Process | `tdd` | auto | Use when implementing any feature or bugfix: red-green-refactor, test first |
| Process | `debugging` | auto | Use on any bug, failing test or unexpected behavior before proposing fixes: reproduce, hypothesize, find root cause |
| Process | `verifying` | auto | Use before claiming anything is done, fixed or passing: run verification, show evidence; delegates review to native /code-review |
| Layer | `layer-frontend` | auto + injected | Use when building or changing UI: structure, state, routing, accessibility, design tokens from the approved mockups |
| Layer | `layer-api` | auto + injected | Use when designing or changing APIs/backend logic: contracts, validation, errors, pagination, idempotency, N+1, transactions, background jobs |
| Layer | `layer-data` | auto + injected | Use when touching the database or storage: modeling, reversible migrations, indexes, PII, backups, object storage |
| Layer | `layer-auth` | auto + injected | Use when touching authentication or authorization: sessions/JWT, RBAC, multi-tenancy, permission matrix, auth flows |
| Layer | `layer-security` | auto + injected | Use when touching security-sensitive code: RLS verified with tests, rate limiting with a shared store, input validation, secrets, headers, OWASP |
| Layer | `layer-performance` | auto + injected | Use when working on caching or performance: cache-aside and invalidation, TTLs, CDN, performance budgets |
| Layer | `layer-delivery` | auto + injected | Use when working on hosting, deployment or environments: deploy with rollback, health checks, config/secrets per environment, minimal observability |
| Layer | `layer-cicd` | auto + injected | Use when setting up or changing CI/CD or repo workflow: lint/typecheck/test/build pipeline, branch protection, conventional commits, releases |

"Injected" means the `build` skill passes the layer's content to the narrow subagent constructing a slice that touches that layer.

### 5.2 The gateway

`using-shipyard` is printed into context by the SessionStart hook. Budget: **<400 tokens**. Contents: the invocation rule (if a skill matches, invoke it before responding), the skill map (one line per skill), and one instruction: "when resuming a project, run `/shipyard:status` first." Nothing else — no philosophy, no repeated system-prompt behavior.

## 6. The pipeline

Stage 0 — **Intake** (inside `new-project`): project name and one-liner, new vs existing repo, documentation language, Claude-only vs multi-AI. One message, wait for answers.

| Stage | Artifact | Gate |
|---|---|---|
| 1 | `docs/VISION.md` — the complete product, conversed section by section (7 fixed sections inherited from proyecto-kike) | HARD: explicit user approval of the full document |
| 2 | `docs/MVP.md` — the first-delivery contract derived from VISION: what is in, what is explicitly out, verifiable success criteria | HARD: explicit user approval |
| 3 | `mockups/` — every MVP screen in full detail (including empty, error and loading states) + `docs/mockups-inventory.md` skeleton (one line per post-MVP screen + navigation placement) | Approved mockups become the frozen visual contract for the MVP |
| 4 | Blueprint — normative docs chosen from the catalog (ROADMAP always; ARCHITECTURE, DATA-MODEL, SECURITY, INTEGRATIONS, UI-DESIGN as applicable), ADRs (stack decided HERE), technical spikes for unproven dependencies, AI context system (CLAUDE.md router + AGENTS.md mirror), repo mechanics (.gitignore, .env.example, CI skeleton), per-project verification scripts | User reviews the full documentation package |
| 5 | Build — the MVP by vertical slices; post-MVP phases receive mockups + spec just-in-time, phase by phase | Explicit order to start building; per-slice and per-phase gates below |

Hard rules (inherited from proyecto-kike, extended):

- **Zero product code before stage 5.** Mockups and spikes are disposable artifacts, not product.
- VISION is the source of truth. A conflict discovered in a child document is resolved in VISION with the user — never patched in the child. MVP.md follows the same derivation rule.
- **Drift rule:** repo reality wins; documents are corrected in the same commit that reveals the drift.
- No placeholders. A missing fact is either asked or declared as a gap.
- **Skip-by-scope:** a project with no UI (CLI, API, worker) skips stage 3 (propose the skip, confirm with user). A project with a known stack and no unproven dependencies produces no spikes.
- Never generate speculative domain skills or future-phase specs on day 0. Both are created just-in-time.

### 6.1 Technical spikes

A spike answers **one concrete technical question** before the related ADR is frozen — the technical symmetric of mockups ("see before building" → "touch before committing").

- **Trigger:** while drafting ADRs in blueprint, any decision that depends on something unproven (third-party API, critical integration, doubtful performance requirement) is flagged for a spike.
- **Success criterion written before any code:** "obtain the OAuth token for X and read 10 real invoices" — never "explore the API".
- **Timebox:** 2-6 hours. Lives in `spikes/NNN-<question>/`, outside the product tree.
- **Output:** the answer, recorded in the ADR (works / does not work / works with these limits). Spike code never merges into product code.
- A CRUD on a known stack produces zero spikes. Optional means optional.

### 6.2 Decision classification

Every decision taken during blueprint and build is classified (from gstack):

- **mechanical** — one correct answer exists (a lockfile fix, an obvious index). Auto-decided silently.
- **taste** — several valid options, low reversal cost (naming, folder layout, minor library choice). Auto-decided, shown in the audit table.
- **user-challenge** — product behavior, money, security posture, data model, anything expensive to reverse. Never auto-decided; the gate question goes to the user.

Every plan document carries an audit table: decision, class, choice, reason. The user only gets interrupted for user-challenge items; everything else stays reviewable after the fact.

### 6.3 Vertical slices

Build proceeds by vertical slices, not by horizontal layers: each slice crosses every applicable layer end-to-end (UI → API → data → auth → deploy) and ends in something observable. The first slice is the **walking skeleton**: the thinnest possible end-to-end path, including deployment — it validates the whole pipeline while the codebase is still tiny. Per slice: just-in-time spec and plan → TDD loop → verification → gate (only if the plan contains user-challenge decisions) → `ship` (one commit per slice).

## 7. Project-side artifacts

What Shipyard generates inside each user project:

```
project/
├── docs/
│   ├── VISION.md              # stage 1, approved
│   ├── MVP.md                 # stage 2, approved
│   ├── ROADMAP.md             # blueprint; phases with verifiable exit criteria
│   ├── ARCHITECTURE.md        # blueprint (catalog: as applicable)
│   ├── adr/NNNN-*.md          # blueprint + any later decision
│   ├── mockups-inventory.md   # stage 3 skeleton (post-MVP screens)
│   └── ...                    # other catalog docs as applicable
├── mockups/                   # stage 3: index.html + one page per MVP screen
├── spikes/NNN-*/              # blueprint: disposable experiments (if any)
├── scripts/verify/            # blueprint: per-project verification commands
├── .shipyard/
│   ├── state.md               # pipeline stage, gates passed with dates
│   └── checkpoints/           # YYYYMMDD-HHmm-<slug>.md
├── CLAUDE.md                  # router: golden rules from Model section + stack
└── AGENTS.md                  # mirror of CLAUDE.md (multi-AI projects)
```

- `.shipyard/` is **committed** — git is the memory; state travels with the repo across machines.
- Verification scripts are **generated per project** in blueprint (the agnostic plugin ships templates; the concrete project gets concrete commands — checking RLS in Supabase is nothing like checking it in raw Postgres).
- All generated artifacts are written in the project language chosen at intake.

### 7.1 Checkpoint format

```markdown
---
date: 2026-07-09 18:40
stage: build
branch: feat/slice-3-invoice-import
slice: "3: invoice import happy path"
files_modified: [src/api/invoices.ts, src/db/migrations/0007_invoices.sql]
next_step: "wire UI list to GET /invoices, then ship"
blocked_on: null
---
One to ten lines of prose context. Nothing else.
```

`status` reads `state.md` + the latest checkpoint + the current ROADMAP phase. Target cost: **<2k tokens**.

## 8. Token economy (hard rules, linted)

1. Skill description ≤ 100 tokens (approximated at 4 characters/token by the lint), written as a trigger ("Use when...").
2. Skill body < 500 lines and < 5k tokens; depth goes to `references/`, loaded on demand.
3. Outputs are budgeted: never paste a full document into conversation; name the sections that matter.
4. Deterministic work goes to scripts (`checkpoint.mjs`, doc scaffolding, budget lint) — zero context cost.
5. Subagents receive only the layer references their slice touches, never all eight.
6. `scripts/lint-budgets.mjs` validates rules 1-2 and the plugin structure; CI fails on violation.
7. The fixed-cost ledger is documented in the README: 21 descriptions × ~90 tokens + gateway ~350 ≈ **~2.3k tokens/session**.

## 9. Layer skills — content contract

Every `layer-*` skill follows the same structure, < 300 lines:

1. **Scope line** — what this layer covers.
2. **ADR preamble** — "Read `docs/adr/` and `ARCHITECTURE.md` before advising. The stack is already decided; never re-derive or second-guess it here."
3. **Production checklist** — goal + verify format ("Sessions expire server-side → verify: expired token returns 401"), stack-agnostic.
4. **Pitfalls** — real traps, one line each, with the failure they cause.
5. **How to verify** — pointers to `scripts/verify/` of the project plus generic probes.
6. `references/` — optional depth (e.g. `rls-testing-patterns.md`).

Layer scopes: `frontend` (structure, state, routing, a11y, design tokens from approved mockups) · `api` (contracts, validation, errors, pagination, idempotency, N+1, transactions, background jobs) · `data` (modeling, reversible migrations, indexes, PII, backups, object storage) · `auth` (sessions/JWT, RBAC, multi-tenancy, flows, permission matrix) · `security` (RLS verified with tests, rate limiting on a shared store, input validation, secrets, headers, OWASP) · `performance` (cache-aside + invalidation, TTLs, CDN, budgets) · `delivery` (hosting, environments, deploy + rollback, health checks, observability minimum) · `cicd` (lint/typecheck/test/build pipeline, branch protection, conventional commits, releases).

## 10. Process skills — content contract

Distilled from superpowers, integrated with the pipeline, native capabilities referenced instead of re-taught:

- `designing` — conversational design → approved design doc. Inside the pipeline it defers to the VISION/MVP stages; outside it, it is the entry point for any feature work.
- `planning` — plans with verifiable completion criteria; used per-slice by `build`.
- `tdd` — strict red-green-refactor; `build` runs its loop, but it also activates standalone.
- `debugging` — systematic: reproduce → hypothesize → root cause → fix with a test. Activates on any bug or failing test.
- `verifying` — evidence before claiming done/fixed/passing. Delegates code review to native `/code-review`; used by `ship` as its final gate.

Native features each skill references in one line instead of duplicating: worktrees, parallel subagents, plan mode, `/code-review`, `/resume`.

## 11. Hook

`hooks/hooks.json` registers one SessionStart hook: `node "${CLAUDE_PLUGIN_ROOT}/hooks/session-start.mjs"`, which prints `skills/using-shipyard/SKILL.md` (<400 tokens) — single source of truth, so the hook and the skill can never drift apart. Node.js is the most portable runtime available where Claude Code runs; if `node` is missing the hook fails silently and Shipyard still works with degraded auto-activation (descriptions only). This risk is validated during implementation on Windows (author's platform), macOS and Linux.

## 12. Plugin repository layout

```
shipyard/
├── .claude-plugin/
│   ├── plugin.json            # name, version (semver), description, author, MIT
│   └── marketplace.json       # for /plugin marketplace add <user>/shipyard
├── skills/                    # 21 skills, one directory each
│   └── <name>/SKILL.md        #   + references/ where depth exists
├── shared/
│   └── references/            # cross-skill content: decision-classification.md,
│                              # output-budgets.md, templates/ (VISION, MVP, ADR,
│                              # checkpoint, router CLAUDE.md, verify-script stubs)
├── hooks/
│   ├── hooks.json
│   └── session-start.mjs      # prints skills/using-shipyard/SKILL.md
├── scripts/
│   ├── checkpoint.mjs         # read/write checkpoints + state.md
│   └── lint-budgets.mjs       # structure + budget lint (CI)
├── docs/
│   └── specs/                 # this document and future specs
├── README.md                  # install, quickstart, fixed-cost ledger, migration
├── CHANGELOG.md
└── LICENSE
```

## 13. Distribution and migration

- Installable from the author's GitHub: `/plugin marketplace add <user>/shipyard` then `/plugin install shipyard`.
- README documents the migration: uninstall `superpowers` and remove the personal `proyecto-kike` skill when adopting Shipyard — keeping them would mean two startup hooks and duplicate skills (two TDDs, two brainstormings) competing for activation.
- Existing projects created with proyecto-kike are compatible: their VISION/ROADMAP/ADRs are read as-is; `/shipyard:onboard` adopts them, detecting what exists and declaring what is missing (it generates MVP.md retroactively only if the project still has unbuilt scope worth gating).

## 14. Verifying Shipyard itself

1. `scripts/lint-budgets.mjs` — structural lint: valid frontmatter in all 21 skills, description ≤ 100 tokens, body < 500 lines, no emojis, required sections present. Runs in CI.
2. `plugin.json` validation against the current Claude Code plugin schema.
3. Manual acceptance, before first release: install locally → run `/shipyard:new-project` on a toy project through stage 4 → run `/shipyard:onboard` on a real existing repo → verify `/shipyard:status` costs <2k tokens → verify the SessionStart hook injects the gateway on Windows.
4. Description routing review: each skill description names the trigger words a user would actually say (manual review in v1; automated routing evals are a v2 candidate).

## 15. Resolved decisions log

All open questions were resolved during the design conversation with the user:

| Decision | Resolution |
|---|---|
| Relation to proyecto-kike | Shipyard replaces it (inherits the backbone) |
| Relation to superpowers | Shipyard replaces it (distilled process skills) |
| Stack | Fully agnostic; stack decided per-project in ADRs; no stack packs in v1 |
| Language / distribution | English, shareable, MIT, author's GitHub marketplace |
| Architecture | Toolbox of auto-invocable skills (user's choice) with discipline mechanisms |
| Plugin name | shipyard |
| MVP handling | Separate MVP.md with its own hard gate; mockups derive from MVP.md |
| Technical risk | Optional timeboxed spikes during blueprint |
| Post-MVP screens | Skeleton inventory at stage 3; detailed mockups just-in-time per phase |
