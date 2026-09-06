# ADR-0001: Stack

- Status: accepted
- Date: 2026-09-01
- Class: user-challenge

## Context
One developer, a small invoicing SaaS, no unproven dependency.

## Decision
Node 22 with SQLite behind a thin HTTP layer, deployed on Fly with one region.

## Consequences
Cheap to run and to roll back; a second region is a new ADR.
