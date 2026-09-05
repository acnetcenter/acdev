# Incident spec template

An incident is a user-requested change the production system requested.
It gets the same paper trail as any other change: a spec in
`docs/plans/YYYY-MM-DD-incident-<slug>.md`, written before any fix is
coded, then a mini-slice through build and a close through ship. Fill
every section; a missing fact is asked or declared as a gap, never
invented.

```markdown
---
date: YYYY-MM-DD
status: active
kind: incident
severity: <down | degraded>
---

# Incident: <one line, in the user's terms>

## Symptom

What was observed, verbatim where possible: the alert text, the failing
canary line, the user report. When it started (timestamp, timezone).

## Impact

Who could not do what, for how long. Numbers where they exist (failed
requests, affected tenants, orders lost); "unknown" is a valid value,
"probably nobody" is not.

## Timeline

| Time | Event |
|---|---|
| <HH:MM> | <deploy of <sha> landed / alert fired / rollback started / service restored> |

## Immediate action

Rolled back to <version> at <time> per RUNBOOK, or why rollback was
unsafe and what was done instead (a user-challenge decision, recorded
with the user's answer).

## Root cause

Found per the debugging skill: reproduced, hypotheses ranked, evidence.
The cause, not the symptom. Link the reproducing test.

## Fix

Goal + verify steps, per the planning skill:

1. <do X> - verify: <exact command or observable check>
2. ...

| Decision | Class | Choice | Reason |
|---|---|---|---|

## Prevention

- Lesson recorded: `node "<plugin-root>/scripts/lessons.mjs" add ...`
  (candidate #N, or promoted when a previous candidate matched).
- Mechanical check added: <test or scripts/verify/ probe that fails if
  this class of incident recurs>, or why none is possible.
- RUNBOOK changes: <band, alert or command corrected, in this commit>.
```
