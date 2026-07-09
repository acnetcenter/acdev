---
name: ship
description: Use when closing a slice or phase: run full verification in green, check docs drift, write a checkpoint, commit or PR, and update the ROADMAP.
---

# Ship (close a slice or phase)

This skill is how `build` closes a slice. Every slice ends here — a slice
that is coded but not shipped is not done, regardless of how complete it
looks. The four gates below run in order: a slice cannot advance past a
red gate to the next one.

## Verification gate

Run the project's full verification — `scripts/verify/` plus the test
suite — per the `verifying` skill, and show the evidence: the actual
command output, not a summary of it. The person reading the close needs to
see the green run, not take your word for it.

**A red check blocks the close. No exceptions.** A failing test, a failing
lint, a failing type check — any of these means the slice is not finished
yet, even if the feature itself looks visually complete. Do not commit
around a red check, do not mark it "known issue, will fix later," and do
not narrow verification scope to dodge a failure. Fix it, or stop and say
the slice is blocked.

When the change warrants review — non-trivial logic, security-sensitive
code, anything you would want a second pair of eyes on — run native
`/code-review` before closing; it already knows how to review a diff, so
this skill does not re-teach that.

## Drift check

Documentation and reality drift apart the moment code changes and docs
don't. Before closing, diff what this slice actually built against every
doc it touches: `docs/ROADMAP.md` phase state, `docs/ARCHITECTURE.md`,
`docs/DATA-MODEL.md`, the permission matrix (in `docs/SECURITY.md`), and
`docs/UI-DESIGN.md`. Check only the docs this slice's work bears on — not
the whole documentation set on every close.

Fix any drift found in the **same commit** as the slice, not a follow-up.
A doc that is wrong for even one commit is a doc nobody can trust.

If the slice surfaced a new lasting decision — a trap in an earlier
assumption, a technical choice made under way that was not previously
recorded — write it as an ADR using `shared/references/templates/adr.md`
and commit it alongside the slice. A decision made without a paper trail
is a decision the next person has to rediscover the hard way.

## Checkpoint

Once verification is green and drift is fixed, write the checkpoint:

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/checkpoint.mjs" write --stage build --branch <branch> --slice "<n: name>" --files "<changed>" --next "<next slice or phase gate>"
```

- `--stage`, `--branch`, and `--next` are required; `--slice` and `--files`
  are optional but always supply them here — they are what makes the
  checkpoint useful for resuming this specific slice later. Use `--blocked`
  instead of closing if the slice cannot actually finish (see Close).
- `--slice` follows `"<n: name>"` — the slice number and its name, e.g.
  `"3: user invites accept flow"`.
- `--files` is the comma-separated list of files this slice changed.
- `--next` names the concrete next slice, or the phase gate if this was the
  phase's last slice.

`.acdev/` is committed with the slice — the checkpoint is part of the
slice's history, not a side artifact left untracked.

## Close

One commit per slice, using a conventional commit message that names the
slice (for example `feat: user invites accept flow (slice 3)`). Do not
batch multiple slices into one commit and do not split one slice across
several — the commit boundary and the slice boundary are the same
boundary.

When the project uses PRs, open one with native `gh` (one line, e.g. `gh
pr create --fill`) — this skill does not re-teach `gh` usage.

**Phase exit.** When the slice just closed was the last one in its phase,
verify the phase's exit criteria in `docs/ROADMAP.md` against what was
actually built and verified — not against intent. Mark the phase
complete only once every exit criterion is actually met. Then stop: do not
start the next phase's slices without the next-phase gate (mockups for any
new screens, blueprint deltas for new decisions) being satisfied first.

If a slice cannot close — verification cannot be made green, or the work
turns out to be blocked on something outside this session's control —
write the checkpoint with `--blocked` describing why, and stop. A blocked
slice is reported, never forced through.
