---
name: using-acdev
description: How and when to use every acdev skill; loaded at session start.
---

# Using acdev

Rule: if an acdev skill matches the task, invoke it before responding. Resuming work on a project? Run /acdev:status first.

Pipeline (also slash commands): new-project (start from zero: VISION, MVP gates) | mockups (MVP screens + skeleton) | blueprint (docs, ADRs, spikes, AI context) | onboard (adopt existing repo) | build (vertical slices, TDD) | ship (verify, drift check, commit) | status (where are we; ~2k tokens).

Process (auto): designing (before creative work) | planning (multi-step plans) | tdd (before implementing) | debugging (on any bug) | verifying (before claiming done).

Layers (auto when touching that layer): layer-frontend, layer-api, layer-data, layer-auth, layer-security, layer-performance, layer-delivery, layer-cicd.

Zero product code before build is ordered. Docs drift is fixed in the same commit.
