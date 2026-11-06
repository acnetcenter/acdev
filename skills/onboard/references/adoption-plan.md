# Adoption plan: how each item is produced

Reference for `onboard`, read after the situation map is confirmed. The
plan is written only as the last section of `docs/SITUATION.md`; the
rules each item obeys are in the skill body. This file holds the
commands.

- **PRODUCT.md.** `acdev scaffold product docs/PRODUCT.md`, then the
  interview per `../../new-project/references/product-questionnaire.md`,
  in the project's documentation language, seeded with what the map
  found.
- **MVP.md.** `acdev scaffold mvp docs/MVP.md`, cut per
  `../../new-project/references/mvp-guide.md`, only when unbuilt scope
  remains.
- **As-built ADRs.** `acdev scaffold adr docs/adr/NNNN-<slug>.md`, one
  per decision the code already embodies, with "as-built" in the
  Context section.
- **Guard config and pipeline state.**

  `acdev init` first. Then set `verify` in `.acdev/guard.json` to the
  commands the repo already runs (test, lint, typecheck, per the map's
  Tests and CI section), and add the repo's conventions to
  `allow_before_build` or `receipt_ignore` where they apply (a generated
  directory, a vendored tree). Only then write the state, because from
  stage build on that file is the user's to change:

  ```
  acdev checkpoint write --stage <stage> --branch <branch> --next "<text>" --lang "<documentation language>"
  acdev status
  ```

  `--stage` is the stage the project resumes at; `--lang` is recorded once
  and kept by later writes. The `status` output is the evidence.
- **CLAUDE.md.** A repo without one gets the full template: `acdev
  scaffold claude-md CLAUDE.md`. For an existing file, read the template
  at `../../../shared/references/templates/claude-md.md` and propose its
  "How work closes here" block as a diff against the existing file.
- **RUNBOOK.md.** `acdev scaffold runbook docs/RUNBOOK.md`, filled with
  what the map found (URLs, deploy path, whatever rollback exists) and
  `[gap]` lines for the rest.
