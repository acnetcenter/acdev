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

## Production checklist

- At least two environments (staging/production) must be configured via
  env, never via code branches — verify: the exact same build artifact
  deploys to both, with only environment variables differing.
- Deploys must be reproducible from a clean checkout, run by CI, never from
  a laptop — verify: the pipeline is the only path that can push to
  staging or production; a manual deploy from a local machine is not
  possible or not permitted.
- Rollback must exist and be TESTED, not assumed — verify: a rollback
  drill was run where deploying version N-1 over a broken N restores
  service, and the drill is recorded.
- A health endpoint must be checked by the platform before routing traffic
  — verify: a deploy with a deliberately failing health check is blocked
  from receiving traffic, and the previous version keeps serving.
- Migrations must be coordinated with deploy order, using
  expand-migrate-contract for breaking schema changes — verify: during the
  rollout window, the old code version runs correctly against the new
  schema before the old columns/fields are removed.
- Secrets must be stored per environment in the platform's secret store,
  never in code or shared across environments — verify: staging and
  production hold different secret values, and no secret appears in the
  repo or in a config file committed to it.
- Observability must meet a minimum bar: structured logs carrying request
  and tenant ids, error tracking wired up, and one uptime alert reaching a
  human channel — verify: a forced test error appears in the error
  tracker and triggers the alert.
- Alerting must cover degradation, not only downtime: an error-rate spike
  reaches a human even while the health check stays green — verify: a
  burst of forced errors short of a total outage triggers the alert.
- Production latency must be measured, not assumed: p95 per route or per
  critical flow is visible in the platform or derivable from the logs —
  verify: the p95 the phase exit compares against its budget (see
  layer-performance) is read from production data, not estimated.
- Log retention must be deliberate: a stated window long enough to debug
  an incident days after it happened, bounded so storage does not grow
  forever — verify: the retention window is configured and recorded, not
  silently left at the platform default.
- The walking-skeleton rule applies: a deploy pipeline must exist from
  slice 1, not be added "at the end" — verify: the first shipped slice
  already deploys through the pipeline to at least one environment, not
  just runs locally.

## Pitfalls

- Config drift: a value edited directly in the hosting dashboard and never
  recorded — the next deploy from CI silently reverts it, or nobody knows
  it exists; record every config value as an ADR or in versioned env docs.
- Migrations set to auto-run on boot of every instance — concurrent
  instances race to apply the same migration; run migrations as a single
  explicit deploy step instead.
- "Roll forward only" adopted as an unexamined default — an incident
  drags on while a fix is written, when a tested rollback would have
  restored service in minutes.
- Logs without correlation ids — an incident spanning multiple services or
  requests becomes undebuggable because log lines cannot be tied together.
- Staging pointing at production services (database, payment provider,
  email sender) — test traffic corrupts real data or sends real
  notifications to real users.

## How to verify

Run the project's `scripts/verify/` checks for this layer if present.
Otherwise run the `verify:` probe attached to each checklist item above
directly, scoped to what the current slice touched, and paste the decisive
output lines as evidence.
