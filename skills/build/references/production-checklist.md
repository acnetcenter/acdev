# Production checklist

Read once per phase, at the phase exit (`phase-exit.md`), never per slice.
Each item is a must with the probe that proves it. An item prefixed with
tags in brackets (`[payments]`, `[multi-tenant]`) applies only when the
project has that trait per its ADRs; untagged items always apply. Check
what the phase touched, run the probe, cite the decisive output; an item
that fails is a finding for the exit, not a silent fix.

## Frontend

- The UI must replicate the frozen mockups exactly, not a reinterpretation
  of them — verify: every screen in the slice matches its approved mockup
  layout, copy and states, per its entry in `mockups/SPEC.md`.
- Visual values must come from the stack's token file, copied from the
  frozen mockups' `mockups/styles.css`, never ad-hoc
  choices — verify: no hardcoded hex colors, pixel spacing, or font sizes
  outside the token file; every value traces to a token.
- Every screen must handle empty, error, and loading states, not only the
  happy path — verify: each of the three states is reachable (empty
  dataset, forced failure, artificial delay) and renders distinct,
  intentional UI.
- [auth] Routing guards must match the permission matrix — verify: a direct URL
  to a route the current role cannot access redirects or returns 403
  instead of rendering.
- Forms must validate client-side for UX AND rely on server validation as
  the source of truth — verify: submitting a payload that bypasses the
  client (e.g. direct API call) is still rejected by the server with the
  same rule.
- Accessibility floor must hold on every interactive screen: labels,
  keyboard navigation, focus management, visible contrast — verify: tab
  through the critical flow start to finish using only the keyboard, with
  each focused element visible and announced.
- State boundaries must separate server state from UI state — verify: no
  server-fetched data is copied into a local/global store without an
  invalidation or refetch path tied to its source.
- Performance budget must hold: routes code-split, images sized for their
  container, no blocking third-party scripts — verify: a bundle report or
  route-level check shows the slice did not add an unsplit chunk or a
  render-blocking script tag.
- [i18n] Copy must be i18n-ready when PRODUCT.md declares multiple languages —
  verify: every user-facing string in the slice resolves through the
  i18n layer, none hardcoded inline.
- Motion must animate transform and opacity only, with ease-out
  entrances and short durations, and respect `prefers-reduced-motion` —
  verify: no `transition: all` or layout-property animation in the
  slice's styles, and the critical flow still works with reduced motion
  enabled.

## API and backend

- Every endpoint must validate input at the boundary against a schema —
  verify: a malformed payload returns 400 with field-level errors, never
  a 500 or an unhandled exception.
- Errors must share a consistent envelope with stable, machine-readable
  codes — verify: a failure from any endpoint in the slice matches the
  project's error shape and code list, not an ad-hoc message string.
- Every list endpoint must paginate from day one — verify: a list endpoint
  backed by 1000+ rows returns a single page with pagination metadata, not
  the entire dataset.
- [payments,external-apis] Mutations with money or external side effects must be idempotent —
  verify: replaying the same request with the same idempotency key
  produces exactly one effect, not two.
- Multi-step writes must be transactional — verify: forcing a failure
  partway through the operation leaves no partial state; a retry or
  rollback restores a consistent state.
- Relation-heavy endpoints must be checked for N+1 queries — verify: query
  count stays constant as the size of the returned list grows, not linear
  with it.
- [jobs] Slow or external work must run in background jobs with retry and a
  dead-letter path — verify: a forced job failure retries per policy and
  lands in the dead-letter queue instead of being silently dropped.
- API evolution must be additive-only or explicitly versioned, and the
  choice recorded in an ADR — verify: the ADR exists and the slice's
  changes comply with it (no breaking change to an unversioned endpoint).
- [external-apis] Outbound calls must have timeouts and retries with backoff — verify: a
  simulated slow or failing dependency does not hang the request past the
  configured timeout, and a transient failure is retried per policy.

## Data

- Every schema change must be a migration, never a manual edit — verify: a
  fresh clone plus running the migrations reproduces the current schema
  exactly.
- Migrations must be reversible or explicitly marked irreversible with a
  documented recovery path — verify: a down migration exists, or the
  irreversible marker and recovery note exist in its place.
- Foreign keys and constraints must live in the database, not only in app
  code — verify: an insert that violates the constraint fails at the DB
  even if the application layer is bypassed.
