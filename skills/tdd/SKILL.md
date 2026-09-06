---
name: tdd
description: Use when implementing any feature or bugfix: write the failing test first, watch it fail, make it pass minimally, refactor. No implementation before a red test.
---

# TDD

The loop that governs how `build` writes code, slice by slice, layer by
layer. Test output enters the context through the quiet runner, never as
a log: `node "<plugin-root>/scripts/acdev.mjs" q -- <test command>`
prints the verdict lines on green and the failure lines plus a tail on
red (`<plugin-root>` is the path printed as `acdev plugin root:` at
session start).

## The loop

1. **Write ONE failing test** expressing the next behavior, not the next
   five. One increment.
2. **Run that test file alone through `q` and confirm it fails for the
   expected reason.** A test that passes immediately tests nothing: it is
   wired wrong or redundant. The failure message must name the exact gap
   you are about to fill, not an unrelated error.
3. **Write the minimal code to make it green.** No abstraction, config or
   extensibility the current test does not demand; YAGNI is what keeps
   the loop fast. Do not re-read the file you just wrote to check it; the
   next run is the check.
4. **Run the full suite through `q`**, once per increment, not only the
   new test. A green new test next to a broken old one is not progress.
5. **Refactor only on green**, with the suite as the safety net. Skip
   this step when there is nothing worth cleaning.
6. **Commit small**: one loop, one commit, or fold into the slice's commit
   per `ship`. Small enough that a revert costs nothing.

**Bug fixes start with the reproducing test.** The failing test IS the
bug, expressed as an assertion; the `debugging` skill says how to get
there and freezes it while the fix is under way.

## Anti-patterns

- **Tests written after the code "to cover it."** They only prove the code
  does what it does, not what it should.
- **Asserting implementation details instead of behavior.** Breaks on
  every refactor and protects nothing real.
- **Skipping the red run.** Without seeing it fail first, a passing test
  might be passing for the wrong reason.
- **Pasting the whole test log.** The verdict lines are the evidence; the
  log is noise that stays in the context for the rest of the session.

## No test runner yet

If the project has no test runner, that setup IS the first slice task,
not a yak-shave to route around. The blueprint's CI skeleton names the
runner; wire it in before the first test.

## Throwaway exception

Genuinely disposable code (a scratch script run once and deleted, spike
code under `blueprint`'s spike protocol) may skip the loop; say so
explicitly. The moment the code is kept, wired in or shipped, it gets
tests.
