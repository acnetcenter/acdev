---
name: mockups
description: Use after MVP approval to build static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved.
---

# Mockups (stage 3)

This skill runs stage 3 of the acdev pipeline: turning the approved MVP into
a walkable set of static HTML mockups, plus a skeleton inventory of the
post-MVP screens. Precondition: `docs/MVP.md` is approved (stage 2 hard
gate). If the project has no UI, this stage does not
apply — it was skipped at `new-project`, or `onboard` set the resume
stage past it. Do not run it now.

Mockups derive from MVP.md, not from VISION.md directly. Every screen built
here must trace to a flow or feature already agreed in the MVP.

## Build the MVP mockups

Follow `references/mockups-guide.md` for the concrete authoring rules
(directory layout, filenames, shared stylesheet, data rules, states,
accessibility), and `references/design-craft.md` for the durable
anti-generic floor: structural tells to avoid, contrast and type-scale
rules, one deliberate aesthetic risk per key screen. When a dedicated
design-direction skill is installed (e.g. the native `frontend-design`
plugin), use it for the aesthetic direction while authoring — always
subordinated to this pipeline: MVP.md decides scope, the gate below
decides approval, and once frozen the contract outranks any skill's
suggestions.

At a minimum, produce:

1. One HTML page per MVP screen — every screen named or implied by
   `docs/MVP.md`'s in-scope feature list gets a page.
2. Realistic sample data on every page: real-looking names, amounts, dates,
   statuses. Never lorem ipsum and never `[placeholder]` text — the point of
   a mockup is to make the product feel real enough to react to.
3. Empty, error, and loading states for the key screens (list views, forms,
   anything that depends on data that might not be there yet).
4. An `index.html` that links every page, grouped so the user can find any
   screen without hunting.
5. Every MVP critical flow walkable screen to screen: a user must be able to
   click from the start of a flow named in VISION §5 / MVP through to its
   end using only the links inside the mockups.

These mockups are a disposable design artifact, not product code — plain
HTML and CSS, no framework, no build step, nothing to install or compile.
This does not violate the "zero product code before build" rule: a mockup is
not an implementation of the product, it is a drawing of it.

## Skeleton inventory

Write `docs/mockups-inventory.md` from
`shared/references/templates/mockups-inventory.md`. This is a skeleton, not
a set of mockups: one line per post-MVP screen, naming its screen name,
purpose, and target phase (taken from VISION §7's phase sketch), plus where
it will live in navigation once built.

The MVP navigation itself must visibly accommodate these future modules —
the menu, sidebar, or nav bar in the MVP mockups should show where phase-2+
items will attach (a disabled item, a labeled section, a placeholder slot).
Do not draw the post-MVP screens themselves yet; only reserve their place.

## Revision rounds

Present the mockups by pointing the user at `mockups/index.html` to browse
in a normal browser. Collect corrections and apply them in rounds; commit
each round as `docs: mockups revision N` (N = 1, 2, 3...).

Drift rule: if a requested revision changes product scope — a new screen
that implies a new feature, a removed flow, a changed success criterion —
update `docs/VISION.md` and/or `docs/MVP.md` in the same commit as the
mockup change, and reconfirm the affected document with the user. A mockup
never silently redefines what the product does.

## Gate

**HARD GATE.** Ask for explicit approval of the full mockup set, the same
way as the VISION and MVP gates: present the set (via `index.html`) and ask,
in these words or equivalent, "Do you approve these mockups?" Do not
continue to `blueprint` until the answer is an explicit approval.

Once approved, the mockups are FROZEN as the visual contract for the MVP
build: `blueprint` derives its UI-DESIGN doc from them, and `build`
replicates them in the real frontend — no redesigning on the fly during
build. Reopening the contract after approval requires re-approval through
this skill again, and an ADR if the change also touches VISION or MVP.

The freeze is normative for what the mockups actually draw: layout,
hierarchy, navigation, design tokens, copy, and the flows between screens.
What they do not draw — hover and focus details, undrawn breakpoints,
animation and micro-interactions — is illustrative: `build` decides those
as taste-class decisions recorded in its audit table, without reopening
this gate. Reopening applies to normative changes only.

Post-MVP phases do not get mockups now. Each phase gets its mockups
just-in-time during `build`, phase by phase, by returning to this same
skill when that phase starts.
