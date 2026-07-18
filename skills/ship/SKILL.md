---
name: ship
description: Use when closing a slice or phase: run full verification in green, check docs drift, write a checkpoint, commit or PR, and update the ROADMAP.
---

# Ship (close a slice or phase)

This skill is how `build` closes a slice. Every slice ends here — a slice
that is coded but not shipped is not done, regardless of how complete it
looks. The five gates below run in order: a slice cannot advance past a
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

## Changelog

Every close appends one line to the project's root `CHANGELOG.md`, under
`## [Unreleased]`: what shipped, written in the project's documentation
language, linking the plan that motivated it — e.g. `- Create invoice
happy path ([plan](docs/plans/2026-07-15-create-invoice.md))`. If the
project has no `CHANGELOG.md` yet, create it with the `[Unreleased]`
section on this first close; if one exists without an `[Unreleased]`
section, add the section at the top — unless the project follows its own
changelog convention (as found at onboard), which wins: append the line
where that convention puts unreleased work. In the same commit, flip that
plan's `status:` from `active` to `shipped` (see the `planning` skill's
lifecycle). A trivial fix that legitimately has no plan file (per that
skill's threshold) still gets its line — without a link; the line IS its
trace. The checkpoint records machine state for resuming; this line is
the human-readable history — both point at the same plan file.

## Checkpoint

Once verification is green, drift is fixed and the CHANGELOG line is
written, write the checkpoint:

```
node "<plugin-root>/scripts/checkpoint.mjs" write --stage build --branch <branch> --slice "<n: name>" --files "<changed>" --plan "<docs/plans/....md>" --next "<next slice or phase gate>"
```

`<plugin-root>` is the absolute path printed as `acdev plugin root:` in the
session context at startup.

- `--stage`, `--branch`, and `--next` are required; `--slice`, `--files`
  and `--plan` are optional but always supply them here — they are what
  makes the checkpoint useful for resuming this specific slice later. Use
  `--blocked` instead of closing if the slice cannot actually finish (see
  Close).
- `--slice` follows `"<n: name>"` — the slice number and its name, e.g.
  `"3: user invites accept flow"`. A user-requested change (build's
  mini-slice) has no phase slice number: use `--slice "change: <topic>"`
  with the plan's topic.
- `--files` is the comma-separated list of files this slice changed.
- `--plan` is the repo-relative path of the plan file this work followed
  (`docs/plans/...`). It is the link that ties commit, checkpoint and
  spec together; omit it only when the work legitimately had no plan file
  (a trivial fix, per the `planning` skill's threshold).
- `--next` names the concrete next slice, the interrupted slice being
  resumed (after a mini-slice), or the phase gate if this was the phase's
  last slice.

`.acdev/` is committed with the slice — the checkpoint is part of the
slice's history, not a side artifact left untracked.

## Close

One commit per slice, using a conventional commit message that names the
slice (for example `feat: user invites accept flow (slice 3)`). Do not
batch multiple slices into one commit and do not split one slice across
several — the commit boundary and the slice boundary are the same
boundary. A user-requested change closes the same way: one commit whose
conventional message names the change (e.g. `fix: invoice total
rounding (change)`).

When the project uses PRs, open one with native `gh` (one line, e.g. `gh
pr create --fill`) — this skill does not re-teach `gh` usage.

**Phase exit.** When the slice just closed was the last one in its phase,
verify the phase's exit criteria in `docs/ROADMAP.md` against what was
actually built and verified — not against intent.

The phase-exit security pass runs before the phase can be marked
complete. If build ran on a cheaper model, this is the moment to switch
back to the most capable one (`/model`) — construction follows
instructions, but hunting vulnerabilities takes adversarial reasoning.
Three parts, each with evidence:

1. Native `/security-review` over the phase's full diff (first slice of
   the phase to HEAD) — it already knows how to hunt vulnerabilities;
   this skill does not re-teach it.
2. The OWASP Top 10 pass from `layer-security`'s checklist, over the
   permission matrix and the phase's injection surfaces.
3. The project's `scripts/verify/` security probes.

A high-severity finding blocks the phase close the same way a red check
blocks a slice: fix it, or put the acceptance to the user as an explicit
user-challenge decision — security posture is never auto-accepted.

Mark the phase complete only once every exit criterion is actually met
and the security pass is clean or explicitly accepted. Then stop: do not
start the next phase's slices without the next-phase gate (mockups for any
new screens, blueprint deltas for new decisions) being satisfied first.

If a slice cannot close — verification cannot be made green, or the work
turns out to be blocked on something outside this session's control —
write the checkpoint with `--blocked` describing why, and stop. A blocked
slice is reported, never forced through.
