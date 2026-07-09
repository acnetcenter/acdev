# Guide: cutting a good MVP

MVP.md is not a new invention — it is the smallest slice of the approved
VISION that already delivers real, end-to-end value. Cutting it well is a
discipline, not a formality.

## The cut

- Aim for the smallest scope that delivers real value end-to-end. "Smallest"
  means fewest features, not thinnest quality — every included flow must work
  completely, not partially.
- Every item in the IN list must trace back to one of the 3-5 critical flows
  named in VISION §5. If a proposed IN item does not trace to a flow, it
  probably does not belong in the MVP.
- The OUT list is as explicit and complete as the IN list. Every OUT item
  names the target phase it moves to, taken from the phase sketch in VISION
  §7. "Out" without a destination phase is a gap, not a decision.
- Success criteria are observable facts, with numbers where possible: "10
  real users complete flow X unaided," not "users like it" or "the flow
  works well."

## The derivation rule

MVP.md is derived from VISION.md, not the other way around. If cutting the
MVP surfaces a gap, contradiction, or undecided point in VISION — a flow that
does not fully make sense, a model question left ambiguous, a feature that
seems required but is not in VISION §5 — STOP. Resolve it in VISION.md first,
with the user. Never patch the gap directly into MVP.md: a child document
does not get to disagree with its source.

## Looking ahead to the build stage

The first vertical slice built in the `build` skill will be the walking
skeleton: the thinnest possible end-to-end path through the MVP, deployed
end to end. A well-cut MVP.md makes that slice obvious; a bloated one hides
it. Keep this in mind while drawing the IN/OUT line.

## Anti-patterns

An "MVP" is not well cut if it contains:

- An admin panel nobody asked for in VISION.
- Theming, white-labeling, or customization screens.
- Settings screens with options nobody requested.
- Any feature justified by "we'll need it eventually" rather than by a flow
  in VISION §5.

These are signs the cut was made by adding convenient scope instead of
subtracting down to real value.
