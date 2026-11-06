#!/bin/sh
# An acdev project in build with a checkpoint that names the next slice.
set -e
git init -q -b main
git config user.email eval@test
git config user.name eval
mkdir -p .acdev/checkpoints docs src
cat > .acdev/state.md <<'EOF'
# acdev state

stage: build
updated: 2026-11-01 10:00
acdev_version: 0.5.0
language: english
latest_checkpoint: .acdev/checkpoints/20261101-100000-2-totals.md
EOF
cat > .acdev/checkpoints/20261101-100000-2-totals.md <<'EOF'
---
date: 2026-11-01 10:00
stage: build
branch: "main"
slice: "2: totals"
plan: null
files_modified: ["src/totals.mjs"]
next_step: "slice 3: export an invoice as PDF"
blocked_on: null
---
Totals shipped with rounding to two decimals.
EOF
echo '{ "enabled": true, "verify": ["node --test"] }' > .acdev/guard.json
printf '# Roadmap\n\n## Phase 1: MVP\n\n- slice 1 walking skeleton\n- slice 2 totals\n- slice 3 export PDF\n\nExit criteria: a user exports an invoice as PDF.\n' > docs/ROADMAP.md
echo 'export const total = (items) => items.reduce((n, i) => n + i.amount, 0);' > src/totals.mjs
git add -A
git commit -q -m init
