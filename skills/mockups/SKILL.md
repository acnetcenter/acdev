---
name: mockups
description: Use after MVP approval to build static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved.
---

# Mockups (stage 3)

Stage 3 of the acdev pipeline: the approved MVP becomes a walkable set of
static HTML mockups, plus a skeleton inventory of the post-MVP screens. Precondition: `docs/MVP.md` is approved (stage 2 hard
gate). If the project has no UI, this stage does not
apply — it was skipped at `new-project`, or `onboard` set the resume
stage past it. Do not run it now.

Mockups derive from MVP.md, not from VISION.md directly. Every screen built
here must trace to a flow or feature already agreed in the MVP.

## Build the MVP mockups

Author per `references/mockups-guide.md` (layout, data, states, index,
revisions, the inventory and spec commands, accessibility) and
`references/design-craft.md` (the anti-generic floor). When a dedicated design-direction skill
is installed (e.g. the native `frontend-design` plugin), use it for the
aesthetic direction while authoring — always subordinated to this
pipeline: MVP.md decides scope, the gate below decides approval, and once
frozen the contract outranks any skill's suggestions.

The set is complete only when: every screen named or implied by
`docs/MVP.md`'s in-scope feature list has a page; every page carries
realistic sample data — never lorem ipsum and never `[placeholder]` text;
the key screens have empty, error and loading states, each a separate
file, never a JS toggle (`mockup-spec` depends on it); `index.html` links
every page, grouped by flow; and
every MVP critical flow named in VISION §5 / MVP is walkable screen to
screen using only the links inside the mockups.

These mockups are a disposable design artifact, not product code — plain
HTML and CSS, no framework, no build step, nothing to install or compile.
This does not violate the "zero product code before build" rule: a mockup is
not an implementation of the product, it is a drawing of it.

## Skeleton inventory

`docs/mockups-inventory.md` (scaffolded; see the guide) is a skeleton, not
a set of mockups: one line per post-MVP screen, naming its screen name,
purpose, and target phase (taken from VISION §7's phase sketch), plus where
it will live in navigation once built. The MVP navigation itself must
visibly accommodate these future modules (a disabled item, a labeled
section, a placeholder slot). Do not draw the post-MVP screens themselves
yet; only reserve their place.

## Revision rounds

The user browses `mockups/index.html`; corrections are collected and
applied in rounds, each committed as `docs: mockups revision N`. A revision is an Edit to the affected block of the affected page,
never a page rewrite: a rewrite re-emits what did not change and may
silently alter it.

Drift rule: if a requested revision changes product scope — a new screen
that implies a new feature, a removed flow, a changed success criterion —
update `docs/VISION.md` and/or `docs/MVP.md` in the same commit as the
mockup change, and reconfirm the affected document with the user. A mockup
never silently redefines what the product does.

## Spec

Before the gate, generate `mockups/SPEC.md`, the compact spec that `build`
reads instead of the pages (`mockup-spec --write`, in the guide), and
complete its one Intent line per screen: what the user does there and
what must be true when it works. Regenerate after every revision round;
the Intent lines survive regeneration. A page is opened during build only
for the screen being implemented; everything else comes from the spec.

## Gate

**HARD GATE.** Ask for explicit approval of the full mockup set, the same
way as the VISION and MVP gates: present the set (via `index.html`) and ask,
in these words or equivalent, "Do you approve these mockups?" Do not
continue to `blueprint` until the answer is an explicit approval.

Once approved, the mockups are FROZEN as the visual contract for the MVP
build: `blueprint` derives its UI-DESIGN doc from them, and `build`
replicates them in the real frontend, reading `mockups/SPEC.md` and
opening a page only for the screen at hand — no redesigning on the fly
during build. Reopening the contract after approval requires re-approval through
this skill again, and an ADR if the change also touches VISION or MVP.

The freeze is normative for what the mockups actually draw: layout,
hierarchy, navigation, design tokens, copy, and the flows between screens.
What they do not draw — hover and focus details, undrawn breakpoints,
animation and micro-interactions — is illustrative: `build` decides those
as taste-class decisions recorded in its audit table, without reopening
this gate. Reopening applies to normative changes only.

On approval, advance the pipeline state (`--stage blueprint`; command in
the guide) and commit, `mockups/SPEC.md` included. The guard reads that
state: from here it asks before any file under `mockups/` is edited, which
is the freeze made deterministic.

Post-MVP phases do not get mockups now: each gets them just-in-time
during `build`, phase by phase, by returning to this skill when that
phase starts.
