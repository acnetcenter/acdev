---
date: 2026-09-05
status: shipped
---

# Governance as code, the lessons ratchet, and the operate loop

## Spec (the request, in the user's terms)

A comparison of acdev against Anthropic's AI-Native SDLC Playbook and the
strongest 2026 harnesses and plugins (gstack, Compound Engineering, ECC,
Babysitter, Superpowers) found acdev ahead on product definition, layer
checklists, token discipline and self-evals, and behind on three things
the field now treats as table stakes:

1. **Deterministic enforcement.** acdev's hard rules (zero product code
   before build, red check blocks the close, approved docs are frozen)
   lived in prose, verified by open-book evals. The playbook, gstack,
   ECC and Babysitter all move such rules into hooks or code.
2. **A learning loop.** gstack's `/learn`, Compound's `/ce-compound`,
   ECC's instincts and the playbook's "same mistake twice, one line in
   CLAUDE.md" all ratchet repeated mistakes into rules. acdev recorded
   traps as ADRs only.
3. **Post-deploy operation.** The playbook's Maintain stage and gstack's
   canary, land-and-deploy and retro cover what happens after ship.
   acdev stopped at the commit.

The user asked for all three, implemented to the standard of the best
system in each, without using acdev's own skills to build them.

## Decisions

| Decision | Class | Choice | Reason |
|---|---|---|---|
| Where the guard lives | taste | Copied into the project (`.claude/hooks/acdev-guard.mjs`), configured by `.acdev/guard.json` | Versioned with the repo, works on any machine and for any agent, no dependency on the plugin path |
| Stage source for the guard | mechanical | `.acdev/state.md` | Already the pipeline's state; the pipeline stages now write it at every gate so the ladder is real |
| Product-code detection | taste | Allowlist that grows by stage, not a blocklist of source dirs | A blocklist cannot know every stack's layout; the allowlist names what the pipeline itself produces before build |
| Receipt binding | taste | SHA-256 over `git diff HEAD` plus untracked files, excluding docs, mockups and `.acdev/` | Docs bookkeeping written after the green run must not stale it; code changes must |
| Test protection during a fix | taste | Explicit `freeze` from `debugging`, cleared by `ship`, not inference | A hook cannot know a task is a fix; a declared freeze is auditable and reversible |
| Lessons ledger format | taste | Markdown table in `.acdev/lessons.md`, promotion threshold 2, budget 12 in CLAUDE.md | Human-readable in git, deterministic promotion, keeps the router under one page |
| Operate as a skill vs a section | taste | New pipeline skill `operate` | Incidents and post-deploy checks need their own routing trigger; folding them into `layer-delivery` would misroute "production is down" |
| Incident record | mechanical | A `docs/plans/*-incident-*.md` spec through the existing mini-slice path | Reuses build, ship, CHANGELOG, checkpoint and `status` unchanged |
| Rollback first | user-challenge, confirmed by the request | Roll back before diagnosing when a release is the suspect and the runbook has no unsafe-when clause | Restoring service is the rehearsed path; the alternative is decided by the user with evidence |

## Steps

1. `shared/references/templates/guard-hook.mjs`, `guard-settings.json`,
   `guard.json`; `shared/references/guard-install.md` - verify:
   `node --test tests/guard-hook.test.mjs` green (stage ladder, protected
   docs, freeze, secrets, destructive commands, receipt fresh/stale/red,
   fail-open, off switches, config extension).
2. `scripts/lessons.mjs` - verify: `node --test tests/lessons.test.mjs`
   green (candidate, promotion, mirror identity, idempotency, budget
   warning, pipe safety, usage errors).
3. `skills/operate/SKILL.md`, `shared/references/templates/runbook.md`,
   `canary-stub.mjs`, `incident.md`; docs catalog and index rows - verify:
   `node scripts/lint-budgets.mjs` OK.
4. Pipeline skills write state at every gate (`new-project`, `mockups`,
   `blueprint`); `build` carries the guard rule and the rollback in the
   walking skeleton; `ship` runs `verify` through the guard, adds the
   Lessons gate, the release check and the phase-1 rollback criterion;
   `debugging` freezes the failing test and records the lesson;
   `verifying`, `status`, `onboard`, `layer-delivery`, the router
   template and the gateway updated - verify: lint OK, gateway under
   1,600 characters.
5. Gate cases for the four new hard rules and routing cases for `operate`
   - verify: `npm run evals -- --dry-run` constructs every prompt.
6. README (stage map, 22 skills, ledger, Governance as code section),
   CHANGELOG, spec amendment - verify: lint OK (README drift check).
7. `node --test` and `node scripts/lint-budgets.mjs` green; commit; push.
