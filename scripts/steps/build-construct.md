Build: construct the slice in progress, then close it.

Construction. The frontend replicates the frozen mockups: read the screen's entry in `mockups/SPEC.md`, open the HTML only for the screen at hand. TDD per the `tdd` skill, one test file at a time through the quiet runner: `node "<plugin-root>/scripts/acdev.mjs" q -- <test command>`. Never re-read a file you just wrote.

Thin orchestrator. One subagent per layer per `<plugin-root>/skills/build/references/slice-guide.md`: the prompt carries the pack command (`pack --layers <layer> --pitfalls`) and the plan steps it owns, never its output. Tier by oracle: `subagent_type: acdev:acdev-builder` where a test, a lint or the guard judges; `acdev:acdev-builder-capable` where judgment decides. Headless `run` session (its prompt orders one slice, then stop): build inline, after one `pack --layers a,b,c --pitfalls`, any layer with no new test file and under about three files.

Close:
1. `node "<plugin-root>/scripts/acdev.mjs" close --check --plan <plan>`: drift candidates, changelog, index, freeze, lessons. Fix what it lists in this same close.
2. `node "<plugin-root>/scripts/acdev.mjs" close --slice "N: name" --plan <plan> --next "<next slice, or: phase exit>" --changelog "<what shipped>"`: verifies first and refuses on red, then changelog, plan flip, checkpoint, one commit.

A red you cannot fix ends with `checkpoint write ... --blocked "<why>"`, never with a narrowed check. If the close deployed, run `operate`'s release check.
