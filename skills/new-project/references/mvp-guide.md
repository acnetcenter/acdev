# Guide: cutting a good MVP

MVP.md is not a new invention: it is the smallest part of the approved
PRODUCT.md that already delivers real, end-to-end value.

## Procedure

1. `acdev scaffold mvp docs/MVP.md`, in the documentation language, then
   replace each `<!-- ... -->` guidance comment with real content.
2. Cut, in this order: what is IN (a numbered list), what is explicitly
   OUT, and the success criteria, per the rules below.
3. Each section is pasted in the reply as document text with the question
   below it, corrected with the user, and Edited into the file right
   after; no whole-document write follows. A revision Edits the changed
   section, shows it, then presents the full document once more.
4. After the gate closes: `acdev checkpoint write --stage mockups --branch
   <branch> --next "mockups of every MVP screen"` (or `--stage blueprint`
   when the product has no UI and the user confirmed the skip), then
   commit `docs: mvp contract`.

## The cut

- The smallest scope that delivers value end to end. Smallest means
  fewest features, not thinnest quality: every included flow works
  completely.
- Every IN item traces to one of the critical flows in PRODUCT.md. An
  item that traces to none probably does not belong.
- The OUT list is as explicit as the IN list and is grouped by the later
  phase each item moves to, one line per phase naming its theme. That
  grouping is the phase sketch the ROADMAP is written from. "Out" with no
  destination is a gap, not a decision.
- Success criteria are observable facts, with numbers where possible:
  "10 real users complete flow X unaided", not "users like it".

## The derivation rule

MVP.md derives from PRODUCT.md, never the other way around. If the cut
surfaces a gap or an undecided point there (a flow that does not hold
together, a model question left ambiguous, a feature that seems required
but is not listed), stop and resolve it in PRODUCT.md first, with the
user.

## Looking ahead

The first slice of the build is the walking skeleton: the thinnest path
through the MVP, deployed. A well-cut MVP makes that slice obvious.

## Signs of a bad cut

An admin panel nobody asked for; theming or white-labeling; settings
screens with options nobody requested; anything justified by "we will
need it eventually" instead of by a critical flow.
