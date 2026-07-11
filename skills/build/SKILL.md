---
name: build
description: Use when constructing an approved project: vertical slices end to end, just-in-time spec and plan per slice, TDD loop, decision classification, narrow subagents per layer.
---

# Build (stage 5)

This skill runs stage 5 of the acdev pipeline: turning the approved
blueprint into working, deployed software, one vertical slice at a time.

## Preconditions

Two things must both be true before this skill does anything: the
blueprint is approved (stage 4 gate passed), and the user has explicitly
ordered construction to start. Finishing the blueprint gate is not itself
that order — wait for it.

Once both hold, read `docs/ROADMAP.md` for the current phase, the relevant
`docs/adr/` entries, and the latest checkpoint (`node
"<plugin-root>/scripts/checkpoint.mjs" read`, where `<plugin-root>` is the
absolute path printed as `acdev plugin root:` in the session context at
startup) before writing any plan. The stack, hosting, data store, auth approach, and tenancy model were
already decided in `blueprint` and recorded as ADRs — read them, do not
re-derive them. If an ADR seems wrong, that is a discovered trap (see
Close), not license to silently pick something else.

## Slice planning

Decompose the current phase into vertical slices. A slice crosses every
layer applicable to that piece of work end to end — UI, API, data, auth,
deploy — and ends in something a user can actually observe (a screen, a
working flow, a deployed change), not an internal building block.

Slice 1 of phase 1 is the **walking skeleton**: the thinnest possible
end-to-end path through the stack, and it INCLUDES deploy. Its purpose is
to validate the whole delivery pipeline — build, test, deploy, and every
layer touched in between — while the codebase is still small enough that
problems are cheap to fix. Do not defer deploy to a later slice to make
slice 1 look simpler; a walking skeleton that does not reach production is
not a walking skeleton.

Write the slice plan **just-in-time** — only for the slice about to be
built, never for slices further out. A future slice's plan is written when
that slice starts, not before, because earlier slices routinely change
what later ones need.

Classify every decision made while planning the slice per
`shared/references/decision-classification.md` (mechanical, taste,
user-challenge) and keep a running audit table in the exact format
`| Decision | Class | Choice | Reason |`.

**GATE.** Present the slice plan to the user only if it contains at least
one user-challenge decision — that decision needs a real answer before
work starts. If the plan contains only mechanical and taste decisions,
proceed directly to construction and keep the audit table available for
review rather than blocking on it.

## Slice construction loop

For each slice, once its plan is settled:

1. **Frontend replicates the frozen mockups.** The approved mockups are the
   visual contract; build implements what they show. No redesigning on the
   fly — a mockup limitation discovered mid-slice is a mockups-skill
   conversation, not a build-time improvisation. Detail the mockups never
   drew — hover and focus behavior, undrawn breakpoints,
   micro-interactions — is not a limitation: decide it here as a
   taste-class decision in the audit table, per the mockups skill's
   normative-vs-illustrative rule, without reopening the gate.
2. **TDD loop per the `tdd` skill.** Test first, watch it fail (red), make
   it pass (green), then refactor. This applies at every layer the slice
   touches, not only the backend.
3. **Narrow subagents per layer, where parallelism helps.** When a slice's
   layers can be worked on independently, dispatch one subagent per layer
   instead of one subagent for the whole slice. Each subagent's prompt
   includes ONLY the `layer-*` skill bodies relevant to the work it is
   actually doing — never all eight layer skills — plus the specific ADR
   lines that bear on that work. See `references/slice-guide.md` for the
   prompt template.
4. **Verification per the `verifying` skill before calling the slice
   done.** A slice is not finished because the code was written; it is
   finished once verification confirms it behaves as the slice spec and
   the mockups say it should.

## Close

Every slice ends by invoking the `ship` skill — one commit per slice, no
exceptions. A slice that is not shipped is not done, regardless of how
complete the code looks.

Two situations can surface mid-slice and each has its own handling:

- **Discovered trap** — an ADR assumption turns out wrong, or a layer
  behaves in a way nobody planned for. Record it in the affected layer's
  project notes, or write a new ADR if it changes a lasting decision. This
  does not require stopping the slice unless the trap invalidates the plan
  itself.
- **Product-behavior change discovered mid-slice** — the work reveals that
  what the product should actually do differs from what VISION or MVP
  says. This always goes through the user-challenge gate first. Once
  confirmed, update `docs/VISION.md` and/or `docs/MVP.md` in the same
  commit as the code change (the drift rule) — the docs and the behavior
  they describe never diverge, even for one commit.

## Continuous build

Only on the user's explicit approval, offered at the blueprint gate or
given any time during build ("build the whole MVP without stopping").
Without it, build pauses at each slice boundary as usual.

In continuous mode:

- The loop and its quality gates DO NOT change: every slice still gets
  its just-in-time plan, the TDD loop, verification per the `verifying`
  skill, and a full `ship` close (green verification, drift check,
  checkpoint, one commit) before the next slice starts. Continuous mode
  removes the pauses between slices, never the gates inside them.
- Mechanical and taste decisions are auto-decided into the audit table,
  as always. A user-challenge decision STOPS the run: write the
  checkpoint with `--blocked` naming the question, report it, and wait —
  autonomy covers execution, never decisions. The user answers and says
  "continue" to resume.
- A discovered trap that invalidates the current plan stops the run the
  same way — this is already the rule; continuous mode does not soften
  it.
- Scope: the run ends at the current phase's exit — for phase 1, the MVP
  exit criteria in `docs/ROADMAP.md`. Post-MVP phases each need their own
  mockups gate first, then their own continuous run if the user wants
  one.
- Narrate every slice close in one short line ("slice N shipped,
  verification green — next: X") without waiting for a reply; the user
  can interrupt at any point. If the session dies mid-run, the
  checkpoints already cover resumption: `/acdev:status`, then "continue".

## Post-MVP phases

When a phase beyond the MVP starts, its screens have no mockups yet — they
are built just-in-time, at the start of that phase, by returning to the
`mockups` skill under the same hard gate used for the MVP. Once that
phase's mockups are approved and frozen, its slices are planned and built
through this same slice-planning and construction loop, starting again
with that phase's own slice 1 (which does not need to be a walking
skeleton — the delivery pipeline was already proven in phase 1).
