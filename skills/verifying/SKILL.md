---
name: verifying
description: Use before claiming anything is done, fixed or passing: run the verification and show the evidence. No green claim without command output.
---

# Verifying

Evidence before assertions. This skill is the gate `ship` runs before any
slice or phase closes.

## Evidence before assertions

Run the project's actual checks — `scripts/verify/`, the test suite,
lint, typecheck — and paste the decisive lines: the verdict lines (pass
counts, exit status, the specific failure), never the full log. The
budget is on the noise, not on whether the evidence is shown.

Every claim maps to evidence. "Tests pass" requires the passing run from
**this session**, taken **after the last edit** — a green run from before
the last change, or from memory, proves nothing about the code as it
stands now.

## Partial is partial

Report partial completion as partial. If one check is green and another is
red, or a piece of scope was not reached, say exactly which parts are done
and which are not — do not round up to "done" because most of it works.

## Code review

When the change is significant — non-trivial logic, security-sensitive
code, anything worth a second pair of eyes — delegate to native
`/code-review` rather than reviewing it yourself; it already knows how to
review a diff.

## Receiving review feedback

Verify feedback technically before implementing it — reviewers are
sometimes wrong. When the feedback does not hold up, push back with
evidence (the command output, the code path it overlooked) instead of
implementing a change you know is incorrect.
