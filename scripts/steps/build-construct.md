Build: construct the slice in progress, then close it.

Construction. The frontend replicates the frozen mockups: read the screen's entry in `mockups/SPEC.md`, open the HTML only for the screen at hand. TDD per the `tdd` skill, one test file at a time through the quiet runner: `node "<plugin-root>/scripts/acdev.mjs" q -- <test command>`. Never re-read a file you just wrote; `git diff --stat` shows what changed.

Thin orchestrator. Dispatch the work to one subagent per layer with the pack (`pack --layers ...`) and the plan lines it needs, per `references/slice-guide.md`. Model by oracle: the cheapest tier where a test, a lint or the guard judges the result (TDD to green, lint and type fixes, doc edits); the capable model where judgment decides (design, root cause, security). A subagent returns files changed, tests added, verdict lines, audit rows and traps, never full diffs.

Close, two commands:
1. `node "<plugin-root>/scripts/acdev.mjs" close --check --plan <plan>`: drift candidates, changelog, index, freeze, lessons. Fix what it lists in this same close.
2. `node "<plugin-root>/scripts/acdev.mjs" close --slice "N: name" --plan <plan> --next "<next slice, or: phase exit>" --changelog "<what shipped>"`: verifies first and refuses on red, then changelog, plan flip, checkpoint, one commit.

A red you cannot fix ends with `checkpoint write ... --blocked "<why>"`, never with a narrowed check. If the close deployed, run `operate`'s release check.
