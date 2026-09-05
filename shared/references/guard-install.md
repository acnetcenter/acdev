# Installing the guard in a project

The guard is the deterministic half of acdev's hard rules: a PreToolUse
hook, versioned inside the project, that enforces what the skills only
describe. `new-project` installs it at intake, `onboard` proposes it in the
adoption plan, and `blueprint` completes its configuration. All three
follow these steps; none of them re-explains them.

## Steps

1. Copy `shared/references/templates/guard-hook.mjs` (in the plugin root
   printed as `acdev plugin root:` at session start) to
   `.claude/hooks/acdev-guard.mjs` in the project. Never edit the copy:
   project-specific policy goes in `.acdev/guard.json`.
2. Write `.acdev/guard.json` from `shared/references/templates/guard.json`.
   At intake `verify` stays empty; `blueprint` fills it with the project's
   verification commands (the `scripts/verify/` runner and the test
   command) once they exist.
3. Merge the `hooks` block from
   `shared/references/templates/guard-settings.json` into the project's
   `.claude/settings.json`: create the file if absent; if it exists, add
   the two `PreToolUse` entries and leave every other key untouched.
4. Add `.acdev/verify-receipt.json` and `.acdev/freeze.json` to
   `.gitignore`: both are session state, not history. `.acdev/guard.json`,
   `.acdev/state.md`, `.acdev/lessons.md` and the checkpoints are
   committed.
5. Make sure `.acdev/state.md` exists with the current stage (the stage
   ladder is read from it): `node "<plugin-root>/scripts/checkpoint.mjs"
   write --stage <stage> --branch <branch> --next "<next step>" --lang
   "<documentation language>"`.
6. Evidence: run `node .claude/hooks/acdev-guard.mjs status` and paste its
   output. It names the stage the guard enforces, the freeze state, the
   verify commands and the receipt state.

## What the guard enforces

| Rule | Decision | Scope |
|---|---|---|
| Zero product code before build | deny | Any write outside docs, mockups, spikes and repo mechanics while `state.md` is at a stage before `build`; the set of allowed paths grows with the stage (mockups at `mockups`, spikes and repo mechanics at `blueprint`) |
| Approved documents | ask | `docs/VISION.md` after the VISION gate, `docs/MVP.md` after the MVP gate, `mockups/` after the mockups gate, `docs/adr/` in build |
| Frozen paths | deny | Whatever `node .claude/hooks/acdev-guard.mjs freeze <glob...> --reason "..."` recorded, until `unfreeze` |
| Secrets | ask | `.env` and `.env.*` (examples exempt), `*.pem`, `*.key` |
| Destructive commands | ask | Force push, `reset --hard`, `clean -f`, discard-all checkouts, force branch delete, stash drop, `rm -f`, `DROP`/`TRUNCATE` |
| Verification receipt | deny | In build, `git commit` needs a receipt written by `node .claude/hooks/acdev-guard.mjs verify` that is green and still matches the code tree (docs and `.acdev/` edits never stale it) |
| The guard's own files | ask | The hook, `.acdev/guard.json`, `.claude/settings.json` |

Bash write targets (redirections, `tee`, `cp`, `mv`, `touch`, `sed -i`)
go through the same path policy as Edit and Write. The parser is a
heuristic; the model-side rule closes the gap: **a guard denial is a gate,
never an obstacle to route around**. Either the stage is wrong, and the
pipeline moves it, or the action is wrong, and it stops.

## Off switch

`"enabled": false` in `.acdev/guard.json`, or `ACDEV_GUARD=off` in the
environment, disables every rule. The hook fails open on any internal
error and leaves a trace on stderr; it can never take a session down.
