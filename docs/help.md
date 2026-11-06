# acdev manual

How to use acdev from the first idea to a product in production, and how
to move a project that started on an earlier version. The Spanish mirror
of this file is [help.es.md](help.es.md).

## Contents

1. [What acdev is and how it runs](#1-what-acdev-is-and-how-it-runs)
2. [Install, update, verify](#2-install-update-verify)
3. [The pipeline, stage by stage](#3-the-pipeline-stage-by-stage)
4. [Starting a new project](#4-starting-a-new-project)
5. [Adopting an existing repository](#5-adopting-an-existing-repository)
6. [Daily work inside a project](#6-daily-work-inside-a-project)
7. [The guard](#7-the-guard)
8. [Production: deploys and incidents](#8-production-deploys-and-incidents)
9. [Commands and files](#9-commands-and-files)
10. [Upgrading from 0.4](#10-upgrading-from-04)
11. [Working on acdev itself](#11-working-on-acdev-itself)
12. [FAQ](#12-faq)

## 1. What acdev is and how it runs

acdev assumes the model already knows how to plan, test, debug and
review. It keeps what a model cannot do from inside a conversation:

- **Your decisions.** What the product is, what ships first, how it
  looks, and the choices that are expensive to change are conversed with
  you and closed by an explicit approval. The model decides the rest and
  lists it for review.
- **State on disk.** The stage, the next step, the plan and the commit
  hold everything the next piece of work needs, so a context can be
  dropped at any close without losing anything.
- **Hard rules in a hook.** Three rules are enforced by code, not by the
  model's memory (section 7).

It runs as six skills, two hooks and a command-line tool, `acdev`. Two of
the skills (`new-project`, `onboard`) are commands you type; the model
never starts them on its own. The other four activate when the work
matches, and each is also a slash command. Outside a project that uses
acdev, the plugin adds nothing to a session but its six one-line skill
descriptions.

## 2. Install, update, verify

From the GitHub marketplace:

```
/plugin marketplace add acnetcenter/acdev
/plugin install acdev@acnetcenter
```

From a local clone (for development):

```
/plugin marketplace add C:\path\to\acdev
/plugin install acdev@acnetcenter
```

Update, from any terminal where `claude` is on the PATH:

```
claude plugin marketplace update acnetcenter
claude plugin update acdev@acnetcenter
```

Then start a new session; plugins load at session start. To verify the
load, open a project that uses acdev: the session begins with a line
`acdev project: stage ...` and a second line naming the CLI. In any
project, `/acdev:status` answers.

Requirements: Claude Code with plugins enabled, Node.js 20 or newer on
the PATH, git inside each project. Without Node the skills still load
from their descriptions, but there is no session line, no CLI, and the
guard fails open.

## 3. The pipeline, stage by stage

| Stage | What is produced | What closes it |
|---|---|---|
| product | `docs/PRODUCT.md`: users, purpose, model, critical flows, constraints | Your explicit approval of the full document |
| mvp | `docs/MVP.md`: what is in, what is out and to which later phase it moves, success criteria | Your explicit approval |
| mockups | A static HTML page per MVP screen with its states, `mockups/SPEC.md`, an inventory of later screens | Your approval, which freezes the visual contract |
| blueprint | One ADR per lasting decision (the stack is decided here), `docs/ROADMAP.md`, `CLAUDE.md`, the verification commands, a runbook if it deploys | Your acceptance of the package |
| build | The MVP by vertical slices, then changes, incidents and later phases | Your order to start; every slice closes verified |

A product with no UI skips mockups. No product code exists before the
build stage, and the guard denies it until then.

## 4. Starting a new project

Run `/acdev:new-project` in an empty repository. It opens with one
question: what you want to build, and for whom. Then four short intake
questions (name, repository, documentation language, other coding
agents).

The interview is sized to the project. A personal tool gets the short
path: a full draft of `docs/PRODUCT.md` from your idea, corrected in a
round or two. A product for sale, or anything multi-tenant, with payments
or with personal data, goes section by section. Either way every section
is pasted in the chat before you are asked about it, and the gate
presents the full document: you approve what you have read.

`docs/PRODUCT.md` follows the schema design tools already read (Platform,
Stack, Users, Product Purpose, Positioning, Operating Context,
Capabilities and Constraints, Brand Commitments, Evidence on Hand,
Product Principles, Accessibility & Inclusion) and adds two sections the
rest of the pipeline derives from: `Model` (how it is delivered and sold)
and `Critical Flows` (the three to five flows that must work end to end).
If a design tool already wrote the file, it is completed, never
overwritten.

`docs/MVP.md` is then cut from it: the IN list, the OUT list grouped by
the later phase each item moves to, and success criteria as verifiable
facts. If the cut reveals a gap in PRODUCT.md, the gap is fixed there
first.

## 5. Adopting an existing repository

Run `/acdev:onboard`. It reads before it writes: every fact goes into
`docs/SITUATION.md` with its source (`[user]`, `[docs]`, `[code]`,
`[git]`), and what cannot be found is a declared gap, never a guess. You
confirm the map; only then does it propose what to add: a product
document if there is none, an MVP only if unbuilt scope remains, ADRs for
decisions the code already embodies, the verification commands the repo
already runs, and the stage the project resumes at. Existing documents
and conventions are kept; nothing is rewritten without showing the diff.

## 6. Daily work inside a project

Start a session. Its first two lines say the stage and the next step;
`acdev status` prints the full snapshot in one call.

### A slice

1. **Cut**: vertical, observable by a user, about a day at most. Slice 1
   is the walking skeleton and includes the deploy and a rollback drill.
2. **Plan**: a file in `docs/plans/`, at most 40 lines, written just
   before building: goal, verify steps, and the table of decisions the
   model took.
3. **Construct**: one failing test for the behavior first, then the code.
   Tests run through `acdev q`, which shows the verdict lines only.
4. **Close**: two commands, below.

### A change, a bug, a small fix

The process scales with the work. A typo or a one-line tweak with no
change in behavior needs no plan. A bug needs its reproducing test. A
feature or a multi-file change gets a short spec in `docs/plans/`, in
your own terms. A change to what the product does is confirmed with you
first, and `docs/PRODUCT.md` or `docs/MVP.md` is amended in the same
commit.

### Closing

```
acdev close --check --plan docs/plans/<plan>.md
acdev close --slice "2: create invoice" --plan docs/plans/<plan>.md --next "slice 3: export" --changelog "Invoices can be created"
```

The first lists the documents that mention the changed files, so they
are corrected in the same commit. The second runs the project's
verification commands and refuses on red; on green it writes the
CHANGELOG line, marks the plan shipped, writes the checkpoint and makes
one commit.

### Keeping contexts small

Most of what a long session costs is the context it re-reads on every
turn. After a close, the slice is on disk: start the next one in a fresh
session (`/clear`). It resumes from the session-start line. Change the
model at that point too, not in the middle of a session, because a switch
re-reads the whole conversation uncached.

### Continuous build

On your explicit request the model builds the whole phase without pausing
between slices. Every slice still gets its plan, its tests and its close.
The run stops at a decision that is yours to make, at a trap that
invalidates the plan, and at the phase exit.

## 7. The guard

A hook that ships with the plugin. It does nothing outside a project
with `.acdev/state.md`, and nothing is installed in your repository.

| Rule | Decision | Scope |
|---|---|---|
| Zero product code before build | deny | Writes outside docs, mockups, spikes and repo mechanics while the stage is before `build` |
| Approved documents | ask | `docs/PRODUCT.md`, `docs/MVP.md` and approved mockup pages after their gates; an existing ADR in build. New pages and new ADRs are free |
| Verified commit | deny | In build, a `git commit` that changes code without a green verification of that code. A docs-only commit needs none |
| The pipeline state | deny | `.acdev/state.md` by hand; `acdev checkpoint write` writes it and announces every stage change |
| The guard config | ask | `.acdev/guard.json`, from build on |

Claude Code does not stop for a hook's `ask` in bypass mode, so where no
prompt can reach you the guard denies instead and tells the model to put
the question in chat. On your explicit yes it runs `acdev allow <path>`,
which opens that path for 15 minutes; it never opens product code or the
pipeline state.

The project's side is one file:

```json
{
  "enabled": true,
  "verify": ["npm run lint", "npm test"],
  "allow_before_build": [],
  "protected": [],
  "receipt_ignore": []
}
```

`verify` lists the commands a close must pass, cheapest first. The three
glob lists adapt the rules to a repo with its own conventions. To switch
the guard off, set `"enabled": false` or the environment variable
`ACDEV_GUARD=off`. If the hook fails internally, it allows the call.

## 8. Production: deploys and incidents

A project that deploys has `docs/RUNBOOK.md` (the exact rollback command,
numeric control bands) and a canary script. After a deploy, the canary
runs through `acdev q`; a release is done when the canary is green, not
when the deploy command succeeded.

On red, or on any incident that started with a release: roll back first,
diagnose afterwards. Then the incident becomes a spec
(`docs/plans/<date>-incident-<slug>.md`) before any fix is coded, and
while it is open `acdev status` puts it ahead of every planned slice. The
fix is a small slice with its reproducing test, and the spec names what
would have caught the problem.

At the end of each phase there is one review of the whole phase:
`/security-review` over the phase's diff, and the production checklist
over what the phase touched. A high-severity finding blocks the phase
until it is fixed or you accept it explicitly.

## 9. Commands and files

`acdev` works in Claude's Bash tool. In PowerShell the same commands are
`node "<plugin folder>/scripts/acdev.mjs" <command>`; the session-start
line prints that path.

| Command | What it does |
|---|---|
| `acdev status` | State, checkpoint, open plans, current phase, guard, what continues |
| `acdev init` | The guard config and the `.gitignore` line for the receipt |
| `acdev checkpoint write` / `read` | Writes or reads the pipeline state |
| `acdev q -- <command>` | Runs a command and prints its verdict lines, not its log |
| `acdev verify` | Runs the verification commands and records the receipt a commit needs |
| `acdev close --check` | What the close needs, without committing |
| `acdev close --slice ...` | Verify, changelog, plan, checkpoint, one commit |
| `acdev allow <path...>` | After your explicit yes: lets an approved document be edited for 15 minutes |
| `acdev drift` | Documents that mention the changed files |
| `acdev scaffold <template> <target>` | Copies a template: `product`, `mvp`, `adr`, `runbook`, `incident`, `claude-md`, `mockups-inventory`, `canary` |
| `acdev mockup-spec --write` | The per-screen spec the build reads |
| `acdev migrate [--apply]` | Moves a project from an earlier version; dry run by default |

```
docs/PRODUCT.md  docs/MVP.md  docs/ROADMAP.md  docs/adr/  docs/plans/
mockups/  CLAUDE.md
.acdev/state.md  .acdev/checkpoints/  .acdev/guard.json
```

## 10. Upgrading from 0.4

Version 0.5.0 removed most of the plugin's instructions and moved the
guard into the plugin. In each project, ask Claude to run these two
commands (`acdev` is on the PATH of Claude's Bash tool, not of PowerShell
or your own terminal):

```
acdev migrate
acdev migrate --apply
```

The first prints what would change. The second renames `docs/VISION.md`
to `docs/PRODUCT.md` with `git mv` (its content is moved as it is),
updates references to the old name in `CLAUDE.md`, `AGENTS.md` and
`docs/` except the plans, renames the stage, and removes the guard copy
and its entries from `.claude/settings.json`. Nothing is committed: check
`git diff`, then commit. A project that was not migrated keeps working,
because every reader falls back to the old file name; until then its old
guard copy keeps running next to the plugin's.

The command also lists what it leaves to you: the old sections of the
moved document, a `CLAUDE.md` that still names removed commands, and the
allow rules 0.4 added to `.claude/settings.json`. The first commit after
the upgrade needs one `acdev verify`, because the receipt changed format.

## 11. Working on acdev itself

```
node --test
node scripts/lint-budgets.mjs
```

The lint enforces the skill budgets, fails on text that names something
removed, checks that this manual and its Spanish mirror keep the same
structure, and compares the README's skill table with the tree. A release
needs the version bumped in `.claude-plugin/plugin.json` and
`package.json`. The eval cases under `evals/` run with `claude plugin
eval` on macOS, Linux or WSL2; native Windows has no sandbox for them, so
there only their fixtures run, inside `node --test`.

## 12. FAQ

**Why are there so few skills now?**

Because the current models already plan, test, debug and verify without
being told how, and instructions that spell it out make them over-check
and cost tokens on every load. What stayed is what the model cannot
supply: your decisions, the state, and the rules a hook enforces.

**Does acdev still require tests first?**

Yes, as one rule with its reason in the project's `CLAUDE.md`: a change in
behavior starts with a failing test for that behavior. It is one focused
test per behavior, not a suite per function.

**The guard denied something I wanted. What now?**

Either the stage is behind reality, and the pipeline moves it at its
gate with you, or the action does not belong to this stage. If the rule
itself is wrong for your repo, adjust `.acdev/guard.json`.

**Can I use it with another design plugin?**

Yes. `docs/PRODUCT.md` uses the schema such tools read, and the mockups
stage hands the aesthetic direction to the design plugin you have
installed, subordinated to the MVP and to the approval gate.

**How do I keep a session cheap?**

Close slices with `acdev close`, start the next one in a fresh session,
run tests through `acdev q`, and change the model only at the start of a
session.
