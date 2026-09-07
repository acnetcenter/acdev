# Adversarial design review protocol

Run this only when the user accepted the offer made at the blueprint
gate. Everything here happens BEFORE the package is approved and frozen.

## Panels

Run two independent panels via the native Agent tool (it already knows
how to run subagents). Each panel receives the file paths of the package
(`docs/*.md`, `docs/adr/`, `mockups/SPEC.md`, `mockups/index.html`,
spike results if any) plus its lens, and reads the files itself; the
package is never pasted into the prompt, since a subagent is a fresh
context and pasting re-emits at output cost what it can read at input
cost. Neither panel knows of the other:

- **The excess panel** attacks what is there: over-design, speculative
  structure, complexity the MVP does not pay for, dependencies that
  could be dropped, scope VISION never asked for.
- **The defect panel** attacks what is missing: unhandled failure modes,
  scale and tenancy traps, unproven dependencies with no spike, security
  or compliance gaps, exit criteria that cannot actually be verified.

When the user wants extra diversity, run the panels on different models;
opposing lenses find more than a second copy of the same reviewer.

## Bounded return

Each panel returns findings severity-first, one line each (file, finding,
severity): every high or critical finding in full, then at most 10
lower-severity findings ordered by severity, then one closing line saying
how many were omitted if more exist ("12 low findings omitted"). Nothing
else comes back: no restated context, no quoted documents.

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
