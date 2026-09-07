---
date: 2026-09-06
status: active
---

# Token-cost findings: wire the cheap tier, cap the loop, stop retyping

## Spec (the request, in the user's terms)

A verified review of where acdev spends tokens (35 findings, each
checked by an adversarial pass against the tree) concluded that the
fixed per-session cost is at the floor and the remaining gap, 30 to 50
percent of a slice, sits inside construction: subagents inherit the
session model because the oracle rule is prose only; the pack is
retyped as orchestrator output into every subagent prompt and the
template names a binary that does not exist; the headless loop has no
budget cap, orphans its process on Windows and documents a permission
mode that cannot run `node`; every fresh context re-reads what the pack
already distilled; the quiet runner's red path is two thirds noise; the
cost ledger omits cache reads. The user ordered the findings implemented
in the review's order, starting with `slice-guide.md` and `run.mjs`,
without losing quality, functionality, advantages or capabilities.

Guardrails that do not move: the hard gates paste the full document;
`using-acdev` stays model-invocable (Node-less fallback); session
persistence stays on in headless runs; the phase-exit pass keeps the
full-phase diff and two lenses; lesson promotion stays deterministic;
the eight layer directories and descriptions stay until routing is
measured; never `--bare` in headless.

## Decisions

| Decision | Class | Choice | Reason |
|---|---|---|---|
| How the tier reaches the Agent tool | taste | Two shipped agents, `agents/acdev-builder.md` (haiku) and `agents/acdev-builder-capable.md` (inherit), named by `subagent_type` in the template | Configuration, not memory; no tools list so MCP servers such as context7 stay available |
| Budget cap default | taste | Twice the ledger's median iteration cost, never below 5 USD; `--budget-usd 0` disables | A normal slice never trips it; a looping one is bounded |
| Timeout on Windows | mechanical | Async spawn plus `taskkill /pid /t /f` at the timer, as `run-evals.mjs` already does | `spawnSync` kills the shim and orphans claude |
| Isolation defaults | taste | `--exclude-dynamic-system-prompt-sections` always; `--strict-mcp-config --mcp-config` only when `.acdev/headless-mcp.json` exists or `--mcp-config` is given; `--no-isolate` opts out | Cache reuse costs nothing; dropping every MCP server would break projects that need one |
| Permissions for headless | mechanical | `permissions.allow` with `Bash(node *)` and `Bash(git *)` in the guard settings template; documented in continuous, help and its mirror | `acceptEdits` cannot run the steps' own commands |
| Ledger fields | mechanical | `total_tokens`, `fresh_tokens`, `model_usage`, `budget_usd` per entry; `cost` prints total, fresh, out and the per-model share with the budget suite's definitions | The old in+out figure omitted the dominant term |
| Version mismatch | taste | `run` warns when the installed acdev version differs from the CLI's; never refuses | An overnight batch must not stall on patch drift |

## Steps

1. Subagent template and tiers: `slice-guide.md`, `build-construct.md`, `build-plan.md`, `agents/*.md`, `continuous.md` (threshold, permissions, effort, isolation) - verify: `node --test` green, `node scripts/lint-budgets.mjs` green (steps under 1,500 chars).
2. Headless loop: `run.mjs` (budget, tree kill, isolation, ledger fields, version warning), `cost.mjs`, `acdev.mjs` usage, `guard-settings.json`, `guard-install.md`, fake `claude` modes `budget` and `hang` - verify: `tests/run.test.mjs` covers the cap, the timeout kill, the dry-run flags and the ledger fields.
3. Project router and quiet runner: `claude-md-router.md` read list and verification; `quiet.mjs` and the guard's `condense()` with vendor-frame filtering and tail dedupe; parity test - verify: `tests/quiet.test.mjs`, `tests/guard-quiet-parity.test.mjs`.
4. Turns: `acdev.mjs status`, absolute reference paths in steps with a lint check, `drift` with matching lines, the per-prompt line, the SessionStart matcher, lessons budget enforced at close - verify: tests per command, lint green, budget eval ceiling for status lowered.
5. Layer skills as stubs with the checklist in `references/checklist.md`; `checklist.mjs` and the lint follow - verify: lint green, `checklist` output unchanged.
6. Output: `scaffold`, mockups by copy and edit, blueprint presentation as a list, adversarial review by paths, AGENTS.md by copy at close, SITUATION and UI-DESIGN caps, VISION and MVP edited per section - verify: tests for scaffold and close, lint green.
7. Phase-exit denylist and diff reuse; pre-build bodies thinned by classification with required phrases in the lint - verify: lint green, gate evals dry-run builds every prompt.
8. Eval judges with `--safe-mode`; budget suite calibrated once the installed plugin is 0.3.0 - verify: `tests/run-evals.test.mjs` green; the calibration run is the user's.
