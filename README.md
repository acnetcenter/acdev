# acdev

[![ci](https://github.com/acnetcenter/acdev/actions/workflows/ci.yml/badge.svg)](https://github.com/acnetcenter/acdev/actions/workflows/ci.yml)

acdev is a Claude Code plugin that takes a software project from idea to production — or adopts an existing one — through a gated, documentation-first, token-disciplined pipeline. For its author it replaces two overlapping setups: the general-purpose `superpowers` plugin and the personal `proyecto-kike` skill, which together meant two startup hooks and duplicate skills (two TDDs, two brainstormings) competing for activation on every session. acdev's core principle is to cover only the delta over native Claude Code: it does not re-teach what Claude already does well, it adds the process discipline, the hard approval gates, and the per-layer production checklists that a real project needs on top of that.

## Install

```
/plugin marketplace add acnetcenter/acdev
/plugin install acdev@acnetcenter
```

Or from a local clone (the plugin is fully usable before it is published
to GitHub):

```
/plugin marketplace add <absolute-path-to-this-repo>
/plugin install acdev@acnetcenter
```

Requirements:

- Claude Code with plugins enabled.
- Node.js >= 20 on `PATH`, used by the SessionStart and UserPromptSubmit hooks and by `scripts/checkpoint.mjs` / `scripts/lint-budgets.mjs`.

Node is not strictly required: without it both hooks fail silently and acdev still works, but skills activate from their descriptions alone (degraded auto-activation) instead of from the gateway skill map injected at session start and the per-prompt routing line.

## Quickstart

- New project, starting from zero: `/acdev:new-project`
- Existing repo, adopting acdev on top of it: `/acdev:onboard`
- Resuming work on any acdev project: `/acdev:status`

Pipeline map (five stages, each gated before the next starts):

| Stage | Artifact | Gate |
|---|---|---|
| 1. VISION | `docs/VISION.md`, conversed section by section | HARD: explicit user approval of the full document |
| 2. MVP | `docs/MVP.md` — what is in, what is out, verifiable success criteria | HARD: explicit user approval |
| 3. Mockups | Every MVP screen (including empty/error/loading states) + post-MVP skeleton inventory | Approved mockups freeze the visual contract |
| 4. Blueprint | Normative docs, ADRs, spikes for unproven dependencies, AI context system, repo mechanics | User reviews the full documentation package |
| 5. Build | The MVP by vertical slices; post-MVP phases get mockups + spec just-in-time | Explicit order to start building; per-slice/per-phase gates |

Zero product code is written before stage 5.

## The 21 skills

**Gateway** — printed in full into context by the SessionStart hook:

| Skill | Description |
|---|---|
| `using-acdev` | How and when to use every acdev skill; loaded at session start. |

**Pipeline** (also available as slash commands; `new-project` and `onboard` are user-invoked entry points — the model recommends the command instead of activating them):

| Skill | Description |
|---|---|
| `new-project` | Use when starting a new software project from scratch: intake interview, then VISION.md and MVP.md conversed section by section with hard approval gates. Zero product code. |
| `mockups` | Use after MVP approval to build static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved. |
| `blueprint` | Use after mockup approval to produce the normative docs, ADRs (stack decided here), technical spikes for unproven dependencies, the AI context system and repo mechanics. |
| `onboard` | Use when adopting an existing repo into acdev: build a truthful situation map of what exists and what is missing, with declared gaps, then propose adopting the pipeline. |
| `build` | Use when constructing an approved project: vertical slices end to end, just-in-time spec and plan per slice, TDD loop, decision classification, narrow subagents per layer. |
| `ship` | Use when closing a slice or phase: run full verification in green, check docs drift, write a checkpoint, commit or PR, and update the ROADMAP. |
| `status` | Use when resuming work or asking where the project stands: read state, latest checkpoint, current ROADMAP phase and open plans for about 2k tokens; can also write a manual checkpoint. |

**Process** (auto-activated on matching work):

| Skill | Description |
|---|---|
| `designing` | Use before any creative or feature work outside the pipeline stages: converse the design until an approved design doc exists. Inside the pipeline, defer to the VISION and MVP stages. |
| `planning` | Use when a task needs a multi-step plan with verifiable completion criteria, including per-slice plans during build and specs for user-requested changes. |
| `tdd` | Use when implementing any feature or bugfix: write the failing test first, watch it fail, make it pass minimally, refactor. No implementation before a red test. |
| `debugging` | Use on any bug, failing test or unexpected behavior before proposing fixes: reproduce it, form hypotheses, find the root cause, fix with a test. |
| `verifying` | Use before claiming anything is done, fixed or passing: run the verification and show the evidence. No green claim without command output. |

**Layers** (auto-activated when touching that layer):

| Skill | Description |
|---|---|
| `layer-frontend` | Use when building or changing UI: structure, state, routing, accessibility, performance, and design tokens from the approved mockups. |
| `layer-api` | Use when designing or changing APIs and backend logic: contracts, validation, errors, pagination, idempotency, N+1, transactions, background jobs. |
| `layer-data` | Use when touching the database or storage: modeling, reversible migrations, indexes, PII, backups, object storage. |
| `layer-auth` | Use when touching authentication or authorization: sessions or JWT, RBAC, multi-tenancy, permission matrix, auth flows. |
| `layer-security` | Use when touching security-sensitive code: row-level security verified with tests, rate limiting on a shared store, input validation, secrets, headers, OWASP. |
| `layer-performance` | Use when working on caching or performance: cache-aside and invalidation, TTLs, CDN, compression, performance budgets. |
| `layer-delivery` | Use when working on hosting, deployment or environments: deploy with rollback, health checks, config and secrets per environment, minimal observability. |
| `layer-cicd` | Use when setting up or changing CI/CD or repo workflow: lint, typecheck, test and build pipeline, branch protection, conventional commits, releases. |

## Token cost ledger

Every session pays a fixed cost, regardless of which skills get used: the 19 model-invocable `description:` frontmatter lines (needed for auto-activation; `new-project` and `onboard` are user-run entry points whose descriptions never load) plus the `using-acdev` gateway body, which the SessionStart hook prints into context (frontmatter stripped) together with a one-line `acdev plugin root:` path.

Measured directly from the repository, not estimated:

- Sum of the 19 model-invocable `description:` values: **2,768 characters**.
- `using-acdev` gateway body as injected by the hook (frontmatter stripped): **1,448 characters**, plus the one-line plugin-root path (varies with the install location).
- Total fixed cost: **4,216 characters**.
- Approximated at 4 characters/token (the same ratio `lint-budgets.mjs` uses): **~1,054 tokens/session**.

Inside a project with `.acdev/state.md`, the `UserPromptSubmit` hook additionally injects one routing line per prompt (current stage, skill precedence, disambiguation rule — about 60 tokens); outside acdev projects it injects nothing.

That is the honest, measured number — well under the plan's original ~2.3k-token estimate, because in practice the descriptions run far shorter than the 400-character (~100-token) budget. `lint-budgets.mjs` recomputes every number in this ledger from the tree and fails CI when the ledger goes stale.

What is **not** loaded at session start, and only enters context on demand:

- Skill bodies (the instructions under each `SKILL.md`'s frontmatter) — loaded only when that skill activates.
- `references/` material inside any skill — loaded only when the skill body points to it.
- `scripts/checkpoint.mjs` and `scripts/lint-budgets.mjs` — run as external processes, their source is never read into context.

Budgets enforced by `scripts/lint-budgets.mjs` (and checked in CI):

| Budget | Limit |
|---|---|
| Skill `description` | <= 400 characters (~100 tokens) |
| Skill body | < 500 lines and < 20,000 characters (~5k tokens) |
| Gateway file (`using-acdev/SKILL.md`, whole file) | <= 1,600 characters (~400 tokens) |

Beyond budgets, the lint also rejects emojis in every markdown file under `skills/` and `shared/`, verifies that `plugin.json`, `marketplace.json` and `package.json` parse and agree on version and description, and checks the skill tables and token ledger in this README against the actual frontmatter — doc drift about the plugin fails its CI the same way doc drift about a project fails a slice.

## Migration from superpowers / proyecto-kike

If you currently use the `superpowers` plugin and/or the personal `proyecto-kike` skill, uninstall/remove both when you adopt acdev:

1. Uninstall the `superpowers` plugin.
2. Delete the personal `proyecto-kike` skill from your skills directory.

Keeping either alongside acdev means two SessionStart hooks and duplicate skills competing for activation on the same task — for example two TDD skills or two brainstorming skills firing for the same prompt, with no clear winner.

Projects built with the kike-era pipeline are compatible: their `VISION.md`, `ROADMAP.md` and ADRs are read as-is. Run `/acdev:onboard` on such a repo to adopt it — it builds a truthful situation map of what exists and what is missing, and generates `MVP.md` retroactively only if the project still has unbuilt scope worth gating.

## Evals

The structural lint proves budgets and drift; it cannot prove the semantic
surface — that a session routes a user prompt to the right skill, and that
a skill body produces the required decision at its hard gates. Two
on-demand eval suites cover that:

- `evals/routing.cases.json` — realistic user prompts (English and
  Spanish, because real users mix both) with the skill expected to
  activate first, judged over the session-start activation surface
  (gateway body + model-invocable descriptions; the per-prompt stage line
  `prompt-context.mjs` injects inside a project is not simulated).
  Includes `RECOMMEND` cases for the user-run entry points, `OFFER` cases
  where the gateway's in-doubt rule is the expected answer (expected
  strictly — `OFFER` is never used as an accept escape), and `NONE` cases
  where acdev must stay out of the way. `accept` lists are capped at two
  genuinely defensible alternatives, and passes via `accept` are reported
  as such.
- `evals/gates.cases.json` — multiple-choice scenarios probing the hard
  rules one at a time (full-document VISION approval, red-check-blocks-close,
  continuous-build stop on user-challenge, drift fixed in the same commit,
  the phase-exit security pass, ...), judged against the governing skill
  body itself.

Each case is one `claude -p` call (default model: haiku), so the suites
cost real money and run on demand — never in CI. A single-sample judge is
noisy, so a failing answer is retried once (`--retries`) before the case
counts as failed; a pass on retry is printed as a flake signal, and a case
that fails twice in a row is a real finding:

```
npm run evals                     # both suites
npm run evals -- --suite routing --filter layer
npm run evals -- --dry-run        # print the constructed prompts, no calls
```

Run them before a release and after changing any skill description, the
gateway, or the wording of a gate. A case that fails twice in a row (the
run plus its retry) is a real finding: the description, the gate text, or
the case itself needs fixing — and a persistent failure is fixed by
sharpening the surface or the case, never by widening `accept`. The gates
suite is an open-book check — it proves the governing text forces the
required decision, not that a session under pressure will obey it.
`npm run evals -- --ablate` measures how many gate cases a judge answers
with no context at all; those cases are non-discriminative and need
sharper distractors. Every real run appends one line to
`evals/history.jsonl` (gitignored): a case that shows up in the retry
list across runs is a finding, not noise. The runner's own pipeline is
tested without model calls (`tests/run-evals.test.mjs` injects a fake
judge via `ACDEV_EVAL_CMD`).

## Development

Run the test suite and the structural lint before sending changes:

```
node --test
node scripts/lint-budgets.mjs
```

Contribution rules:

- Budgets are hard limits, not guidelines — a skill that exceeds a budget fails the lint and fails CI.
- No emojis, anywhere: skill files, scripts, hooks, docs.
- English only, across skills, docs and commit messages.
