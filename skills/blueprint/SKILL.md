---
name: blueprint
description: Use after mockup approval to produce the normative docs, ADRs (stack decided here), technical spikes for unproven dependencies, the AI context system and repo mechanics.
---

# Blueprint (stage 4)

This skill runs stage 4 of the acdev pipeline: turning the approved product
definition into the normative documentation package, the architecture
decisions, and the repo mechanics that later stages depend on. Inputs are
ONLY the approved `docs/VISION.md`, the approved `docs/MVP.md`, and the
frozen mockups — nothing here reopens or reinvents those documents; it
derives from them.

## Normative docs

Choose the document set from `references/docs-catalog.md` and present the
proposed list to the user with a one-line reason per document before
writing anything.

`docs/ROADMAP.md` is ALWAYS produced: phase 1 is the MVP, taken directly
from `docs/MVP.md`; later phases come from VISION §7's phase sketch. Every
phase, including phase 1, gets verifiable exit criteria (facts that can be
checked, not wishes) and, where relevant, external lead times (API
approvals, compliance reviews, hardware procurement) that affect
scheduling regardless of engineering effort.

`docs/UI-DESIGN.md`, when applicable, derives its tokens and component
inventory from the approved mockups' `styles.css` — colors, spacing,
typography, and component variants are read out of the frozen mockups, not
redecided here.

## ADRs and spikes

Write one Architecture Decision Record per closed decision — stack,
hosting, data store, auth approach, tenancy model, and any other choice
with lasting weight — using `shared/references/templates/adr.md`. Keep
each ADR short: about 10 lines total across Context, Decision, and
Consequences.

This is where the stack gets decided. That decision, once recorded as an
ADR, is the single source of truth the rest of the pipeline reads instead
of re-deriving: the layer skills (frontend, api, data, auth, security,
performance, delivery, cicd) open `docs/adr/` before advising and treat the
stack as already settled, never re-litigating it.

While drafting an ADR, flag any decision that depends on something
unproven — a third-party API, a critical integration, a doubtful
performance requirement — and run `references/spike-protocol.md` before
freezing that ADR. A spike writes its success criterion before any code,
stays timeboxed to 2-6 hours, lives in `spikes/NNN-question/`, and its
result (works / does not work / works with limits) is recorded back in the
ADR. Spike code never merges into product code. A CRUD on a known stack
with no unproven dependency produces zero spikes — this step is optional
by design.

Classify every decision made in this stage per
`shared/references/decision-classification.md` (mechanical, taste,
user-challenge) and keep the running audit table in the blueprint summary
presented to the user, in the exact format
`| Decision | Class | Choice | Reason |`. Only user-challenge decisions
interrupt the user for a real answer; mechanical and taste decisions are
made and simply listed for review.

## AI context system

Generate `CLAUDE.md` at the project root from
`shared/references/templates/claude-md-router.md`. Its golden rules are
derived from VISION §2 (Model) plus the chosen stack — for example, a
multi-tenant model yields a golden rule like "every table change proves
isolation"; a payments-handling model yields one about never logging card
data. Keep the router under one page.

If multi-AI was chosen at intake (stage 0 of `new-project`), mirror the
same content to `AGENTS.md`. Both files must stay in sync and both stay
under one page — this is a router to context, not the context itself.

## Repo mechanics

Produce the mechanical scaffolding the project needs before build starts:

- `.gitignore` covering secrets and `.env*` files, plus the standard
  ignores for the chosen stack.
- `.env.example` listing every environment variable named in any ADR, with
  a one-line comment on what each one is for and no real values.
- A CI skeleton (lint, typecheck, test jobs) matching the chosen stack.
- `scripts/verify/` generated from
  `shared/references/templates/verify-script-stub.mjs`, one concrete
  verification command per applicable layer (auth, security/RLS,
  migrations, smoke). The plugin ships an agnostic stub; the project gets
  a concrete, runnable probe per layer — this is the agnosticism contract
  layer skills and `ship` rely on later. For the frontend layer,
  `shared/references/templates/verify-design-tells.mjs` ships ready-made
  (mechanical scan for transition: all, lone ease-in, scale(0), gradient
  text, over-budget durations, raw hex outside the token file); copy it
  in and adjust its targets.

## Gate

Present the full package — normative docs, ADRs, spikes (if any), the AI
context system, and repo mechanics — for user review. Apply corrections in
place. Once accepted, commit:

```
docs: full project blueprint and ai context system
```

Next step: the `build` skill. It starts ONLY on the user's explicit order
— finishing this gate is not itself the order to build.
