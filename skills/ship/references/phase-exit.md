# Phase exit

Reference for `ship`. Runs once the phase's last slice has closed, before
the phase can be marked complete.

## Exit criteria

Verify every exit criterion in `docs/ROADMAP.md` against what was actually
built and verified, not against intent, with evidence for each. For phase
1 of a project that deploys, that includes the rehearsed rollback the
roadmap requires: a drill recorded in `docs/RUNBOOK.md` with its date,
the exact command and the time to restore. No drill, no exit.

## Security pass

If build ran on a cheaper model, switch back to the most capable one
(`/model`): construction follows instructions, hunting vulnerabilities
takes adversarial reasoning. Three parts, each with evidence:

1. Native `/security-review` over the phase's full diff (first slice of
   the phase to HEAD).
2. The OWASP Top 10 pass from `layer-security`'s checklist over the
   permission matrix and the phase's injection surfaces.
3. The project's `scripts/verify/` security probes, through `q`.

A high-severity finding blocks the phase close the same way a red check
blocks a slice: fix it, or put the acceptance to the user as an explicit
user-challenge decision. Security posture is never auto-accepted.

## Marking the phase

Once every criterion is met and the pass is clean or explicitly accepted:
append " (complete)" to the phase heading in `docs/ROADMAP.md` (the
dispenser and the pack read the first phase heading without that marker
as the current phase), write the checkpoint with `--next` naming the next
phase's mockups gate, and commit `docs: phase N exit`.

Then stop. Do not start the next phase's slices until its gate is
satisfied: mockups for any new screens, blueprint deltas for new
decisions, `mockup-spec --write` extended with the new screens.
