Build: the phase's last slice closed; run the phase exit (`ship` skill, `<plugin-root>/skills/ship/references/phase-exit.md`).

1. Exit criteria in `docs/ROADMAP.md` checked against what was built and verified, with evidence, not against intent. Phase 1 of a deploying project also needs the rollback drill recorded in `docs/RUNBOOK.md`.
2. Security pass on the most capable model (switch with `/model` if build ran cheaper). First the `scripts/verify/` security probes through `q` as a fast fail. Then native `/security-review` over the phase diff with the non-risk paths excluded (tests, docs, mockups HTML, lockfiles, CHANGELOG; never scoped by profile tags or by earlier code reviews). Then `layer-security`'s OWASP pass over the permission matrix and the injection surfaces, reusing the diff already in context instead of re-reading the files. A high-severity finding blocks; accepting one is an explicit user-challenge decision.
3. Mark the phase heading complete in ROADMAP ("Phase 1 (complete)"), write the checkpoint with `--next` naming the next phase's mockups gate, commit `docs: phase N exit`.

Then stop. The next phase needs its own mockups gate and blueprint deltas before any slice is planned.
