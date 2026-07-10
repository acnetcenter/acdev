# Changelog

## [Unreleased]

### Added
- Deterministic routing pack: `new-project` and `onboard` are now user-invoked entry points (`disable-model-invocation: true`) — their descriptions no longer load or compete for activation, and `designing`/`status`/`new-project` recommend the slash command instead of invoking them. Net fixed cost drops to ~1,002 tokens/session.
- `UserPromptSubmit` hook (`hooks/prompt-context.mjs`): inside a project with `.acdev/state.md`, injects one line per prompt with the current stage, skill precedence (pipeline outranks process) and the disambiguation rule; silent outside acdev projects.
- Disambiguation rule in the gateway and the per-prompt line: in doubt or ambiguity about which skill applies, offer the matching `/acdev` commands and let the user choose instead of picking silently.
- Description-overlap lint: model-invocable skill descriptions whose trigger vocabularies overlap beyond a calibrated threshold (Jaccard > 0.25 with at least 3 shared trigger words; current real maximum 0.143) fail CI.
- Documentation-language rule now travels with every session: the gateway instructs matching `docs/VISION.md`'s language for all generated artifacts, and `state.md` records a sticky `language` field (set via `checkpoint.mjs --lang`, normally at onboard; preserved by later writes).
- Lint guards the deliberately duplicated layer blocks: the eight "Before advising" blocks must be identical, and every "How to verify" must keep the shared verify-probe sentence (wrap-insensitive).
- Spike timebox softened to "roughly 2-6 hours" — process numbers are heuristics; only the lint budgets are hard limits.
- `mockups/references/design-craft.md`: durable anti-generic design floor for mockups — structural AI tells to avoid, contrast and type-scale rules, per-screen audit pass. Distilled from Emil Kowalski's skills (MIT) and leonxlnx/taste-skill (MIT); concepts from pbakaus/impeccable (Apache-2.0, ideas only). Trend-sensitive taste (font/palette bans) deliberately excluded.
- `layer-frontend/references/motion-craft.md`: durable animation rules — frequency-based decisions, duration budgets per element class, easing rules, transform/opacity-only, reduced-motion. New motion item in the layer-frontend production checklist points at it.
- `shared/references/templates/verify-design-tells.mjs`: ready-made mechanical `scripts/verify/` scan for AI-design tells (transition: all, lone ease-in, scale-from-zero, gradient text, over-budget durations, raw hex values outside token files) covering CSS, camelCase JS object styles, Framer Motion props and Tailwind classes; comment-stripping, token files exempt, per-line `motion-ok` suppression for audited exceptions, hard fail when nothing is scanned. Referenced from blueprint's repo mechanics.
- `mockups` now delegates aesthetic direction to a dedicated design skill when installed (e.g. the native `frontend-design` plugin), explicitly subordinated to the pipeline's scope and freeze gates.

## [0.1.1] - 2026-07-09

Surgical fix pack from two independent expert reviews. No design changes.

### Fixed
- `checkpoint.mjs`: filenames now carry second precision plus a collision suffix — two checkpoints written in the same minute no longer silently overwrite each other (data loss).
- `checkpoint.mjs`: `branch` and every `files_modified` entry are JSON-escaped in the generated frontmatter; YAML-hostile values (colons, quotes, spaces) no longer corrupt the checkpoint.
- `checkpoint.mjs`: `read` resolves the latest checkpoint from `state.md`'s `latest_checkpoint` pointer first, falling back to the name sort.
- `checkpoint.mjs`: `--stage` is validated against the pipeline stage list; argument parsing moved to `node:util` `parseArgs`.
- `session-start.mjs`: failures now leave a trace on stderr instead of failing fully silently (exit code stays 0, degradation contract unchanged).
- Skill bodies no longer instruct running `"${CLAUDE_PLUGIN_ROOT}/scripts/..."` — that variable is only interpolated in hook/MCP configs, not in shell sessions. The hook now prints `acdev plugin root: <path>` into session context and `build`/`ship`/`status`/`onboard` reference it as `<plugin-root>`.
- Emoji lint switched to `\p{Extended_Pictographic}` plus explicit ranges for regional-indicator flags, VS16 and the keycap combiner (catches country flags, stars and arrows the old ranges missed, without losing the keycap coverage they had) and now scans every markdown file under `skills/` and `shared/`, not only `SKILL.md`.
- `lint-budgets.mjs` fails on an empty skills directory instead of passing green.

### Added
- `state.md` now records `acdev_version`, enabling future format migrations.
- README drift checks in the lint: the 21-skill tables and the token cost ledger are recomputed from the tree and fail CI when stale; manifests are parsed and cross-checked (version, description).
- Hook smoke tests (gateway output, frontmatter stripping, silent-degradation path) and checkpoint collision/escaping/stage-validation tests.
- CI matrix: ubuntu + windows, Node 20 + 22; actions pinned by SHA; `permissions: contents: read`; `engines.node >= 20` declared.
- `decision-classification.md`: explicit escalation rule for doubtful classes.
- `mockups`: the freeze now distinguishes normative content (layout, hierarchy, navigation, tokens, copy, flows) from illustrative detail (hover, undrawn breakpoints, micro-interactions), which `build` decides as taste-class decisions.
- `tdd`: explicit throwaway-code exception (scratch scripts, spikes).

### Changed
- The eight `layer-*` "How to verify" sections no longer restate the checklist in prose; they point at the per-item `verify:` probes (sections shrink 60-75%, ~11% of each skill body per activation).
- `.gitignore` no longer ignores `.superpowers/` (leftover from the retired plugin).
- README gained local-clone install instructions, usable before the GitHub repository is published.

## [0.1.0] - 2026-07-09
- Initial release: 21 skills in 4 groups (1 gateway, 7 pipeline, 5 process, 8 layers), a SessionStart hook that injects the `using-acdev` gateway skill into context, and two scripts — `checkpoint.mjs` for per-slice/per-phase checkpoints and `lint-budgets.mjs` for structural and token-budget enforcement across all skills.
