#!/bin/sh
# An acdev project at the mockups stage: MVP approved, mockups drawn, gate open.
set -e
git init -q -b main
git config user.email eval@test
git config user.name eval
mkdir -p .acdev docs mockups
cat > .acdev/state.md <<'EOF'
# acdev state

stage: mockups
updated: 2026-11-01 10:00
acdev_version: 0.5.0
language: english
latest_checkpoint: none
EOF
echo '{ "enabled": true, "verify": [] }' > .acdev/guard.json
printf '# Product\n\n## Product Purpose\nA small invoice tracker for freelancers.\n' > docs/PRODUCT.md
printf '# MVP\n\n## In scope (v1)\n1. Create an invoice\n2. List invoices\n' > docs/MVP.md
printf '<html><head><title>Index</title></head><body><a href="invoice-list.html">Invoices</a></body></html>\n' > mockups/index.html
printf '<html><head><title>Invoices</title></head><body><main><h1>Invoices</h1><table><tr><th>Number</th><th>Client</th></tr></table></main></body></html>\n' > mockups/invoice-list.html
git add -A
git commit -q -m init
