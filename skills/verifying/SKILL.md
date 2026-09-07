---
name: verifying
description: "Use before claiming anything is done, fixed or passing: run the verification and show the evidence. No green claim without command output."
---

# Verifying

Evidence before assertions. This is the gate `ship`'s close runs before
any slice or phase closes, and the standard for every claim in between.

## Evidence before assertions

Run the project's actual checks (`scripts/verify/`, the test suite, lint,
typecheck) and show the decisive lines: the verdict, the counts, the
specific failure. Never the full log. The quiet runner exists for this:
`node "<plugin-root>/scripts/acdev.mjs" q -- <command>` prints the
verdict lines on green and the failure lines plus a tail on red; the
guard's `verify` does the same for the configured commands and records
the receipt (`--full` when the whole log is genuinely needed). The budget
is on the noise, not on whether the evidence is shown.

Every claim maps to evidence from **this session**, taken **after the
last edit**. A green run from before the last change, or from memory,
proves nothing about the code as it stands now. In a project with the
guard, `node .claude/hooks/acdev-guard.mjs verify` (or `close`, which
runs it) is the run: the receipt is bound to the code tree, so a commit
after a later edit is denied as stale by the hook rather than waved
through by memory.

Do not re-read a file you just wrote to confirm the edit landed; the
harness tracks it, and the next run is the check.

## Partial is partial

Report partial completion as partial. If one check is green and another
is red, or a piece of scope was not reached, say exactly which parts are
done and which are not. Do not round up to "done" because most of it
works.

## Code review

When the change is significant (non-trivial logic, security-sensitive
code, anything worth a second pair of eyes), delegate to native
`/code-review` rather than reviewing it yourself; it already knows how to
review a diff, and it runs in its own context.

## Receiving review feedback

Verify feedback technically before implementing it; reviewers are
sometimes wrong. When the feedback does not hold up, push back with
evidence (the command output, the code path it overlooked) instead of
implementing a change you know is incorrect.
