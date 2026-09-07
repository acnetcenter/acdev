# Layer api: checklist

## Production checklist

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

## Pitfalls

- Business logic in controllers/handlers — makes the logic untestable
  without spinning up the full HTTP stack.
- Returning ORM entities directly — leaks internal fields to clients;
  use explicit DTOs shaped for the response contract instead.
- Catching exceptions to log-and-continue — swallows failures and leaves
  the system in a corrupt, undetected state.
- Pagination added "later" — becomes a breaking change once clients
  already depend on receiving the full list.
- Retry without idempotency — turns a transient failure into a duplicated
  effect (double charge, double email, double write).
