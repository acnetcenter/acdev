#!/bin/sh
# An acdev project whose PRODUCT.md is approved and whose MVP is being cut.
set -e
git init -q -b main
git config user.email eval@test
git config user.name eval
mkdir -p .acdev docs
cat > .acdev/state.md <<'EOF'
# acdev state

stage: mvp
updated: 2026-11-01 10:00
acdev_version: 0.5.0
language: english
latest_checkpoint: none
EOF
echo '{ "enabled": true, "verify": [] }' > .acdev/guard.json
cat > docs/PRODUCT.md <<'EOF'
# Product

## Product Purpose
A small invoice tracker for freelancers. Not an accounting suite.

## Model
Local app, personal use.

## Critical Flows
- creates an invoice -> sees it in the list
EOF
git add -A
git commit -q -m init
