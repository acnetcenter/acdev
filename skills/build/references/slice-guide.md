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

| Decision | Class | Choice | Reason |
|---|---|---|---|
| Form field order | Taste | Client, amount, due date, notes | Matches mockup layout; no existing convention to follow |
| Validation library | Mechanical | Reuse the form validator already used on the login slice | Avoids a second validation approach in the same codebase |
| Invoice ID format | Taste | UUID v4 | Already the project's convention for all other entity IDs |
| Success feedback | Taste | Inline toast, not a redirect | Matches the frozen mockup for this screen |
| Draft vs. submitted state | User-challenge | Asked and confirmed with the user: invoices are submitted immediately, no draft state in phase 1 | Changes what the product does, not just how it's built — outside auto-decision |

The user-challenge row is not auto-resolved: it is asked and answered in
conversation before the slice proceeds, then recorded here with the
user's actual answer (and, if it also affects the data model or VISION/MVP
text, as an ADR alongside it).

## Subagent prompt template

Use this shape when dispatching a narrow, per-layer subagent during the
construction loop. Fill every bracket; do not paste all eight layer
skills — only the ones this subagent's work actually touches.

```
Goal: <one sentence — what this subagent builds or fixes, scoped to one
layer of the current slice>

Slice spec excerpt: <paste only the lines of the just-in-time slice plan
that this layer needs — not the whole plan>

ADR lines: <paste the specific lines from the relevant ADR(s) that this
work must follow — stack, schema shape, auth approach, etc., only what
applies>

Injected layer checklist(s): <name only the layer-* skills whose bodies
were included for this subagent, e.g. "layer-api, layer-data" — never all
eight>

TDD: follow the tdd skill — test first, red, green, refactor.

Return a summary and the diff, not the whole files.
```

The last line matters beyond token economy: a subagent that returns full
files invites the orchestrating skill to skim instead of review. A summary
plus a diff keeps the change auditable against the slice spec and the ADR
lines it was given.
