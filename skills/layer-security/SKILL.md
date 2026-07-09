---
name: layer-security
description: Use when touching security-sensitive code: row-level security verified with tests, rate limiting on a shared store, input validation, secrets, headers, OWASP.
---

# Layer: security

Production knowledge for security-sensitive changes, stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or onboard (existing repos).

## Production checklist

- Row-level security (or equivalent row filtering) must be active on every
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
- Security headers must be present on the deployed app — verify: the
  response includes Content-Security-Policy, Strict-Transport-Security,
  X-Content-Type-Options, and frame-ancestors (or X-Frame-Options).
- Webhooks must be verified by signature with a replay window — verify: a
  request with a missing or invalid signature is rejected, and a replayed
  valid request outside the allowed time window is rejected too.
- Dependencies must be audited in CI with a triage rule — verify: the CI
  pipeline runs a dependency audit step and a documented rule states who
  triages findings and by when.
- An OWASP Top 10 pass over the permission matrix and injection surfaces
  must happen at each phase exit — verify: the phase-exit checklist or
  report references this pass and lists what was checked.

## Pitfalls

- RLS enabled but the app queries through a service-role/admin client —
  bypasses row-level security silently; app code must use the
  policy-constrained client for user-facing queries.
- Rate limiting only at the edge/CDN while the origin is directly
  reachable — an attacker who hits the origin skips the limit entirely.
- CORS configured with `*` alongside credentials — allows any origin to
  make authenticated requests on behalf of the user.
- SSRF via user-supplied URLs in fetchers, importers, or webhook
  registration — an attacker points the server at internal
  infrastructure; validate and restrict outbound targets.
- Error messages leaking internals (stack traces, SQL, file paths) to
  clients — hands attackers a map of the system; return generic errors
  and log details server-side.

## How to verify

Run the project's `scripts/verify/` suite for the security layer if one
exists. Otherwise probe generically: authenticate as user A and query for
user B's rows, confirming the RLS isolation test exists and runs in CI
with an empty result; create a table or route with no policy and confirm
it denies access rather than allowing it; hit an auth or expensive route
past its limit from two different app instances or processes and confirm
a shared count and a 429 with Retry-After; send malformed input to the
API, a webhook, an upload handler, and a queue consumer and confirm each
rejects it; scan git history for secrets and confirm `.env.example` has
names only; inspect response headers on the deployed app for CSP, HSTS,
X-Content-Type-Options, and frame-ancestors; send a webhook request with
a bad signature and a replayed old signature and confirm both are
rejected; confirm CI runs a dependency audit with a documented triage
owner; confirm the most recent phase-exit report includes an OWASP Top 10
pass.
