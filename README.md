# acdev

[![ci](https://github.com/acnetcenter/acdev/actions/workflows/ci.yml/badge.svg)](https://github.com/acnetcenter/acdev/actions/workflows/ci.yml)

acdev is a Claude Code plugin for building a real product with a model that already knows how to engineer. It does not teach the model to plan, test or debug. It keeps the three things a model cannot do from inside a conversation: your decisions, behind explicit gates; the project's state, on disk, so a context can be dropped without losing anything; and a few hard rules, enforced by a hook instead of by memory.

## Why acdev

- **Your decisions, gated.** What the product is (`docs/PRODUCT.md`), what ships first (`docs/MVP.md`), how it looks (the mockups) and the choices that are expensive to change (the ADRs) are conversed with you and approved explicitly. The model decides everything else and lists it.
- **State on disk, small contexts.** The stage, the next step, the plan and the commit hold everything the next slice needs. In 74 measured sessions of real projects, over 60 percent of the tokens were spent on turns carrying more than 400k of context, and the plugin's own text was under 6 percent. So every slice close is a place to drop the context, and a fresh session resumes from two lines.
- **Hard rules in a hook.** No product code before the build stage; an approved document asks before it is edited again; in build, a commit needs a green verification of the current code. The guard ships with the plugin: nothing is installed in your repo.
- **Process sized to the change.** A typo gets fixed. A bug gets a reproducing test. A feature or a multi-file change gets a short plan. Specs pay for themselves on features and cost more than they return on small fixes.
- **One document other tools already read.** `docs/PRODUCT.md` follows the schema design tools such as Impeccable read, plus two sections this pipeline derives from (`Model`, `Critical Flows`).
- **Native where native is better.** Plan mode, subagents, `/code-review`, `/security-review`, auto memory and `/rewind` are used where they belong and never re-taught.

## Install

```
/plugin marketplace add acnetcenter/acdev
/plugin install acdev@acnetcenter
```

Or from a local clone:

```
/plugin marketplace add <absolute-path-to-this-repo>
/plugin install acdev@acnetcenter
```

Requirements: Claude Code with plugins enabled, Node.js 20 or newer on `PATH` (the hooks and the CLI run on it), and git inside each project. Without Node the skills still load from their descriptions, but there is no session line, no CLI, and the guard fails open.

## Quickstart

- New project, starting from zero: `/acdev:new-project`
- Existing repo: `/acdev:onboard`
- Resuming work: start a session. Inside an acdev project the first two lines say the stage and the next step; `/acdev:status` prints the full snapshot.
- A project started on acdev 0.4 or earlier: `acdev migrate` (see Upgrading).

The full manual is [docs/help.md](docs/help.md); its Spanish mirror is [docs/help.es.md](docs/help.es.md).

| Stage | Artifact | Gate |
|---|---|---|
| product | `docs/PRODUCT.md`, conversed with you | Explicit approval of the full document |
| mvp | `docs/MVP.md`: what is in, what is out and where it goes, verifiable success criteria | Explicit approval |
| mockups | Every MVP screen with its states, `mockups/SPEC.md`, the inventory of later screens | Approval freezes the visual contract |
| blueprint | ADRs (the stack is decided here), `docs/ROADMAP.md`, `CLAUDE.md`, the verification commands, a runbook if it deploys | Explicit acceptance of the package |
| build | The MVP by vertical slices (slice 1 deploys and rolls back); changes, incidents and later phases after that | Your order to start; every slice closes verified |

A product with no UI skips the mockups stage. `new-project` and `onboard` are run by you, never by the model.

## What acdev leaves in your repo

```
docs/PRODUCT.md            the source of truth
docs/MVP.md                the first delivery
docs/ROADMAP.md            phases with verifiable exit criteria
docs/adr/NNNN-*.md         one per lasting decision
docs/plans/*.md            one per slice or change; status active or shipped
docs/RUNBOOK.md            only if it deploys: rollback, numeric bands, canary
mockups/                   static HTML, styles.css, SPEC.md
CLAUDE.md                  under 60 lines: golden rules, commands, how work closes
.acdev/state.md            stage, language, pointer to the latest checkpoint
.acdev/checkpoints/        one small file per close
.acdev/guard.json          verification commands and guard options
```

Other documents (security, data model, architecture) are written only when the project meets their condition; see the catalog in the `blueprint` skill.

## The 6 skills

| Skill | When it applies |
|---|---|
| `blueprint` | Use after mockup approval to record the lasting decisions as ADRs (stack decided here), write the ROADMAP, run technical spikes for unproven dependencies, and set up CLAUDE.md, the verification commands and the repo mechanics. |
| `build` | Use when constructing an approved project or changing one already in build: vertical slices end to end, a plan sized to the change, a failing test first, a verified close, incidents and phase exits. |
| `mockups` | Use after MVP approval to build static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved. |
| `new-project` | Use when starting a new software project from scratch: a short intake, then docs/PRODUCT.md and docs/MVP.md conversed with the user and closed by explicit approval gates. Zero product code. |
| `onboard` | Use when adopting an existing repo into acdev: build a truthful situation map of what exists and what is missing, with declared gaps, then propose adopting the pipeline. |
| `status` | Use when resuming work or asking where the project stands: one acdev status call prints the stage, the latest checkpoint, the current ROADMAP phase, open plans and what continues, for about 1k tokens; can also write a manual checkpoint. |

## The guard

A PreToolUse hook that ships with the plugin and is inert outside a project with `.acdev/state.md`.

| Rule | Decision | Scope |
|---|---|---|
| Zero product code before build | deny | Any write outside docs, mockups, spikes and repo mechanics while the stage is before `build`; the allowed set grows with the stage (mockups at `mockups`; tests, configs and CI at `blueprint`) |
| Approved documents | ask | `docs/PRODUCT.md` and `docs/MVP.md` after their gates, an approved mockup page after its gate, an existing ADR in build. New pages and new ADRs are free |
| Verified commit | deny | In build, a `git commit` that changes code needs a green `acdev verify` (or `acdev close`) of that code. A docs-only commit needs none, and staging, committing or amending the same code keeps the receipt valid |
| The pipeline state | deny | `.acdev/state.md` by hand; it is written by `acdev checkpoint write`, which announces every stage change |
| The guard config | ask | `.acdev/guard.json`, from build on |

Claude Code does not stop for a hook's `ask` in bypass mode: measured on the real CLI, the edit simply went through. So where no prompt can reach you (`bypassPermissions`, `dontAsk`) an `ask` becomes a `deny` that tells the model to put the question in chat; on your explicit yes it runs `acdev allow <path>`, which opens that path for 15 minutes. The allowance never opens product code or the pipeline state.

Shell commands go through the same path policy as Edit and Write: redirections, `tee`, `cp`, `mv`, `touch`, `sed -i`, a project scaffolder (`npx create-*`, `npm create`), and `Set-Content`, `Out-File`, `New-Item`, `Copy-Item` in PowerShell. Heredoc bodies and quoted text are read as data, a leading `cd` is followed, and the project is found from a subfolder or from a monorepo root. The parser reads a command the way a person skims it: it finds the usual ways of writing a file, not every way. The rule the model follows closes the gap: a guard denial is a gate, never an obstacle to route around.

`.acdev/guard.json` holds `verify` (the commands a close must pass, in order) and, for a repo with its own conventions, `allow_before_build`, `protected` and `receipt_ignore` globs. `"enabled": false` there, or `ACDEV_GUARD=off` in the environment, switches every rule off. The hook fails open on any internal error.

## The command line

The plugin puts `acdev` on the PATH of Claude's Bash tool. The PowerShell tool does not get it, so there the command is `node "<plugin folder>/scripts/acdev.mjs" <command>`; the session-start line and the skills that run before a project exists print that full path.

| Command | What it does |
|---|---|
| `acdev status` | The resume snapshot in one call: state, checkpoint, open plans, current phase, guard, what continues |
| `acdev init` | `.acdev/guard.json` and the `.gitignore` line for the verification receipt |
| `acdev checkpoint write` / `read` | Writes or reads the pipeline state and its checkpoint |
| `acdev q -- <command>` | Quiet runner: the verdict lines of a test, lint or build run, never the log |
| `acdev verify` | Runs the project's verification commands and records the receipt a commit needs |
| `acdev close --check` | What the close needs: drift candidates, changelog and plan state, nothing committed |
| `acdev close --slice ... --next ... --changelog ...` | Verifies first and refuses on red; then the CHANGELOG line, the plan status, the checkpoint and one commit |
| `acdev allow <path...>` | After your explicit yes: lets an approved document be edited for 15 minutes |
| `acdev drift` | The documents that mention the files changed since HEAD |
| `acdev scaffold <template> <target>` | Copies a template verbatim: `product`, `mvp`, `adr`, `runbook`, `incident`, `claude-md`, `mockups-inventory`, `canary` |
| `acdev scaffold mockup-variant <page> <state>` | A state variant of a mockup with only its `<main>` left to write |
| `acdev mockup-spec --write` | The per-screen spec the build reads instead of the HTML |
| `acdev migrate [--apply]` | Moves a project from acdev 0.4 or earlier to the current layout; a dry run by default |

## Cost model

A session's cost is its turns times the context each turn re-reads, plus output. acdev's fixed cost is the six skill descriptions and, inside a project, two lines at session start. What it does about the rest:

- `acdev q` and `acdev verify` put verdict lines in the context instead of logs. A log pasted once is re-read on every later turn.
- `acdev status` replaces reading the roadmap, the plans and the checkpoints.
- `acdev close` ends by saying the slice is on disk and the next one starts cheaper in a fresh session. After `/clear`, the session-start line carries the stage and the next step.
- Documents have a reader and a cap, and the catalog refuses the ones that only restate the code.
- The one whole-phase review (security pass plus the production checklist) happens once, at the phase exit, instead of on every slice.

A model switch in the middle of a session re-reads the whole conversation uncached, so a cheaper model for construction belongs at the start of a fresh session.

## Upgrading from 0.4

0.5.0 is a breaking release. In each project, ask Claude to run these two commands (`acdev` is on the PATH of Claude's Bash tool, not of your own terminal; from a terminal the same commands are `node <plugin folder>/scripts/acdev.mjs migrate`):

```
acdev migrate
acdev migrate --apply
```

The first prints what would change; the second makes the changes in the working tree and commits nothing. It renames `docs/VISION.md` to `docs/PRODUCT.md` with `git mv` (the content is moved as it is), updates references to the old name in `CLAUDE.md`, `AGENTS.md` and `docs/` (plans are history and stay as written), renames the stage, and removes the guard copy and its entries from `.claude/settings.json`. A project that has not been migrated keeps working: every reader falls back to the old file name, and its old guard copy keeps running next to the plugin's until the migration removes it.

`migrate` also reports what it leaves for you to decide: the migrated document keeps its old sections (restructuring an approved document is your call), a `CLAUDE.md` that still names removed commands, and the `Bash(node *)` and `Bash(git *)` allow rules that 0.4 wrote into `.claude/settings.json` for its headless loop. The verification receipt changed format, so the first commit after the upgrade needs one `acdev verify`.

What was removed, and what covers it now:

| Removed | Covered by |
|---|---|
| The process skills (tdd, debugging, verifying, planning, designing) | The model's own practice, plan mode, `/code-review`; the rules that matter are six lines in the project's `CLAUDE.md` |
| The eight layer skills | One production checklist, read at the phase exit |
| The gateway skill and the per-prompt hook | The skill descriptions and a two-line session start |
| The step dispenser, the context pack and the layer checklists as commands | `acdev status` and six short skill bodies |
| The builder subagents | Native subagents, used for large independent work |
| The headless loop and its cost ledger | Claude Code's background sessions and workflows |
| The lessons ledger | Native auto memory, and a rule added to `CLAUDE.md` when a mistake would repeat |
| The guard copied into each project | The plugin-level hook |
| The custom eval runner | `claude plugin eval` |

## Evals

[evals/](evals/) holds five cases for the native runner, each with a fixture that builds a small acdev project:

```
claude plugin eval . --scaffold --allow-tools Write Edit Bash --runs 1 --max-cost-usd 5
```

Every case also runs without the plugin, so the report shows what acdev changes. The cases grant Bash, which Claude Code only runs inside its sandbox: native Windows has no sandbox backend, so run them on macOS, on Linux (with `bubblewrap` and `socat`) or under WSL2. See [evals/README.md](evals/README.md).

The unit suite runs each fixture without a model, on every platform, and checks the deterministic half (the guard decision, the red close, the status output), so a fixture cannot drift from the code silently.

## Development

```
node --test
node scripts/lint-budgets.mjs
```

- Budgets are hard limits: a skill body over 6,000 characters or a description over 400 fails the lint and CI.
- The lint also fails on text that names something removed, on a pointer into `references/` that does not resolve, and on a skill table in this README that drifted from the tree.
- No emojis, anywhere.
- English only, except `docs/help.es.md`, the Spanish mirror of the manual: every change to `docs/help.md` lands in both files in the same commit, and the lint fails when their structure diverges.
- A release needs the version bumped in `.claude-plugin/plugin.json` and `package.json`: Claude Code pins the plugin cache by version.
