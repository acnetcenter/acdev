# Guide: authoring mockups

Concrete rules for building the static HTML mockup set. The goal is a set of
pages a non-technical stakeholder can click through in a browser and
recognize as "the product," not a wireframe kit.

## Directory layout

- Everything lives flat under `mockups/` at the project root — no nested
  folders per flow or per screen. A flat directory keeps links simple and
  the set easy to scan.
- One shared stylesheet: `mockups/styles.css`, referenced by every page.
  Do not fork per-page styles; a single source of palette, typography, and
  spacing is the point (see below).
- `mockups/index.html` is the entry point, always present.

## Filenames

Kebab-case, one file per screen: `dashboard.html`, `invoice-list.html`,
`invoice-detail.html`, `settings.html`. The filename should tell a reader
what screen it is without opening it.

State variants live in their own file, suffixed and linked from the main
page, never toggled with JS: `invoice-list-empty.html`,
`invoice-list-error.html`, `invoice-list-loading.html`. Link to these from
the primary screen (e.g. a small "view empty state" link near the top) so
they stay reachable without cluttering the main flow.

## styles.css and design tokens

`styles.css` must use CSS custom properties for palette, typography, and
spacing — not hardcoded values scattered across pages:

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-primary: #2563eb;
  --color-border: #e2e2e2;
  --color-danger: #dc2626;
  --font-family: system-ui, sans-serif;
  --font-size-base: 16px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 32px;
}
```

These custom properties are not just convenience — they become the source
for the UI-DESIGN doc written later at `blueprint`. Name them clearly and
keep the set small and deliberate; a token sprawl here becomes a token
sprawl in the real design system.

## Semantic HTML

Use `<nav>`, `<header>`, `<main>`, `<table>`, `<form>`, `<button>`,
`<label>` for what they actually are, not `<div>` soup. The real frontend
inherits structural decisions from these pages, so a sloppy mockup produces
a sloppy build.

## Realistic data

Every page ships with data that looks like it came from real use of the
product, in the project's documentation language:

- Names: plausible full names in the target locale, not "John Doe" repeated
  everywhere or "Test User 1."
- Amounts: real-looking numbers with correct currency formatting for the
  locale (thousand separators, decimal marks, currency symbol placement).
- Dates: real-looking dates in the locale's expected format, spread across
  a believable range (not every row dated today).
- Statuses, categories, and other enums: the actual values from MVP.md, not
  invented ones.

Never use lorem ipsum, "Lorem ipsum dolor," `[placeholder]`, `TODO`, or
`Item 1 / Item 2 / Item 3` filler. If a real value is not known yet, invent
a plausible one rather than leaving a placeholder — a mockup with fake-but-
real-looking data is what makes stakeholders react to the actual product
instead of squinting past filler text.

## State variants

For each screen that depends on data that might not be there or might fail
to load — lists, dashboards, search results, anything backed by a fetch —
produce:

- Empty state: what the screen shows with zero records, including any
  call-to-action to create the first one.
- Error state: what the screen shows when the data fails to load.
- Loading state: what the screen shows mid-fetch, if the flow's timing
  makes this meaningfully different from the empty state.

Not every screen needs all three — a static settings page does not need a
loading state — but every screen with dynamic, possibly-absent, or
possibly-failing data does.

## index.html

Group links by flow, not alphabetically by filename: each of the MVP's
critical flows gets its own section listing the screens in the order a user
encounters them, with state variants noted inline. A reader should be able
to follow one flow top to bottom by clicking links in order, the same way
they will in the real product.

## JavaScript

None beyond trivial navigation (e.g. a mobile nav toggle, an accordion).
Mockups are static pages linked to each other with plain `<a href>`; no
client-side state, no fetch calls, no framework runtime. If a flow needs to
show a screen "after" an action, that is a separate HTML page, not a JS
state change.

## Accessibility floor

Because the real frontend inherits decisions made here, keep a minimum bar
on every page:

- Every input has a associated `<label>`.
- Text and background colors meet a reasonable contrast ratio — do not pick
  a token palette with light-gray-on-white body text.
- Focus order follows visual/reading order — do not reorder tab stops with
  `tabindex` tricks.
- Interactive elements are real `<button>`/`<a>` elements, not `<div
  onclick>`.

This is a floor, not a full accessibility audit — the goal is to not bake
inaccessible patterns into the visual contract that `build` will later
replicate.
