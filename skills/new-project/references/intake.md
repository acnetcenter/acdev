# Intake

Reference for `new-project` stage 0: the questions that follow the
opening one, and the mechanics that make the guard live before any
document exists. The rules (when to stop and send the user to
`/acdev:onboard`, zero product code) live in the skill body.

## The questions

Ask them in one message, after the user has told the idea, proposing
defaults derived from what was just told:

1. Project name (propose one from the idea).
2. New repository or existing one? An existing repo not yet on acdev
   sends the user to `/acdev:onboard`; one with `.acdev/` already runs
   the pipeline and is amended through it. Both stop this skill.
3. Documentation language: the language every generated artifact
   (VISION.md, MVP.md, and everything downstream) will be written in.
4. Claude Code only, or multi-AI (Codex, Cursor, Copilot, ...)? This
   decides whether an `AGENTS.md` mirror of `CLAUDE.md` is generated
   later, at blueprint stage.

## Guard and initial state

With the answers in hand, and before any document is written:

1. Install the guard per `shared/references/guard-install.md`: `node
   "<plugin-root>/scripts/acdev.mjs" scaffold guard` (`<plugin-root>` is
   the absolute path printed as `acdev plugin root:` at session start).
2. Write the initial pipeline state:

   ```
   node "<plugin-root>/scripts/checkpoint.mjs" write --stage vision --branch <branch> --next "VISION interview, section 1" --lang "<documentation language>"
   ```

   `--lang` records the documentation language in `.acdev/state.md`;
   later checkpoint writes preserve it automatically.
3. Paste `node .claude/hooks/acdev-guard.mjs status` as evidence the guard
   is live.
