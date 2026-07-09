---
name: layer-data
description: Use when touching the database or storage: modeling, reversible migrations, indexes, PII, backups, object storage.
---

# Layer: data

Production knowledge for database and storage changes, stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or onboard (existing repos).

## Production checklist

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
- PII columns must be marked in DATA-MODEL with a retention rule — verify:
  the table listing PII exists and matches the actual schema.
- On multi-tenant projects, tenant-owned tables must carry the tenant key
  and it must be non-nullable — verify: inserting a row without a tenant
  key fails at the DB.
- Backups must be automated AND restore must be tested — verify: a restore
  drill note exists; an untested backup is not a backup.
- Object storage must be private by default, use signed URLs, and enforce
  size/type limits at upload — verify: a direct unsigned URL to a stored
  object fails.

## Pitfalls

- Soft-delete everywhere by default — adds query complexity and index
  bloat without an actual requirement for it.
- JSON columns as a schema escape hatch — unqueryable and unvalidated,
  pushes structure out of the database's reach.
- UUIDv4 primary keys on huge hot tables without considering locality —
  hurts index and page cache performance at scale.
- "Temporary" tables or columns without an owner — they become permanent
  and nobody removes them.
- Running migrations only forward in dev — the down path silently rots
  until a rollback is needed in production and fails.

## How to verify

Run the project's `scripts/verify/` checks for this layer if present.
Otherwise run the `verify:` probe attached to each checklist item above
directly, scoped to what the current slice touched, and paste the decisive
output lines as evidence.
