---
name: tdd
description: Use when implementing any feature or bugfix: write the failing test first, watch it fail, make it pass minimally, refactor. No implementation before a red test.
---

# TDD

The loop that governs how `build` writes code, slice by slice, layer by
layer.

## The loop

1. **Write ONE failing test** expressing the next behavior — not the next
   five, not the whole feature. One increment.
2. **Run it and confirm it fails for the expected reason.** A test that
   passes immediately tests nothing — it is either wired wrong or
   redundant. Read the failure message; it should name the exact gap you
   are about to fill, not an unrelated error.
3. **Write the minimal code to make it green.** Resist speculative
   structure — no abstraction, config, or extensibility the current test
   does not demand. YAGNI is not a suggestion here; it is what keeps the
   loop fast.
4. **Run the full suite**, not just the new test. A green new test next to
   a broken old one is not progress.
5. **Refactor only on green.** Clean up naming, duplication, structure —
   never behavior — with the suite as a safety net. Skip this step when
   there is nothing worth cleaning.
6. **Commit small.** One loop, one commit (or fold into the slice's commit
   per `ship`) — small enough that a revert costs nothing.

**Bug fixes start with the reproducing test.** The failing test IS the bug,
expressed as an assertion; see the `debugging` skill for how to get there.

## Anti-patterns

- **Writing tests after the code "to cover it."** A test written to match
  existing behavior cannot fail on a bug in that behavior — it only proves
  the code does what it does, not what it should.
- **Asserting implementation details instead of behavior.** A test coupled
  to internals breaks on every refactor and protects nothing real.
- **Skipping the red run.** Without seeing it fail first, a passing test
  might be passing for the wrong reason — or not exercising the code path
  at all.

## No test runner yet

If the project has no test runner set up, that setup IS the first slice
task — not a yak-shave to route around. The blueprint's CI skeleton names
the runner to use; wire it in before writing the first test.
