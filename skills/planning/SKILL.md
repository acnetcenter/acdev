---
name: planning
description: "Use when a task needs a multi-step plan with verifiable completion criteria, including per-slice plans during build and specs for user-requested changes."
---

# Planning

A plan's only job is to make completion checkable by someone other than
the person who wrote the code. A plan nobody can verify is a to-do list
with extra steps.

## Every step is a goal + verify pair

Write each step as "do X — verify: observable check." The verify half is
not optional and not generic: it names the exact command, file, or output
that proves X happened, not just that it was attempted.

Use exact paths and exact commands — `src/api/users.ts`, not "the users
file"; `npm test -- users.spec.ts`, not "run the tests." A plan that
requires the reader to go figure out which file or command you meant has
failed at its one job.

## No placeholders

"TBD", "handle errors appropriately", "add proper validation", "configure
as needed" are plan failures, not acceptable shorthand for later. If a
detail isn't known yet, that's either a question for the user right now or
a named open question in the plan — never a vague phrase standing in for a
decision nobody made.

## Right-size the steps

A step should be the smallest unit that has its own verify cycle — small
enough to fail in one identifiable place, large enough to be worth a
checkpoint. "Implement the feature" is too big to verify meaningfully;
"add the `email` column to the migration — verify: migration runs clean
against a fresh db" is sized right. Splitting further than that just adds
bookkeeping without adding confidence.

## Size

A slice plan fits in 40 lines and a change spec in 60; a design plan is
proportional to the decision. Output tokens are the expensive ones, and a
plan is reread at every step of its slice. If the plan does not fit, the
slice is too big (see `build`'s slice smells), not the cap.

## Decision audit table

When steps involved decisions classified per
`shared/references/decision-classification.md` (mechanical, taste,
user-challenge), include the running audit table in the plan, in the exact
format:

```
| Decision | Class | Choice | Reason |
```

User-challenge decisions are asked and answered in conversation, not
silently resolved into a table row.

## Where plans live

Store the plan at `docs/plans/YYYY-MM-DD-<topic>.md`. A per-slice plan
during `build` follows the same goal+verify format, scoped to that one
slice, and lives in the same location.

A user-requested change — a correction or an addition asked for outside
the current phase's planned slices — gets a plan file here too, written
before the work starts: first the request captured as a spec (what
changes and why, in the user's own terms), then the goal+verify steps.
Only a genuinely trivial fix — a typo, a one-line tweak with no behavior
change — skips the file; its trace is the CHANGELOG line `ship` writes
at close.

## Plan lifecycle

Every plan opens with frontmatter carrying its state:

```
---
date: YYYY-MM-DD
status: active
---
```

`status` is `active` while the work is open; `ship` flips it to `shipped`
in the same commit that closes the work; `abandoned` is set by hand, with
a line in the plan saying why, when the work is dropped. Plans never move
to an archive folder and are never deleted — the file stays where every
link (checkpoint `plan:` field, CHANGELOG entry, ADR) can still reach it.
"The archive" is a query over `status:`, not a location.

## Execution and done

During execution, track each step as a todo — one in progress at a time,
marked done only after its verify has actually run. Use plan mode, the
Agent tool, or worktrees as usual for the work itself; this skill governs
the plan's shape, not how it gets executed.

A plan is done when every verify has evidence — command output, a screen,
a passing test run — attached or reproducible, not when the last line of
code was written. Code without its verify having run is still an open
step.
