# Adoption plan: how each item is produced

Reference for `onboard`, read after the situation map is confirmed. The
plan itself is written only as the last section of `docs/SITUATION.md`;
the rules each item obeys live in the skill body. This file holds the
mechanics. `<plugin-root>` is the absolute path printed as `acdev plugin
root:` in the session context at startup.

- **VISION.md retroactively.** Start it with `node
  "<plugin-root>/scripts/acdev.mjs" scaffold vision docs/VISION.md`, fill
  only the `<...>` placeholders, and run the interview per
  `<plugin-root>/skills/new-project/references/vision-questionnaire.md`,
  section by section, in the project's documentation language.
- **MVP.md.** Cut it per
  `<plugin-root>/skills/new-project/references/mvp-guide.md` (`scaffold
  mvp docs/MVP.md`), only when unbuilt scope remains.
- **As-built ADRs.** `node "<plugin-root>/scripts/acdev.mjs" scaffold adr
  docs/adr/NNNN-<slug>.md`, one per decision the code already embodies,
  with "as-built" in the Context section.
- **Initial pipeline state.** Write `.acdev/state.md` and the first
  checkpoint:

  ```
  node "<plugin-root>/scripts/checkpoint.mjs" write --stage <s> --branch <b> --next "<text>" --lang "<documentation language>"
  ```

  `--stage`, `--branch` and `--next` are required. `--stage` is the stage
  the project resumes at per the plan just agreed; `--next` is the
  concrete next action; `--lang` records the documentation language in
  `state.md`, and later checkpoint writes preserve it automatically.
- **The guard.** Install per `shared/references/guard-install.md`
  (`scaffold guard`), then set `verify` in `.acdev/guard.json` to the
  commands the repo already runs (test command, lint, typecheck, per the
  map's Tests and CI section) and add the repo's conventions to
  `allow_before_build` or `receipt_ignore` where they apply. Evidence:
  `node .claude/hooks/acdev-guard.mjs status`.
- **The profile.** `.acdev/profile.json` (copied by `scaffold guard` from
  `shared/references/templates/profile.json`): set only the tags the map
  supports, per `shared/references/profile-tags.md` (`auth`,
  `multi-tenant`, `pii`, `deploys`...). The layer checklists drop the
  items whose tags the project lacks.
- **`docs/RUNBOOK.md`.** `scaffold runbook docs/RUNBOOK.md`, filled with
  what the map found (URLs, deploy path, whatever rollback exists) and
  `[gap]` lines for the rest.
