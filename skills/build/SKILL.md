---
name: build
description: Use when constructing an approved project: vertical slices end to end, just-in-time spec and plan per slice, TDD loop, decision classification, narrow subagents per layer.
---

# Build (stage 5)

Turns the approved blueprint into working, deployed software, one vertical
slice at a time. The procedure is served one step at a time by the
dispenser; this body holds only what never changes.

## Preconditions

Two things must both be true: the blueprint gate passed, and the user has
explicitly ordered construction. Finishing the blueprint gate is not that
order, and neither is the state write that unlocked product code. Wait
for it.

## The step

Run `node "<plugin-root>/scripts/acdev.mjs" next` (`<plugin-root>` is the
absolute path printed as `acdev plugin root:` at session start) and follow
the step it prints: plan, construct, blocked, incident, phase exit, or a
user-requested change (`next --change "<topic>"`). The step names the
commands. `pack` replaces reading ADRs, ROADMAP, checkpoints and mockups
wholesale; `q` replaces raw command output; `close` replaces the hand-run
close. Open a document only when the pack says it lacks something.

## Rules that do not move

- A slice crosses every layer it needs and ends in something a user can
  observe. Slice 1 of phase 1 is the walking skeleton and includes deploy
  and the rollback drill: the pipeline is cheapest to fix while the code
  is small.
- The plan is written just-in-time, for the slice about to be built,
  because earlier slices change what later ones need.
- Every decision is classified per
  `shared/references/decision-classification.md`. User-challenge decisions
  are asked, never auto-decided and never delegated to a subagent.
- The frozen mockups are the visual contract. What they draw is not
  reopened here; what they do not draw is a taste decision in the audit
  table.
- The guard's denial is a gate, never an obstacle: no redirections, no
  alternative path, no edit to `.acdev/` or the hook to make it go away.
  Either the state is behind reality (the pipeline advances it at its
  gate, with the user) or the action is wrong.
- The orchestrator stays thin. Construction runs in subagents that run
  the pack command named in their prompt and return a short report; the
  capable model plans, decides and hunts security, the cheapest tier does
  what a test or a lint can judge (`references/slice-guide.md`).
- Every slice closes through `ship`: verified green first, one commit.

## Situations

- Discovered trap (an ADR assumption wrong, a layer behaving unplanned):
  record it in the layer's notes or a new ADR; stop the slice only if the
  plan itself is invalid.
- Product-behavior change discovered mid-slice: user-challenge gate first,
  then VISION or MVP amended in the same commit as the code.
- A user-requested change or an incident is a mini-slice with its own
  spec: `references/changes.md`.
- Continuous build, interactive or as the headless loop: only on the
  user's explicit approval, per `references/continuous.md`. A
  user-challenge decision or a plan-invalidating trap stops the run with a
  `--blocked` checkpoint; autonomy covers execution, never decisions.
- Post-MVP phases: their screens get mockups just-in-time through the
  `mockups` gate before any slice is planned.
