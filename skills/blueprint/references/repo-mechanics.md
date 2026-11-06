# Repo mechanics

Reference for `blueprint`: what the repo needs before the first slice can
be built and verified. Produced once, at blueprint.

- `.gitignore` covering secrets and `.env*` files, the standard ignores
  for the stack, and `.acdev/verify-receipt.json` (`acdev init` adds that
  line).
- `.env.example` listing every environment variable an ADR names, with a
  one-line comment each and no real values.
- The test runner wired in, with one trivial passing test: the first
  slice starts with a failing test and needs a runner to fail in.
- A CI skeleton (lint, typecheck, test) that calls the same commands the
  guard config lists, so CI and the local close never drift apart.
- The verification commands, in `.acdev/guard.json`:

  ```json
  { "enabled": true, "verify": ["npm run lint", "npm test"] }
  ```

  In order, cheapest first. From the first slice on, `acdev close` runs
  them and commits only on green, and the guard denies a `git commit`
  made without a green run on the current code. A check worth keeping
  beyond the test suite (a tenant-isolation query, a migration dry run, a
  health curl) is a script under `scripts/verify/` listed there too.
  The same file accepts `allow_before_build`, `protected` and
  `receipt_ignore` globs for a repo with its own conventions.
- For a project that deploys: `acdev scaffold canary
  scripts/verify/canary.mjs`, adjusted to the bands in `docs/RUNBOOK.md`.
  It is the post-deploy release check.
- Evidence: paste `acdev status`. Its guard line names the verify
  commands and the receipt state.
