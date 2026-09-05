---
name: status
description: Use when resuming work or asking where the project stands: read state, latest checkpoint, current ROADMAP phase and open plans for about 2k tokens; can also write a manual checkpoint.
---

# Status (resume snapshot)

This skill answers "where are we" without re-deriving it from the repo.
Everything it reports comes from three cheap sources — the checkpoint
script, the current phase of the ROADMAP, and a name-only grep of
`docs/plans/` for open plans — never from scanning the codebase.

## Read

Run:

```
node "<plugin-root>/scripts/checkpoint.mjs" read
```

`<plugin-root>` is the absolute path printed as `acdev plugin root:` in the
session context at startup.

This prints `.acdev/state.md` (stage, updated, acdev_version, language,
latest checkpoint path) and
the full latest checkpoint file. Then read **only the current phase
section** of `docs/ROADMAP.md` — the phase named by `state.md`'s stage, not
the whole document. A multi-phase roadmap is not a status input; the phase
already in progress is. Last, list open plans: the file names of
`docs/plans/*.md` whose frontmatter says `status: active` (one grep,
names only — never their contents).

From those sources, report:

- **Stage** — the pipeline stage from `state.md`.
- **Branch** — from the latest checkpoint's `branch` field.
- **Last slice** — from the latest checkpoint's `slice` field.
- **Plan** — from the latest checkpoint's `plan` field, if not `null`.
- **Next step** — from the latest checkpoint's `next_step` field.
- **Blockers** — from `blocked_on`, if not `null`.
- **Open plans** — the `status: active` file names from `docs/plans/`,
  including user-requested changes not yet shipped. Files named
  `*-incident-*` are listed first: an open incident outranks any planned
  slice, and the `operate` skill owns it.
- **Phase progress** — which slices/exit criteria in the current ROADMAP
  phase are done versus outstanding, read from that phase section only.

**Budget.** The whole status answer, including the read above, stays under
roughly 2k tokens. No repo scanning, no grepping for code, no dumping full
files into the conversation — the checkpoint, one ROADMAP section and the
name-only plans grep are the entire input. If more detail is wanted, that
is a separate, explicit request, not part of a status check.

**Missing `.acdev/`.** If `.acdev/` does not exist in the project, say so
plainly and stop — do not infer a stage from the repo's code. Offer two
paths: `/acdev:onboard` if the repo already has code, `/acdev:new-project`
if it is empty. Both are user-invoked; let the user pick and run the
command themselves.

## Write (manual checkpoint)

When the user asks to save state mid-work — not at a slice close, which is
`ship`'s job — gather what the session actually knows: the current stage,
branch, the slice in progress (if any), the files touched so far, and a
concrete next step. Then call:

```
node "<plugin-root>/scripts/checkpoint.mjs" write --stage <s> --branch <b> --next "<text>" [--slice "<n: name>"] [--plan "<docs/plans/...>"] [--files "<a,b>"] [--blocked "<text>"] [--notes "<text>"]
```

`--stage`, `--branch`, and `--next` are required; the script exits with an
error naming the missing flag if any of them are absent. `--stage` must be
one of `intake`, `vision`, `mvp`, `mockups`, `blueprint`, `build`. `--slice`,
`--plan`, `--files`, `--blocked`, and `--notes` are optional — supply them
when the session has the information, skip them otherwise. Supply `--plan`
whenever the work in progress follows a plan file. Use `--blocked` when
work is genuinely stuck, not as a routine field.

After the script runs, confirm the checkpoint path it prints back to the
user — that path is the proof the write happened, not a restatement of
what was asked for.

## Trust rule

A checkpoint records what was true at the moment it was written — it is a
snapshot, not a live view. If what it says conflicts with what the repo
actually shows right now (the branch it names no longer exists, the files
it lists have moved or are gone, the stage looks further along than
recorded), say what differs plainly and trust the repo over the
checkpoint. Report the drift instead of silently picking one version or
silently overwriting the checkpoint to match reality — that correction is
the user's call, typically made through a fresh manual checkpoint or the
next `ship`.
