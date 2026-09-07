---
name: layer-delivery
description: Use when working on hosting, deployment or environments: deploy with rollback, health checks, config and secrets per environment, minimal observability.
---

# Layer: delivery

Production knowledge for hosting, deployment, and environments, stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or have the user run /acdev:onboard (existing
repos).

Hard gate: before any advice or verdict on this layer you MUST run
`node "<plugin-root>/scripts/acdev.mjs" checklist --layers delivery --pitfalls`
and cite its output. That output is this skill, filtered by
`.acdev/profile.json` (code-formatted); do not open the checklist file:
the command is the only way it enters context. During build the pack,
run with `--pitfalls`, already carries it: any context whose slice pack
already printed this layer checklist (a subagent, or the orchestrator
building a layer inline) cites that output instead of re-running the
command.

## How to verify

Run the project's `scripts/verify/` checks for this layer if present.
Otherwise run the `verify:` probe attached to each checklist item
directly, scoped to what the current slice touched, and paste the decisive
output lines as evidence.
