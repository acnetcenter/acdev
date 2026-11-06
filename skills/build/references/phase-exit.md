# Phase exit

Reference for `build`. Runs once the phase's last slice has closed,
before the phase can be marked complete. It is the one place where the
whole phase is reviewed with fresh eyes, instead of re-checking every
slice as it goes.

## Exit criteria

Verify every exit criterion in `docs/ROADMAP.md` against what was built
and verified, not against intent, with evidence for each. For phase 1 of
a project that deploys, that includes the rehearsed rollback: a drill
recorded in `docs/RUNBOOK.md` with its date, the exact command and the
time to restore. No drill, no exit.

## Production and security pass

Hunting defects takes adversarial reasoning, so run this on the most
capable model available. If the build ran on a cheaper one, do the pass
in a fresh session on the capable model instead of switching mid-session
(a switch re-reads the whole conversation uncached). Three parts, each
with evidence, in this order:

1. The project's own security checks under `scripts/verify/`, if any,
   through `acdev q`: they are free and a red one ends the pass early.
2. Native `/security-review` over the phase's diff (first slice of the
   phase to HEAD) with the non-risk paths excluded: tests, docs, mockup
   HTML, lockfiles, the CHANGELOG. Exclude by path only, and do not skip
   commits because `/code-review` saw them; that is not a security
   review.
3. `production-checklist.md`, over what the phase touched: run each
   applicable item's probe and cite the decisive output, reasoning over
   the diff already in context instead of re-reading files.

A high-severity finding blocks the phase the same way a red check blocks
a slice: fix it, or put its acceptance to the user as an explicit
user-challenge decision. Security posture is never auto-accepted.

## Marking the phase

Once every criterion is met and the pass is clean or explicitly accepted:
append " (complete)" to the phase heading in `docs/ROADMAP.md` (`acdev
status` reads the first phase heading without that marker as the current
phase), write the checkpoint with `--next` naming the next phase's
mockups gate, and commit `docs: phase N exit`.

Then stop. The next phase's slices do not start until its own gates are
satisfied (`changes.md`, later phases).
