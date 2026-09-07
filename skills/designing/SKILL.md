---
name: designing
description: "Use before any creative or feature work outside the pipeline stages: converse the design until an approved design doc exists. Inside the pipeline, defer to the VISION and MVP stages."
---

# Designing

Purpose: understand before building. A design conversation exists to
surface the real problem and the real constraints before any code gets
written — skipping it just moves the same questions into the middle of
implementation, where they are more expensive to answer.

## Pipeline projects route, they do not duplicate

If the work belongs to a project already running the acdev pipeline
(`.acdev/` exists), this skill does not run its own process. It routes to
the pipeline stage that already owns this kind of decision instead:

- A change to what THIS product does, at the VISION/MVP level → not a new
  project: amend `docs/VISION.md` / `docs/MVP.md` with the user (it is a
  user-challenge decision), then re-derive the affected downstream docs.
- A separate new product → have the user run `/acdev:new-project` in its
  own repository (entry points are user-invoked, not model-invoked).
- A new or changed screen → `mockups`.
- Architecture, stack, or a normative doc → `blueprint`.

Redoing that conversation here would produce a second, competing source of
truth. Route and stop.

## Outside the pipeline

Everything below applies to work with no pipeline stage to own it —
a standalone script, a library, a one-off tool, a feature in a codebase
that never adopted acdev.

1. **Explore current state first.** Read the relevant code, docs, and
   recent history before asking anything — a question the codebase already
   answers wastes the user's time and signals you didn't look.
2. **Ask ONE question at a time.** Never batch a list of open questions.
   Prefer multiple choice over open-ended when the option space is
   knowable — it's faster to pick than to compose.
3. **Challenge weak answers.** "Make it flexible" is not a requirement;
   ask what varies and how. "However you think is best" on a
   user-challenge-class decision is not an answer — press for the actual
   constraint behind it.
4. **Propose 2-3 approaches with a recommendation.** Lay out real
   trade-offs, not a strawman next to the obvious winner, and say plainly
   which one you'd pick and why. Let the user override it.
5. **Scale the write-up to the complexity of the decision.** A small
   change gets a few lines; a new subsystem gets sections (problem,
   approach, alternatives considered, open questions). Do not pad a simple
   design with empty headings, and do not compress a genuinely complex one
   into a paragraph.
6. **Write `docs/designs/YYYY-MM-DD-<topic>.md`.** This is the durable
   record of what was decided and why — later readers should not have to
   reconstruct the reasoning from chat history.

## Self-review before the gate

Before presenting the doc for approval, check it yourself:

- No placeholders — every section says something real, or is explicitly
  marked as an open question for the user, never left as `TBD` silently.
- No contradictions between sections (e.g. scope says X is out, a later
  section assumes X exists).
- Scope is explicit: what's in, what's deliberately out.
- No ambiguity a reader would have to guess at — vague verbs ("handle",
  "support") get replaced with the actual behavior.

## Gate

**GATE.** Present the design doc and ask for explicit approval before any
implementation starts. "Looks fine" on a skim counts; silence or moving
straight to code does not. Revise and re-ask until approved.

Once approved, hand off to the `planning` skill to turn the design into an
executable plan. Designing decides *what* and *why*; planning decides the
concrete steps and how each one gets verified.
