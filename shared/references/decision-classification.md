# Decision classification

Every decision made during `blueprint` and `build` falls into exactly one
of three classes. The class determines whether the user is interrupted for
it, and whether it shows up in the audit table presented alongside the
work.

## Mechanical

One correct answer exists; there is nothing to prefer between options
because there is effectively only one reasonable option. Auto-decided
silently — it does not even need to appear in the audit table.

Examples:

1. Deduplicating a lockfile after a dependency install.
2. Adding an index on a foreign key that is queried but unindexed.
3. Applying the project's formatting config (prettier/eslint/etc.) to
   newly generated files.
4. Fixing an import path broken by a file move.
5. Pinning a dependency to the version already used elsewhere in the
   project, to avoid two versions of the same library.

## Taste

Several valid options exist, all with low reversal cost. Auto-decided, but
shown in the audit table so the user can see and, if they want, override
the choice after the fact.

Examples:

1. Folder naming convention (`utils/` vs `helpers/`) when the project has
   not already established one.
2. Choosing between two equivalent libraries for a minor, swappable
   concern (e.g. `date-fns` vs `dayjs` for date formatting).
3. Error message copy tone (terse vs. explanatory), when no style guide
   dictates it.
4. Variable/function naming style within an already-chosen convention.
5. Ordering of independent config keys or environment variables in
   `.env.example`.

## User-challenge

Anything touching money, security posture, data model shape, product
behavior, vendor lock-in, or with more than one day of reversal cost if it
turns out wrong. Never auto-decided — the decision is put to the user as
an explicit question, and the pipeline waits for their answer before
proceeding.

Examples:

1. Which payment processor to integrate, or how refunds are handled.
2. The tenant isolation strategy (row-level security vs. schema-per-tenant
   vs. database-per-tenant).
3. The shape of a core data model entity that many features will build on.
4. Choosing a hosting provider or database vendor that is expensive to
   migrate away from later.
5. Any change to what the product does or promises the user (a feature's
   actual behavior, not its implementation).

## When in doubt

When a decision sits between two classes, escalate to the higher one
(mechanical < taste < user-challenge). Misclassifying a user-challenge
decision as taste is the one unrecoverable error of this system — a
product decision auto-taken and buried in a table instead of asked. A
cheap tell: if the Reason for a mechanical or taste row takes more than
one sentence to justify, it probably belongs a class higher.

## Audit table format

Every plan document — the blueprint summary, and later every `build` slice
plan — carries a table of every mechanical and taste decision made along
the way, in this exact format:

```
| Decision | Class | Choice | Reason |
```

User-challenge decisions do not belong in this table as auto-decided rows
— they are asked and answered explicitly in the conversation, then
recorded (e.g. as an ADR) with the user's actual answer, not silently
resolved and logged after the fact.
