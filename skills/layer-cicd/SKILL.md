---
name: layer-cicd
description: Use when setting up or changing CI/CD or repo workflow: lint, typecheck, test and build pipeline, branch protection, conventional commits, releases.
---

# Layer: cicd

Production knowledge for CI/CD and repo workflow, stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or onboard (existing repos).

## Production checklist

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
  green before `ship` closes it — verify: the commit history shows one
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
- The deploy job must be separated from the test job, with an environment
  gate protecting production — verify: tests run on every push, but the
  production deploy step requires an explicit approval or protected
  environment, and cannot run from an arbitrary branch.

## Pitfalls

- Tests skipped in CI "temporarily" — the skip is never revisited and
  becomes permanent, silently removing coverage.
- Flaky tests retried-until-green instead of fixed — a flaky test is a
  real bug (race condition, shared state, timing) masked by the retry.
- CI config duplicating commands that drift from the local
  `scripts/verify/` — CI and local runs diverge over time and stop
  meaning the same thing; keep one source of truth and have CI call it.
- Workflow files with inline secrets — the secret leaks through version
  control history even if later removed.
- Unpinned third-party actions or CI plugins — a supply-chain risk, since
  a compromised or changed upstream action runs with the pipeline's
  credentials on the next push.

## How to verify

Run the project's `scripts/verify/` suite locally and confirm CI invokes
the same commands, not a divergent copy. Otherwise probe generically: push
a change with a failing test and confirm the merge is blocked; check the
recorded pipeline duration and confirm it is measured, not guessed;
attempt a direct push to `main` and confirm it is rejected; make a
malformed commit message and confirm it is caught, or confirm the
convention is documented in `CLAUDE.md`; check that the last shipped slice
has exactly one commit with a green CI run; check the latest release tag
against the changelog; compare timing between a cold and a warm CI run to
confirm caching; scan workflow files for inline secret values; confirm the
production deploy step is gated separately from the test job and requires
approval or a protected environment.
