# Slice guide

Reference for `build`. How to cut a good vertical slice, how to recognize
a bad one, and the concrete templates used at planning and construction
time.

## Worked example: invoice SaaS, phase 1 (MVP)

A phase 1 scope of "freelancers track and send invoices" cuts into slices
like this:

1. **Slice 1 — walking skeleton.** "Log in, see an empty invoice list,
   deployed." Thinnest possible path through auth, API, data, and the
   list UI, but it runs in production, not just locally. Nothing about
   invoices actually works yet beyond proving the pipe end to end.
2. **Slice 2 — create invoice happy path.** "Fill in the invoice form,
   submit, see it appear in the list." The first slice that delivers real
   product value; deliberately skips edge cases and error handling to stay
   observable and small.
3. **Slice 3 — invoice list with pagination and empty/error states.**
   Revisits the slice-1 list screen now that there is enough data to need
   pagination, and fills in the empty and error states the mockups define
   but slice 1 didn't need yet.
4. **Slice 4 — PDF export.** "Click export on an invoice, get a PDF."
   A self-contained, observable capability layered on top of what already
   exists.

Each slice is independently deployable and each one gives the user
something new to look at — none of them is "build the invoice database
schema" or "add the auth middleware" on its own.

## Slice smells

Signs a proposed slice needs to be re-cut before work starts:

- **Single-layer slice.** If a "slice" only touches one layer (only the
  API, only the schema, only styling), it is a horizontal task, not a
  slice — it does not cross the stack and produces nothing a user can see
  on its own. Fold it into the vertical slice that actually needs it.
- **No observable result.** If nobody outside the codebase could tell the
  slice happened — no new screen, no new behavior, no visible fix — it
  is not a slice. Refactors and internal groundwork ride along inside a
  slice that also delivers something observable; they don't get their own
  slice.
- **Too big.** A slice that runs longer than roughly one day is almost
  always cutting the wrong boundary. Split it into a smaller observable
  step and a follow-up slice, rather than letting it run long and blur the
  one-commit-per-slice discipline.

## Audit table example (slice 2: create invoice happy path)

Before the slice plan is written, one question is put to the user because
it is a user-challenge decision — it changes what the product does, not
just how it's built, so it is asked and answered explicitly instead of
auto-decided:

> **Draft vs. submitted state (user-challenge, asked and confirmed with
> the user):** invoices are submitted immediately, no draft state in
> phase 1. Reason: changes what the product does, not just how it's
> built — outside auto-decision. Recorded as an ADR alongside the slice
> plan.

With that settled, the slice plan's audit table covers only the
mechanical and taste decisions made while implementing it — user-challenge
decisions are asked, not auto-decided, so they are not rows in this table:

| Decision | Class | Choice | Reason |
|---|---|---|---|
| Form field order | Taste | Client, amount, due date, notes | Matches mockup layout; no existing convention to follow |
| Validation library | Mechanical | Reuse the form validator already used on the login slice | Avoids a second validation approach in the same codebase |
| Invoice ID format | Taste | UUID v4 | Already the project's convention for all other entity IDs |
| Success feedback | Taste | Inline toast, not a redirect | Matches the frozen mockup for this screen |

## Subagent prompt template

Use this shape when dispatching a narrow, per-layer subagent during the
construction step. The prompt carries the pack COMMAND, never its
output: `pack` is deterministic script output the subagent produces
itself, and retyping it into every prompt costs output tokens once per
layer. Never paste all eight layer skills, never whole documents.
Always pass `--pitfalls`: the subagent never loads a layer skill, so the
pack is the only path by which the layer's Pitfalls reach construction.
Replace `<plugin-root>` with the absolute path printed as `acdev plugin
root:` at session start before dispatching.

Dispatch with the Agent tool and name the tier, because a subagent
without one inherits the session's model and the oracle rule below
never fires: `subagent_type: acdev-builder` where a test, a lint or the
guard judges the result; `subagent_type: acdev-builder-capable` where
judgment decides. Both ship with the plugin (`agents/`).

```
Goal: <one sentence: what this subagent builds or fixes, scoped to one
layer of the current slice>

Plan: <docs/plans/... path>, steps <N-M>: read only those steps; they
are the goal + verify pairs this layer owns.

Context: as your first tool call run
node "<plugin-root>/scripts/acdev.mjs" pack --screens <a.html> --layers <layer> --pitfalls
and treat its output as your context. It is authoritative: the
checklist and pitfalls it prints ARE the layer skill, so do not invoke
layer-* or tdd skills, and the project CLAUDE.md read list does not
apply to you.

Loop: write one failing test, run that file alone through
node "<plugin-root>/scripts/acdev.mjs" q -- <test command>
and confirm it fails for the expected reason; minimal code to green;
the full suite through q once per increment; refactor only on green.
A bug fix starts with the reproducing test. Never paste a log: q prints
the verdict lines.

Rules: the guard's denial is a gate; a user-challenge decision is not
yours to make: stop and report it.

Report back, in this order and nothing else: files changed (paths),
tests added (names), the verdict lines of the last green run, audit rows
(| Decision | Class | Choice | Reason |), traps found. No diffs, no file
contents.
```

## Model by oracle

Pick the subagent's tier by who judges its result, not by the stage,
and say it in the call (`subagent_type`, or the Agent tool's `model`
parameter when dispatching without the shipped agents):

- **`acdev-builder`, the cheapest tier** (a test, a lint, a typecheck or
  the guard judges): TDD to green against a written test, lint and type
  fixes, doc edits the drift list names, changelog and checkpoint
  bookkeeping.
- **`acdev-builder-capable`, the session's model** (judgment judges):
  root-cause debugging, anything security-sensitive, a layer whose plan
  steps leave a design choice open. Slice planning, cutting the slice,
  the mockups and every conversation with the user never leave the
  orchestrator.

The report format above is what makes the cheap tier safe: a subagent
cannot declare itself done, it returns verdict lines the orchestrator can
check against the guard's receipt. A subagent that returns full files or
diffs invites the orchestrator to skim instead of review, and doubles the
tokens of every slice. In the headless loop, `run` records each
session's `model_usage`, so `cost` shows whether the split happened.
