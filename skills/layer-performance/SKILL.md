---
name: layer-performance
description: Use when working on caching or performance: cache-aside and invalidation, TTLs, CDN, compression, performance budgets.
---

# Layer: performance

Production knowledge for caching and performance changes, stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or onboard (existing repos).

## Production checklist

- Only proven-hot reads get cached — verify: the metric or slow query
  that justified each cache exists in a comment or ADR next to the cache
  code, not added speculatively.
- Caches must use cache-aside with explicit invalidation on write, plus a
  TTL as backstop — verify: a write followed immediately by a read shows
  fresh data, and every cache key has a TTL set (no permanent entries).
- Cache keys must include every variance dimension — tenant, locale,
  role — verify: user A never receives user B's cached payload, and a
  request with a different locale or role produces a different cache key.
- Static assets must be served through a CDN with immutable hashed
  filenames — verify: asset responses carry long-lived immutable
  cache-control, distinct from the HTML document's cache-control.
- HTML and API responses must be no-store or short private cache unless
  deliberately public — verify: an authenticated response is not served
  from the CDN cache to a different user.
- Compression must be enabled — verify: responses carry a
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

## Pitfalls

- Caching to hide an N+1 query — masks the real cost and multiplies it
  under load; fix the query instead of caching its output.
- Invalidating by "wait for TTL" on user-visible writes — the UI shows
  stale data until expiry and users file bug reports; invalidate on write.
- Per-process in-memory caches behind a load balancer — different
  instances serve different answers for the same request; use a shared
  store or accept the inconsistency explicitly.
- Caching error responses — a transient failure gets served to every
  subsequent request until the TTL expires, amplifying an outage.
- Forgetting Vary/tenant in cache keys — the worst failure mode of this
  layer: one user's cached response leaks to another user, a data leak
  rather than a performance bug.

## How to verify

Run the project's `scripts/verify/` suite for the performance layer if
one exists. Otherwise probe generically: check each cache site for a
comment or ADR link naming the metric or slow query that justified it;
write then immediately read a cached value and confirm freshness, and
confirm every cache key has a TTL; request the same cached endpoint as
two different tenants/locales/roles and confirm distinct results; inspect
cache-control headers on a static asset versus the HTML document; request
an authenticated page twice from different sessions and confirm no
cross-user cached response; inspect the content-encoding header on a
compressible response; compare current p95 latency and page weight
against the budgets stated in the blueprint; check the query plan behind
any cache added for a slow query.
