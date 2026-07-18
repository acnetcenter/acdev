# Adversarial design review protocol

Run this only when the user accepted the offer made at the blueprint
gate. Everything here happens BEFORE the package is approved and frozen.

## Panels

Run two independent panels via the native Agent tool (it already knows
how to run subagents). Each panel receives the full package — normative
docs, ADRs, spike results, the mockups contract — and no knowledge of
the other panel:

- **The excess panel** attacks what is there: over-design, speculative
  structure, complexity the MVP does not pay for, dependencies that
  could be dropped, scope VISION never asked for.
- **The defect panel** attacks what is missing: unhandled failure modes,
  scale and tenancy traps, unproven dependencies with no spike, security
  or compliance gaps, exit criteria that cannot actually be verified.

When the user wants extra diversity, run the panels on different models;
opposing lenses find more than a second copy of the same reviewer.

## Contrast before presenting

Contrast the findings before showing them: what both panels flag comes
first; a finding one panel raises and the other contradicts is presented
as contested, with both views.

## Routing the findings

- A resulting design change is a user-challenge decision — presented,
  never auto-applied.
- A plain document-clarity fix is applied directly.
- A high-severity finding blocks the gate: it is resolved, or its
  acceptance is put to the user explicitly — never automatic. The skill
  body carries this rule too; the gate enforces it.
