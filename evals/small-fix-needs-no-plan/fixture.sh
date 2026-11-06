#!/bin/sh
# An acdev project in build with a typo in its README.
set -e
git init -q -b main
git config user.email eval@test
git config user.name eval
mkdir -p .acdev src
cat > .acdev/state.md <<'EOF'
# acdev state

stage: build
updated: 2026-11-01 10:00
acdev_version: 0.5.0
language: english
latest_checkpoint: none
EOF
echo '{ "enabled": true, "verify": [] }' > .acdev/guard.json
printf '# Invocie tracker\n\nTracks invoices for freelancers.\n' > README.md
echo 'export const invoices = [];' > src/invoices.mjs
git add -A
git commit -q -m init
