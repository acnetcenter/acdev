---
name: operate
description: Use after a deploy lands or on any production incident: run the release canary against the RUNBOOK bands, roll back on red before diagnosing, turn the incident into a spec that closes as a mini-slice, and rescan security after a release.
---

# Operate (after deploy)

The pipeline does not end when a slice ships; it ends when the release
proves itself in production and every incident has flowed back into the
repo as a spec, a fix and a lesson. This skill owns that loop. Its inputs
are `docs/RUNBOOK.md` (service map, rollback command, control bands,
canary, alerts) and `scripts/verify/canary.mjs`; both are written by
`blueprint` for any project that deploys. If the runbook is missing, say
so and write it first from `shared/references/templates/runbook.md` as a
blueprint delta, with the user; operating without a rehearsed rollback
and numeric bands is guessing under pressure.

## Release check

When a deploy lands (CI deployed `main` after a `ship` close, or the user
deployed by hand), run the canary and paste the decisive lines, per the
`verifying` skill:

```
node scripts/verify/canary.mjs
```

It reads the environment variables the runbook's Canary section names.
Green closes the release; say so with the evidence and stop. Red is an
incident of severity `down` or `degraded` per the bands, handled below.
A release is not done because the deploy command succeeded; it is done
when the canary is green.

## Rollback before root cause

**When the canary is red after a release, or an incident started with a
release, roll back per the runbook before diagnosing.** Restoring service
is the rehearsed path, not a decision to deliberate while users wait; the
diagnosis happens afterwards, on the logs of the rolled-back system.
The one exception is the runbook's own "unsafe when" clause (a migration
already contracted, an irreversible external side effect): then the
roll-forward path it names applies, and choosing it is a user-challenge
decision put to the user with the evidence, never taken silently.

Tiers, from the runbook's control bands:

- **Green.** Nothing to do.
- **Degraded.** Diagnose read-only (logs, metrics, the reproducing
  request) per the `debugging` skill; write the incident spec; no
  production change without it.
- **Down.** Roll back first, confirm the canary is green on the restored
  version, then proceed as degraded.

Never change production by hand without a paper trail: a value edited in
a dashboard, a feature flag flipped, a scaled instance, each is recorded
in the runbook or an ADR in the same session, or it is config drift the
next deploy silently reverts.

## Incident to spec

Every incident becomes `docs/plans/YYYY-MM-DD-incident-<slug>.md` from
`shared/references/templates/incident.md` **before any fix is coded**:
symptom, impact, timeline, immediate action, root cause, fix as goal +
verify steps, prevention. A hotfix without a spec is a side edit, and the
pipeline has no such thing; the spec is what lets the fix close through
`ship` like every other change, with its CHANGELOG line, its checkpoint
and its `status:` flip.

Then the fix runs as a `build` mini-slice: reproducing test first (`tdd`),
root cause not symptom (`debugging`), verification (`verifying`), one
commit (`ship`). Freeze the reproducing test while fixing, per the
`debugging` skill; the test is the spec of the fix.

Prevention is part of the spec, not a follow-up:

- Record the lesson with `node "<plugin-root>/scripts/lessons.mjs"`
  (`<plugin-root>` is the path printed as `acdev plugin root:` at
  session start): `list` first; if a candidate matches the root cause,
  `add --id N --source <spec path>` promotes it into `CLAUDE.md`;
  otherwise `add "<lesson>" --source <spec path>` records the candidate.
  A repeat incident of the same class is by definition a second
  occurrence.
- Add the mechanical check that would have caught it: a test, a
  `scripts/verify/` probe, a canary smoke path, an alert band. If none is
  possible, the spec says why.
- Correct the runbook in the same commit when the incident proved a band,
  a command or a contact wrong (drift rule).

## Post-release security rescan

After each production release, run the runbook's rescan: native
`/security-review` over the release diff (previous release tag to HEAD)
when the phase-exit pass did not already cover those commits, plus the
stack's dependency audit. A high-severity finding is an incident of
severity `degraded`: it gets a spec and closes through the same path.
Accepting it instead is a user-challenge decision, never automatic.

## Budgets and evidence

Every check here cites command output: the canary lines, the rollback
command's result, the reproducing request. "Production looks fine" is
not evidence. Keep the operating loop cheap: the canary and the runbook
are the whole input for a release check; reading the codebase is for the
fix, not for the check.
