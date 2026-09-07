---
name: operate
description: "Use after a deploy lands or on any production incident: run the release canary against the RUNBOOK bands, roll back on red before diagnosing, turn the incident into a spec that closes as a mini-slice, and rescan security after a release."
---

# Operate (after deploy)

The pipeline ends when the release proves itself in production and every
incident has flowed back into the repo as a spec, a fix and a lesson.
Inputs: `docs/RUNBOOK.md` (service map, rollback command, control bands,
canary, alerts) and `scripts/verify/canary.mjs`, both written by
`blueprint` for any project that deploys. If the runbook is missing, write
it first (`node "<plugin-root>/scripts/acdev.mjs" scaffold runbook
docs/RUNBOOK.md`, then fill only the `<...>` placeholders) as a blueprint
delta, with the user: operating without a rehearsed rollback and numeric
bands is guessing under pressure.

## Release check

When a deploy lands, run the canary through the quiet runner and paste
its verdict lines:

```
node "<plugin-root>/scripts/acdev.mjs" q -- node scripts/verify/canary.mjs
```

Green closes the release: say so with the evidence and stop. Red is an
incident of severity `down` or `degraded` per the bands. A release is not
done because the deploy command succeeded; it is done when the canary is
green.

## Rollback before root cause

**When the canary is red after a release, or an incident started with a
release, roll back per the runbook before diagnosing.** Restoring service
is the rehearsed path; the diagnosis happens afterwards, on the logs of
the rolled-back system. The one exception is the runbook's own "unsafe
when" clause (a migration already contracted, an irreversible external
side effect): then the roll-forward path it names applies, and choosing
it is a user-challenge decision put to the user with the evidence.

Tiers, from the runbook's bands: green, nothing to do; degraded, diagnose
read-only per the `debugging` skill and write the incident spec, no
production change without it; down, roll back first, confirm the canary
is green on the restored version, then proceed as degraded. Never change
production by hand without a paper trail: a dashboard edit, a flipped
flag, a scaled instance is recorded in the runbook or an ADR in the same
session, or it is config drift the next deploy reverts.

## Incident to spec

Every incident becomes `docs/plans/YYYY-MM-DD-incident-<slug>.md`
(`scaffold incident <that path>`) **before any fix is coded**:
symptom, impact, timeline, immediate action, root cause, fix as goal +
verify steps, prevention. A hotfix without a spec is a side edit, and the
pipeline has no such thing. While the incident plan is `status: active`,
`next` routes every build session to it: an open incident outranks any
planned slice.

The fix runs as a build mini-slice: reproducing test first and frozen
(`tdd`, `debugging`), root cause not symptom, verification, then the two
close commands with `--slice "change: <incident>" --plan <spec>`.
Prevention is part of the spec, not a follow-up: the lesson recorded with
`lessons` (a repeat incident of the same class is by definition a second
occurrence), the mechanical check that would have caught it (a test, a
probe, a canary smoke path, an alert band, or the spec says why none is
possible), and the runbook corrected in the same commit when the incident
proved a band, a command or a contact wrong.

## Post-release security rescan

After each production release, run the runbook's rescan: native
`/security-review` over the release diff when the phase-exit pass did not
already cover those commits, plus the stack's dependency audit. A
high-severity finding is an incident of severity `degraded`; accepting it
instead is a user-challenge decision, never automatic.

## Budgets and evidence

Every check here cites command output: the canary's verdict lines, the
rollback command's result, the reproducing request. "Production looks
fine" is not evidence. The canary and the runbook are the whole input for
a release check; reading the codebase is for the fix, not for the check.
