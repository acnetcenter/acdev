# Installing the guard in a project

The guard is the deterministic half of acdev's hard rules: a PreToolUse
hook, versioned inside the project, that enforces what the skills only
describe. `new-project` installs it at intake, `onboard` proposes it in the
adoption plan, and `blueprint` completes its configuration. All three
follow these steps; none of them re-explains them.

## Steps

1. Run `node "<plugin-root>/scripts/acdev.mjs" scaffold guard`
   (`<plugin-root>` is the path printed as `acdev plugin root:` at session
   start). One call, no retyping: it copies the hook to
   `.claude/hooks/acdev-guard.mjs`, `.acdev/guard.json` and
   `.acdev/profile.json` from their templates (existing files are kept;
   `--force` recopies), merges the `permissions.allow` patterns and the
   two `PreToolUse` entries from `guard-settings.json` into
   `.claude/settings.json` without touching any other key (creating the
   file if absent; rerunning changes nothing), and adds the guard's
   session state (`.acdev/verify-receipt.json`, `.acdev/freeze.json`,
   `.acdev/cost.jsonl`) to `.gitignore`. It prints one line per file
   written, skipped or merged; paste them. Never edit the hook copy:
   project-specific policy goes in `.acdev/guard.json`, where `verify`
   stays empty at intake and `blueprint` fills it with the project's
   verification commands (the `scripts/verify/` runner and the test
   command) once they exist. The allow patterns (`Bash(node *)`,
   `Bash(git *)`) are what a headless session needs to run the pipeline's
   own commands; add the project's verify commands next to them once
   `blueprint` names them. The guard still asks before destructive git
   and inline node code, and denies a commit without a receipt.
   `.acdev/guard.json`, `.acdev/state.md`, `.acdev/lessons.md` and the
   checkpoints are committed; the ignored files are session state, not
   history.
2. Make sure `.acdev/state.md` exists with the current stage (the stage
   ladder is read from it): `node "<plugin-root>/scripts/checkpoint.mjs"
   write --stage <stage> --branch <branch> --next "<next step>" --lang
   "<documentation language>"`.
3. Evidence: run `node .claude/hooks/acdev-guard.mjs status` and paste its
   output. It names the stage the guard enforces, the freeze state, the
   verify commands and the receipt state.
4. From build on, the slice close is `node
   "<plugin-root>/scripts/acdev.mjs" close`, which runs the guard's
   `verify` itself and commits only on green. `verify` prints each
   command's verdict lines (the whole log only on red or with `--full`)
   so the evidence enters the context without the noise.

## What the guard enforces

| Rule | Decision | Scope |
|---|---|---|
| Zero product code before build | deny | Any write outside docs, mockups, spikes and repo mechanics while `state.md` is at a stage before `build`; the set of allowed paths grows with the stage (mockups at `mockups`, spikes and repo mechanics at `blueprint`) |
| Approved documents | ask | `docs/VISION.md` after the VISION gate, `docs/MVP.md` after the MVP gate, `mockups/` after the mockups gate, `docs/adr/` in build |
| Frozen paths | deny | Whatever `node .claude/hooks/acdev-guard.mjs freeze <glob...> --reason "..."` recorded, until `unfreeze` |
| Secrets | ask | `.env` and `.env.*` (examples exempt), `*.pem`, `*.key` |
| Destructive commands | ask | Force push, `reset --hard`, `clean -f`, discard-all checkouts, force branch delete, stash drop, `rm -f`, `DROP`/`TRUNCATE` |
| Inline node code | ask | `node -e`, `-p`, `--eval`, `--print`, `--input-type`, `node -`, a bare `node` fed by a pipe or a heredoc; script files stay allowed |
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
