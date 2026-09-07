# CLAUDE.md router template

Fill every section below when generating the project's `CLAUDE.md` at
blueprint time. Keep the whole file to one page — this is a router to
context, not the context itself; it points at the documents that hold the
real detail instead of repeating them.

```markdown
# <Project name>

<One-liner: what this product is, who it is for.> Full detail:
[docs/VISION.md](docs/VISION.md).

## Golden rules

<3-6 bullets derived from VISION §2 (Model) plus the chosen stack. Each
rule states a non-negotiable implication of the model, not a general best
practice. Examples of the pattern (replace with the project's own):
- Multi-tenant model -> "Every table change proves tenant isolation
  (RLS test or equivalent) before merge."
- Payments in scope -> "Card data is never logged, stored, or passed
  through application code; it touches only the payment provider's SDK."
- Public SaaS with PII -> "Any new field holding personal data is marked
  in DATA-MODEL.md and covered by the retention policy in SECURITY.md."
- On-premise/local-personal model -> "No feature may assume outbound
  network access is available at runtime."
>

## Stack

<One line naming the stack, sourced from docs/adr/ — do not restate the
reasoning, link to the ADRs instead.> See [docs/adr/](docs/adr/).

## Read before working

The acdev step (`next`) and the pack it names already carry the current
[ROADMAP](docs/ROADMAP.md) phase, the [ADR](docs/adr/) decision lines
and the latest checkpoint. Do not re-read those documents, and do not run
`/acdev:status` on top of them, unless the pack prints one of its
fallback markers: `(+N more lines, open the file if needed)`,
`(docs/ROADMAP.md missing or without phase headings)`, `(no docs/adr/)`,
`(+more ADRs beyond 40; ...)`. Resuming a session starts with
`/acdev:status`, once. Decisions in `docs/adr/` are made; never re-derive
them.

## Verification

Run the layer-specific probes in `scripts/verify/` as you go; see each
script for the command it runs. Do not run the full suite by hand before
closing: the acdev close command (`node "<plugin-root>/scripts/acdev.mjs"
close`) runs it as its first step, records the receipt the guard
(`.claude/hooks/acdev-guard.mjs`) checks, and refuses to commit on red;
for an early signal run that close with `--check --verify`. A guard
denial is a gate, not an obstacle; never route around it.

## Lessons

Rules earned from mistakes repeated in this repo, promoted by acdev's
lessons script (`.acdev/lessons.md` holds the ledger). Never hand-edit
this section. A lesson that can be checked mechanically also lives as a
test or a `scripts/verify/` probe; the bullet names it.

## Drift rule

Repo reality wins. When a document and the code disagree, the document is
corrected in the same commit that reveals the drift — never left stale
"for later."

## Mirror note

`AGENTS.md`, if present, is regenerated from this file by the acdev close
command and by the blueprint; never edit it by hand; close recognizes the
copy by this heading (or by a `<!-- acdev: copy of CLAUDE.md -->` comment)
and leaves any other `AGENTS.md` alone.
```
