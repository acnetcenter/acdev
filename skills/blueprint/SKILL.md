---
name: blueprint
description: Use after mockup approval to produce the normative docs, ADRs (stack decided here), technical spikes for unproven dependencies, the AI context system and repo mechanics.
---

# Blueprint (stage 4)

Stage 4 of the acdev pipeline: turning the approved product definition
into the normative documentation package, the architecture decisions, and
the repo mechanics that later stages depend on. Inputs are ONLY the
approved `docs/VISION.md`, the approved `docs/MVP.md`, and the frozen
mockups with their `mockups/SPEC.md`. Nothing here reopens or reinvents
those documents; it derives from them.

## Normative docs

Choose the document set from `references/docs-catalog.md` and present the
proposed list to the user before writing anything: one line per document
with its reason, its reader (the skill or step that will open it) and its
size cap. A document without a reader is not produced; a document over
its cap is hiding a decision that belongs in an ADR.

`docs/ROADMAP.md` is ALWAYS produced: phase 1 is the MVP, taken directly
from `docs/MVP.md`; later phases come from VISION §7's phase sketch. Every
phase gets verifiable exit criteria (facts that can be checked, not
wishes) and, where relevant, external lead times (API approvals,
compliance reviews, procurement). For any project that deploys, phase 1's
exit criteria include one more fact: the rollback was rehearsed once
(version N-1 deployed over a broken N, service restored, drill recorded
in the runbook). Phase headings are plain ("## Phase 1: MVP"); the phase
exit appends " (complete)" to the heading, which is how the dispenser and
the pack find the current phase.

`docs/RUNBOOK.md`, for any project that deploys somewhere users reach, is
written from `shared/references/templates/runbook.md`: service map,
deploy path, the exact rollback command, numeric control bands derived
from the phase budgets, the canary's inputs, alerts and escalation. It is
what `operate` reads after every deploy; a band left as prose
("acceptable latency") is a placeholder and fails the no-placeholder rule.

`docs/UI-DESIGN.md`, when applicable, derives its tokens and component
inventory from the approved mockups' `styles.css` and `mockups/SPEC.md`;
colors, spacing, typography and component variants are read out of the
frozen mockups, not redecided here.

Close the document set by generating `docs/README.md` from
`shared/references/templates/docs-index.md`: one line per document
produced plus one line per series folder (`adr/`, `plans/`, `designs/`,
`domain/` when present). It is written last, once the set is final.

## ADRs and spikes

Write one Architecture Decision Record per closed decision (stack,
hosting, data store, auth approach, tenancy model, any other choice with
lasting weight) using `shared/references/templates/adr.md`, about 10
lines each. The Decision section is what the pack quotes to every build
slice; write it as the one or two lines a builder needs.

This is where the stack gets decided. Recorded as an ADR, it is the single
source of truth the rest of the pipeline reads instead of re-deriving:
the layer skills open `docs/adr/` before advising and never re-litigate
it.

Compliance is decided here too. From the jurisdictions named during the
VISION interview, write one ADR recording which regulatory regimes apply,
where data must reside, and what retention and deletion obligations
follow, or recording, explicitly, that none apply. Jurisdiction and
compliance posture are user-challenge decisions: asked, never assumed
from the product's domain.

Then write `.acdev/profile.json` from
`shared/references/templates/profile.json`: the `tags` the ADRs justify,
from the vocabulary in `shared/references/profile-tags.md`
(`multi-tenant`, `payments`, `pii`, `jobs`, `deploys`...). The layer
checklists drop the items whose tags the project lacks; an absent
profile keeps every item. List it in the audit table.

While drafting an ADR, flag any decision that depends on something
unproven (a third-party API, a critical integration, a doubtful
performance requirement) and run `references/spike-protocol.md` before
freezing that ADR. A spike writes its success criterion before any code,
stays timeboxed to roughly 2-6 hours, lives in `spikes/NNN-question/`,
and its result (works / does not work / works with limits) is recorded
back in the ADR. Spike code never merges into product code. A CRUD on a
known stack with no unproven dependency produces zero spikes.

Classify every decision made in this stage per
`shared/references/decision-classification.md` and keep the running audit
table in the blueprint summary, in the exact format `| Decision | Class |
Choice | Reason |`. Only user-challenge decisions interrupt the user;
mechanical and taste decisions are made and listed for review.

## AI context system

Generate `CLAUDE.md` at the project root from
`shared/references/templates/claude-md-router.md`. Its golden rules are
derived from VISION §2 (Model) plus the chosen stack: a multi-tenant
model yields "every table change proves isolation"; a payments-handling
model yields "card data is never logged". Keep the router under one page:
it is a router to context, not the context itself, and it loads in every
session of the project.

If multi-AI was chosen at intake, mirror the same content to `AGENTS.md`
and keep both in sync. The router's `## Lessons` section starts empty and
is owned by the lessons script from then on; nobody hand-writes lessons
into it.

## Repo mechanics

Produce the mechanical scaffolding per `references/repo-mechanics.md`:
`.gitignore`, `.env.example`, the CI skeleton, `scripts/verify/` with one
concrete probe per applicable layer, the canary for projects that deploy,
and the guard completed with its `verify` commands. The evidence that
closes this section is `node .claude/hooks/acdev-guard.mjs status`.

## Adversarial design review (optional)

When presenting the package, offer one optional pass before approval: an
adversarial design review per `references/adversarial-review.md`, two
independent panels with opposing lenses (excess: what is over-designed;
defect: what is missing), findings contrasted before the freeze. It is
the user's call; it costs real tokens, and a small blueprint on a
well-trodden stack may not need it. But a design error caught here costs
a conversation; the same error caught mid-build costs slices. A
high-severity finding is resolved or explicitly accepted by the user
before the gate below can close; acceptance is never automatic.

## Gate

Present the full package (normative docs, ADRs, spikes if any, profile,
the AI context system, repo mechanics) for user review. Apply corrections
in place. Once accepted, commit:

```
docs: full project blueprint and ai context system
```

Advance the pipeline state in the same close (`node
"<plugin-root>/scripts/acdev.mjs" checkpoint write --stage build --branch
<branch> --next "await the user's order to start slice 1"`;
`<plugin-root>` is the path printed as `acdev plugin root:` at session
start). Only this write unlocks product code in the guard.

Next step: the `build` skill. It starts ONLY on the user's explicit
order; finishing this gate is not itself the order to build, and the
state write above is not that order either.

**Model switch point and continuous-build offer.** When closing this
gate, advise the user: the thinking-heavy stages are done, and everything
downstream is construction against approved documents. Offer two choices
in one message: switch to a cheaper model (`/model`) for `build`, since
construction follows instructions and the guard judges the result; and
continuous build, interactive or headless, under `build`'s
`references/continuous.md` (per-slice gates stay; a user-challenge
decision stops the run). Without that approval, build proceeds slice by
slice as usual.
