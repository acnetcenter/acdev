# Motion craft

Reference for `layer-frontend`. Durable animation rules for the real
frontend built during `build` — mockups are static; motion is decided
here, as taste-class decisions in the slice's audit table.

## When to animate at all

Frequency decides. The more often a user triggers an action, the shorter
its animation should be — or absent. A hover used hundreds of times a
session gets 100-160ms or nothing; a modal opened occasionally can afford
more. Never make a frequent action wait for a decoration.

## Duration by element

| Element | Duration |
|---|---|
| Hover / focus / pressed states | 100-160ms |
| Tooltip, dropdown, popover | 150-250ms |
| Modal, dialog | 200-350ms |
| Sheet, drawer, page transition | 300-500ms |

Nothing over 500ms without a written justification in the audit table —
and a `motion-ok` comment on the offending line, which is what tells the
mechanical scan the exception is deliberate.

## Easing

- Entrances and user-triggered changes: ease-out (fast start, settle).
- Movement within the screen (reorder, resize): ease-in-out.
- Never ease-in alone — it makes the UI feel like it hesitates.
- Linear only for continuous loops (spinners, marquees).

## Hard rules

- Animate only `transform` and `opacity`. Never animate layout properties
  (width, height, top/left, margin) or box-shadow directly — cross-fade a
  pseudo-element's opacity instead.
- Never `transition: all` — it animates properties you did not intend and
  breaks the moment someone adds one.
- Never enter from `scale(0)`; start at 0.9-0.97 so the element appears,
  not inflates.
- `transform-origin` matches the trigger: a popover grows from the button
  that opened it, not from its own center. Exception: modals and dialogs
  keep `transform-origin: center` — they are anchored to the viewport,
  not to the trigger.
- Respect `prefers-reduced-motion`: nonessential animation is removed or
  reduced to opacity, and the flow still works.
- Transitions are interruptible: input is never blocked while an
  animation plays; a second click mid-animation wins.

## Verification

`shared/references/templates/verify-design-tells.mjs` mechanically scans
for `transition: all`, lone ease-in, `scale(0)`, gradient text and
over-budget durations (CSS, JS object styles, Framer Motion props and
Tailwind classes) — `blueprint` copies it into `scripts/verify/` for the
frontend layer. A justified exception is silenced per line with a
`motion-ok` comment; token files are exempt because they declare the
scale rather than use it. Reduced-motion needs a manual pass: load the
critical flow with reduced motion enabled and confirm it works.

## Sources

Distilled from Emil Kowalski's design-engineering and animation skills
(MIT) and Apple's fluid-interface principles as translated there.
