---
name: layer-frontend
description: Use when building or changing UI: structure, state, routing, accessibility, performance, and design tokens from the approved mockups.
---

# Layer: frontend

Production knowledge for building or changing UI, stack-agnostic.

## Before advising

Read `docs/adr/` and `ARCHITECTURE.md` first. The stack is already decided;
never re-derive or second-guess it here. If no ADRs exist, say so and route
to blueprint (new projects) or have the user run /acdev:onboard (existing
repos).

## Production checklist

- The UI must replicate the frozen mockups exactly, not a reinterpretation
  of them — verify: every screen in the slice matches its approved mockup
  layout, copy, and states.
- Visual values must come from the UI-DESIGN token set, never ad-hoc
  choices — verify: no hardcoded hex colors, pixel spacing, or font sizes
  outside the token file; every value traces to a token.
- Every screen must handle empty, error, and loading states, not only the
  happy path — verify: each of the three states is reachable (empty
  dataset, forced failure, artificial delay) and renders distinct,
  intentional UI.
- Routing guards must match the permission matrix — verify: a direct URL
  to a route the current role cannot access redirects or returns 403
  instead of rendering.
- Forms must validate client-side for UX AND rely on server validation as
  the source of truth — verify: submitting a payload that bypasses the
  client (e.g. direct API call) is still rejected by the server with the
  same rule.
- Accessibility floor must hold on every interactive screen: labels,
  keyboard navigation, focus management, visible contrast — verify: tab
  through the critical flow start to finish using only the keyboard, with
  each focused element visible and announced.
- State boundaries must separate server state from UI state — verify: no
  server-fetched data is copied into a local/global store without an
  invalidation or refetch path tied to its source.
- Performance budget must hold: routes code-split, images sized for their
  container, no blocking third-party scripts — verify: a bundle report or
  route-level check shows the slice did not add an unsplit chunk or a
  render-blocking script tag.
- Copy must be i18n-ready when VISION declares multiple languages —
  verify: every user-facing string in the slice resolves through the
  i18n layer, none hardcoded inline.
- Motion must follow `references/motion-craft.md` — transform/opacity
  only, ease-out entrances, duration budgets by element class,
  `prefers-reduced-motion` respected — verify: the design-tells scan in
  `scripts/verify/` passes, and the critical flow still works with
  reduced motion enabled.

## Pitfalls

- Redesigning during build instead of reopening the mockup gate — silently
  drifts the UI away from what was approved and reviewed.
- Global mutable stores for server data — produces stale UI bugs when the
  server state changes elsewhere and the store is never invalidated.
- Disabled-button-only validation — bypassable by anyone calling the API
  directly, so it is not real validation.
- Z-index/overlay arms race — stacking contexts fixed by raising numbers
  instead of establishing a layering system, causing regressions elsewhere.
- Fetch in components without cancellation — causes race conditions where
  a stale response overwrites fresher state on fast navigation.

## How to verify

Run the project's `scripts/verify/` checks for this layer if present.
Otherwise run the `verify:` probe attached to each checklist item above
directly, scoped to what the current slice touched, and paste the decisive
output lines as evidence.
