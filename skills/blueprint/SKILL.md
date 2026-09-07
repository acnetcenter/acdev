---
name: blueprint
description: Use after mockup approval to produce the normative docs, ADRs (stack decided here), technical spikes for unproven dependencies, the AI context system and repo mechanics.
---

# Blueprint (stage 4)

Stage 4 of the acdev pipeline: the normative documentation package, the
architecture decisions and the repo mechanics. Inputs are ONLY the approved
`docs/VISION.md`, the approved `docs/MVP.md`, and the frozen mockups with
their `mockups/SPEC.md`. Nothing here reopens those documents; it
derives from them.

## Normative docs

Choose the document set from `references/docs-catalog.md` and present the
proposed list to the user before writing anything: one line per document
with its reason, its reader and its size cap. A document without a reader
is not produced; a document over its cap is hiding a decision that
belongs in an ADR. Two further contracts bind:

- `docs/ROADMAP.md` is ALWAYS produced, every phase with verifiable exit
  criteria (checkable facts, not wishes); for a project that deploys,
  phase 1's exit includes the rehearsed rollback. Phase headings are
  plain ("## Phase 1: MVP"); the phase exit appends " (complete)", which
  is how the dispenser and the pack find the current phase.
- `docs/RUNBOOK.md`, for any project that deploys somewhere users reach,
  carries numeric control bands; a band left as prose ("acceptable
  latency") is a placeholder and fails the no-placeholder rule.

## ADRs and spikes

Write one ADR per closed decision (stack,
hosting, data store, auth approach, tenancy model, any other choice with
lasting weight), about 10 lines each. The Decision section is what the
pack quotes to every build slice; write it as the one or two lines a
builder needs.

The stack is decided here. Its ADR is the single source of truth the
pipeline reads instead of re-deriving: the layer skills open `docs/adr/`
before advising and never re-litigate it.

Compliance is decided here too. From the jurisdictions named during the
VISION interview, write one ADR recording which regulatory regimes apply,
where data must reside, and what retention and deletion obligations
follow, or recording, explicitly, that none apply. Jurisdiction and
compliance posture are user-challenge decisions: asked, never assumed
from the product's domain.

Then write `.acdev/profile.json` with the `tags` the ADRs justify
(`shared/references/profile-tags.md`) and list it in the audit table.

A decision that depends on something unproven runs
`references/spike-protocol.md` before its ADR freezes; the result (works
/ does not / with limits) is recorded back in the ADR. Spike code never
merges into product code. A CRUD on a known stack with no unproven
dependency produces zero spikes.

Classify every decision made in this stage per
`shared/references/decision-classification.md` and keep the running audit
table in the blueprint summary, exact format `| Decision | Class |
Choice | Reason |`. Only user-challenge decisions interrupt the user;
mechanical and taste decisions are made and listed for review.

## AI context system

Generate `CLAUDE.md` at the project root from its scaffold (catalog). Its
golden rules are derived from VISION §2 (Model) plus the chosen stack.
Keep it under one page: a router to context, not the context itself; it
loads in every session. If multi-AI was chosen at intake, `AGENTS.md` is
a copy of it that the acdev close command (`node "<plugin-root>/scripts/acdev.mjs"
close`) regenerates from then on, never a hand sync. The router's `## Lessons` section starts empty and is owned by the
lessons script from then on; nobody hand-writes lessons into it.

## Repo mechanics

Produce the mechanical scaffolding per `references/repo-mechanics.md`,
ending with the guard completed with its `verify` commands. Evidence
closing this section: `node .claude/hooks/acdev-guard.mjs status`.

## Adversarial design review (optional)

When presenting the package, offer one optional pass before approval: an
adversarial design review per `references/adversarial-review.md` (two
panels with opposing lenses, findings contrasted before the freeze). It
is the user's call: it costs real tokens; but a design error caught here
costs a conversation, and mid-build it costs slices. A high-severity
finding is resolved or explicitly accepted by the user before the gate
below can close; acceptance is never automatic.

## Gate

Present the package as a list, never document bodies (the user reads the
files): (a) the document-set table already agreed, with path, reader and
lines written; (b) the ADR titles with their one-line Decision; (c) the
audit table; (d) the guard `status` output. Apply the user's corrections
in place (Edits, never re-emitted bodies), then ask for explicit
acceptance of the package; nothing is committed before that acceptance.
Once accepted, commit:

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
gate, offer the user two choices in one message: a cheaper model (`/model`) for `build`, since
construction follows instructions and the guard judges the result; and
continuous build, interactive or headless, under `build`'s
`references/continuous.md` (per-slice gates stay; a user-challenge
decision stops the run). Without that approval, build proceeds slice by
slice as usual.
