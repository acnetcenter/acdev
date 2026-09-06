---
date: 2026-09-06
status: shipped
---

# Cost-first: fewer turns, smaller contexts, cheaper models, same gates

## Spec (the request, in the user's terms)

An expert review of where acdev's tokens actually go concluded that the
plugin optimizes the wrong variable. The fixed cost per session (about
1.1k tokens) is measured and guarded, but an agent's bill is dominated by
three unmanaged things: the number of turns (every tool call resends the
whole context), the size of that context, and output tokens. Three
structural choices inflate them: pipeline logic lives in prose the model
loads and rereads, the document catalog and the drift rule maintain
artifacts nobody consumes, and every procedure runs as a chain of loose
commands.

The user ordered all ten recommendations applied, without losing quality,
advantages or capabilities:

1. One command per procedure (the slice close in two commands).
2. A step dispenser instead of long pipeline skill bodies.
3. A thin orchestrator with fresh contexts per slice.
4. Every command's output filtered before it enters the context.
5. Model chosen by oracle, not by stage.
6. The document catalog pruned with evidence; drift candidates by script.
7. Mockups with a compact spec that build reads instead of the HTML.
8. Layer checklists filtered by the project's profile tags.
9. Size caps on every template; the per-prompt hook line cut to a stage.
10. A cost ledger per slice and a budget eval.

Quality guardrails that do not move: the gates, evidence before claims,
TDD, ADRs, the guard, the layer checklists. User-challenge decisions are
never delegated; the phase-exit security pass always runs on the most
capable model; every skill keeps one line of rationale per rule.

## Decisions

| Decision | Class | Choice | Reason |
|---|---|---|---|
| Where the new commands live | taste | One plugin CLI, `scripts/acdev.mjs <command>`, with modules under `scripts/lib/` | One entry point to learn; `checkpoint.mjs` and `lessons.mjs` stay as they are and are reachable as subcommands |
| Pipeline skills keep their descriptions | taste | Bodies become thin, descriptions stay model-invocable | Auto-activation and the routing evals depend on descriptions; dropping them would remove a capability |
| Step dispenser source | taste | Markdown step files under `scripts/steps/`, one per situation, each under 1,500 characters, lint-checked | Editable like a skill, loaded one at a time, budget enforced |
| Close needs verification | mechanical | `close` runs the guard's verify (or the `verify` commands in `.acdev/guard.json`), red aborts; unconfigured warns, as the guard already does | Same policy as the hook; no new escape hatch |
| Close commits without the hook | mechanical | `close` runs `git commit` itself after its own green run; the model's direct commits still go through the hook | The verify inside the same command is the receipt; nothing is bypassed |
| Drift candidates | taste | Docs mentioning a changed file's path or basename, plus ROADMAP always | Deterministic, cheap, over-inclusive rather than silent |
| Profile tags | taste | `.acdev/profile.json` with a `tags` list; a checklist item marked `[tag]` applies only when the profile carries the tag; no profile means everything applies | Safe default; filtering is opt-in per project |
| Mockup spec | taste | `mockups/SPEC.md`, skeleton extracted by script from the HTML, intent lines completed by the model at the freeze | The HTML stays the human contract; the spec is what build reads |
| Continuous mode | taste | A headless outer loop (`acdev run`), one fresh session per slice, cost recorded per iteration | Cheaper and more robust than a Stop hook; continuous mode is non-interactive by definition |
| Language of machine artifacts | user-challenge | Unchanged: the project's documentation language, per the sticky `language` field | Flipping it saves tens of tokens per checkpoint and contradicts a decision the user made deliberately; left to the user |
| Catalog pruning | taste | INTEGRATIONS folded into ADRs plus RUNBOOK; DATA-MODEL only when the schema is not code; caps per document | Evidence: no skill reads INTEGRATIONS during build |

## The CLI contract

```
node "<plugin-root>/scripts/acdev.mjs" next [--change "topic"]
node "<plugin-root>/scripts/acdev.mjs" pack [--screens a,b] [--layers api,data]
node "<plugin-root>/scripts/acdev.mjs" checklist --layers api,data [--pitfalls]
node "<plugin-root>/scripts/acdev.mjs" q [--tail N] [--full] -- <command>
node "<plugin-root>/scripts/acdev.mjs" drift
node "<plugin-root>/scripts/acdev.mjs" close --check
node "<plugin-root>/scripts/acdev.mjs" close --slice "n: name" --plan <path> --next "<text>" --changelog "<text>" [--message "<conventional commit>"]
node "<plugin-root>/scripts/acdev.mjs" mockup-spec [--write]
node "<plugin-root>/scripts/acdev.mjs" run [--max-slices N] [--model M] [--claude <cmd>] [--extra "<flags>"] [--prompt "<text>"] [--dry-run]
node "<plugin-root>/scripts/acdev.mjs" cost [--json]
node "<plugin-root>/scripts/acdev.mjs" checkpoint read|write ...
node "<plugin-root>/scripts/acdev.mjs" lessons ...
```

## Steps

1. Plugin CLI and modules: `scripts/acdev.mjs`, `scripts/lib/{project,quiet,next,pack,checklist,drift,close,mockup-spec,run,cost}.mjs`, step files under `scripts/steps/` — verify: `node --test` green with new tests per module (fixtures: a git project with `guard.json` verify commands, ADRs, ROADMAP, checkpoints, mockups HTML, a fake `claude` command).
2. Guard template: `verify` prints verdict lines and a tail, full output on red or with `--full` — verify: `tests/guard-hook.test.mjs` covers green and red output shapes.
3. Hook line: `hooks/prompt-context.mjs` prints the stage and the `next` command only — verify: `tests/prompt-context.test.mjs` updated and green.
4. Skills: `build`, `ship`, `operate` thin and pointing at the dispenser; `tdd`, `verifying`, `debugging` use the quiet runner; `blueprint` writes the profile and moves repo mechanics to a reference; `mockups` writes the spec at the freeze; `planning` caps plans; layer skills carry tags; references and templates updated — verify: `node scripts/lint-budgets.mjs` green with the lowered budgets; `node scripts/run-evals.mjs --dry-run` builds every prompt.
5. Lint: body budget 8,000 characters, step files 1,500, README ledger recomputed — verify: lint green, CI matrix unchanged.
6. Docs: README, `docs/help.md` and `docs/help.es.md` (same structure), CHANGELOG line — verify: lint's mirror check green.
7. Budget eval: `evals/budget.cases.json` plus the `budget` suite in `run-evals.mjs` — verify: `node --test tests/run-evals.test.mjs` with a fake judge that prints a headless JSON result.
