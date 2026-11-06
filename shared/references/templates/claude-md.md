# CLAUDE.md template

Fill every section below when generating the project's `CLAUDE.md` at
blueprint time. It loads in every session, so it holds only what the code
cannot say: under 60 lines, no architecture tour, no file map. A rule
stays here only if removing it would change what gets built.

```markdown
# <Project name>

<One line: what this product is and who it is for.> Source of truth:
[docs/PRODUCT.md](docs/PRODUCT.md); first delivery: [docs/MVP.md](docs/MVP.md);
decisions: [docs/adr/](docs/adr/); phases: [docs/ROADMAP.md](docs/ROADMAP.md).

## Golden rules

<3-6 bullets derived from PRODUCT.md "Model" plus the decided stack. Each
states a non-negotiable implication of the model, not a general best
practice. Examples of the pattern (replace with the project's own):
- Multi-tenant model -> "Every table change proves tenant isolation with
  a test before it merges."
- Payments in scope -> "Card data touches only the payment provider's
  SDK; it is never logged or stored."
- On-premise or local model -> "No feature assumes outbound network
  access at runtime."
>

## Commands

<The exact commands a session cannot guess: run, test (one file and the
whole suite), lint, typecheck, deploy. One line each.>

## How work closes here

- This project runs the acdev pipeline: `acdev status` says where it
  stands and what continues.
- Done means the project's checks ran after the last edit and passed;
  show the verdict lines (`acdev q -- <command>`), never the log. A claim
  without a run has been wrong before.
- A change in behavior starts with one failing test for that behavior,
  because a test written afterwards only proves the code does what it
  does.
- A decision about what the product does, money, security posture or the
  shape of the data is the user's: ask it. Decide the rest and list it.
- A document that disagrees with the code is corrected in the same
  commit. The decisions in docs/adr/ are made; do not re-derive them.
- A slice closes through `acdev close`, which verifies first and refuses
  on red. After it, the next slice starts in a fresh session.

## Mirror note

`AGENTS.md`, if present, is a copy of this file that `acdev close`
regenerates; never edit it by hand.
```
