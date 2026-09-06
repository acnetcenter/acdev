Build: an open incident spec outranks any slice (`operate` skill).

Read only the incident file named in the open plans. If a release is the suspect and no "unsafe when" clause in `docs/RUNBOOK.md` applies, roll back per the runbook before diagnosing; choosing roll-forward is a user-challenge decision.

The fix is a mini-slice: reproducing test first and frozen (`node .claude/hooks/acdev-guard.mjs freeze <test> --reason "<incident>"`), root cause per the `debugging` skill, then the two close commands with `--slice "change: <incident>" --plan <incident spec>`. Prevention is part of the spec: the mechanical check that would have caught it, and the lesson (`node "<plugin-root>/scripts/acdev.mjs" lessons list`, then `add --id N` or `add "<lesson>"`). Correct the runbook in the same commit if the incident proved a band, a command or a contact wrong.
