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
takes adversarial reasoning. Three parts, each with evidence, in this
order:

1. The project's `scripts/verify/` security probes, through `q`, first:
   they are free and a red one ends the pass before any diff is read.
2. Native `/security-review` over the phase's diff (first slice of the
   phase to HEAD) with the non-risk paths excluded: tests, docs, mockup
   HTML, lockfiles, the CHANGELOG. Exclude by path only; never scope the
   diff by profile tags (they carry no path mapping) and never skip
   commits because `/code-review` saw them (that is not a security
   review). The unscoped diff stays the backstop when in doubt.
3. The OWASP Top 10 pass from `layer-security`'s checklist over the
   permission matrix and the phase's injection surfaces, reasoning over
   the diff already in context instead of re-reading the files; open a
   file only for a surface the diff does not show whole.

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
