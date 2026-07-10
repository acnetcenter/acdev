---
name: using-acdev
description: How and when to use every acdev skill; loaded at session start.
---

# Using acdev

Rule: if an acdev skill matches the task, invoke it before responding; user-run skills are never model-invoked — recommend their /acdev command instead. Resuming work on a project? Run /acdev:status first.

Pipeline: new-project (user-run; start from zero: VISION, MVP gates) | mockups (MVP screens + skeleton) | blueprint (docs, ADRs, spikes, AI context) | onboard (user-run; adopt existing repo) | build (vertical slices, TDD) | ship (verify, drift check, commit) | status (where are we; ~2k tokens).

Process (auto): designing (before creative work) | planning (multi-step plans) | tdd (before implementing) | debugging (on any bug) | verifying (before claiming done).

Layers (auto when touching that layer): layer-frontend, layer-api, layer-data, layer-auth, layer-security, layer-performance, layer-delivery, layer-cicd.

Pipeline skills outrank process skills when both match. In doubt or ambiguity about which skill applies, do not pick silently: offer the matching /acdev:<name> commands (every skill is one) with what each does, and let the user choose.

Zero product code before build is ordered. Docs drift is fixed in the same commit. Every generated artifact (docs, ADRs, checkpoints) is written in the project's documentation language — match docs/VISION.md.