- Indexes must be justified by real queries — foreign keys and frequent
  WHERE/ORDER BY columns first — verify: EXPLAIN on the hot queries shows
  index use, not a sequential scan.
- [pii] PII columns must be marked with a retention rule, in DATA-MODEL.md
  or in SECURITY.md when the schema lives in code — verify: the table
  listing PII exists and matches the actual schema.
- [pii,compliance] Retention and deletion must be enforced, not only declared: when the
  compliance ADR grants users deletion or a retention window expires, the
  data must actually be erased or anonymized — verify: running the
  deletion path for a test subject removes or anonymizes their rows and
  stored files, and a documented note states how backups age out.
- [multi-tenant] On multi-tenant projects, tenant-owned tables must carry the tenant key
  and it must be non-nullable — verify: inserting a row without a tenant
  key fails at the DB.
- Backups must be automated AND restore must be tested — verify: a restore
  drill note exists; an untested backup is not a backup.
- [uploads] Object storage must be private by default, use signed URLs, and enforce
  size/type limits at upload — verify: a direct unsigned URL to a stored
  object fails.

## Authentication and authorization

- Session/token strategy must match the ADR — server sessions vs
  short-lived JWT plus refresh, never both improvised — verify: inspect
  the running implementation and compare it field by field against the
  ADR — token transport (httpOnly cookie vs Authorization header), token
  lifetime/TTL, and refresh mechanism each match the ADR's documented
  choice, with no second mechanism present alongside it.
- Tokens and sessions must expire and revoke server-side — verify: an
  expired or revoked token returns 401 on a protected route.
- Authorization must be enforced at the API boundary for every route, not
  in the UI — verify: a forbidden role calling the endpoint directly
  (bypassing the UI) gets 403.
- The permission matrix in SECURITY.md must be the source of truth and
  tests must mirror it — verify: at least one test per matrix row exists
  for critical resources.
- [multi-tenant] On multi-tenant projects, the tenant must be resolved from the session
  server-side, never from client input — verify: a forged tenant id in the
  request payload cannot cross tenants.
- Auth flows must be complete: signup, verify, reset, logout-everywhere —
  verify: a password reset token is single-use and expiring.
- Secrets used for auth (signing keys) must be rotated per a documented
  procedure — verify: the rotation procedure exists and names an owner and
  cadence.
- [oauth] OAuth providers must use state and PKCE where applicable — verify: the
  authorization request includes both for the flows that support them.

## Security

- [auth,multi-tenant] Row-level security (or equivalent row filtering) must be active on every
  tenant/user-owned table AND proven by an isolation test — verify: a test
  authenticated as user A queries for user B's rows and gets an empty
  result, and that test exists and runs in CI (not just locally).
- New tables and routes must be default-deny — verify: a table created
  without explicit policies is inaccessible, not open by default; the same
  holds for a new route with no explicit authorization rule.
- Auth endpoints and expensive routes must be rate limited with counters
  in a SHARED store, never per-process memory — verify: two app instances
  (or two requests routed to different processes) share the same limit
  count, and a request past the limit returns 429 with a Retry-After
  header.
- Input must be validated at every trust boundary — verify: a malformed
  or out-of-schema payload is rejected at the API, at webhook receivers,
  at file upload handlers, and at queue consumers, not just at the UI.
- Secrets must live only in env vars or a secret manager, never in the
  repo — verify: a repo-history scan finds no secrets, and `.env.example`
  lists variable names only, with no real values.
- [compliance,pii] Data residency must match the compliance ADR — verify: the regions of
  the database, file storage and backups are listed and each is allowed
  by the ADR's jurisdiction constraints, or the ADR explicitly records
  that residency is unconstrained.
- [deploys] Security headers must be present on the deployed app — verify: the
  response includes Content-Security-Policy, Strict-Transport-Security,
  X-Content-Type-Options, and frame-ancestors (or X-Frame-Options).
- [webhooks] Webhooks must be verified by signature with a replay window — verify: a
  request with a missing or invalid signature is rejected, and a replayed
  valid request outside the allowed time window is rejected too.
- Dependencies must be audited in CI with a triage rule — verify: the CI
  pipeline runs a dependency audit step and a documented rule states who
  triages findings and by when.
- An OWASP Top 10 pass over the permission matrix and injection surfaces
  must happen at each phase exit (this pass) — verify: the phase-exit
  report lists what was checked and what was found.

## Performance and caching

- Only proven-hot reads get cached — verify: the metric or slow query
  that justified each cache exists in a comment or ADR next to the cache
  code, not added speculatively.
