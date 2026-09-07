# Repo mechanics

Reference for `blueprint`: the mechanical scaffolding a project needs
before build starts. Everything here is produced at blueprint, once, and
verified by the guard's `status` output.

- `.gitignore` covering secrets and `.env*` files, the standard ignores
  for the chosen stack, and the guard's session state
  (`.acdev/verify-receipt.json`, `.acdev/freeze.json`, `.acdev/cost.jsonl`).
- `.env.example` listing every environment variable named in any ADR,
  with a one-line comment on what each one is for and no real values.
- A CI skeleton (lint, typecheck, test jobs) matching the chosen stack,
  calling the same commands `.acdev/guard.json` lists, so CI and the
  local close never drift apart.
- `scripts/verify/`, scaffolded in one call, never retyped: `node
  "<plugin-root>/scripts/acdev.mjs" scaffold verify --layers <a,b>
  [--canary]`, with the applicable layer names (`frontend`, `api`,
  `data`, `auth`, `security`, `performance`, `delivery`, `cicd`; an
  unknown name is an error, an existing file is skipped unless
  `--force`). It writes `scripts/verify/<layer>.mjs` from the plugin's
  agnostic stub per layer; the project then gets a concrete, runnable
  probe in each (RLS isolation query, health curl, migration dry run),
  which is the agnosticism contract the layer skills and the close rely
  on later. When the layers include `frontend` it also writes
  `scripts/verify/design-tells.mjs` ready-made (mechanical scan for
  transition: all, lone ease-in, scale(0), gradient text, over-budget
  durations, raw hex outside the token file); adjust its targets.
- `--canary`, for any project that deploys, adds
  `scripts/verify/canary.mjs`: the post-deploy release check `operate`
  runs (health, smoke paths, p95 against the runbook band, error rate
  when the platform exposes it). Adjust its checks to `docs/RUNBOOK.md`;
  the runbook's Canary section documents the variables it reads.
- The guard, completed. `new-project` installed it at intake (or install
  it now per `shared/references/guard-install.md` if this project came
  through `onboard` without one). Fill `verify` in `.acdev/guard.json`
  with the commands a close must pass, in order: the `scripts/verify/`
  runner and the test command (lint and typecheck when the stack has
  them). From the first build slice, `git commit` is denied unless
  `verify` recorded a green run on the current code tree; the acdev close
  command (`node "<plugin-root>/scripts/acdev.mjs" close`) runs it itself
  and commits only on green. That is the
  red-check-blocks-close rule, enforced.
- Evidence: paste `node .claude/hooks/acdev-guard.mjs status`. It names
  the stage the guard enforces, the freeze state, the verify commands
  and the receipt state.
