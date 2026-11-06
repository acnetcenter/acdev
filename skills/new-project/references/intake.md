# Intake

Reference for `new-project`: the questions that follow the opening one,
and the two commands that make the guard live before any document exists.

## The questions

Ask them in one message, after the user has told the idea, proposing
defaults derived from what was just told:

1. Project name (propose one from the idea).
2. New repository or existing one? An existing repo without `.acdev/` is
   adopted with `/acdev:onboard`; one that has `.acdev/` already runs the
   pipeline and is amended through it. Both stop this skill.
3. Documentation language: the language of every generated document.
4. Claude Code only, or other coding agents too? If others, the blueprint
   stage keeps an `AGENTS.md` copy of `CLAUDE.md`.

## Project config and first state

With the answers in hand, and before any document is written (run `git
init` first if the folder is not a repository yet):

```
acdev init
acdev checkpoint write --stage product --branch <branch> --next "PRODUCT.md interview" --lang "<documentation language>"
acdev status
```

`acdev init` writes `.acdev/guard.json` (where the blueprint stage later
lists the project's verification commands) and ignores the verification
receipt in `.gitignore`. The guard itself ships with the plugin; nothing
else is installed in the project. `--lang` is recorded once and kept by
later checkpoint writes. The `status` output is the evidence to paste.

`acdev` is the plugin's CLI, on the PATH of the Bash tool. In PowerShell
use the `node` form the skill body gives.
