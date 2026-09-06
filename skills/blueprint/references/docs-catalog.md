# Normative docs catalog

Reference for `blueprint` when proposing which documents to produce for a
project. Every document here is optional except the almost-always set;
choose based on what the approved VISION and MVP actually require, not on
completeness for its own sake. Every document has a named reader inside
the pipeline and a size cap; a document nobody reads is maintenance cost
without a return, and a document over its cap is hiding a decision that
belongs in an ADR.

## Almost always

Produced for nearly every project; skip only with an explicit reason
stated to the user.

| Doc | When | Reader | Cap |
|---|---|---|---|
| `docs/README.md` | Always. The index of `docs/`: one line per singleton doc (what it is, when to read it) plus one line per series folder (`adr/`, `plans/`, `designs/`, `domain/` when present); series are never indexed file by file. Written last, once the doc set is final; `close` blocks when a singleton doc is added or removed without touching it. | Humans; the close's index check | One line per entry |
| `docs/ROADMAP.md` | Always. Phase 1 = the MVP from MVP.md, later phases from VISION §7, each with verifiable exit criteria and external lead times. Plain phase headings; the phase exit appends " (complete)". | `pack`, `status`, the phase exit | 20 lines per phase |
| `docs/ARCHITECTURE.md` | Any project beyond a trivial script: system shape, components, data flow, links to the ADRs that decided them. | The eight layer skills before advising | 60 lines |
| `docs/adr/NNNN-*.md` | Always, one per closed decision. The stack and every other lasting choice are recorded here; the Decision section is what the pack quotes to every slice. | `pack`, the layer skills | 10 lines each |

## Conditional

Produce these only when the condition holds; state the reason when
proposing the list.

| Doc | Condition | Contents | Reader | Cap |
|---|---|---|---|---|
| `docs/DATA-MODEL.md` | The project has a database AND the schema is not self-describing in code (no migrations or ORM schema to read). When the schema is code, the schema plus the data-store ADR is the model, and the PII and tenant-ownership notes go to SECURITY.md. | Entities and relationships, tenant-owned tables (multi-tenant models), PII columns marked with their retention rule. | `layer-data` | 60 lines |
| `docs/SECURITY.md` | The project has auth, is multi-tenant, handles PII, handles payments, or has role-based access. | Permission matrix (resource x role), tenant and data isolation approach, encryption and secrets handling, retention policy, PII notes when there is no DATA-MODEL, incident response contact and steps. | `layer-auth`, `layer-security`, the phase-exit security pass | 80 lines |
| `docs/UI-DESIGN.md` | The project has a relevant UI. | Design tokens and component inventory derived from the approved mockups' `styles.css` and `mockups/SPEC.md`, not redecided here. | `layer-frontend` | 60 lines |
| `docs/RUNBOOK.md` | The project deploys somewhere users reach (a hosted app, an API, a worker with SLAs). | From `shared/references/templates/runbook.md`: service map with health endpoints, deploy path and who authorizes production, the exact rollback command and its last rehearsal, numeric control bands, the canary's inputs, alerts, escalation, the post-release security rescan. | `operate`, `layer-delivery` | 100 lines |
| A central-domain doc (`docs/domain/PRICING-MODEL.md`, `docs/domain/SCHEDULING-RULES.md`) | One domain concept is central enough to define the product (a pricing engine, a scheduling algorithm, a compliance ruleset). | The rules of that concept in enough depth that build does not reinvent them ad hoc. The one singleton category that can multiply per project. | The slices that implement it, via the plan | 80 lines each |

Integrations with third-party APIs get no document of their own: each
integration is an ADR (scope, credentials provisioning lead time, sandbox
versus production differences, the `external-apis` or `webhooks` profile
tag it justifies) and, when it affects operations, a line in the runbook's
service map. Nothing in build reads an integrations document; ADRs are
read by every slice.

## Never at blueprint time

- Specs for future phases. Post-MVP phases get their own spec and mockups
  just-in-time, phase by phase, when that phase actually starts.
- Speculative domain skills. A domain skill is created only when build
  reaches a slice that needs it.
- Hollow "complete" documents. A document with every section header but
  no real content is worse than not having it; every section written
  carries actual decisions or facts.

## Coherence rules

- VISION wins any conflict. If a child document contradicts VISION,
  VISION is correct and the child document is fixed, never the other way
  around.
- Every child document links back to VISION in its header, so a reader
  can always trace a normative doc to the source of truth it derives from.
- If a future change alters a decision recorded in one of these
  documents, it is captured as a new or superseding ADR, not as a silent
  edit; decisions have a paper trail.
- The close's drift list names the docs that mention the changed files;
  those are corrected in the same commit. A document nothing names for a
  whole phase is a candidate for folding into an ADR at the phase exit.
