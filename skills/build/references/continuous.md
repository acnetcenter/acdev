# Continuous build

Reference for `build`. Continuous mode removes the pauses between slices,
never the gates inside them. It runs only on the user's explicit
approval, offered at the blueprint gate or given any time during build
("build the whole MVP without stopping").

## What does not change

Every slice still gets its just-in-time plan, its tests first and a full
close (`acdev close --check`, then `acdev close`: green verification,
drift, CHANGELOG line, checkpoint, one commit) before the next slice
starts. Taste decisions go into the audit table, as always.

## What stops the run

- A user-challenge decision: write the checkpoint with `--blocked` naming
  the question, report it, and wait. The user answers and says
  "continue". Autonomy covers execution, never decisions.
- A trap that invalidates the current plan: the same way.
- The phase exit: the run ends at the phase's exit criteria and its
  security pass (`phase-exit.md`). A later phase needs its own mockups
  gate first, then its own run if the user wants one.

## How it runs

The session keeps going: report every slice close in one line ("slice N
shipped, verification green; next: X") without waiting for a reply, then
plan the next slice. The user can interrupt at any point.

The context grows with every slice, and a long context is paid again on
every turn. Each close is a safe place to drop it: the state, the plan
and the commit hold everything the next slice needs, and a session
started after `/clear` resumes from the session-start line. When the user
is present, suggest that cut every few slices; when they asked for an
unattended run, keep going and say at the end how many slices shared the
context.

For a run with a fresh context per slice and nobody watching, Claude
Code's own background sessions or a workflow can start one session per
slice; each one reads `acdev status`, builds one slice, closes it and
stops. The guard is the safety net in every one of them: no commit
without a green verification, no product code before build.
