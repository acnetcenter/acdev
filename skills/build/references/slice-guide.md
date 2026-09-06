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
construction step. The pack is the context: `node
"<plugin-root>/scripts/acdev.mjs" pack --screens <a.html> --layers
<api,data>` prints the ADR decision lines, the current phase, the
checkpoint, the spec entries and the checklists filtered by the
project's profile. Paste its output; never all eight layer skills, never
whole documents.

```
Goal: <one sentence: what this subagent builds or fixes, scoped to one
layer of the current slice>

Plan lines: <only the goal + verify steps of the slice plan this layer
owns, not the whole plan>

Context: <the pack output>

Rules: TDD per the tdd skill (test first, red, green, refactor), tests
run through `acdev q -- <command>`; the guard's denial is a gate; a
user-challenge decision is not yours to make: stop and report it.

Report back, in this order and nothing else: files changed (paths),
tests added (names), the verdict lines of the last green run, audit rows
(| Decision | Class | Choice | Reason |), traps found. No diffs, no file
contents.
```

## Model by oracle

Pick the subagent's model by who judges its result, not by the stage:

- **Cheapest tier** (a test, a lint, a typecheck or the guard judges):
  TDD to green against a written test, lint and type fixes, doc edits
  the drift list names, changelog and checkpoint bookkeeping.
- **Capable model** (judgment judges): slice planning, cutting the slice,
  root-cause debugging, anything security-sensitive, the mockups, and
  every conversation with the user.

The report format above is what makes the cheap tier safe: a subagent
cannot declare itself done, it returns verdict lines the orchestrator can
check against the guard's receipt. A subagent that returns full files or
diffs invites the orchestrator to skim instead of review, and doubles the
tokens of every slice.
