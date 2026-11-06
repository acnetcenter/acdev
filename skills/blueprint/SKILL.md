---
name: blueprint
description: "Use after mockup approval to record the lasting decisions as ADRs (stack decided here), write the ROADMAP, run technical spikes for unproven dependencies, and set up CLAUDE.md, the verification commands and the repo mechanics."
---

# Blueprint (decisions before code)

Inputs are only the approved `docs/PRODUCT.md`, the approved `docs/MVP.md`
and, when the product has a UI, the frozen mockups with `mockups/SPEC.md`.
Nothing here reopens them; it derives from them.

The job is to make the decisions that are expensive to change, write them
where every later session will find them, and leave the repo ready for
the first slice to be verified. A document that only restates what the
code will say is not produced: a session reads the repo.

## Decisions

One ADR per lasting decision (stack, hosting, data store, auth approach,
tenancy model, each third-party integration), about 10 lines each:
`acdev scaffold adr docs/adr/NNNN-<slug>.md`. Write the Decision section
as the one or two lines a builder needs.

The stack is decided here, and its ADR is the single source: later
sessions read it and never re-derive it. Once it is accepted, replace the
`## Stack` line in `docs/PRODUCT.md` with the decided stack. That document
is approved, so the guard stops the edit; the user's acceptance of the
stack is the yes it needs, and its message says how to go on.

Compliance is decided here too. From the jurisdictions in PRODUCT.md
"Operating Context", write one ADR recording which regulatory regimes
apply, where data must reside and what retention and deletion obligations
follow, or recording explicitly that none apply. Jurisdiction and
compliance posture are user-challenge decisions: asked, never assumed
from the product's domain.

A decision that depends on something unproven runs
`references/spike-protocol.md` before its ADR freezes, and the result is
recorded in the ADR. Spike code never merges into product code. A CRUD on
a known stack produces zero spikes.

Classify every decision per
`../../shared/references/decision-classification.md`. Only user-challenge
decisions interrupt the user. Mechanical decisions are just made; taste
decisions are made and listed in the audit table, exact format
`| Decision | Class | Choice | Reason |`.

## Documents

Choose the set from `references/docs-catalog.md` and present it before
writing anything: one line per document with its reason and its reader. A
document without a reader is not produced. `docs/ROADMAP.md` is always
produced, every phase with verifiable exit criteria; phase headings are
plain ("## Phase 1: MVP") and the phase exit appends " (complete)", which
is how `acdev status` finds the current phase. A project that deploys
somewhere users reach gets `docs/RUNBOOK.md` with numeric control bands.

## CLAUDE.md

`acdev scaffold claude-md CLAUDE.md`, then fill the placeholders: the
golden rules come from PRODUCT.md "Model" plus the stack, the commands
are the ones a session cannot guess. It loads in every session, so it
stays under 60 lines and holds nothing the code already says. If other
coding agents are used, `AGENTS.md` is a copy of it (`cp CLAUDE.md
AGENTS.md`) that `acdev close` regenerates from then on.

## Repo mechanics

Per `references/repo-mechanics.md`, ending with the project's
verification commands in `.acdev/guard.json`. Evidence: `acdev status`.

## Adversarial design review (optional)

When presenting the package, offer one optional pass before approval, per
`references/adversarial-review.md`: two panels with opposing lenses. It
is the user's call, because it costs real tokens; a design error caught
here costs a conversation, and mid-build it costs slices. A high-severity
finding is resolved or explicitly accepted by the user before the gate
closes.

## Gate

**Gate.** Present the package as a list, never as document bodies (the
user reads the files): the document table (path, reader, lines), the ADR
titles with their one-line Decision, the audit table, and the `acdev
status` output. Apply corrections as Edits, then ask for explicit
acceptance; nothing is committed before it. On acceptance commit `docs:
project blueprint`, then advance the state:

```
acdev checkpoint write --stage build --branch <branch> --next "await the user's order to start slice 1"
```

Only this write unlocks product code in the guard.

Next is the `build` skill. It starts only on the user's explicit order:
closing this gate is not that order, and neither is the state write.

When closing the gate, say two things in one message. Construction can
run on a cheaper model or a lower effort than planning did, since tests
judge it and the guard blocks a red commit; a model change belongs at the
start of a fresh session, because switching mid-session re-reads the
whole conversation uncached. And the whole phase can be built without
pauses between slices (`build`, continuous mode) if the user asks for it.
