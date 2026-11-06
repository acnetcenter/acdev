---
date: 2026-11-05
status: shipped
---

# Thin rework: keep what the model cannot do from inside, PRODUCT.md as the source of truth

## Spec (the request, in the user's terms)

"Update this project completely. VISION.md becomes PRODUCT.md. But first
research how it should work with the current models (Fable 5.1, Opus
5.5): much of what this project does the models now do from inside,
without spending tokens routing it through the plugin."

The research (repo audit, 74 real pilot sessions measured, official docs
for Claude Code and the Claude 5 prompting guides) found:

- acdev's injected text is 5.6 percent of context growth in the heaviest
  pilot; 71 percent of processed tokens were spent on turns above 400k of
  context. The cost is context size per turn, which the plugin did not
  attack.
- Never used in 74 sessions: 7 of 8 layer skills, `verifying`, the cheap
  builder agent, `run`, `cost`. No lesson was ever promoted. The guard was
  not installed in the two projects where the work happens.
- Anthropic's guides say legacy skills are often too prescriptive for
  these models and that explicit verification steps cause over-verifying
  on large models (and are still needed on small ones at low effort).

The user approved the recommended design.

## Goal and verify steps

1. `docs/PRODUCT.md` replaces `docs/VISION.md`, in the schema the
   acfrontend plugin already writes (Impeccable's), plus `## Model` and
   `## Critical Flows`. Verify: `scaffold product docs/PRODUCT.md` writes
   it; lint fails on a stray `VISION` outside legacy notes.
2. Six skills: `new-project`, `onboard`, `mockups`, `blueprint`, `build`,
   `status`. Process skills, layer skills, the gateway, `ship`, `operate`
   and both agents are deleted. Verify: lint counts 6; README table
   matches.
3. The guard is a plugin-level PreToolUse hook (`hooks/guard.mjs`) with
   three rules: no product code before build, approved documents ask,
   commit in build needs a green receipt. Nothing is copied into the
   project. Verify: `tests/guard.test.mjs`.
4. CLI on PATH as `acdev` (`bin/`): `status`, `checkpoint`, `q`, `verify`,
   `close`, `scaffold`, `mockup-spec`, `drift`, `migrate`. Removed: `next`
   and its steps, `pack`, `checklist`, `run`, `cost`, `lessons`. Verify:
   `node --test`.
5. `acdev migrate` moves an existing project over (dry run by default):
   `git mv docs/VISION.md docs/PRODUCT.md`, path references, stage
   `vision` to `product`, the per-project guard copy removed. A project
   not yet migrated keeps working: readers fall back to `docs/VISION.md`.
   Verify: `tests/migrate.test.mjs`.
6. SessionStart prints one or two lines (stage, next step, CLI path) and
   only inside an acdev project; the per-prompt hook is gone. Verify:
   `tests/hook.test.mjs`.
7. The slice close is a context cut point: `close` ends by saying the
   state is on disk and the next slice starts cheaper in a fresh session.
8. Evals move to the native `claude plugin eval` layout; the custom
   runner and its cases are deleted.
9. README, `docs/help.md` and its Spanish mirror, CHANGELOG, version
   0.5.0. Verify: `node scripts/lint-budgets.mjs` green.

## Decisions

| Decision | Class | Choice | Reason |
|---|---|---|---|
| PRODUCT.md location | Taste | `docs/PRODUCT.md` | Where acfrontend already writes it; Impeccable reads `docs/` |
| acdev sections in PRODUCT.md | Taste | Appended after Impeccable's, order untouched | Keeps the shared schema readable by both plugins |
| MVP cut | Mechanical | Stays in `docs/MVP.md`; OUT list carries the phase sketch | PRODUCT.md is durable fact, not a delivery cut |
| Stage id | Taste | `product` replaces `vision`; `vision` read as an alias | Matches the document; old state files keep working |
| Freeze, secrets, destructive and inline-node guard rules | Taste | Dropped | Zero uses in the pilots; permission modes cover destructive commands |
| Layer checklists | Taste | One `production-checklist.md` read at the phase exit | A single fresh review at the end, per the model guides |
| Lessons ledger | Mechanical | Dropped in favour of native auto memory | 9 candidates, 0 promotions |
| Profile tags | Mechanical | Dropped with `pack` and `checklist` | Their only readers are gone |
| Gateway and layer skills | User-challenge | Deleted | Reopens the 2026-09 decision on the new usage data; approved by the user on 2026-11-05 |

## Verified after review

Headless `claude -p` could not authenticate on this machine, so the real
CLI was driven against a local fake of the Messages API with scripted
tool calls. Confirmed: `bin/` on the Bash tool's PATH, a plugin-level deny
under bypass mode, the session line and the skills reaching the model.
Found and fixed: a hook's `ask` does nothing in bypass mode (now a deny
plus `acdev allow`), and the PowerShell tool does not get `bin/` (the
session line and the skills give the `node` form). The native evals still
need a signed-in Claude Code on macOS, Linux or WSL2.
