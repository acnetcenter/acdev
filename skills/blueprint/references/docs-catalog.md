# Document catalog

Reference for `blueprint`. Every document has a named reader and a size
cap. A document nobody reads is maintenance cost without a return, and a
document that restates the code goes stale the first time the code moves:
a session reads the repo, so write down only what the repo cannot say
(decisions, numbers, commitments).

## Always

| Doc | Contents | Reader | Cap |
|---|---|---|---|
| `docs/adr/NNNN-*.md` | One per lasting decision; the Decision section is the one or two lines a builder needs. Integrations are ADRs too (scope, credential lead time, sandbox versus production). | Every session that touches the decision | 10 lines each |
| `docs/ROADMAP.md` | Phase 1 is the MVP; later phases come from the MVP's out-of-scope groups. Each phase has verifiable exit criteria and any external lead times. For a project that deploys, phase 1's exit includes a rehearsed rollback. | `acdev status`, the phase exit | 20 lines per phase |
| `CLAUDE.md` | Golden rules, commands, how work closes (`acdev scaffold claude-md CLAUDE.md`). | Every session | 60 lines |

## Only when the condition holds

State the reason when proposing the list.

| Doc | Condition | Contents | Cap |
|---|---|---|---|
| `docs/RUNBOOK.md` | The project deploys somewhere users reach. | `acdev scaffold runbook docs/RUNBOOK.md`: service map with health endpoints, deploy path, the exact rollback command and its last rehearsal, numeric control bands, the canary's inputs, alerts, escalation. A band left as prose is a placeholder. | 100 lines |
| `docs/SECURITY.md` | Auth with roles, multi-tenancy, personal data or payments. | The permission matrix (resource x role), the isolation approach, secrets handling, retention policy, incident contact. | 80 lines |
| `docs/DATA-MODEL.md` | There is a database and the schema will not be readable from code (no migrations or ORM schema). | Entities, relationships, tenant-owned tables, personal-data columns with their retention rule. | 60 lines |
| `docs/ARCHITECTURE.md` | More than one deployable, or a shape a reader could not infer from the repo. | System shape, data flow, links to the ADRs. | 40 lines |
| `docs/domain/<CONCEPT>.md` | One domain concept defines the product (a pricing engine, a scheduling rule set). | Its rules, in enough depth that build does not reinvent them. | 80 lines each |

## Not produced

- A UI design document. `mockups/SPEC.md` and `mockups/styles.css` are
  the visual contract; a design tool may record `DESIGN.md` from the
  built code afterwards.
- An index of `docs/`, an integrations document, specs for future
  phases, hollow documents with headers and no decisions.

## Coherence rules

- PRODUCT.md wins any conflict: the child document is fixed, never the
  other way around.
- A change to a recorded decision is a new or superseding ADR, never a
  silent edit.
- `acdev close --check` lists the documents that mention the changed
  files; those are corrected in the same commit. A document nothing
  touched for a whole phase is a candidate for folding into an ADR at
  the phase exit.
- The package is presented at the gate as a list, never as quoted
  document bodies.
