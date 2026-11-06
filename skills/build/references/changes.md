# Changes, incidents and later phases

Reference for `build`.

## A change the user asks for

A correction or an addition outside the phase's planned slices is a
mini-slice, not a side edit.

- Its plan is the request captured as a spec:
  `docs/plans/YYYY-MM-DD-<topic>.md`, frontmatter `status: active`, at
  most 60 lines: the request in the user's own terms, then goal + verify
  steps (each step names the command or the observable check that proves
  it), then the audit table. A small fix skips the file; the CHANGELOG
  line the close writes is its trace.
- If the request changes what the product does, confirm it with the user
  first, then amend `docs/PRODUCT.md` or `docs/MVP.md` in the same commit
  as the code. The guard stops those edits until the user agrees, and its
  message says how to go on; that is the gate working.
- It runs through the same loop and closes with `acdev close --slice
  "change: <topic>" --plan <spec> --next "<parked slice>" --changelog
  "<what changed>"`.
- If a slice is in progress when the request arrives, park it first
  (stash or branch) so the close commits only the change, restore it
  afterwards, and name the resumed slice in `--next`.

## An incident

Production misbehaves, or the canary is red after a deploy.

1. **Roll back before root cause.** If a release is the suspect, roll
   back per `docs/RUNBOOK.md` and confirm the canary is green on the
   restored version; diagnose afterwards, on the logs. The one exception
   is the runbook's own "unsafe when" clause (a migration already
   contracted, an irreversible external effect): choosing to roll forward
   is a user-challenge decision, put to the user with the evidence.
2. **Spec before fix.** `acdev scaffold incident
   docs/plans/YYYY-MM-DD-incident-<slug>.md`: symptom, impact, timeline,
   immediate action, root cause, fix as goal + verify steps, prevention.
   While that plan is `status: active`, `acdev status` puts it first: an
   open incident outranks any planned slice.
3. **Fix as a mini-slice.** The reproducing test first; the test is the
   spec of the fix, so a fix that needs the test changed is a change of
   spec and goes to the user. Root cause, not symptom. Close with `--slice
   "change: <incident>" --plan <incident spec>`.
4. **Prevention is part of the spec.** The mechanical check that would
   have caught it (a test, a probe, a canary path, an alert band), or the
   reason none is possible; a rule added to `CLAUDE.md` if the mistake
   would repeat; the runbook corrected in the same commit when the
   incident proved a band, a command or a contact wrong.

Never change production by hand without a paper trail: a dashboard edit
or a flipped flag is recorded in the runbook or an ADR in the same
session, or it is drift the next deploy reverts.

## Later phases

A phase beyond the MVP starts with its own gates: mockups for its new
screens through the `mockups` skill (`acdev mockup-spec --write` extends
`mockups/SPEC.md`), and ADRs for its new decisions. The stage stays
`build` throughout. Then its slices are
planned and built the same way, starting with that phase's slice 1, which
needs no walking skeleton: the delivery path was proven in phase 1.
