---
name: debugging
description: Use on any bug, failing test or unexpected behavior before proposing fixes: reproduce it, form hypotheses, find the root cause, fix with a test.
---

# Debugging

The sequence for any bug, failing test, or unexpected behavior — followed
in order, never skipped under time pressure.

## The sequence

1. **Reproduce reliably.** A bug you cannot reproduce is not understood.
   Capture the exact command and its exact output — not a paraphrase.
   Intermittent failures still need a reliable trigger before step 3 means
   anything.
2. **Read the actual error**, not the assumed one. The stack trace, the
   failing assertion, the log line — the real text, in full, before any
   theory is formed about what it means.
3. **Form 2-3 ranked hypotheses BEFORE editing anything.** Write them down,
   ranked by likelihood. Editing code while still guessing turns debugging
   into trial and error, and trial and error does not converge.
4. **Test the cheapest hypothesis with evidence** — a log line, a probe, a
   bisect — not a guess dressed up as a fix. For regressions, `git bisect`
   finds the introducing commit faster than reasoning about the diff by
   eye. Discard the hypothesis the evidence rules out and move to the
   next.
5. **Fix the root cause, never the symptom.** If the fix does not explain
   why the bug happened in the first place, it is not the fix yet — keep
   going.
6. **Add the regression test and verify green.** Follow the `tdd` skill:
   the reproducing case becomes a permanent test, red before the fix,
   green after. In a project with the guard, freeze the test before
   touching the code under it:

   ```
   node .claude/hooks/acdev-guard.mjs freeze <test file or glob> --reason "<bug>"
   ```

   The failing test is the spec of the fix. A fix that needs the test
   changed is a spec change, which is the user's decision, not a fix;
   the freeze makes that a denial instead of a temptation. `ship` clears
   it at the close.
7. **One line: what was learned.** Record it with the lessons script
   (`node "<plugin-root>/scripts/lessons.mjs" list`, then `add --id N` if
   a candidate already matches the root cause, else `add "<lesson>"`;
   `<plugin-root>` is the path printed as `acdev plugin root:` at session
   start). Its second occurrence promotes it into `CLAUDE.md`. If the bug
   exposed a lasting trap — a wrong assumption baked into an ADR, a layer
   behaving unexpectedly — write the ADR as well, so the next person does
   not rediscover it the hard way.

## Red flags

- **"Quick fix while I am here."** Unrelated changes bundled into a bug fix
  hide what actually fixed the bug and risk new bugs nobody asked for.
- **Stacking speculative fixes.** Applying fix after fix without evidence
  that any one of them addresses the cause — if the first guess didn't
  work, go back to step 3, don't pile on a second guess.
- **Fixing without reproducing.** A fix for a bug you cannot trigger is a
  guess with extra steps.
