---
name: status
description: Use when resuming work or asking where the project stands: one acdev.mjs status call prints state, latest checkpoint, current ROADMAP phase and open plans for about 1k tokens; can also write a manual checkpoint.
---

# Status (resume snapshot)

## Read

One call:

```
node "<plugin-root>/scripts/acdev.mjs" status
```

`<plugin-root>` is the path printed as `acdev plugin root:` at session
start. Report from that output only: stage, branch, last slice, plan,
next step, blockers, open plans (an `*-incident-*` plan comes first and
outranks any slice; `operate` owns it), and phase progress (slices and
exit criteria done versus outstanding) read from the phase section
alone. Its last line is the `next` command; run it when the
user wants to continue.

**Budget.** The whole answer stays under about 1k tokens: no repo
scanning, no file dumps. More detail is a separate, explicit request.

**Missing `.acdev/`.** The command says so; stop there, never infer a
stage from the code. Offer `/acdev:onboard` (existing code) or
`/acdev:new-project` (empty repo); both are user-run.

## Write (manual checkpoint)

Mid-work saves (a slice close is `ship`'s job):

```
node "<plugin-root>/scripts/checkpoint.mjs" write --stage <s> --branch <b> --next "<text>" [--slice "<n: name>"] [--plan "<docs/plans/...>"] [--files "<a,b>"] [--blocked "<text>"] [--notes "<text>"]
```

`--stage` (`intake`, `vision`, `mvp`, `mockups`, `blueprint`, `build`),
`--branch` and `--next` are required; the script names a missing flag.
`--plan` whenever the work follows a plan; `--blocked` only when stuck.
The path the script prints is the proof of the write: confirm it.

## Trust rule

A checkpoint is a snapshot. When the repo disagrees (branch gone, files
moved, stage further along), say what differs and trust the repo; never
rewrite the checkpoint silently. The correction is the user's call, via a
fresh manual checkpoint or the next `ship`.
