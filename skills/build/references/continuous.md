# Continuous build

Reference for `build`. Continuous mode removes the pauses between slices,
never the gates inside them. It runs only on the user's explicit approval,
offered at the blueprint gate or given any time during build ("build the
whole MVP without stopping").

## What does not change

Every slice still gets its just-in-time plan, the TDD loop, verification
and a full close (`close --check`, then `close`: green verification,
drift, CHANGELOG line, checkpoint, one commit) before the next slice
starts. Mechanical and taste decisions are auto-decided into the audit
table, as always.

## What stops the run

- A user-challenge decision: write the checkpoint with `--blocked` naming
  the question, report it, and wait. The user answers and says "continue".
- A discovered trap that invalidates the current plan: the same way.
- The phase exit: the run ends at the current phase's exit criteria plus
  `ship`'s phase-exit security pass. Post-MVP phases need their own
  mockups gate first, then their own run if the user wants one.

## Two ways to run it

**Interactive.** The session keeps going: narrate every slice close in one
line ("slice N shipped, verification green; next: X") without waiting for
a reply, then run `next` again. The user can interrupt at any point. The
context grows with every slice; when it gets heavy, a fresh session loses
nothing: `/clear`, `/acdev:status`, "continue".

**Headless (recommended for cost).** One fresh session per slice, memory
in git and the checkpoints, nothing carried between iterations:

```
node "<plugin-root>/scripts/acdev.mjs" run --max-slices 10 [--model sonnet] [--extra "--permission-mode acceptEdits"]
```

Each iteration runs `claude -p` with the default prompt ("run `next`,
build one slice, close it, stop"), records cost and tokens in
`.acdev/cost.jsonl`, and reads the checkpoint back. The loop stops on a
`--blocked` checkpoint, on the phase exit, when no new checkpoint appears
(the slice did not close), on an error result, or at `--max-slices`.
`--dry-run` prints the command; `--claude` and `--extra` pass the CLI and
its flags; `cost` prints the ledger. The guard is the safety net in every
iteration: no commit without a green receipt, no product code before
build, no destructive command without a human. Run it from a terminal the
user watches; a headless session cannot ask anyone anything, which is
exactly why a user-challenge decision ends it.
