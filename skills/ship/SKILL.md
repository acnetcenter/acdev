---
name: ship
description: Use when closing a slice or phase: run full verification in green, check docs drift, write a checkpoint, commit or PR, and update the ROADMAP.
---

# Ship (close a slice or phase)

This skill is how `build` closes a slice. Every slice ends here — a slice
that is coded but not shipped is not done, regardless of how complete it
looks. The six gates below run in order: a slice cannot advance past a
red gate to the next one.

## Verification gate

Run the project's full verification — `scripts/verify/` plus the test
suite — per the `verifying` skill, and show the evidence: the actual
command output, not a summary of it. The person reading the close needs to
see the green run, not take your word for it.

In a project with the guard installed, the run is:

```
node .claude/hooks/acdev-guard.mjs verify
```

It executes the commands `.acdev/guard.json` lists, in order, streaming
their output (that output is the evidence), and records a receipt bound
to the current code tree. The hook denies `git commit` while the receipt
is missing, red, or stale because code changed after the run; docs,
CHANGELOG and `.acdev/` bookkeeping written later in this close never
stale it. If a freeze from `debugging` is still active, clear it now
(`node .claude/hooks/acdev-guard.mjs unfreeze`); a slice never closes
with a frozen test.

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
`docs/DATA-MODEL.md`, the permission matrix (in `docs/SECURITY.md`),
`docs/UI-DESIGN.md`, and any central-domain doc (`docs/domain/`). Check
only the docs this slice's work bears on — not the whole documentation
set on every close.

When the slice added, renamed or removed a document, update
`docs/README.md` (the index) in the same commit — create it from
`shared/references/templates/docs-index.md` if the project has no docs
index yet. If the project follows its own index convention (as found at
onboard — including a `docs/README.md` that is something other than an
index of `docs/`), that convention wins: update that index instead,
wherever it lives. Series folders (`adr/`, `plans/`, `designs/`,
`domain/`) are indexed as folders: the first file that creates one adds
that folder's single line; further files inside it never touch the
index.

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
where that convention puts unreleased work. The close that creates
`CHANGELOG.md` also adds its `../CHANGELOG.md` line to `docs/README.md`,
in the same commit. In the same commit, flip that plan's
`status:` from `active` to `shipped` (see the `planning` skill's
lifecycle). A trivial fix that legitimately has no plan file (per that
skill's threshold) still gets its line — without a link; the line IS its
trace. The checkpoint records machine state for resuming; this line is
the human-readable history — both point at the same plan file.

## Lessons

The ratchet: a mistake made twice in this repo becomes a rule in its
`CLAUDE.md`, so the next session inherits it instead of rediscovering it.
Before the checkpoint, review what this slice cost that it should not
have: a correction the user had to make again, a verification failure
whose cause was already seen in an earlier slice, a trap already noted in
a checkpoint, an ADR or the ledger. Then:

```
node "<plugin-root>/scripts/lessons.mjs" list
node "<plugin-root>/scripts/lessons.mjs" add --id <N> --source "<docs/plans/... or slice>"
node "<plugin-root>/scripts/lessons.mjs" add "<one-line lesson>" --source "<...>"
```

`list` shows the candidates already recorded. A repeat matches one of
them: `add --id N` bumps it, and on the second occurrence the script
promotes it into the `## Lessons` section of `CLAUDE.md` (and
`AGENTS.md` when the project keeps the mirror), in this commit. A first
occurrence is recorded as a candidate with `add "<lesson>"`. **Never
hand-edit the Lessons section**; the script owns it and keeps the mirror
identical.

A promoted lesson that can be checked mechanically becomes a check in the
same commit: a test, a `scripts/verify/` probe, a lint rule, a canary
smoke path. The CLAUDE.md line then names the check. A lesson that only
exists as a sentence will be forgotten a third time; one that fails a
command cannot be. The script warns past twelve promoted lessons:
consolidate the section with the user (merge, or move detail into an
ADR) rather than let the router grow past one page.

## Checkpoint

Once verification is green, drift is fixed, the CHANGELOG line is written
and lessons are recorded, write the checkpoint:

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

**Release check.** When this close reaches an environment users touch
(CI deploys the branch on merge, or the slice deployed by hand), the
slice is not finished when the deploy command returns: once the deploy
lands, run the `operate` skill's release check (the canary against
`docs/RUNBOOK.md`). A red canary rolls back per the runbook and the
follow-up is an incident spec through `operate`, never a hotfix pushed on
top of a broken release.

**Phase exit.** When the slice just closed was the last one in its phase,
verify the phase's exit criteria in `docs/ROADMAP.md` against what was
actually built and verified — not against intent. For phase 1 of a
project that deploys, that includes the rehearsed rollback the roadmap
requires: a drill recorded in the runbook, with its date and outcome,
or the phase does not exit.

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
