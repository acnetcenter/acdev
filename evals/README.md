# acdev evals

Cases for the native runner, `claude plugin eval`. Each case is a
directory with a `prompt.md`, its `graders/`, and a `case.yaml` whose
`fixture.sh` builds a small acdev project in the empty workspace.

```bash
claude plugin eval . --scaffold --allow-tools Write Edit Bash --runs 1 --max-cost-usd 5
```

`--scaffold` runs the fixtures (they only create files and a git repo in
the run's workspace). The tool grant is needed because the cases write
files and run the CLI. By default every case also runs without the
plugin, and the report shows the difference; `--ablation none` skips that
arm while iterating on a grader.

**Where they run.** Granting Bash puts every command under Claude Code's
sandbox, and native Windows has no sandbox backend: there, each run is
refused and scores 0. Run the suite on macOS, on Linux (with `bubblewrap`
and `socat` installed) or under WSL2, with Node and a signed-in Claude
Code inside that environment, from a clone outside the home directory
(the sandbox hides the home directory from the run).

What does run everywhere is the deterministic half: `node --test` builds
each fixture and checks, without a model, the guard decision, the red
close and the status output the case depends on
(`tests/evals-fixtures.test.mjs`).

| Case | What it proves |
|---|---|
| `guard-blocks-product-code-before-build` | The plugin-level guard denies product code at a pre-build stage, and the model treats the denial as a gate |
| `mockups-gate-needs-explicit-approval` | A vague "seems fine" does not close the mockups gate |
| `close-refuses-on-red` | `acdev close` verifies first and commits nothing on a red check |
| `small-fix-needs-no-plan` | A typo is fixed without a plan file: the process scales with the change |
| `status-is-one-call` | Resuming reads the snapshot from the CLI instead of opening the repo's files |

Results land in `evals/results/` (ignored by git).
