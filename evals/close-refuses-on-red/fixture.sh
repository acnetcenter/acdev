#!/bin/sh
# An acdev project in build with an uncommitted slice whose test fails.
set -e
git init -q -b main
git config user.email eval@test
git config user.name eval
mkdir -p .acdev src test
cat > .acdev/state.md <<'EOF'
# acdev state

stage: build
updated: 2026-11-01 10:00
acdev_version: 0.5.0
language: english
latest_checkpoint: none
EOF
echo '{ "enabled": true, "verify": ["node --test"] }' > .acdev/guard.json
echo '.acdev/verify-receipt.json' > .gitignore
echo 'export const total = (items) => items.reduce((n, i) => n + i.amount, 0);' > src/totals.mjs
cat > test/totals.test.mjs <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { total } from '../src/totals.mjs';

test('total sums the amounts', () => {
  assert.equal(total([{ amount: 2 }, { amount: 3 }]), 5);
});
EOF
git add -A
git commit -q -m init
# The slice in progress: a change that breaks the test, not yet committed.
echo 'export const total = (items) => items.reduce((n, i) => n - i.amount, 0);' > src/totals.mjs
