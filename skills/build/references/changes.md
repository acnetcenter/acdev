# User-requested changes, incidents and post-MVP phases

Reference for `build`.

## A change asked for mid-build

A correction or addition the user asks for outside the current phase's
planned slices is a mini-slice, not a side edit. `next --change "<topic>"`
prints the step; the rules:

- It gets its own plan file per the `planning` skill: the request captured
  as a spec in the user's own terms (`status: active`, at most 60 lines),
  then goal + verify steps. Only a genuinely trivial fix (a typo, a
  one-line tweak with no behavior change) skips the file; the CHANGELOG
  line `close` writes is its trace.
- If the request changes what the product should do, the user-challenge
  gate and the VISION/MVP drift rule apply first: confirm, then amend the
  document in the same commit as the code.
- It runs through the same TDD and verification loop and closes through
  `close --slice "change: <topic>" --plan <spec> --next "<parked slice>"`.
- If a slice is in progress when the request arrives, park it first (stash
  or branch) so the close commits only the change's files, restore it
  afterwards, and name the resumed slice in `--next`.

## An incident

The same mini-slice with a different origin: its spec is the incident file
`operate` writes (`docs/plans/*-incident-*.md`), and it enters build once
that spec exists, never before. `next` routes to it automatically while
the incident plan is `status: active`, because an open incident outranks
any planned slice.

## Post-MVP phases

When a phase beyond the MVP starts, its screens have no mockups yet: they
are built just-in-time, at the start of that phase, through the `mockups`
skill under the same hard gate used for the MVP, and `mockup-spec --write`
extends `mockups/SPEC.md` with the new screens. Once frozen, the phase's
slices are planned and built through the same steps, starting with that
phase's own slice 1, which needs no walking skeleton: the delivery
pipeline was proven in phase 1.
