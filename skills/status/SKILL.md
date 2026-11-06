---
name: status
description: "Use when resuming work or asking where the project stands: one acdev status call prints the stage, the latest checkpoint, the current ROADMAP phase, open plans and what continues, for about 1k tokens; can also write a manual checkpoint."
---

# Status (resume snapshot)

## Read

One call:

```
acdev status
```

Report from that output only: stage, branch, last slice, plan, next
step, blockers, open plans (an `*-incident-*` plan comes first and
outranks any slice) and phase progress read from the phase section
alone. Its `to continue:` line names the skill or the user-run command
that picks the work up.

The whole answer stays under about 1k tokens: no repo scanning, no file
dumps. More detail is a separate, explicit request.

If there is no `.acdev/`, the command says so; stop there and never infer
a stage from the code. Offer `/acdev:onboard` (existing code) or
`/acdev:new-project` (empty repo); the user runs them.

`acdev` is the plugin's CLI in the Bash tool; in PowerShell call it as
`node "${CLAUDE_PLUGIN_ROOT}/scripts/acdev.mjs"`.

## Write (manual checkpoint)

For a save in the middle of work (a slice close writes its own):

```
acdev checkpoint write --stage <s> --branch <b> --next "<text>" [--slice "<n: name>"] [--plan "<docs/plans/...>"] [--files "<a,b>"] [--blocked "<text>"] [--notes "<text>"]
```

`--stage` (`product`, `mvp`, `mockups`, `blueprint`, `build`), `--branch`
and `--next` are required. `--blocked` only when stuck on a question for
the user. The path the command prints is the proof of the write.

## Trust rule

A checkpoint is a snapshot. When the repo disagrees with it (branch gone,
files moved, stage further along), say what differs and trust the repo;
never rewrite the checkpoint silently. The correction is the user's call.
