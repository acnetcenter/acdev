# Normative docs catalog

Reference for `blueprint` when proposing which documents to produce for a
project. Every document here is optional except the almost-always set —
choose based on what the approved VISION and MVP actually require, not on
completeness for its own sake.

## Almost always

These are produced for nearly every project; skip only with an explicit
reason stated to the user.

| Doc | When |
|---|---|
| `docs/ROADMAP.md` | Always. Phase 1 = the MVP from MVP.md, later phases from VISION §7, each phase with verifiable exit criteria and external lead times. |
| `docs/ARCHITECTURE.md` | Any project beyond a trivial script or single-file tool: system shape, components, data flow, key technical decisions summarized (links to the ADRs that decided them). |
| `docs/adr/NNNN-*.md` | Always, one per closed decision. This is where the stack and other lasting choices are recorded — see `SKILL.md`. |

## Conditional

Produce these only when the condition holds; state the reason when
proposing the list.

| Doc | Condition | Contents |
|---|---|---|
| `docs/DATA-MODEL.md` | The project has a database. | Entities and relationships, which tables are tenant-owned (in multi-tenant models), and which columns hold PII, marked explicitly. |
| `docs/SECURITY.md` | The project has auth, is multi-tenant, handles PII, handles payments, or has role-based access. | Permission matrix (resource x role), tenant/data isolation approach, encryption and secrets handling, data retention policy, incident response contact and steps. |
| `docs/UI-DESIGN.md` | The project has a relevant UI. | Design tokens and component inventory derived from the approved mockups' `styles.css` — not redecided here. |
| `docs/INTEGRATIONS.md` | The project depends on third-party APIs. | Scope of each integration, rate limits, credential provisioning lead times, sandbox vs. production environment differences. |
| A central-domain doc (e.g. `docs/PRICING-MODEL.md`, `docs/SCHEDULING-RULES.md`) | One domain concept is central enough to define the product (a pricing engine, a scheduling algorithm, a compliance ruleset). | The rules of that concept in enough depth that build does not have to reinvent them ad hoc. |

Do not produce a conditional doc "just in case." If the condition does not
clearly hold against the approved VISION/MVP, leave it out and say why.

## Never at blueprint time

- Specs for future phases. Post-MVP phases get their own spec and mockups
  just-in-time, phase by phase, when that phase actually starts.
- Speculative domain skills. A domain skill is created only when build
  reaches a slice that needs it, not preemptively.
- Hollow "complete" documents — a document with every section header but
  no real content is worse than not having the document; every section
  written must carry actual decisions or facts.

## Coherence rules

- VISION wins any conflict. If a child document (ROADMAP, ARCHITECTURE,
  DATA-MODEL, SECURITY, UI-DESIGN, INTEGRATIONS, an ADR) contradicts
  VISION, VISION is correct and the child document is fixed — never the
  other way around.
- Every child document links back to VISION in its header, so a reader can
  always trace a normative doc to the source of truth it derives from.
- If a future change alters a decision recorded in one of these documents,
  it is captured as a new or superseding ADR, not as a silent edit —
  decisions have a paper trail.