- Caches must use cache-aside with explicit invalidation on write, plus a
  TTL as backstop — verify: a write followed immediately by a read shows
  fresh data, and every cache key has a TTL set (no permanent entries).
- Cache keys must include every variance dimension — tenant, locale,
  role — verify: user A never receives user B's cached payload, and a
  request with a different locale or role produces a different cache key.
- [public-web] Static assets must be served through a CDN with immutable hashed
  filenames — verify: asset responses carry long-lived immutable
  cache-control, distinct from the HTML document's cache-control.
- HTML and API responses must be no-store or short private cache unless
  deliberately public — verify: an authenticated response is not served
  from the CDN cache to a different user.
- [deploys] Compression must be enabled — verify: responses carry a
  content-encoding header (gzip or brotli) for compressible content
  types.
- Performance budgets must be stated in the blueprint and checked at
  phase exits — verify: p95 API latency and page weight targets are
  documented, and the latest phase-exit report compares actuals against
  them.
- A missing index gets fixed with an index, not papered over with a
  cache — verify: the query plan for a cached slow query shows a
  sequential scan or missing index was addressed, or a documented reason
  exists for why it wasn't.

## Delivery and hosting

- At least two environments (staging/production) must be configured via
  env, never via code branches — verify: the exact same build artifact
  deploys to both, with only environment variables differing.
- Deploys must be reproducible from a clean checkout, run by CI, never from
  a laptop — verify: the pipeline is the only path that can push to
  staging or production; a manual deploy from a local machine is not
  possible or not permitted.
- Rollback must exist and be TESTED, not assumed — verify: a rollback
  drill was run where deploying version N-1 over a broken N restores
  service, and the drill is recorded in `docs/RUNBOOK.md` with its date,
  the exact command and the time to restore.
- Every deploy must be followed by a release check, not by silence —
  verify: `scripts/verify/canary.mjs` (health, smoke paths, p95 against
  the runbook band) runs after the deploy lands and its green output is
  in the close; a red canary is followed by the rollback command, not by
  a fix on top.
- The runbook's control bands must be numeric and derived from measured
  budgets — verify: every Degraded and Down threshold in
  `docs/RUNBOOK.md` is a number with a window, and the alert that fires
  on it reaches a human channel.
- A health endpoint must be checked by the platform before routing traffic
  — verify: a deploy with a deliberately failing health check is blocked
  from receiving traffic, and the previous version keeps serving.
- [db] Migrations must be coordinated with deploy order, using
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
  Performance and caching) is read from production data, not estimated.
- Log retention must be deliberate: a stated window long enough to debug
  an incident days after it happened, bounded so storage does not grow
  forever — verify: the retention window is configured and recorded, not
  silently left at the platform default.
- The walking-skeleton rule applies: a deploy pipeline must exist from
  slice 1, not be added "at the end" — verify: the first shipped slice
  already deploys through the pipeline to at least one environment, not
  just runs locally.

## CI/CD and repo workflow

- CI must run on every push/PR: lint, typecheck, tests, build, and the
  project's `scripts/verify/` where cheap enough to run on every push —
  verify: a failing test blocks the merge, not just shows a warning.
- The pipeline must stay fast enough to respect, roughly under 10 minutes
  or split into parallel jobs — verify: the current run time is measured
  and recorded, not assumed.
- `main` must be protected: pull requests and green CI required to merge
  — verify: a direct push to `main` is rejected by the platform.
- Conventional commits must be enforced by tooling or, at minimum,
  documented in `CLAUDE.md` — verify: either a commit-lint step rejects a
  malformed commit message, or the convention is written down and
  followed.
- Every slice must map to one commit (the acdev rule), and CI must be
  green before the slice counts as shipped — verify: the commit history shows one
  commit per shipped slice, each with a passing CI run.
- Releases must be tagged with changelog entries — verify: the latest
  release tag has a corresponding changelog entry describing what
  changed.
- CI must cache dependencies — verify: the second run of the same
  pipeline is visibly faster than the first (cache hit), not re-fetching
  everything from scratch.
- Secrets used in CI must come from the platform's secret store, never
  from workflow files — verify: no secret value appears in a workflow
  file, only a reference to the platform's secret store.
- [deploys] The deploy job must be separated from the test job, with an environment
  gate protecting production — verify: tests run on every push, but the
  production deploy step requires an explicit approval or protected
  environment, and cannot run from an arbitrary branch.
