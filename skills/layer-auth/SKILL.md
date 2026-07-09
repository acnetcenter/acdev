---
name: layer-auth
description: Use when touching authentication or authorization: sessions or JWT, RBAC, multi-tenancy, permission matrix, auth flows.
---

# Layer: auth

Production knowledge for authentication and authorization changes,
stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or onboard (existing repos).

## Production checklist

- Session/token strategy must match the ADR — server sessions vs
  short-lived JWT plus refresh, never both improvised — verify: the
  implementation matches the documented choice, not a mix.
- Tokens and sessions must expire and revoke server-side — verify: an
  expired or revoked token returns 401 on a protected route.
- Authorization must be enforced at the API boundary for every route, not
  in the UI — verify: a forbidden role calling the endpoint directly
  (bypassing the UI) gets 403.
- The permission matrix in SECURITY.md must be the source of truth and
  tests must mirror it — verify: at least one test per matrix row exists
  for critical resources.
- On multi-tenant projects, the tenant must be resolved from the session
  server-side, never from client input — verify: a forged tenant id in the
  request payload cannot cross tenants.
- Auth flows must be complete: signup, verify, reset, logout-everywhere —
  verify: a password reset token is single-use and expiring.
- Secrets used for auth (signing keys) must be rotated per a documented
  procedure — verify: the rotation procedure exists and names an owner and
  cadence.
- OAuth providers must use state and PKCE where applicable — verify: the
  authorization request includes both for the flows that support them.

## Pitfalls

- JWT stored in localStorage — readable by XSS; prefer httpOnly cookies
  per the ADR.
- Role checks sprinkled as scattered string comparisons — drifts from the
  permission matrix over time; centralize the check instead.
- An "admin" flag checked only in the UI — trivially bypassed by calling
  the API directly.
- Long-lived refresh tokens without rotation or reuse detection — a
  leaked token grants indefinite access undetected.
- Permission checks performed after the data load — leaks the resource's
  existence via timing or error content even when access is denied.

## How to verify

Run the project's `scripts/verify/` suite for the auth layer if one
exists. Otherwise probe generically: call a protected route with an
expired or revoked token and confirm 401; call each changed endpoint
directly with a forbidden role and confirm 403; run the matrix-derived
tests for critical resources and confirm one per row passes; send a
forged tenant id in a request payload and confirm no cross-tenant access;
reuse a password reset token twice and confirm the second use fails;
confirm the auth secret rotation procedure is documented; inspect an
OAuth authorization request for state and PKCE parameters where
applicable.
