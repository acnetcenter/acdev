# Layer auth: checklist

## Production checklist

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
