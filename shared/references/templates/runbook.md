# Runbook template

Fill every section below when generating the project's `docs/RUNBOOK.md`
at blueprint time (only for projects that deploy somewhere users reach).
It is the operating contract `operate` reads after every deploy and on
every incident: exact URLs, exact commands, numeric bands. A runbook
that says "check the dashboard" is a placeholder, not a runbook. Cap:
about 100 lines; numbers and commands, not prose.

```markdown
# Runbook

Derived from [VISION.md](VISION.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
Read by the operate skill after each deploy and on any incident. Repo
reality wins: a band or a command proven wrong is corrected here in the
same commit that proved it.

## Service map

| Environment | URL | Health endpoint | Deploys from |
|---|---|---|---|
| staging | <url> | <url>/health | <branch or pipeline> |
| production | <url> | <url>/health | <branch or pipeline> |

Error tracker: <where errors land>. Logs: <where, retention window>.
Metrics: <where p95 and error rate are read>.

## Deploy

How a change reaches production: <pipeline name, trigger, approval>. Who
authorizes a production deploy: <role or person>. Migrations run as
<explicit step, expand-migrate-contract for breaking changes>.

## Rollback

The most rehearsed path in this document.

- Command: `<exact rollback command or platform action>`
- Time to restore service: <minutes, measured in the last drill>
- Last rehearsed: <YYYY-MM-DD, environment, outcome>
- Unsafe when: <a migration has already contracted the schema, or other
  irreversible step>. Roll-forward path in that case: <what to do>.

## Control bands

Thresholds come from the phase budgets in ROADMAP.md and
layer-performance; measured, not guessed.

| Signal | Green | Degraded (diagnose, read-only) | Down (roll back first) |
|---|---|---|---|
| Availability (health endpoint) | 200 within <n> ms | one failed probe in <window> | two consecutive failed probes |
| Error rate | < <x>% over <window> | >= <x>% | >= <y>% or any 5xx storm |
| p95 latency, <critical route> | < <n> ms | >= <n> ms | >= <m> ms |
| <business signal, e.g. checkouts per hour> | >= <n> | < <n> | 0 for <window> |

## Canary

`scripts/verify/canary.mjs` runs after every deploy. It reads:

- `CANARY_BASE_URL`: the environment's base URL
- `CANARY_HEALTH_PATH`: health endpoint path (default `/health`)
- `CANARY_SMOKE_PATHS`: comma-separated paths that must return 2xx
- `CANARY_P95_BUDGET_MS`: the p95 band above for the smoke paths
- `CANARY_SAMPLES`: latency samples per path (default 20)
- `CANARY_ERROR_RATE_CMD`: optional command printing the current error
  rate as a number; compared against `CANARY_ERROR_RATE_MAX`

Green means every check passed; red means roll back per the section
above, then diagnose.

## Alerts

| Alert | Fires when | Reaches |
|---|---|---|
| downtime | health probe fails <n> times | <channel> |
| degradation | error rate >= <x>% while health is green | <channel> |
| latency | p95 of <route> >= <n> ms for <window> | <channel> |

## Escalation

Who is on call and how to reach them: <name, channel>. What they can do
without a second person: <rollback, disable a feature flag, scale up>.
What needs a user-challenge decision: <data fixes, refunds, anything
touching money or security posture>.

## Post-release security rescan

After each production release: native `/security-review` over the
release diff (`git diff <previous release tag>..HEAD`), plus the stack's
dependency audit (`<npm audit / pip-audit / cargo audit / ...>`). A high
finding becomes an incident spec.

## Incident log

Incidents are specs in `docs/plans/` named `YYYY-MM-DD-incident-<slug>.md`,
with `status:` marking whether the fix shipped. Nothing is listed here
by hand; the folder is the log.
```
