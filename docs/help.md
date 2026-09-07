# acdev help

How the plugin works, how to use it well, and the questions that come up
in practice. The README is the overview; this is the manual. Everything
here describes acdev 0.4.1.

Contents:

1. [What acdev is and how it runs](#1-what-acdev-is-and-how-it-runs)
2. [Install, update, verify](#2-install-update-verify)
3. [The pipeline, stage by stage](#3-the-pipeline-stage-by-stage)
4. [A worked example: an invoicing SaaS from zero](#4-a-worked-example-an-invoicing-saas-from-zero)
5. [Adopting an existing repository](#5-adopting-an-existing-repository)
6. [Daily work inside a project](#6-daily-work-inside-a-project)
7. [The guard](#7-the-guard)
8. [The lessons ratchet](#8-the-lessons-ratchet)
9. [Operating in production](#9-operating-in-production)
10. [Scripts and files reference](#10-scripts-and-files-reference)
11. [Cost, budgets and what loads when](#11-cost-budgets-and-what-loads-when)
12. [Working on acdev itself](#12-working-on-acdev-itself)
13. [FAQ](#13-faq)

---

## 1. What acdev is and how it runs

acdev is a Claude Code plugin that takes a software project from an idea
to production and keeps it running afterwards. It does this with three
kinds of pieces:

- **Skills.** Twenty-two markdown instruction sets. Seven run the
  pipeline (`new-project`, `mockups`, `blueprint`, `onboard`, `build`,
  `ship`, `operate`), one reports state (`status`), five govern process
  (`designing`, `planning`, `tdd`, `debugging`, `verifying`), eight carry
  production knowledge per layer (`layer-frontend`, `layer-api`,
  `layer-data`, `layer-auth`, `layer-security`, `layer-performance`,
  `layer-delivery`, `layer-cicd`), and one gateway (`using-acdev`) tells
  the model how to use the rest. A layer skill's body is a stub: it makes
  the model read the ADRs, run `checklist --layers <x> --pitfalls` and
  cite the output before advising; the items live in
  `skills/layer-<x>/references/checklist.md` and reach context only
  through that command or `pack`, filtered by the profile. A skill's body
  loads into context only when it activates; only its one-line
  description is always present.
- **Hooks.** Two in the plugin: at session start, the gateway is printed
  into context together with the plugin's install path; on every prompt
  inside a project that has `.acdev/state.md`, one line names the current
  pipeline stage and nothing else. One more hook is installed by
  acdev *inside each project*: the guard, which enforces the hard rules
  before a tool call runs (section 7).
- **Scripts.** Deterministic work never spends context. `acdev.mjs` is
  the pipeline's command line: `next` prints the one step that applies
  now, `pack` the context a slice needs, `q` a command's verdict, `close`
  the whole slice close, `run` the headless loop, `status` the resume
  snapshot, `scaffold` verbatim copies of the guard, the verify stubs,
  the templates and the mockup state variants (section 10).
  `checkpoint.mjs` reads and writes pipeline state, `lessons.mjs`
  promotes repeated mistakes into rules, `lint-budgets.mjs` polices the
  plugin's own budgets, `run-evals.mjs` checks routing, gates and budgets
  against a model, and the guard's command line runs verification and
  freezes files.

The design principle behind all of it: **cover only the delta over native
Claude Code.** Plan mode, subagents, worktrees, `/code-review`,
`/security-review`, `/rewind` are used where they belong and never
re-taught. What acdev adds is the process discipline, the hard approval
gates, the per-layer production checklists, the deterministic enforcement,
and the cross-session continuity that a real product needs.

How a session goes, mechanically:

1. Claude Code starts. The SessionStart hook prints the gateway: the
   invocation rule, the skill map, the hard rules, and `acdev plugin
   root: <path>`. Pipeline skills substitute that path for
   `<plugin-root>` when they run a script.
2. You type a prompt. If the project has `.acdev/state.md`, the
   UserPromptSubmit hook adds one line: the stage. The `next` command and
   the plugin root are in the gateway, re-injected after every compaction.
3. The model matches your prompt against the skill descriptions and the
   gateway. If a skill matches, its body loads and runs; inside build the
   body is short and the procedure comes from `next`, one step at a time.
   If two readings are plausible, the gateway tells it not to pick
   silently but to offer the matching `/acdev:<name>` commands and let
   you choose.
4. Every Edit, Write or Bash call passes through the project's guard
   first. Most calls pass silently; a denial or an "ask" comes back with
   the reason and the command that resolves it.

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

Update, from any terminal where `claude` is on the PATH, or from inside a
session with the same words after a slash:

```
claude plugin marketplace update acnetcenter
claude plugin update acdev@acnetcenter
```

Then start a new session; plugins load at session start. Verify the load:
the session context printed by the hook must contain `acdev plugin root:`
ending in the installed version's folder, and the `Pipeline:` line of the
gateway must list `operate`.

Requirements: Claude Code with plugins enabled, Node.js 20 or newer on the
PATH, git inside each project. Without Node the skills still activate from
their descriptions, but there is no gateway map, no routing line, no
checkpoints, no lessons, and the guard fails open.

## 3. The pipeline, stage by stage

Five gated stages take a project to production; the operate loop runs
after every deploy. Each stage produces an artifact the next one consumes,
and nothing downstream reopens an approved artifact silently.

| Stage | Skill | Produces | Gate |
|---|---|---|---|
| 0. Intake | `new-project` (user-run) | Project name, repo, documentation language, Claude-only or multi-AI; the guard installed; `.acdev/state.md` at `vision` | One open question, then the intake questions in one message |
| 1. VISION | `new-project` | `docs/VISION.md`, seven sections conversed one at a time | HARD: you approve the full document, in these words or equivalent: "Do you approve this VISION document?" |
| 2. MVP | `new-project` | `docs/MVP.md`: numbered in-scope list traceable to VISION flows, explicit out-of-scope list naming the phase each item moves to, verifiable success criteria | HARD: explicit approval of the full document |
| 3. Mockups | `mockups` | `mockups/`: one static HTML page per MVP screen, empty/error/loading states, each written from `scaffold mockup-variant <page> <state>`, a copy of its page with `<main>` reduced to one marker line so the model writes only that block (separate files, never a JS toggle); sample data capped at 5-8 rows per table and 3-6 items per list, every critical flow walkable; `mockups/SPEC.md`, the per-screen spec build reads instead of the pages; `docs/mockups-inventory.md` for post-MVP screens | HARD: "Do you approve these mockups?" Approval freezes the visual contract and the spec |
| 4. Blueprint | `blueprint` | ROADMAP with verifiable exit criteria; ARCHITECTURE, DATA-MODEL, SECURITY, UI-DESIGN (30 lines: component inventory and taste decisions; tokens stay in `mockups/styles.css`), RUNBOOK as applicable, each with a reader and a size cap (integrations are ADRs); ADRs (the stack is decided here); spikes for unproven dependencies; `.acdev/profile.json`; `CLAUDE.md` router and `AGENTS.md` copy (`cp`, regenerated by `close`, never hand-synced); repo mechanics (`.gitignore`, `.env.example`, CI skeleton, `scripts/verify/`, canary); the guard's `verify` commands | You review the package as a list: the document table, the ADR titles with their Decision line, the audit table, the guard status; you open the files, chat never quotes them. Explicit acceptance before corrections and the commit; then a separate, explicit order to start building |
| 5. Build | `build` + `ship` | Working, deployed software by vertical slices, one step at a time from `next`; slice 1 deploys and rolls back | Per slice: a plan gate only when a user-challenge decision exists; `close` (two commands) closes each slice with verification first, drift, changelog, lessons, checkpoint, one commit; per phase: exit criteria plus a security pass |
| 6. Operate | `operate` | Canary evidence after each deploy; incident specs; runbook corrections | Rollback before diagnosis on red; incident spec before any fix |

Rules that hold across every stage:

- **VISION is the source of truth.** A contradiction found in a child
  document is fixed in VISION with you, never patched in the child.
- **Zero product code before build is ordered.** Mockups and spikes are
  disposable drawings and experiments, not product. The guard denies
  product writes until `state.md` reaches `build`.
- **Drift rule.** Repo reality wins. A document proven wrong is corrected
  in the same commit that proved it, never "later".
- **No placeholders.** A missing fact is asked, or declared as a gap.
  `TBD` is a failure.
- **Skip by scope.** A project with no UI skips mockups (proposed, then
  confirmed with you). A known stack with no unproven dependency produces
  zero spikes. A project that does not deploy produces no runbook.
- **Just in time.** Slice plans, post-MVP mockups and phase specs are
  written when that slice or phase starts, never on day 0.
- **Documentation language.** Every generated artifact is written in the
  language chosen at intake. Skill files themselves are English.

## 4. A worked example: an invoicing SaaS from zero

The commands are yours; everything else the model does under the skills.

**Intake.** You run `/acdev:new-project`. The model asks one thing: tell
it, in a few sentences, what you want to build and for whom. You answer:
"An invoicing tool for freelancers in Spain; they create invoices, send
them, and see who has paid." Then it asks the four intake questions in
one message, with defaults derived from your answer: name (`facturalo`),
new repo, documentation language (Spanish), Claude-only or multi-AI. It
installs the guard, writes `.acdev/state.md` at stage `vision`, and
pastes the guard's `status` output as evidence.

**VISION.** The model walks the seven sections of the questionnaire one
at a time. For each it proposes a draft from what you already said, you
correct it, and it shows you the section as it will read in the
document. It challenges weak answers: "freelancers" is not a market until
you say who is not a customer. Each agreed section is edited into
`docs/VISION.md` (initialized from the template, in Spanish) the moment
you accept it. After section 7 it presents the full document and asks
for approval; a change you ask for edits that section, shows it, and
the full document is presented again. You approve. It advances the
state to `mvp`, and commits `docs: project vision`. From now on an edit
to VISION makes the guard ask first.

**MVP.** It cuts the first delivery from the approved VISION: in-scope
features numbered and traced to VISION flows, out-of-scope features each
naming its phase, success criteria as facts ("ten real freelancers send
an invoice unaided"). If cutting reveals a gap in VISION, it stops and
fixes VISION with you first. You approve the full MVP. State moves to
`mockups`.

**Mockups.** It builds `mockups/index.html`, `invoice-list.html`,
`invoice-list-empty.html`, `invoice-detail.html`, `invoice-new.html`,
`settings.html` with a shared `styles.css`, realistic sample data (real
names, real amounts, never lorem ipsum; 5-8 rows per table),
`invoice-list-empty.html` scaffolded with `scaffold mockup-variant
mockups/invoice-list.html empty` (the copy keeps header, nav and footer
and reduces `<main>` to one marker line; the model writes only that
block), and the navigation showing where phase-2 modules will attach. You open the index in a browser, ask for two rounds of
corrections, each applied as edits to the affected blocks and preceded
by a one-line-per-screen audit (typography / color / layout / states /
content / iconography, pass or FAIL with reason) (`docs: mockups
revision 1`, `... 2`), then approve. The set is frozen; state moves to
`blueprint`.

**Blueprint.** It proposes the document set with a one-line reason each,
then writes ROADMAP (phase 1 = the MVP, exit criteria including one
rehearsed rollback), ARCHITECTURE, DATA-MODEL (PII columns marked),
SECURITY (permission matrix), UI-DESIGN (30 lines: component inventory
and taste decisions; the tokens stay in `mockups/styles.css`, which the
frontend copies into the stack's token file and `pack` prints to
frontend slices), RUNBOOK (health URL, exact rollback command, numeric
bands), and the ADRs: stack, hosting, data store, auth, tenancy,
compliance (it asks which jurisdictions apply; it never assumes them
from the domain). A decision that depends on something unproven, say a
bank-sync API, gets a timeboxed spike with a success criterion written
before any code. It generates `CLAUDE.md` (copied once to `AGENTS.md`
if multi-AI) with golden rules derived from the model ("every table
change proves tenant isolation"), `scripts/verify/` with concrete
probes, `scripts/verify/canary.mjs`, the CI skeleton, and fills the
guard's `verify` commands. It offers an optional adversarial design
review. Its two panels receive file paths and a lens, read the files
themselves, and return findings severity-first: every high or critical
one, at most 10 lower ones, and a count of what was omitted. It
presents the package as a list, never quoted documents: the document
table (path, reader, lines), the ADR titles with their Decision line,
the audit table, the guard's `status`; you open the files. On your
explicit acceptance it commits, advances the state to `build`, and asks
two things: switch to a cheaper model for construction, and whether to
build the whole MVP without pausing. It waits for your explicit order
to start.

**Build.** You say "start". Slice 1 is the walking skeleton: log in, see
an empty invoice list, deployed to staging through CI, and rolled back
once with the runbook's command. Its plan is written just in time in
`docs/plans/`, every step as goal + verify, decisions classified in an
audit table. Only a user-challenge decision (draft invoices or not?)
interrupts you. The loop is TDD: red test, minimal green, refactor.
Layers that can proceed independently go to narrow subagents whose
prompt carries the `pack` command for their layer (with `--pitfalls`),
never a pasted context or a layer skill.

**Ship.** At the close: `node .claude/hooks/acdev-guard.mjs verify` runs
the configured checks and records the receipt; a red check blocks the
close, no exceptions. Drift check on the docs the slice touched. One
CHANGELOG line linking the plan. Lessons: any mistake seen twice becomes
a rule in `CLAUDE.md`. Checkpoint with `--plan`. One conventional commit
per slice, `feat: walking skeleton (slice 1)`; the guard allows it
because the receipt is green and fresh. When CI deploys, the release
check runs the canary.

**Operate.** Three weeks later, a deploy lands and the canary reports two
failed health probes. Per the runbook, the model rolls back first,
confirms the canary is green on the restored version, then diagnoses.
It writes `docs/plans/2026-10-02-incident-blank-pdfs.md` with symptom,
impact, timeline, root cause (a font missing from the build image), the
fix as goal + verify steps, and prevention: a lesson recorded, a smoke
path added to the canary, the runbook band corrected. The fix runs as a
mini-slice and closes through `ship`.

## 5. Adopting an existing repository

Run `/acdev:onboard` in the repo. The model inventories it before writing
anything and produces `docs/SITUATION.md`, where every line carries its
source tag in order of precedence: `[user]` (what you said this session,
overrides everything), `[docs]`, `[code]`, `[git]`. What it looked for
and did not find is a declared `[gap]`, never a guess. The map is about
80 lines: the eight layer rows are mandatory, everything else one line
per fact; a genuinely complex repo gets more lines and says so. You
correct the map; it asks for explicit confirmation that the map is
accurate before proposing anything. The adoption plan is written only
as the map's last section; chat says "the plan is the last section of
`docs/SITUATION.md`; confirm or correct it".

The adoption plan then offers, only where it applies: VISION written
retroactively (conversed, not autogenerated from the map), MVP only if
unbuilt scope is worth gating, ADRs marked "as-built" for decisions the
code already embodies, the initial pipeline state at the stage you should
resume from, the guard (with `verify` set to the checks the repo already
runs, and `allow_before_build` or `receipt_ignore` for generated or
vendored trees), and a RUNBOOK if the project deploys and has no
equivalent. Existing conventions win over acdev defaults; an existing doc
is never rewritten without showing the diff.

## 6. Daily work inside a project

**Resuming.** Start every session on an acdev project with
`/acdev:status`. It runs `acdev.mjs status` once and reports from its
output: `state.md`, the latest checkpoint, the names of open plans
(incidents first) and the current ROADMAP phase, answering "where are
we" in about 1k tokens; it never scans the repo. If
the checkpoint disagrees with the repo, it reports the difference and
trusts the repo. Then `next` prints the one step that applies now (plan
a slice, construct and close, blocked, an open incident, the phase exit)
with its commands, in under 500 tokens; the build skill's body holds only
the rules that never change.

**A change you ask for mid-build.** Anything beyond a trivial fix is a
mini-slice: the request is captured as a spec in
`docs/plans/YYYY-MM-DD-<topic>.md` with `status: active`, followed by
goal + verify steps, then runs through TDD, verification and a full
`ship` close. If the change alters what the product does, the
user-challenge gate and the VISION/MVP drift rule come first. If a slice
is in progress, it is parked (stash or branch) so the mini-slice's commit
contains only its own changes.

**A bug.** The `debugging` skill runs in order: reproduce with the exact
command and output, read the real error, write two or three ranked
hypotheses before editing anything, test the cheapest with evidence, fix
the root cause, add the regression test. Before touching the code under
a failing test it freezes the test (`freeze <file> --reason "..."`): the
test is the spec of the fix, and a fix that needs the test changed is a
spec change, which is your decision. The root cause is recorded as a
lesson candidate.

**Verification.** No green claim without command output from this
session, taken after the last edit. `verify` through the guard (or
`close`, which runs it) is the run; its verdict lines are the evidence,
the whole log only on red or with `--full`; `q -- <command>` does the
same for any other command, so a test run costs a few lines of context
instead of hundreds. The receipt `verify` writes is what `git commit` is
checked against. Partial is reported as partial.

**The close.** `close --check --plan <plan>` lists what the close needs:
the docs that mention the changed files (each with its matching lines,
three at most; the root `CLAUDE.md` and `AGENTS.md` are scanned too;
`docs/ROADMAP.md` always, showing its current phase heading), the
changelog, the plan, the docs index, an active freeze, the lessons
ledger. You fix what it lists; then `close --slice "N: name" --plan
<plan> --next "..." --changelog "..."` verifies first, refuses on red,
and does the rest in one go: CHANGELOG line, plan flipped to shipped,
freeze cleared, `AGENTS.md` regenerated from `CLAUDE.md` when it is an
acdev router copy (it carries the template's `## Mirror note` heading or
a `<!-- acdev: copy of CLAUDE.md -->` comment; an `AGENTS.md` kept by
hand for other agents is left as is and `close` says so), checkpoint,
one commit.

**Decision classes.** Mechanical (one correct answer: decided silently),
taste (several valid, cheap to reverse: decided and listed in the audit
table), user-challenge (money, security posture, data model shape,
product behavior, vendor lock-in, jurisdiction: asked, never assumed).
In doubt, the higher class wins.

**Continuous build.** With your explicit approval ("build the whole MVP
without stopping"), `build` runs slice after slice without pausing. The
gates inside each slice do not change; a user-challenge decision or a
plan-invalidating trap stops the run with a `--blocked` checkpoint. The
run ends at the phase exit, including the security pass. The cheapest
way to run it is the headless loop, `run --max-slices N`: one fresh
`claude -p` session per slice, memory in git and the checkpoints, cost
per slice recorded in `.acdev/cost.jsonl` and summed by `cost`. Each
iteration is capped (`--budget-usd`, by default twice the ledger's median
and never below 5 USD) and starts with the dynamic system-prompt sections
excluded, so the static prefix stays a cache read across iterations; a
headless session cannot answer a permission prompt, so the project's
settings must allow the `node` and `git` commands the steps run (the
guard settings template ships that block). In a headless `run` session a
layer with no new test file and under about three files is built inline
after one `pack --layers a,b,c --pitfalls` call; the `build-construct`
step carries that threshold, and the session knows it is headless by the
`run` prompt it received (build one slice, then stop).

**Model switch.** The document stages deserve the most capable model.
At the blueprint gate you are advised that construction can run on a
cheaper one; at the phase-exit security pass you are advised to switch
back, because hunting vulnerabilities takes adversarial reasoning.
Inside build the model is chosen by who judges the result: the cheapest
tier for subagents whose work a test, a lint or the guard judges (TDD to
green, lint fixes, doc edits), the capable model where judgment decides
(planning, root cause, security, every conversation with you). The tier
is named in the dispatch, not hoped for: the plugin ships two agents,
`acdev:acdev-builder` (the cheapest model) and `acdev:acdev-builder-capable` (the
session's model), and the construct step dispatches by `subagent_type`;
a subagent without a named tier inherits the session's model. During
construction the subagent prompt carries `pack --screens <a.html>
--layers <layer> --pitfalls`; the flag is what delivers the layer's
Pitfalls, since a construction subagent never loads a layer skill. The
headless ledger records each session's per-model usage, so `cost` shows
whether the split happened.

**Phase exit.** After the last slice of a phase: exit criteria checked
against what was built, not intended; for phase 1, the rehearsed
rollback. Then the security pass, on the most capable model, in this
order: the project's security probes first, through `q`, as a fast fail
(a red one ends the pass before any diff is read); native
`/security-review` over the phase diff with tests, docs, mockup HTML,
lockfiles and the CHANGELOG excluded by path, never by profile tag and
never by skipping commits an earlier code review saw; then the OWASP
pass from `layer-security` over the diff already in context. A
high-severity finding blocks the phase unless you accept it explicitly.
The next phase starts with its own mockups gate.

## 7. The guard

The guard is a PreToolUse hook that lives in your repo at
`.claude/hooks/acdev-guard.mjs`, wired through the project's
`.claude/settings.json`, configured by `.acdev/guard.json`. It reads the
stage from `.acdev/state.md` and answers `allow` (silent), `ask` (you
confirm) or `deny` (blocked, with the reason) before a tool call runs.

Install: `node "<plugin-root>/scripts/acdev.mjs" scaffold guard`, one
call that copies the hook, `.acdev/guard.json` and `.acdev/profile.json`
from their templates (existing files are kept; `--force` recopies),
merges the `permissions.allow` patterns and the two `PreToolUse` entries
into `.claude/settings.json` without touching any other key (rerunning
changes nothing) and adds the guard's session state to `.gitignore`.
Evidence: `node .claude/hooks/acdev-guard.mjs status`.

| Rule | Decision | When |
|---|---|---|
| Zero product code before build | deny | Stage before `build` and the path is outside the allowlist for that stage: always `docs/`, `.acdev/`, `.claude/`, root markdown, `.gitignore`, `.env.example`; from `mockups`, `mockups/`; from `blueprint`, `spikes/`, `scripts/verify/`, CI files, manifests and tool configs |
| Approved documents | ask | `docs/VISION.md` after the VISION gate, `docs/MVP.md` after the MVP gate, `mockups/` after the mockups gate, `docs/adr/` during build |
| Frozen paths | deny | Whatever `freeze` recorded, until `unfreeze` |
| Secrets | ask | `.env`, `.env.*` (examples exempt), `*.pem`, `*.key` |
| Destructive commands | ask | Force push, `reset --hard`, `clean -f`, `checkout -- .`, force branch delete, stash drop, `rm -f`, `DROP`/`TRUNCATE` |
| Inline node code | ask | `node -e`/`-p`/`--eval`/`--print`/`--input-type`, `node -`, a bare `node` fed by a pipe or a heredoc: a program the path policy cannot read (`Bash(node *)` is pre-allowed, so nothing else would prompt); script files stay allowed |
| Verification receipt | deny | In build, `git commit` without a receipt that is green and still bound to the code tree |
| The guard's own files | ask | The hook, `.acdev/guard.json`, `.claude/settings.json` |

Bash write targets (`>`, `>>`, `tee`, `cp`, `mv`, `touch`, `sed -i`) go
through the same policy as Edit and Write, so the stage rule cannot be
dodged with a heredoc. The parser is a heuristic; the gateway carries
the rule that closes the rest: **a guard denial is a gate, never an
obstacle to route around.** Either the state is behind reality, and the
pipeline advances it at its gate with you, or the action is wrong.

Commands:

```
node .claude/hooks/acdev-guard.mjs status
node .claude/hooks/acdev-guard.mjs verify [--full]
node .claude/hooks/acdev-guard.mjs freeze tests/invoices.test.ts src/legacy/** --reason "bug 42"
node .claude/hooks/acdev-guard.mjs unfreeze
```

`verify` prints each command's verdict lines (counts, totals, the last
lines) on green and, on red, its failure lines plus a short tail: stack
frames from `node_modules/`, `dist/` and Node's own `node:` modules are
dropped (the first one is kept only when a failing test has no project
frame at all), project frames are capped at two per failing test, and
the tail holds at most ten lines that the failure section has not
already shown; the whole log only with `--full`. The guard's filter is
a copy of the plugin's `scripts/lib/quiet.mjs` block, kept identical by
`tests/guard-quiet-parity.test.mjs`. `close` runs it itself and commits
only on green, so
the model's own `git commit` is the only path the receipt rule has to
guard.

`.acdev/guard.json`, with every key optional:

```json
{
  "enabled": true,
  "verify": ["node scripts/verify/run.mjs", "npm test", "npm run lint"],
  "allow_before_build": ["prototype/**"],
  "protected": [{ "glob": "docs/domain/PRICING-MODEL.md", "after": "blueprint", "what": "the pricing rules" }],
  "receipt_ignore": ["vendor/**"]
}
```

The receipt (`.acdev/verify-receipt.json`, gitignored) stores a hash of
`git diff HEAD` plus the untracked files, excluding `docs/`, `mockups/`,
`.acdev/` and markdown. So the close's own bookkeeping (checkpoint,
CHANGELOG line, drift fixes) never stales it; any code edit does, and the
next commit is denied until `verify` runs green again.

Off switches: `"enabled": false` in the config, or `ACDEV_GUARD=off` in
the environment. The hook fails open on any internal error and writes
the reason to stderr; it can never take a session down.

## 8. The lessons ratchet

A mistake made twice in a repo becomes a rule in that repo's `CLAUDE.md`,
by script, so the next session inherits it.

```
node "<plugin-root>/scripts/lessons.mjs" list
node "<plugin-root>/scripts/lessons.mjs" add "Run migrations before the API tests" --source "slice 2"
node "<plugin-root>/scripts/lessons.mjs" add --id 1 --source "docs/plans/2026-10-02-incident-blank-pdfs.md"
node "<plugin-root>/scripts/lessons.mjs" promote --id 3
```

The ledger is `.acdev/lessons.md`, a committed markdown table. A first
occurrence is a candidate. `add --id N` on a candidate is its second
occurrence: the script appends a bullet under `## Lessons` in `CLAUDE.md`
and, if the project keeps `AGENTS.md`, the identical bullet there. Nobody
hand-edits that section. Past twelve promoted lessons the script warns
and `close` refuses, like a red verify, until you consolidate the
section with the user (merge bullets, or move detail into an ADR);
`close --check` reports it as `lessons: N promoted > 12: consolidate the
section and .acdev/lessons.md before close`. The router stays under one
page. When the project keeps `AGENTS.md` as an acdev router copy (the
template's `## Mirror note` heading or a `<!-- acdev: copy of CLAUDE.md
-->` comment), `close` regenerates it from `CLAUDE.md` in the same
commit, so the mirror never drifts by hand; an `AGENTS.md` kept by hand
for other agents is left as is and `close` says so.

`ship` runs it at every close, `debugging` records root causes, `operate`
records incidents (a repeat incident of the same class is a second
occurrence by definition). A promoted lesson that can be checked
mechanically gets its check in the same commit: a test, a
`scripts/verify/` probe, a lint rule, a canary smoke path. A lesson that
only exists as a sentence will be forgotten a third time.

## 9. Operating in production

`docs/RUNBOOK.md` is the operating contract, written at blueprint for any
project that deploys: service map with health endpoints, deploy path and
who authorizes production, the exact rollback command and its last
rehearsal, numeric control bands (green, degraded, down), the canary's
environment variables, alerts, escalation, the post-release security
rescan. A band written as prose ("acceptable latency") is a placeholder.

The canary, `scripts/verify/canary.mjs`, reads `CANARY_BASE_URL`,
`CANARY_HEALTH_PATH`, `CANARY_SMOKE_PATHS`, `CANARY_P95_BUDGET_MS`,
`CANARY_SAMPLES`, and optionally `CANARY_ERROR_RATE_CMD` with
`CANARY_ERROR_RATE_MAX`. It probes health twice, hits every smoke path
the configured number of times, computes p95, and exits 1 with one line
per failed check.

`operate` runs when a deploy lands or production misbehaves:

1. Release check: run the canary, paste the decisive lines. Green closes
   the release.
2. Red, or an incident that started with a release: **roll back per the
   runbook before diagnosing.** The only exception is the runbook's own
   "unsafe when" clause (a contracted migration, an irreversible side
   effect); choosing the roll-forward path there is your decision.
3. Tiers from the bands: degraded means read-only diagnosis and an
   incident spec; down means rollback first, then the same.
4. Every incident becomes `docs/plans/YYYY-MM-DD-incident-<slug>.md`
   before any fix is coded, then runs as a build mini-slice and closes
   through `ship`. Prevention is part of the spec: lesson, mechanical
   check, runbook corrections.
5. After each production release: `/security-review` over the release
   diff plus the stack's dependency audit. A high finding is an incident.

No production change by hand without a paper trail: a dashboard value or
a feature flag flipped is recorded in the runbook or an ADR in the same
session, or the next deploy silently reverts it.

## 10. Scripts and files reference

| Path | What it is |
|---|---|
| `<plugin-root>/scripts/acdev.mjs next [--change "topic"]` | The one pipeline step that applies now, from `scripts/steps/`; under 500 tokens |
| `<plugin-root>/scripts/acdev.mjs status` | Resume snapshot in one call: state, latest checkpoint, open plans (incidents first), current ROADMAP phase; about 1k tokens |
| `<plugin-root>/scripts/acdev.mjs pack [--screens a,b] [--layers x,y] [--pitfalls]` | ADR decision lines, current ROADMAP phase, checkpoint, open plans, spec entries, the `:root` block of `mockups/styles.css` when `--layers` includes `frontend` (first block, capped at 60 lines), filtered checklists; about 2k tokens |
| `<plugin-root>/scripts/acdev.mjs checklist --layers x,y [--pitfalls]` | A layer's checklist filtered by `.acdev/profile.json` |
| `<plugin-root>/scripts/acdev.mjs q [--tail N] [--full] -- <command>` | Runs the command; verdict lines on green; on red the failure lines (no vendor frames, two project frames per test) and a deduped tail of min(N, 10) lines |
| `<plugin-root>/scripts/acdev.mjs drift` | Docs that mention the files changed since HEAD, with the matching lines (grep -n style, three per doc); the root `CLAUDE.md` and `AGENTS.md` too; ROADMAP always, with its current phase heading |
| `<plugin-root>/scripts/acdev.mjs close --check [--plan P] [--verify]` | What the close needs, without committing |
| `<plugin-root>/scripts/acdev.mjs close --slice "n: name" --plan P --next T --changelog T [--message M] [--notes T]` | Verification first (refuses on red), CHANGELOG line, plan flip, freeze cleared, checkpoint, one commit |
| `<plugin-root>/scripts/acdev.mjs mockup-spec [--write]` | Per-screen skeleton of `mockups/*.html`; `--write` updates `mockups/SPEC.md` keeping the Intent lines |
| `<plugin-root>/scripts/acdev.mjs run [--max-slices N] [--model M] [--budget-usd N] [--mcp-config F] [--no-isolate] [--claude CMD] [--extra "flags"] [--prompt T] [--timeout-min N] [--dry-run]` | Continuous build as one fresh headless session per slice, capped per iteration; stops on blocked, phase exit, no progress, error, the budget or the cap. `--mcp-config F`, or `.acdev/headless-mcp.json` when that file exists, loads only those MCP servers (`--strict-mcp-config`). `--timeout-min` defaults to 120 minutes; the timeout kills the whole process tree on both platforms (POSIX through a detached process group, Windows through `taskkill`) |
| `<plugin-root>/scripts/acdev.mjs cost [--json]` | The `.acdev/cost.jsonl` ledger: total, fresh and per-model tokens per run and per closed slice |
| `<plugin-root>/scripts/acdev.mjs scaffold guard \| verify --layers a,b [--canary] \| <template> <target> \| mockup-variant <page> <state> [--force]` | Copies the guard files and merges settings, writes the verify stubs (design-tells with `frontend`, canary on request), materializes a template (`runbook`, `incident`, `router`, `docs-index`, `vision`, `mvp`, `mockups-inventory`, `adr`) printing its caps and the rule "replace each `<...>` placeholder and each `<!-- ... -->` guidance comment", or copies a mockup page to `<page>-<state>.html` (`empty`, `error`, `loading`) with `<main>` reduced to one marker line; byte-identical copies, existing files skipped or refused |
| `<plugin-root>/scripts/checkpoint.mjs read` | Prints `.acdev/state.md` and the latest checkpoint (also `acdev.mjs checkpoint read`) |
| `<plugin-root>/scripts/checkpoint.mjs write --stage S --branch B --next T [--slice "n: name"] [--plan path] [--files a,b] [--blocked T] [--notes T] [--lang L]` | Writes a checkpoint and updates the state; `--stage` is one of `intake`, `vision`, `mvp`, `mockups`, `blueprint`, `build`; `--lang` is sticky |
| `<plugin-root>/scripts/lessons.mjs` | `add`, `add --id`, `promote --id`, `list` (section 8) |
| `.claude/hooks/acdev-guard.mjs` | `verify`, `status`, `freeze`, `unfreeze`; hook mode with no arguments (section 7) |
| `scripts/verify/*.mjs` | One concrete probe per layer, generated at blueprint from the plugin's stub; exit 0 verified, exit 1 violation, one evidence line |
| `scripts/verify/canary.mjs` | The post-deploy release check (section 9) |
| `.acdev/state.md` | `stage`, `updated`, `acdev_version`, `language`, `latest_checkpoint` |
| `.acdev/checkpoints/*.md` | Frontmatter: date, stage, branch, slice, plan, files_modified, next_step, blocked_on; up to ten lines of prose |
| `.acdev/lessons.md` | The lessons ledger |
| `.acdev/guard.json` | Guard policy for this repo |
| `.acdev/profile.json` | What the project has (`tags`); filters the layer checklists |
| `.acdev/freeze.json`, `.acdev/verify-receipt.json`, `.acdev/cost.jsonl` | Session state and the cost ledger, gitignored |
| `mockups/SPEC.md` | Per-screen spec generated from the pages at the freeze; build reads it instead of the HTML |
| `<plugin-root>/scripts/steps/*.md` | The twelve step files `next` prints, one per situation |
| `docs/plans/*.md` | Slice plans, change specs, incident specs; `status: active`, `shipped` or `abandoned`; never moved or deleted |
| `docs/README.md` | The docs index, one line per document and per series folder |
| `CLAUDE.md`, `AGENTS.md` | One-page router: golden rules, stack, read-before-working, verification, lessons, drift rule |

Templates the skills fill live in the plugin under
`shared/references/templates/` (VISION, MVP, ADR, checkpoint, state,
docs index, router, runbook, incident, guard hook and config, verify and
canary stubs, design-tell scanner).

## 11. Cost, budgets and what loads when

Fixed cost per session, measured from the tree and checked by the lint:
the twenty model-invocable descriptions plus the gateway body, about
1.1k tokens, plus the two shipped agents' descriptions in the Agent tool
listing (314 characters, about 80 tokens, outside the lint's ledger).
Inside a project, one line per prompt, the stage only,
under 10 tokens; every injected line is re-read on every later turn.
Skill bodies load only when the skill activates; `references/` load only
when a body points at them (the layer checklists in
`references/checklist.md` never load as prose: `checklist` and `pack`
print them filtered); step files one at a time; scripts run outside the
context.

The fixed cost is the small part. An agent's bill is turns times context
times model price, plus output tokens, and that is what the command line
cuts: a slice close is two calls instead of ten; `next` is a step of
under 500 tokens instead of a body of 2,500; `pack` is about 2k tokens
instead of ADRs, ROADMAP, checkpoints and mockup pages read whole; `q`
and the guard's `verify` put verdict lines in the context instead of
logs; subagents get the pack and a filtered checklist and return a
report, not diffs; the model is chosen by who judges the result; the
headless loop starts every slice with an empty context. `cost` and the
budget eval suite measure it per slice.

Budgets, enforced in CI: a description is at most 400 characters; a body
under 250 lines and 8,000 characters; the four pre-build bodies tighter
still (`new-project` 5,400, `mockups` 5,500, `blueprint` 6,000, `onboard`
5,600 characters) with their gate phrases required verbatim, since the
gate evals paste the body and expect that wording to force the decision;
a step file at most 1,500 characters, one per situation, no orphans; the
gateway file at most 1,600 characters. The lint also rejects emojis,
invocation-shaped `acdev <cmd> --flag` mentions in any markdown under
`skills/` or in the steps (no such executable exists), overlapping trigger
vocabularies between descriptions, divergence in the block the layer
skills share, a layer skill missing its stub headings or its
`references/checklist.md`, manifest disagreement, and a README whose
tables or ledger drift from the tree. A skill body, once activated, is
re-sent on every later turn of the session, which is why those four keep
only rules and send their procedure to the steps and to `references/`.

Practical consequences: subagents receive only the layer checklists
their slice touches, filtered by the profile, never all eight skills;
`status` never scans the repo; outputs name the sections that matter
instead of pasting whole documents; plans and documents carry size caps
because output tokens are the expensive ones.

## 12. Working on acdev itself

```
node --test                  # unit suite: hooks, checkpoint, lessons, guard, lint, eval runner, the command line
node scripts/lint-budgets.mjs
npm run evals                # routing and gate suites against a model, each judge in --safe-mode with no tools; on demand, costs money
npm run evals -- --suite gates --filter operate
npm run evals -- --suite budget   # whole headless sessions against their token budgets
npm run evals -- --dry-run   # print the judge command and the constructed prompts
npm run evals -- --ablate    # which gate cases a judge answers with no context at all
```

Contribution rules: budgets are hard limits; no emojis anywhere; English
across skills, docs and commits; a commit that adds or rewords a hard
rule adds or updates its gate case in the same commit; a persistent eval
failure is fixed by sharpening the text or the case, never by widening
`accept`; a procedure belongs in a step file or a script, a skill body
holds only the rules that never change. The plugin's own changes follow the rules it imposes: a
non-trivial change gets a plan in `docs/plans/`, a CHANGELOG line, and
the spec's amendment log when it changes the design.

## 13. FAQ

**The guard denied a write. What do I do?**
Read the reason; it names the rule and the command that resolves it. If
the project is at a stage before `build`, the write is product code and
the answer is to finish the stage, not to route around the denial. If
the file is frozen, the fix is touching the test, which is your decision
to make explicitly, then `unfreeze`. If it is a commit without a receipt,
run `verify`.

**Can the model bypass the guard with a Bash heredoc?**
Redirections, `tee`, `cp`, `mv`, `touch` and `sed -i` are parsed and go
through the same policy. A sufficiently creative command could still
slip past a heuristic parser, which is why the gateway and `build` carry
the model-side rule that a denial is a gate. The eval suite has a case
for exactly that scenario.

**How do I turn the guard off for one project?**
Set `"enabled": false` in `.acdev/guard.json`, or export
`ACDEV_GUARD=off` for a session. Editing the config itself asks first.

**`git commit` says the receipt is stale but I only changed docs.**
Docs, mockups, `.acdev/` and markdown are excluded from the fingerprint.
Check `status`: a stale receipt means a tracked non-markdown file or an
untracked file changed after the green run. Generated or vendored trees
go in `receipt_ignore`.

**My project has no UI. Do I have to draw mockups?**
No. After the MVP is approved the model proposes skipping to blueprint
and asks you to confirm. A project that never deploys anywhere users
reach also gets no runbook and no canary.

**I want to change VISION after it was approved.**
That is allowed and expected; it is a user-challenge decision. The guard
asks before the edit; you confirm; the change lands in the same commit as
whatever revealed it, and the affected downstream documents are
re-derived. VISION is never patched around.

**Can I write the docs in Spanish (or any language)?**
Yes. The documentation language is chosen at intake and stored in
`state.md`; every generated artifact uses it. The skill files and commit
messages stay English.

**The state says `mvp` but the repo is clearly mid-build.**
`status` reports the difference and trusts the repo. Fix it with a manual
checkpoint at the right stage: `checkpoint.mjs write --stage build ...`.
Do not edit `state.md` by hand to get past a denial; that is the one
thing the rule forbids.

**What is a trivial fix that skips the plan file?**
A typo, a one-line tweak with no behavior change. It still gets its
CHANGELOG line at ship; the line is its trace. Everything else is a
mini-slice with a spec.

**How is continuous build different from just letting it run?**
The pauses between slices are removed; nothing else changes. Every slice
still gets its plan, TDD, verification and full close. A user-challenge
decision stops the run with a `--blocked` checkpoint. You approve
continuous mode explicitly; it is never assumed.

**What does `run` do, and is it safe to leave alone?**
It starts one fresh `claude -p` session per slice with a fixed prompt
(run `next`, build one slice, close it, stop), reads the checkpoint back,
and stops on a blocked checkpoint, the phase exit, no new checkpoint, an
error, the per-iteration budget cap, or `--max-slices`. Each session's
cost lands in `.acdev/cost.jsonl` with its total, fresh and per-model
tokens. The guard runs inside every session, so no commit lands without
a green receipt and no destructive command runs without a human; a
headless session cannot ask you anything, which is exactly why a
user-challenge decision ends the loop. The timeout kills the whole
process tree on both platforms. Run it from a terminal you watch, and
calibrate the budget evals from its ledger.

**The headless run stops at its first command with a permission denial.**
`--permission-mode acceptEdits` covers file edits, not the `node` and
`git` commands every step runs, and nobody can answer a prompt in a
headless session. Allow `Bash(node *)`, `Bash(git *)` and the project's
verify commands in the project's `.claude/settings.json` (the guard
settings template carries the first two; `guard-install` merges them),
or pass `run --extra "--allowedTools ..."`. The guard still asks before
destructive git and inline `node -e`/`-p`/stdin code, and denies a
commit without a receipt.

**Which model should I use?**
The most capable one for VISION, MVP, mockups, blueprint and the
phase-exit security pass. Construction against approved documents can
run cheaper; the blueprint gate reminds you of the switch point.

**Can I use acdev with Codex, Cursor or another agent?**
The plugin runs in Claude Code. What it leaves in the repo is agent
neutral: `AGENTS.md` mirrors `CLAUDE.md` when you choose multi-AI at
intake (an `AGENTS.md` you keep by hand, without the router marker, is
left alone), and the guard's command line, the lessons script and the
canary run from any shell. The guard's hook enforcement itself is Claude Code's.

**Can I keep superpowers installed alongside acdev?**
Not recommended. Two startup hooks and two TDD or brainstorming skills
compete for the same prompt with no clear winner. acdev distilled the
process skills it needed from superpowers; uninstall it.

**A lesson was promoted with wording I do not like.**
Reword it as a consolidation, with the user, in one commit: the ledger
row in `.acdev/lessons.md` and the bullet in `CLAUDE.md` together
(`close` regenerates `AGENTS.md` from `CLAUDE.md`). The "never
hand-edit" rule exists so promotion stays deterministic and the mirror
never drifts, not to freeze wording; a consolidation that touches both
at once keeps both guarantees. The same move merges bullets or moves
detail into an ADR when the script warns and `close` refuses past
twelve promoted lessons.

**The canary is red but I am sure the release is fine.**
Roll back anyway if the runbook has no unsafe-when clause; a rehearsed
rollback costs minutes, and the diagnosis happens on the restored
system. If the canary itself is wrong, that is drift: fix the band or the
smoke path in the runbook in the same commit, with evidence.

**Why does phase 1 require a rollback rehearsal?**
Because a pipeline that has only ever gone forward is untested where it
matters most. The walking skeleton deploys and rolls back once while the
codebase is tiny; the drill is recorded in the runbook with its date.

**Where do secrets go?**
Never through the agent. `.env.example` lists every variable with a
comment and no value; real values live in the platform's secret store per
environment, and the guard asks before any `.env` file is written.

**How much does acdev cost per session?**
About 1.1k tokens fixed, measured and linted, plus about 25 per prompt
inside a project. Skill bodies cost only when they activate and the
largest is under 2k tokens; a step from `next` is under 500; a pack
about 2k. The number that matters is the cost per shipped slice, which
`cost` reports from the headless ledger and the budget evals check. The
evals cost real money and run only on demand.

**How do I know a skill activated?**
The model invokes it before responding and its behavior follows the
body: the VISION interview asks section by section, `ship` shows the
verification output, `status` answers in a few lines. When two skills
plausibly match, the model offers the `/acdev:<name>` commands instead
of picking; that is the in-doubt rule working, not indecision.

**Something in acdev misbehaves. Where do I look?**
`node --test` and `node scripts/lint-budgets.mjs` in the plugin repo;
the hooks print failures to stderr, visible in Claude Code's hook debug
output; the guard's `status` shows what it thinks the project state is.
A routing or gate that misfires in practice is a case for the eval
suites, added in the same commit as the fix.
