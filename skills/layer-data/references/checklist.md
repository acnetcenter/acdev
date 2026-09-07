# Layer data: checklist

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
