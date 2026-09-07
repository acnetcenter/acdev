# Design craft

Reference for `mockups`. How to keep mockups from looking AI-generated,
using only rules that do not expire with fashion. Trend-sensitive taste
(banned font lists, palette fads) deliberately does NOT live here — that
is what a dedicated design skill (e.g. the native `frontend-design`
plugin) is for; this file carries the durable floor.

## Structural tells to avoid

These patterns read as "generated" because models emit them by default,
regardless of what the product needs. Avoid them unless the design brief
explicitly calls for one:

- **Uniform section anatomy** — every section built as eyebrow label +
  heading + three cards. Vary the anatomy per section's actual content.
- **Mechanical zigzag** — image-left / image-right alternation repeated
  identically down the page.
- **Gradient text** on headings as decoration.
- **One radius, one shadow everywhere** — identical border-radius and
  box-shadow on every element flattens hierarchy; vary them by elevation
  and importance, or use none.
- **Icon-per-card filler** — a generic icon above every card title,
  carrying no information.
- **Uniform spacing** — the same gap between every section produces no
  rhythm; spacing should group related content and separate unrelated.
- **Hero + three features + CTA** as the only page structure considered.

## Durable positive rules

- Contrast: body text >= 4.5:1 against its background; large text >= 3:1
  (WCAG AA). Check the actual rendered values, not the intention.
- Typography: at most two families; a modular scale chosen deliberately
  and held — dense product UI typically uses lower ratios (1.125-1.2),
  editorial and marketing pages higher ones (1.25-1.333) — with every
  text size on the page traceable to a step of the scale.
- Hierarchy: one dominant element per screen. If everything is
  emphasized, nothing is.
- Density is a decision: pick airy or dense per the product's audience
  and hold it consistently — the uncommitted middle reads as default.
- One deliberate aesthetic risk per key screen — a distinctive choice
  (type, color, layout, imagery) that is justified in a sentence and
  consistent with the brand. Zero risks reads as template; several reads
  as noise.
- Tokens from the first mockup: colors, spacing and type steps live in
  `styles.css` as custom properties, because the frontend copies that
  file into the stack's token file and `pack` prints its `:root` block.

## Per-screen audit pass

Before presenting a revision round, audit each screen: typography
(hierarchy and scale hold), color (tokens only, contrast passes), layout
(rhythm, alignment, no structural tells above), states (empty/error/
loading exist where required), content (realistic data per the mockups
guide), iconography (one family, one weight, informative only).

The report is one fixed six-slot line per screen, never prose; a slot is
`pass` or `FAIL (reason)`:

```
invoice-list.html: typography: pass / color: pass / layout: pass / states: FAIL (no error state) / content: pass / iconography: pass
```

A FAIL is fixed before the round is presented, or named to the user as a
known gap; the line format keeps the audit scannable across many
screens and comparable between rounds.

## Sources

Distilled from Emil Kowalski's design-engineering skills (MIT) and
leonxlnx/taste-skill's redesign audit (MIT); structural-tell taxonomy
informed by concepts from pbakaus/impeccable (Apache-2.0; ideas only, no
prose copied).
