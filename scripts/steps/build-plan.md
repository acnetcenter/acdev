Build: plan the next slice (the tree is clean).

Precondition: the user has explicitly ordered construction. If `next_step` says to await that order, ask for it and stop.

1. Context in one command: `node "<plugin-root>/scripts/acdev.mjs" pack --screens <a.html,b.html> --layers <api,data> --pitfalls`. It carries the ADR decision lines, the current ROADMAP phase, the checkpoint, the spec entries and the filtered checklists with their Pitfalls. Do not open ADRs, ROADMAP or mockups wholesale.
2. Cut the slice: vertical (every layer it needs, end to end), observable by a user, at most about a day. Slice 1 of phase 1 is the walking skeleton and includes deploy and the rollback drill. Smells and the worked example: `<plugin-root>/skills/build/references/slice-guide.md`.
3. Write `docs/plans/YYYY-MM-DD-slice-N-<topic>.md` per the `planning` skill: `status: active`, at most 40 lines, goal + verify steps, and the audit table `| Decision | Class | Choice | Reason |` (mechanical and taste only).
4. GATE only if the plan holds a user-challenge decision: ask it and wait. Otherwise start construction now (run `next` again once the first file changes).

Planning runs on the capable model and is never delegated.
