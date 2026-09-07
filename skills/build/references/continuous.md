# Continuous build

Reference for `build`. Continuous mode removes the pauses between slices,
never the gates inside them. It runs only on the user's explicit approval,
offered at the blueprint gate or given any time during build ("build the
whole MVP without stopping").

## What does not change

Every slice still gets its just-in-time plan, the TDD loop, verification
and a full close (`close --check`, then `close`: green verification,
drift, CHANGELOG line, checkpoint, one commit) before the next slice
starts. Mechanical and taste decisions are auto-decided into the audit
table, as always.

## What stops the run

- A user-challenge decision: write the checkpoint with `--blocked` naming
  the question, report it, and wait. The user answers and says "continue".
- A discovered trap that invalidates the current plan: the same way.
- The phase exit: the run ends at the current phase's exit criteria plus
  `ship`'s phase-exit security pass. Post-MVP phases need their own
  mockups gate first, then their own run if the user wants one.

## Two ways to run it

**Interactive.** The session keeps going: narrate every slice close in one
line ("slice N shipped, verification green; next: X") without waiting for
a reply, then run `next` again. The user can interrupt at any point. The
context grows with every slice; when it gets heavy, a fresh session loses
nothing: `/clear`, `/acdev:status`, "continue". The orchestrator keeps
one subagent per layer, as in any build session.

**Headless (recommended for cost).** One fresh session per slice, memory
in git and the checkpoints, nothing carried between iterations:

```
node "<plugin-root>/scripts/acdev.mjs" run --max-slices 10 [--model sonnet] [--budget-usd 5] [--extra "--effort medium"]
```

Each iteration runs `claude -p` with the default prompt ("run `next`,
build one slice, close it, stop"), records cost and tokens in
`.acdev/cost.jsonl` (total, fresh, per-model usage), and reads the
checkpoint back. The loop stops on a `--blocked` checkpoint, on the
phase exit, when no new checkpoint appears (the slice did not close), on
an error result, when the budget cap trips, or at `--max-slices`.
`--dry-run` prints the command; `--claude` and `--extra` pass the CLI and
its flags; `cost` prints the ledger.

What `run` passes by itself, and why:

- `--max-budget-usd`: a cap per iteration, from `--budget-usd`; the
  default is twice the ledger's median iteration cost, never below 5 USD,
  so a normal slice does not hit it and a looping one cannot run for two
  hours. `--budget-usd 0` disables it. A capped session leaves no
  checkpoint, so the loop stops with "budget exceeded" and the tree stays
  uncommitted (`close` refuses on red).
- `--exclude-dynamic-system-prompt-sections`: cwd, git status and date
  move out of the system prompt into the first user message, so the
  static prefix is a cache read for every iteration instead of a cache
  write. The steps and the pack already carry the checkpoint and the tree
  state. `--no-isolate` restores the CLI defaults.
- `--strict-mcp-config --mcp-config <file>` when `.acdev/headless-mcp.json`
  exists or `--mcp-config` names a file: the session loads only the MCP
  servers the build needs (a documentation server, for example), not
  every server the user's environment carries. Never use `--bare`: it
  skips hooks, and the guard is a hook.
- The timeout (`--timeout-min`, 120 by default) kills the whole process
  tree, on Windows too, so a hung iteration cannot keep spending after
  the loop gave up on it.

A headless session cannot answer a permission prompt. `--permission-mode
acceptEdits` covers file edits, not the `node` and `git` commands every
step runs, so the project's `.claude/settings.json` must allow
`Bash(node *)`, `Bash(git *)` and the project's verify commands; the guard
settings template ships that block and `guard-install` merges it. Or pass
`--extra "--allowedTools ..."`; note that `--extra` is split on spaces
(no quoted values), so an `allowedTools` pattern with a space in it, such
as `Bash(node *)`, cannot travel through `--extra`: put it in the project
settings `permissions` block instead. The guard still asks before destructive
git and inline node code, and denies a commit without a receipt.

`--extra "--effort medium"` is worth a try on slices with a strong test
suite, comparing `cost.jsonl` before and after; never below medium,
because planning and the phase-exit security pass share the session.

Delegation in a headless session: delegate a layer to a subagent only
when it has its own test loop (at least one new test file) or more than
about three files; otherwise build it inline after one `pack --layers
a,b,c --pitfalls` call, since the session is discarded at the close and
inline growth cannot compound. The `build-construct` step carries this
rule, and the session recognizes itself as headless by the `run` prompt
it received (build one slice, then stop), so the threshold needs no
`--prompt` of its own. The interactive orchestrator does not use it.

Run headless slices back to back and with one model per batch, so the
static prefix stays a cache read across iterations. The guard is the
safety net in every iteration: no commit without a green receipt, no
product code before build, no destructive command without a human. Run
it from a terminal the user watches; a headless session cannot ask anyone
anything, which is exactly why a user-challenge decision ends it.
