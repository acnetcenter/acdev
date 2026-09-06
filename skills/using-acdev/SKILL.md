---
name: using-acdev
description: How and when to use every acdev skill; loaded at session start.
---

# Using acdev

Rule: if an acdev skill matches the task, invoke it before responding. Exception: new-project and onboard are user-run — never invoke them yourself; recommend their /acdev command and stop. Resuming? Run /acdev:status first. In a project, `node "<plugin-root>/scripts/acdev.mjs" next` prints the step that applies now; follow it.

Pipeline: new-project (user-run; VISION, MVP gates) | mockups (MVP screens + spec) | blueprint (docs, ADRs, spikes, AI context) | onboard (user-run; adopt existing repo) | build (vertical slices, TDD) | ship (close: verify, drift, commit) | operate (post-deploy: canary, rollback, incidents) | status (where are we).

Process (auto): designing (before creative work) | planning (multi-step plans) | tdd (before implementing) | debugging (on any bug) | verifying (before claiming done).

Layers (auto per layer): layer-frontend, layer-api, layer-data, layer-auth, layer-security, layer-performance, layer-delivery, layer-cicd.

Pipeline skills outrank process skills when both match. In doubt about which skill applies, do not pick silently: offer the matching /acdev:<name> commands (every skill is one) and let the user choose.

Zero product code before build is ordered. Docs drift is fixed in the same commit. Every non-trivial user-requested change gets a spec in docs/plans/ and a CHANGELOG line at close. Docs, ADRs and checkpoints use the project's documentation language (docs/VISION.md). A guard denial is a gate: never route around it.
