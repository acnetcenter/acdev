---
name: layer-demo
description: "Use when touching the fixture's demo layer: tagged items, probes and pitfalls served from references/checklist.md."
---

# Layer: demo

Production knowledge for the demo layer, stack-agnostic.

## Before advising

Read `docs/adr/` first. Hard gate: run
`node "<plugin-root>/scripts/acdev.mjs" checklist --layers demo --pitfalls`
and cite its output.

## How to verify

Otherwise run the `verify:` probe attached to each checklist item directly.
