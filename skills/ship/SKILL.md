---
name: ship
description: Use when closing a slice or phase: run full verification in green, check docs drift, write a checkpoint, commit or PR, and update the ROADMAP.
---

# Ship (close a slice or phase)

Every slice ends here. A slice that is coded but not shipped is not done,
regardless of how complete it looks. The close is two commands; the gates
run inside them, in order, and a red gate stops everything after it.

## The close

1. `node "<plugin-root>/scripts/acdev.mjs" close --check --plan <plan>`
   (`<plugin-root>` is the path printed as `acdev plugin root:` at session
   start). It lists what the close needs: the drift candidates (docs that
   mention the changed files, ROADMAP always), the changelog state, the
   plan status, whether `docs/README.md` needs the new documents, an
   active freeze, the lessons ledger. Fix what it lists before closing:
   docs corrected in the same commit as the code (a doc that is wrong for
   even one commit is a doc nobody can trust), a new ADR if a lasting
   decision surfaced, a lesson added or bumped if the slice repeated a
   mistake.
2. `node "<plugin-root>/scripts/acdev.mjs" close --slice "N: name" --plan
   <plan> --next "<next slice, or: phase exit>" --changelog "<what
   shipped>" [--message "<conventional commit>"]`. It runs the project's
   verification first (the guard's `verify`, which records the receipt;
   its verdict lines are the evidence) and refuses on red. Then, in this
   order: the CHANGELOG line under Unreleased linking the plan, the plan's
   `status: shipped`, the freeze cleared, the checkpoint, and one commit
   named after the slice (`feat: <name> (slice N)`, `fix: <topic>
   (change)`).

**A red check blocks the close. No exceptions.** Do not commit around it,
do not mark it "known issue", do not narrow verification to dodge it. Fix
it, or write the checkpoint with `--blocked` describing why, and stop.
Code review for non-trivial or security-sensitive changes is native
`/code-review`, run before step 2.

## After the commit

- PRs: `gh pr create --fill` when the project uses them.
- Release check: if the close reached an environment users touch, run
  `operate`'s canary; a red canary rolls back per the runbook, and the
  follow-up is an incident spec, never a hotfix on top.
- Phase exit: when the slice was the phase's last, run
  `references/phase-exit.md` (exit criteria against what was built, the
  security pass on the most capable model, the ROADMAP marker). A
  high-severity finding blocks the phase; accepting one is an explicit
  user-challenge decision.

## Lessons

The ratchet: a mistake made twice in this repo becomes a rule in
`CLAUDE.md`, by script, never by hand. `lessons list` shows the
candidates; a repeat is `lessons add --id N --source <plan>`, which
promotes it on the second occurrence; a first occurrence is `lessons add
"<one line>" --source <plan>`. A promoted lesson that can be checked
mechanically becomes a test, a probe or a lint rule in the same commit:
a lesson that only exists as a sentence will be forgotten a third time.
