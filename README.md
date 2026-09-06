# acdev

[![ci](https://github.com/acnetcenter/acdev/actions/workflows/ci.yml/badge.svg)](https://github.com/acnetcenter/acdev/actions/workflows/ci.yml)

acdev is a Claude Code plugin that takes a software project from idea to production — or adopts an existing one — and keeps it running afterwards, through a gated, documentation-first, token-disciplined pipeline. It is built for one developer or a small team shipping a real product: the product is defined and approved before any code exists, every production layer is covered by a checklist parameterized by the project's own decisions, the hard rules are enforced by a hook inside the repo rather than by the model's memory, and the whole plugin costs about 1.1k tokens per session.

## Why acdev

- **Product before code, with hard gates.** VISION, MVP and mockups are conversed with the user, who watches each document grow and approves it in full before the pipeline moves on. Zero product code exists before the user orders construction, and a hook in the repo denies it until then.
- **Decisions made once.** The stack, hosting, data store, auth and tenancy are recorded as ADRs at blueprint; the eight layer skills read them and never re-derive them. Every other decision is classified as mechanical, taste or user-challenge, so the user is interrupted only for what changes the product, the money, the security posture or the data model.
- **Production knowledge per layer, not per technology.** Frontend, API, data, auth, security, performance, delivery and CI/CD each carry a stack-agnostic checklist in goal + verify form, with the project's own `scripts/verify/` probes as evidence. Narrow subagents receive only the layer they are building.
- **Governance as code.** A PreToolUse guard installed in each project enforces the stage ladder, the frozen documents, the frozen test under a fix, secrets, destructive commands, and a `git commit` that needs a green verification receipt. Repeated mistakes are promoted into the project's `CLAUDE.md` by script, and every incident becomes a spec before a fix.
- **Git is the memory.** Pipeline state, checkpoints, the lessons ledger and the guard config travel with the repo. Resuming a project costs about 2k tokens, never a re-scan.
- **Token discipline that is measured, not hoped for.** Every fixed cost is recomputed from the tree by a lint that fails CI when this README goes stale; skill descriptions, bodies and the gateway have hard budgets, and overlapping trigger vocabularies between skills fail the lint before they collide in a session.
- **The plugin verifies itself.** A unit suite covers the scripts and the guard, the lint covers structure and drift, and two on-demand eval suites check that prompts route to the right skill and that every hard rule forces the required decision.
- **Only the delta over native Claude Code.** Plan mode, subagents, worktrees, `/code-review`, `/security-review` and `/rewind` are referenced where they belong and never re-taught.

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
- Node.js >= 20 on `PATH`, used by the SessionStart and UserPromptSubmit hooks, by `scripts/checkpoint.mjs`, `scripts/lessons.mjs` and `scripts/lint-budgets.mjs`, and by the guard hook acdev installs inside each project.

Without Node the skills still activate from their descriptions alone (degraded auto-activation, no gateway map at session start, no per-prompt routing line), but the pipeline's machinery does not run: no checkpoints or state, no lessons ledger, and the project guard fails open. Git is required inside a project for the verification receipt.

## Quickstart

- New project, starting from zero: `/acdev:new-project`
- Existing repo, adopting acdev on top of it: `/acdev:onboard`
- Resuming work on any acdev project: `/acdev:status`
- After a deploy lands, or when production misbehaves: `/acdev:operate`

The full manual, with a worked example and a FAQ, is [docs/help.md](docs/help.md).

Every pipeline skill is also a slash command (`/acdev:mockups`, `/acdev:blueprint`, `/acdev:build`, `/acdev:ship`), and each one activates on its own when the work matches; only `new-project` and `onboard` are run by the user, never by the model.

Pipeline map (five stages to production, each gated before the next starts, plus the operate loop that runs after every deploy):

| Stage | Artifact | Gate |
|---|---|---|
| 1. VISION | `docs/VISION.md`, conversed section by section | HARD: explicit user approval of the full document |
| 2. MVP | `docs/MVP.md` — what is in, what is out, verifiable success criteria | HARD: explicit user approval |
| 3. Mockups | Every MVP screen (including empty/error/loading states) + post-MVP skeleton inventory | Approved mockups freeze the visual contract |
| 4. Blueprint | Normative docs, ADRs, spikes for unproven dependencies, AI context system, `docs/RUNBOOK.md`, repo mechanics, the guard configured | User reviews the full documentation package |
| 5. Build | The MVP by vertical slices (slice 1 deploys and rolls back); post-MVP phases get mockups + spec just-in-time | Explicit order to start building; per-slice/per-phase gates; `git commit` needs a green verification receipt |
| 6. Operate | Canary after each deploy against the runbook bands; incidents as specs in `docs/plans/` closing as mini-slices; repeated mistakes promoted into `CLAUDE.md` | Rollback before diagnosis on red; no fix without an incident spec |

Zero product code is written before stage 5. Inside a project, that rule, the frozen documents, the frozen test under a fix and the red-check-blocks-close rule are enforced by a hook, not by memory (see Governance as code below).

## What acdev leaves in your repo

Everything the pipeline produces is committed with the project, so state and history travel with the code and any session on any machine resumes from the same facts:

```
project/
├── docs/
│   ├── VISION.md              # stage 1, approved by the user
│   ├── MVP.md                 # stage 2, approved by the user
│   ├── ROADMAP.md             # phases with verifiable exit criteria
│   ├── ARCHITECTURE.md ...    # normative docs chosen from the catalog
│   ├── RUNBOOK.md             # deploy, exact rollback, control bands (deploying projects)
│   ├── adr/                   # one record per closed decision
│   ├── plans/                 # dated specs: slices, user-requested changes, incidents
│   └── README.md              # the docs index, kept current by ship
├── mockups/                   # stage 3: the frozen visual contract
├── spikes/                    # disposable experiments, never merged into product code
├── scripts/verify/            # one runnable probe per layer, plus canary.mjs
├── .acdev/
│   ├── state.md               # pipeline stage; the guard reads it
│   ├── checkpoints/           # resume points written at every close
│   ├── lessons.md             # the lessons ledger
│   └── guard.json             # what the guard enforces in this repo
├── .claude/hooks/acdev-guard.mjs   # the guard, wired in .claude/settings.json
├── CLAUDE.md                  # one-page router: golden rules, stack, lessons
├── AGENTS.md                  # identical mirror, for multi-AI projects
└── CHANGELOG.md               # one line per shipped change, linking its plan
```

All generated documents are written in the documentation language chosen at intake, which need not be English.

## The 22 skills

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
| `operate` | Use after a deploy lands or on any production incident: run the release canary against the RUNBOOK bands, roll back on red before diagnosing, turn the incident into a spec that closes as a mini-slice, and rescan security after a release. |
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

## Governance as code

A hard rule that lives only in prose is a suggestion. acdev keeps its rules short in the skills and enforces them with three deterministic pieces installed inside each project and versioned with it. The guard's hook is wired for Claude Code; its command line (`verify`, `status`, `freeze`, `unfreeze`) and the lessons script work from any shell, for any agent.

**The guard** (`.claude/hooks/acdev-guard.mjs`, from `shared/references/templates/guard-hook.mjs`, wired as a `PreToolUse` hook in the project's `.claude/settings.json`; `new-project` installs it at intake, `onboard` proposes it, `blueprint` completes its configuration in `.acdev/guard.json`):

| Rule | Decision | Enforced how |
|---|---|---|
| Zero product code before build | deny | Writes outside docs, mockups, spikes and repo mechanics are denied while `.acdev/state.md` is at a stage before `build`; the allowed set grows with the stage, and the pipeline advances the stage only at its gates |
| Approved documents stay approved | ask | `docs/VISION.md`, `docs/MVP.md`, `mockups/` and `docs/adr/` ask before an edit once their gate has closed (the drift rule made explicit) |
| The failing test is the spec of the fix | deny | `debugging` freezes the test (`freeze <glob> --reason`); edits to frozen paths are denied until `ship` clears the freeze |
| A red check blocks the close | deny | In build, `git commit` is denied without a receipt from `node .claude/hooks/acdev-guard.mjs verify`: the configured checks ran green on the current code tree; docs and `.acdev/` bookkeeping never stale it, code edits do |
| Secrets and destructive commands | ask | `.env*` (examples exempt), `*.pem`, `*.key`; force push, `reset --hard`, `clean -f`, discard-all checkouts, force branch delete, stash drop, `rm -f`, `DROP`/`TRUNCATE` |
| The guard itself | ask | The hook, its config and `.claude/settings.json` |

Bash write targets (redirections, `tee`, `cp`, `mv`, `touch`, `sed -i`) go through the same path policy as Edit and Write. The hook fails open on any internal error and can be switched off with `"enabled": false` or `ACDEV_GUARD=off`; the model-side rule in the gateway closes what a parser cannot: a guard denial is a gate, never an obstacle to route around. `tests/guard-hook.test.mjs` exercises every rule.

Day to day, the skills run four commands against it:

```
node .claude/hooks/acdev-guard.mjs verify                       # run the configured checks, record the receipt (ship)
node .claude/hooks/acdev-guard.mjs status                       # stage, freeze, verify commands, receipt state
node .claude/hooks/acdev-guard.mjs freeze tests/login.test.ts --reason "bug 42"   # debugging, before touching the code under a failing test
node .claude/hooks/acdev-guard.mjs unfreeze                     # ship, at the close
```

Per-repo policy lives in `.acdev/guard.json`: the `verify` commands, extra paths allowed before build (a generated directory, a vendored tree), extra protected documents, and paths the receipt ignores.

**The lessons ratchet** (`scripts/lessons.mjs`, ledger in `.acdev/lessons.md`): a mistake the agent makes once is a candidate; the second occurrence promotes it, by script, into the `## Lessons` section of the project's `CLAUDE.md` (mirrored to `AGENTS.md` when the project keeps one). `ship` runs it at every close, `debugging` and `operate` feed it, and a promoted lesson that can be checked mechanically becomes a test or a `scripts/verify/` probe in the same commit. Nobody hand-edits the section; past twelve promoted lessons the script asks for consolidation so the router stays under one page.

**The operate loop** (`operate` skill, `docs/RUNBOOK.md`, `scripts/verify/canary.mjs`): after every deploy the canary checks health, smoke paths and p95 against the runbook's numeric bands; a red canary rolls back before anyone diagnoses, unless the runbook's own unsafe-when clause applies and the user chooses the roll-forward path; every incident becomes a spec in `docs/plans/` before any fix is coded, then closes as a mini-slice through `ship` with a lesson and a mechanical check; each production release gets a security rescan; phase 1 of any deploying project does not exit until the rollback was rehearsed once.

## Token cost ledger

Every session pays a fixed cost, regardless of which skills get used: the 20 model-invocable `description:` frontmatter lines (needed for auto-activation; `new-project` and `onboard` are user-run entry points whose descriptions never load) plus the `using-acdev` gateway body, which the SessionStart hook prints into context (frontmatter stripped) together with a one-line `acdev plugin root:` path.

Measured directly from the repository, not estimated:

- Sum of the 20 model-invocable `description:` values: **3,005 characters**.
- `using-acdev` gateway body as injected by the hook (frontmatter stripped): **1,487 characters**, plus the one-line plugin-root path (varies with the install location).
- Total fixed cost: **4,492 characters**.
- Approximated at 4 characters/token (the same ratio `lint-budgets.mjs` uses): **~1,123 tokens/session**.

Inside a project with `.acdev/state.md`, the `UserPromptSubmit` hook additionally injects one routing line per prompt (current stage, skill precedence, disambiguation rule — about 60 tokens); outside acdev projects it injects nothing.

That is the honest, measured number — well under the plan's original ~2.3k-token estimate, because in practice the descriptions run far shorter than the 400-character (~100-token) budget. `lint-budgets.mjs` recomputes every number in this ledger from the tree and fails CI when the ledger goes stale.

What is **not** loaded at session start, and only enters context on demand:

- Skill bodies (the instructions under each `SKILL.md`'s frontmatter) — loaded only when that skill activates.
- `references/` material inside any skill — loaded only when the skill body points to it.
- `scripts/checkpoint.mjs`, `scripts/lessons.mjs`, `scripts/lint-budgets.mjs` and the project guard — run as external processes, their source is never read into context.

Budgets enforced by `scripts/lint-budgets.mjs` (and checked in CI):

| Budget | Limit |
|---|---|
| Skill `description` | <= 400 characters (~100 tokens) |
| Skill body | < 500 lines and < 20,000 characters (~5k tokens) |
| Gateway file (`using-acdev/SKILL.md`, whole file) | <= 1,600 characters (~400 tokens) |

Beyond budgets, the lint also rejects emojis in every markdown file under `skills/` and `shared/`, fails when two model-invocable descriptions share enough trigger vocabulary to collide at activation time, fails when the block the eight layer skills repeat by design diverges between them, verifies that `plugin.json`, `marketplace.json` and `package.json` parse and agree on version and description, and checks the skill tables and token ledger in this README against the actual frontmatter — doc drift about the plugin fails its CI the same way doc drift about a project fails a slice.

## Migration from superpowers / proyecto-kike

acdev was born to replace two overlapping setups its author ran side by side: the general-purpose `superpowers` plugin and the personal `proyecto-kike` skill, which together meant two startup hooks and duplicate skills (two TDDs, two brainstormings) competing for activation on every session. If you currently use the `superpowers` plugin and/or the personal `proyecto-kike` skill, uninstall/remove both when you adopt acdev:

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
  the phase-exit security pass, a guard denial never routed around,
  rollback before root cause, incident spec before fix, ...), judged
  against the governing skill body itself.

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
gateway, or the wording of a gate. A real finding is fixed by sharpening
the description, the gate text or the case itself, never by widening
`accept`. The gates
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
