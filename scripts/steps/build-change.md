Build: a user-requested change ("<change>") is a mini-slice, not a side edit.

1. If a slice is in progress, park it (stash or branch) so the close commits only the change; name the parked slice in the change's `--next`.
2. Spec first, per the `planning` skill: `docs/plans/YYYY-MM-DD-<topic>.md`, `status: active`, at most 60 lines, the request in the user's own terms, then goal + verify steps. A change to what the product does is a user-challenge decision: confirm it, then amend `docs/VISION.md` or `docs/MVP.md` in the same commit. A genuinely trivial fix (a typo, a one-line tweak with no behavior change) skips the file; its trace is the CHANGELOG line.
3. TDD, verification, then the two close commands with `--slice "change: <topic>"`, `--plan <spec>` and `--changelog "<what changed>"`.
