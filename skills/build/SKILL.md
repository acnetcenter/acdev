---
name: build
description: "Use when constructing an approved project or changing one already in build: vertical slices end to end, a plan sized to the change, a failing test first, a verified close, incidents and phase exits."
---

# Build

Turns the approved blueprint into working, deployed software one vertical
slice at a time, and handles every change after that. The session-start
line already says the stage and the next step; `acdev status` prints the
full snapshot. Open a document only when the task at hand needs it.

## Preconditions

Two things must both be true: the blueprint gate passed, and the user has
explicitly ordered construction. Closing the blueprint gate is not that
order, and neither is the state write that unlocked product code.

## Size the process to the change

| Work | Plan | Close |
|---|---|---|
| Small fix: a typo, a one-line tweak, no change in behavior | None | The close below without `--plan`; its CHANGELOG line is the trace |
| Bug | The reproducing test | The close below without `--plan` |
| Feature, multi-file change, anything that changes what the product does | `docs/plans/` file, at most 60 lines (`references/changes.md`) | The close below with `--plan <file>` |
| Roadmap slice | `docs/plans/` file, at most 40 lines, written just before building it | The close below with `--plan <file>` |

Every close is the same command; `--slice`, `--next` and `--changelog`
are required, and a change that is not a roadmap slice is named `"change:
<topic>"`:

```
acdev close --slice "change: <topic>" --next "<what follows>" --changelog "<what changed>" [--plan <file>]
```

A plan pays for itself on features and multi-file work and costs more
than it returns on small fixes, so do not write one where the table says
none.

## A slice

1. **Cut it.** Vertical (every layer it needs, end to end), observable by
   a user, about a day at most. Slice 1 of phase 1 is the walking
   skeleton and includes the deploy and the rollback drill, because the
   delivery path is cheapest to fix while the code is small. Smells and a
   worked example: `references/slice-guide.md`.
2. **Plan it** in `docs/plans/YYYY-MM-DD-slice-N-<topic>.md`: frontmatter
   `status: active`, goal + verify steps, and the audit table of the
   taste decisions taken. Just-in-time, because earlier slices
   change what later ones need. A user-challenge decision in the plan is
   asked before construction; otherwise start.
3. **Construct it.** The frontend replicates the frozen mockups: read the
   screen's entry in `mockups/SPEC.md` and open the HTML only for the
   screen at hand. A change in behavior starts with one failing test for
   that behavior, seen failing for the expected reason, then the minimal
   code to pass it: a test written afterwards only proves the code does
   what it does. One focused test per behavior, not a suite per function.
   Run tests through `acdev q -- <command>`: it prints the verdict lines,
   and a log pasted once is re-read on every later turn.
4. **Close it.** `acdev close --check --plan <plan>` lists the documents
   that mention the changed files; correct them in this same commit. Then
   `acdev close --slice "N: name" --plan <plan> --next "<next slice, or:
   phase exit>" --changelog "<what shipped>"`. It verifies first and
   refuses on red, then writes the CHANGELOG line, the plan status, the
   checkpoint and one commit. A red you cannot fix ends with `acdev
   checkpoint write ... --blocked "<why>"`, never with a narrowed check.
5. **Cut the context.** After the close, tell the user the slice is on
   disk and that the next one starts cheaper in a fresh session
   (`/clear`). Do not start the next slice in the same context unless the
   user asked for continuous mode: most of what a long session costs is
   the context it re-reads on every turn.

## Rules that do not move

- Every decision is classified per
  `../../shared/references/decision-classification.md`. A user-challenge
  decision is asked, never auto-decided and never delegated.
- The frozen mockups are the visual contract. What they draw is not
  reopened here; what they do not draw is a taste decision in the audit
  table.
- A guard denial is a gate, never an obstacle: no redirection, no other
  tool, no edit to `.acdev/` to make it go away. Either the state is
  behind reality and the pipeline advances it at its gate, or the action
  is wrong.
- Done means the project's checks ran after the last edit and passed,
  with the verdict lines shown. Partial is reported as partial.
- A change in product behavior found mid-slice goes to the user first,
  then PRODUCT.md or MVP.md is amended in the same commit as the code.

## Delegation

Work in the main session by default. A subagent earns its cost on large
independent work (a wide scan of the repo, a layer with its own test loop
and several files), not on re-checking your own work. When delegating to
a smaller model, tell it to run the check and return the verdict lines:
small models at low effort sometimes report done without running
anything. A significant or security-sensitive change gets native
`/code-review` before the close.

## Other situations

- A change the user asks for, an incident, a post-MVP phase:
  `references/changes.md`.
- A deploy landed: run the canary (`acdev q -- node
  scripts/verify/canary.mjs`); red means roll back per `docs/RUNBOOK.md`
  before diagnosing.
- The phase's last slice closed: `references/phase-exit.md`.
- Building the whole phase without pauses, only on the user's explicit
  approval: `references/continuous.md`.
