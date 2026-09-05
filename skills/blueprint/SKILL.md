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
scheduling regardless of engineering effort. For any project that
deploys, phase 1's exit criteria always include one more fact: the
rollback was rehearsed once (version N-1 deployed over a broken N,
service restored, drill recorded in the runbook). A pipeline that has
only ever gone forward is untested where it matters most.

`docs/RUNBOOK.md`, for any project that deploys somewhere users reach,
is written from `shared/references/templates/runbook.md`: service map,
deploy path, the exact rollback command, numeric control bands derived
from the phase budgets, the canary's inputs, alerts and escalation. It is
what `operate` reads after every deploy and on every incident; a band
left as prose ("acceptable latency") is a placeholder and fails the
no-placeholder rule.

`docs/UI-DESIGN.md`, when applicable, derives its tokens and component
inventory from the approved mockups' `styles.css` — colors, spacing,
typography, and component variants are read out of the frozen mockups, not
redecided here.

Close the document set by generating `docs/README.md` from
`shared/references/templates/docs-index.md`: one line per document
produced (what it is, when to read it) plus one line per series folder
(`adr/`, `plans/`, `designs/`, `domain/` when present). It is written
last, once the set is final — an index that precedes its documents is
guesswork.

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

Compliance is decided here too. From the jurisdictions named during the
VISION interview's complementary questions, write one ADR recording which
regulatory regimes apply, where data must reside, and what retention and
deletion obligations follow — or recording, explicitly, that none apply.
Jurisdiction and compliance posture are user-challenge decisions: asked,
never assumed from the product's domain. The data and security layer
checklists verify against this ADR during build.

While drafting an ADR, flag any decision that depends on something
unproven — a third-party API, a critical integration, a doubtful
performance requirement — and run `references/spike-protocol.md` before
freezing that ADR. A spike writes its success criterion before any code,
stays timeboxed to roughly 2-6 hours, lives in `spikes/NNN-question/`, and its
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

The router's `## Lessons` section starts empty. It is owned by
`scripts/lessons.mjs` from then on: `ship` and `operate` promote a
mistake into a rule there on its second occurrence, mirrored to
`AGENTS.md` automatically. Nobody hand-writes lessons into the router,
at blueprint or later.

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
- `scripts/verify/canary.mjs` from
  `shared/references/templates/canary-stub.mjs`, for any project that
  deploys: the post-deploy release check `operate` runs (health, smoke
  paths, p95 against the runbook band, error rate when the platform
  exposes it). Adjust its checks to `docs/RUNBOOK.md`; the runbook's
  Canary section documents the variables it reads.
- The guard, completed. `new-project` installed it at intake (or install
  it now per `shared/references/guard-install.md` if this project came
  through `onboard` without one). Fill `verify` in `.acdev/guard.json`
  with the commands a close must pass, in order: the `scripts/verify/`
  runner and the test command (lint and typecheck when the stack has
  them). From the first build slice, `git commit` is denied unless
  `node .claude/hooks/acdev-guard.mjs verify` recorded a green run on the
  current code tree; that is the red-check-blocks-close rule, enforced.
  Paste `node .claude/hooks/acdev-guard.mjs status` as evidence.

## Adversarial design review (optional)

When presenting the package for review, offer one optional pass before
approval: an adversarial design review per
`references/adversarial-review.md` — two independent panels with opposing
lenses (excess: what is over-designed; defect: what is missing), findings
contrasted before the freeze. It is the user's call — it costs real
tokens, and a small blueprint on a well-trodden stack may not need it.
But this is the highest-leverage review in the pipeline: a design error
caught here costs a conversation; the same error caught mid-build costs
slices. A high-severity finding is resolved or explicitly accepted by the
user before the gate below can close — like `ship`'s security pass,
acceptance is never automatic.

## Gate

Present the full package — normative docs, ADRs, spikes (if any), the AI
context system, and repo mechanics — for user review. Apply corrections in
place. Once accepted, commit:

```
docs: full project blueprint and ai context system
```

Advance the pipeline state in the same close (`node
"<plugin-root>/scripts/checkpoint.mjs" write --stage build --branch
<branch> --next "await the user's order to start slice 1"`). Only this
write unlocks product code in the guard; until it happens, any write
outside docs, mockups, spikes and repo mechanics is denied by the hook.

Next step: the `build` skill. It starts ONLY on the user's explicit order
— finishing this gate is not itself the order to build; the state write
above is not that order either.

**Model switch point and continuous-build offer.** When closing this
gate, advise the user: the thinking-heavy stages are done — everything
downstream is construction against approved documents (ADRs, frozen
mockups, just-in-time slice plans). Offer two choices in one message:

- Switch to a cheaper model (`/model`) for `build` — the document stages
  deserve the most capable model; construction follows instructions.
- Continuous build: with their explicit approval, `build` runs the whole
  MVP phase slice after slice without pausing between them, under the
  rules in `build`'s "Continuous build" section (per-slice quality gates
  stay; a user-challenge decision stops the run). Without that approval,
  build proceeds slice by slice as usual.
