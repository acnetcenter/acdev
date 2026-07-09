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

- [docs/ROADMAP.md](docs/ROADMAP.md) - current phase and what is next.
- The latest checkpoint - run `/acdev:status` to load it (~2k tokens).
- [docs/adr/](docs/adr/) - decisions already made; do not re-derive them.

## Verification

Run the layer-specific checks in `scripts/verify/` before considering any
slice done. See each script for the concrete command it runs.

## Drift rule

Repo reality wins. When a document and the code disagree, the document is
corrected in the same commit that reveals the drift — never left stale
"for later."

## Mirror note

`AGENTS.md`, if present, is kept identical to this file. If you edit one,
edit both.
```
