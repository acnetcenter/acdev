---
name: mockups
description: "Use after MVP approval to build static HTML mockups of every MVP screen plus the post-MVP skeleton inventory, and to run revision rounds until the visual contract is approved."
---

# Mockups (the visual contract)

The approved MVP becomes a walkable set of static HTML pages the user can
click through, plus a one-line inventory of the screens that come later.
Precondition: `docs/MVP.md` is approved. A product with no UI skips this
stage; do not run it for one.

Mockups derive from MVP.md: every screen traces to a feature or a flow
already agreed there.

## Build the set

Author per `references/mockups-guide.md` (layout, tokens, data, state
variants, index, the inventory and spec commands, accessibility floor).
For the aesthetic direction, use the design plugin the user has installed
(acfrontend's `impeccable`, or `frontend-design`); when there is none,
`references/design-craft.md` is the floor. Either way the design tool is
subordinated to this pipeline: MVP.md decides scope, the gate below
decides approval, and once frozen the contract outranks any suggestion.

The set is complete when: every screen named or implied by the MVP's
in-scope list has a page; every page carries realistic sample data, never
lorem ipsum or `[placeholder]` text; the key screens have their empty,
error and loading states, each a separate file, never a JS toggle (the
spec command depends on it); `index.html` links every page, grouped by
flow; and every critical flow is walkable screen to screen using only the
links inside the mockups.

Mockups are a drawing of the product, not an implementation: plain HTML
and CSS, no framework, no build step. That is why they are allowed before
the build stage.

## Skeleton inventory

`docs/mockups-inventory.md` (scaffolded; see the guide) holds one line
per post-MVP screen: name, purpose, target phase, where it will attach in
the navigation. The MVP navigation visibly reserves those places (a
disabled item, a labeled section). The later screens are not drawn now.

## Revision rounds

The user browses `mockups/index.html`; corrections are applied in rounds,
each committed as `docs: mockups revision N`. A revision is an Edit to
the affected block of the affected page, never a page rewrite: a rewrite
re-emits what did not change and may silently alter it.

If a revision changes product scope (a screen that implies a new feature,
a removed flow, a changed success criterion), update `docs/PRODUCT.md`
or `docs/MVP.md` in the same commit and reconfirm that document with the
user. A mockup never silently redefines what the product does.

## Spec

Before the gate, run `acdev mockup-spec --write` and complete the one
Intent line per screen in `mockups/SPEC.md`: what the user does there and
what must be true when it works. Regenerate after every round; the Intent
lines survive. During build a page is opened only for the screen being
implemented; everything else comes from the spec.

## Gate

**Gate.** Present the set through `index.html` and ask: "Do you approve
these mockups?" Do not continue to `blueprint` until the answer is an
explicit approval.

Once approved the mockups are frozen as the visual contract of the MVP
build. The freeze is normative for what the mockups actually draw: layout,
hierarchy, navigation, design tokens, copy, and the flows between
screens. What they do not draw (hover and focus details, undrawn
breakpoints, animation) is illustrative: `build` decides those as
taste-class decisions and lists them. Reopening the contract after
approval requires re-approval through this skill, and a change that also
touches PRODUCT.md or MVP.md is recorded as an ADR.

On approval advance the state (`--stage blueprint`; command in the guide)
and commit, `mockups/SPEC.md` included. From then on the guard stops an
edit of an approved page until the user agrees.

Later phases get their mockups just-in-time, by returning to this skill
when that phase starts. The project is in build by then, and it stays
there: do not write the stage again, or product code would lock. New
pages are free; `index.html` and `styles.css` are approved files, so the
guard stops those edits until the user agrees (its message says how), and
the gate question is the same.

A design tool may add to `docs/PRODUCT.md`; it never rewrites it. If one
proposes a rewrite that drops sections, refuse it when the guard stops it.
