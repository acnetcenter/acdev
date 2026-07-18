# Changelog

## [Unreleased]

### Fixed
- Sonnet-judge calibration (`npm run evals -- --model sonnet`, run after the haiku baseline went 64/64) surfaced two real gaps the haiku judge never exposed:
  - A stronger reasoner sometimes reasoned correctly that `new-project`/`onboard` are user-run, then self-invoked one anyway or answered without the required `RECOMMEND:` prefix — a genuine behavior difference (a haiku baseline, re-run repeatedly, never showed it), not judge noise. `using-acdev`'s gateway rule now names `new-project` and `onboard` directly and forecloses the "just save a step" rationalization, still inside the 1,600-char gateway budget; `gate-user-run-entry`'s options were re-worded so A and D are unambiguous about *who* acts this turn. (A first attempt at fixing this by sharpening the routing judge's own RECOMMEND instructions overcorrected — it started flagging `blueprint`/`build`/`status` as user-run too, none of which are — and was reverted; the gateway wording alone measured 9/12 to 12/12 clean across repeated single-sample calibration runs, which the existing retry already absorbs.)
  - `gate-phase-exit-security` failed 4/5 single-sample runs: option A's "every slice shipped through its own verification and close" is true but incomplete, and a careful reader can mistake per-slice verification for satisfying the separate phase-exit security gate. Reworded to state the (false) sufficiency claim explicitly; 6/6 after the fix.
  - `route-layer-api-idempotency-es` proved unstable across three separate answers (`layer-security`, `tdd`, `build`) over repeated haiku and sonnet runs — an implementation-command phrasing ("haz la mutación idempotente") that could plausibly route to four different skills. Rather than keep widening `accept` past the two-entry cap, the prompt was rewritten as a contract question anchored to `layer-api`'s own trigger word ("idempotency"); 6/6 haiku and 4/4 sonnet after the fix.
  - `route-layer-auth-sessions-es` kept pulling a `planning` reading (50% single-sample rate, measured over 8 rounds) across three separate wording attempts spanning this and an earlier session — the goal-level "hay que endurecer..." framing genuinely borders `planning`, the same three-way border `route-layer-auth-rbac` already accepts for the identical reason. `planning` added to `accept` rather than attempted as a fourth rewrite; 8/8 after the fix.
  - `gate-user-run-entry` additionally showed a letter-binding failure mode under sonnet: reasoning that correctly concluded "recommend the command" was sometimes labeled with the wrong letter because options A and D were not crisply distinguished on *who acts this turn*. Folded into the same rewording as the sufficiency-claim fix above.
  - Residual, accepted as documented noise rather than engineered away further: `route-recommend-new-project` (EN, under sonnet) and `route-planning-spec-es` (under haiku) each settle around a ~75-80% single-sample pass rate with no clearly-actionable rewording — the former's reasoning is consistently correct (verified via an explain-mode probe: 6/6) but the strict one-line format occasionally drops the required `RECOMMEND:` prefix; the latter occasionally reads as genuinely OFFER-worthy, which cannot be added to `accept` without reopening the strict-OFFER discipline established earlier in this same release. With ~64 cases run repeatedly, an aggregate low-single-digit double-fail rate per full run is expected statistical noise from the retry math, not a defect signal — the bar for further action stays "consistently high failure rate across a real multi-sample stress test," which both of these fall short of.

## [0.1.9] - 2026-07-18

### Changed
- Pre-push committee review (two panels — critics vs solvers — 12 findings, all implemented): release history split into one commit per version with honest messages; the adversarial design review protocol moved to `skills/blueprint/references/adversarial-review.md` (the body keeps the offer, the cost argument and the high-severity gate rule; ~290 tokens saved per activation); jurisdiction bullets deduped in the vision questionnaire; the spec records why the evals v2 deferral fell.

### Fixed
- `run-evals.mjs` correctness: `parseRouting` scans top-down and validates bare words against real skill names (closes a false-FAIL and a false-PASS pair reproduced byte for byte); the judge timeout is injectable via `ACDEV_EVAL_TIMEOUT_MS` and covered by a real hung-judge test, with nonzero-exit and unspawnable-judge paths tested; an empty selection (typoed `--filter`, empty cases file) exits 1 instead of passing over zero cases; the test suite survives checkouts under paths with spaces.
- Eval suite hardening: gates options de-leaked (correct answers no longer quote distinctive strings from the governing text; `npm run evals -- --ablate` measures how many cases a judge answers with no context at all); `OFFER` expected strictly and banned from `accept` lists, which are capped at two and enforced by a deterministic guard test; passes via `accept` and via retry are reported in the summary and persisted per run to gitignored `evals/history.jsonl` so chronic flakes become visible across runs.

### Added
- Four gate cases covering the v0.1.6-v0.1.8 hard-rule delta — compliance asked-not-assumed, adversarial-finding routing, spike-never-merges, mockups scope drift — plus the authoring contract in the cases file and README: a commit that adds or rewords a hard rule adds or updates its gate case in the same commit; one case per hard rule, not one per skill.

## [0.1.8] - 2026-07-17

### Added
- Routing and gate evals (`evals/`, `scripts/run-evals.mjs`, `npm run evals`): the plugin's semantic surface — does a prompt activate the right skill, does a hard gate produce the required decision — now has an on-demand behavioral suite. Routing cases (English and Spanish prompts) are judged over the session-start activation surface — gateway plus model-invocable descriptions; the in-project per-prompt stage line is not simulated — including `RECOMMEND` for user-run entry points, `OFFER` for genuine ambiguity and `NONE`; gate cases are multiple-choice scenarios against the governing skill body, with the correct option written as a bare action so the rule must come from the injected text, not the option itself. One model call per case (default haiku, one retry absorbing judge noise), never in CI; the runner's pipeline is tested judge-free via `ACDEV_EVAL_CMD`. Implements the spec's section 14.4 "automated routing evals" v2 candidate.
- Jurisdiction-aware compliance: the VISION interview's complementary questions now ask which jurisdictions the product operates and holds data in; `blueprint` records the answer as a compliance ADR — regimes, residency, retention and deletion obligations, or explicitly none — as a user-challenge decision (asked, never assumed from the domain). `layer-data` verifies retention/deletion is enforced rather than declared, `layer-security` verifies data residency against that ADR, and jurisdiction/compliance joins the user-challenge examples in `decision-classification.md`.
- Adversarial design review, optional at the blueprint gate: offered when presenting the package, before approval — two independent panels via the native Agent tool with opposing lenses (excess: what is over-designed; defect: what is missing or will not scale), findings contrasted (agreements first, contradictions presented as contested), design changes routed as user-challenge decisions, and a high-severity finding resolved or explicitly accepted before the gate closes. The blueprint is the highest-leverage review point: a design error caught here costs a conversation, mid-build it costs slices.
- `layer-delivery` observability beyond the minimum bar: an error-rate alert that fires even while the health check stays green (degradation, not only downtime), production p95 latency measured per route so the phase-exit budget comparison in `layer-performance` reads real data, and a deliberate log-retention window instead of the platform default.

## [0.1.7] - 2026-07-17

### Added
- `docs/README.md` index, owned by `blueprint`: one line per singleton doc (what it is, when to read it) plus one line per series folder — series are never indexed file by file. Generated last from `shared/references/templates/docs-index.md` once the doc set is final; `ship`'s drift check updates it in the same commit whenever a slice adds, renames or removes a document, creating it if the project lacks one.
- `docs/domain/` for central-domain docs (PRICING-MODEL, SCHEDULING-RULES, ...): the one singleton category that can multiply per project moves under its own folder. Applies to new projects; `ship`'s drift check now also covers central-domain docs.

## [0.1.6] - 2026-07-17

### Added
- Change-request specs with linked history: every user-requested change beyond trivial gets a plan/spec at `docs/plans/YYYY-MM-DD-<topic>.md` before work starts (the request captured as a spec, then goal+verify steps), treated by `build` as a mini-slice closing through `ship`. Plans carry a `status:` lifecycle in frontmatter (`active` / `shipped` / `abandoned`) instead of moving between folders — links never break; "the archive" is a query, not a location.
- `checkpoint.mjs --plan`: checkpoints now record the repo-relative path of the plan the work followed (`plan:` frontmatter field, `null` when absent), tying commit, checkpoint and spec together. `ship` supplies it at every close; `status` reports it.
- Per-project `CHANGELOG.md` owned by `ship`: every close appends one line under `[Unreleased]` — what shipped, in the project's documentation language, linking its plan — and flips that plan's `status:` to `shipped` in the same commit. Created lazily on the first close if the project has none.
- `status` lists open plans (file names of `docs/plans/*.md` with `status: active`, names only) as its third cheap source.

## [0.1.5] - 2026-07-11

### Added
- Phase-exit security pass, owned by `ship` (pilot feedback): before a phase can be marked complete, run the native `/security-review` over the phase's full diff, the OWASP Top 10 pass from `layer-security` (permission matrix, injection surfaces) and the project's `scripts/verify/` security probes — with evidence. If build ran on a cheaper model, this is the switch-back point to the most capable one: construction follows instructions, hunting vulnerabilities takes adversarial reasoning. A high-severity finding blocks the phase close; accepting it is an explicit user-challenge decision, never automatic. The continuous-build run ends through this same pass.

## [0.1.4] - 2026-07-11

### Added
- Continuous build mode (pilot feedback): at the blueprint gate, alongside the model-switch offer, the user can approve building the whole MVP phase slice after slice without pausing. Per-slice quality gates are untouched (just-in-time plan, TDD, verification, full `ship` close per slice); mechanical/taste decisions auto-decide into the audit table as always; a user-challenge decision or a plan-invalidating trap stops the run with a `--blocked` checkpoint — autonomy covers execution, never decisions. The run ends at the phase exit; post-MVP phases need their own mockups gate first.

## [0.1.3] - 2026-07-10

### Added
- Model switch point at the blueprint gate: when the documentation package is approved, the user is advised that everything downstream is construction against approved documents, and that `build` can run on a cheaper model (`/model`) — the document stages deserve the most capable one (pilot feedback).

## [0.1.2] - 2026-07-10

First fix from the real pilot: the VISION interview felt like a cold
questionnaire and the gate could ask approval for a never-shown document.

### Changed
- `new-project` intake now opens by listening: one question — tell the idea in a few sentences — before any paperwork; the remaining intake questions follow in one message with defaults proposed from the idea.
- VISION.md is now written in front of the user: each questionnaire section closes by showing the section as document text ("this is what we have so far") for correction on the spot, so by the gate the user has already read every line.
- The VISION hard gate no longer allows presenting "a summary" — the full document, always; the gate confirms a document the user watched grow, it does not reveal one.

## [0.1.1] - 2026-07-09

First public release. On top of the v0.1.0 skill set: a hardening pass from
two independent expert reviews, a distilled design-craft layer, and a
deterministic-routing pack. Every change was adversarially verified.

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
- `decision-classification.md`: escalation rule for doubtful classes (misclassifying user-challenge as taste is the one unrecoverable error).
- Documentation-language rule now travels with every session: the gateway instructs matching `docs/VISION.md`'s language for all generated artifacts, and `state.md` records a sticky `language` field (`checkpoint.mjs --lang`, set at onboard, preserved by later writes).
- Lint guards the deliberately duplicated layer blocks: the eight "Before advising" blocks must be identical, and every "How to verify" must keep the shared verify-probe sentence (wrap-insensitive).

Design craft (distilled, not vendored, from emilkowalski/skills MIT, leonxlnx/taste-skill MIT, and concepts from pbakaus/impeccable Apache-2.0):
- `mockups/references/design-craft.md`: durable anti-generic floor — structural AI tells to avoid, contrast and type-scale rules, per-screen audit pass. Trend-sensitive taste (font/palette bans) deliberately excluded.
- `layer-frontend/references/motion-craft.md`: frequency-based motion decisions, duration budgets per element class, easing rules, transform/opacity-only, reduced-motion, modal transform-origin exception.
- `shared/references/templates/verify-design-tells.mjs`: mechanical `scripts/verify/` scan for AI-design tells (transition: all, lone ease-in, scale-from-zero, gradient text, over-budget durations, raw hex outside token files) covering CSS, JS object styles, Framer Motion and Tailwind; per-line `motion-ok` suppression, token files exempt, hard fail when nothing is scanned.
- `mockups` delegates aesthetic direction to a dedicated design skill when installed (e.g. the native `frontend-design` plugin), subordinated to the pipeline's scope and freeze gates.

Deterministic routing:
- `new-project` and `onboard` are user-run entry points (`disable-model-invocation: true`): their descriptions no longer load or compete for activation; `designing`/`status`/`new-project` recommend the slash command instead of invoking them.
- `UserPromptSubmit` hook (`hooks/prompt-context.mjs`): inside a project with `.acdev/state.md`, injects one line per prompt with the current stage, skill precedence (pipeline outranks process) and the disambiguation rule; silent outside acdev projects.
- Disambiguation rule (gateway and per-prompt line): in doubt or ambiguity about which skill applies, offer the matching `/acdev` commands and let the user choose instead of picking silently.
- Description-overlap lint: model-invocable descriptions overlapping beyond a calibrated threshold (Jaccard > 0.25 with at least 3 shared trigger words; current real maximum 0.143) fail CI.

### Changed
- The eight `layer-*` "How to verify" sections no longer restate the checklist in prose; they point at the per-item `verify:` probes (sections shrink 60-75%, ~11% of each skill body per activation).
- Spike timebox softened to "roughly 2-6 hours" — process numbers are heuristics; only the lint budgets are hard limits.
- `.gitignore` no longer ignores `.superpowers/` (leftover from the retired plugin).
- README gained local-clone install instructions, usable before the GitHub repository is published.

## [0.1.0] - 2026-07-09
- Initial release: 21 skills in 4 groups (1 gateway, 7 pipeline, 5 process, 8 layers), a SessionStart hook that injects the `using-acdev` gateway skill into context, and two scripts — `checkpoint.mjs` for per-slice/per-phase checkpoints and `lint-budgets.mjs` for structural and token-budget enforcement across all skills.
