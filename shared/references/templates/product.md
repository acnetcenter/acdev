# Product

<!-- impeccable:product-schema 1 -->

<!-- Cap: about 120 lines. Confirmed facts and explicitly marked open decisions only; omit a section rather than fill it with generic prose. Nothing visual (that is DESIGN.md) and no delivery cut (that is MVP.md). The sections down to Accessibility follow the schema design tools already read; Model and Critical Flows are acdev's. -->

## Platform

<!-- One bare value. With screens: web | ios | android | adaptive (design tools read it). Without: cli | api | worker. -->

## Stack

<!-- The user's stated preference, or "decided at blueprint (docs/adr/)". The blueprint stage replaces this line with the decided stack. -->

## Users

<!-- Who uses it, their situation and technical level. If the payer is not the user, name each one. -->

## Product Purpose

<!-- What it is in one sentence without jargon, the concrete problem it solves and how people solve it today. Then what it is NOT: the scope it explicitly refuses. -->

## Positioning

<!-- The approach in 2-4 sentences: the mechanism or claim a neighbouring product could not truthfully copy. No architecture or stack here. -->

## Operating Context

<!-- Where and how it runs for its users: jurisdictions, data residency, connectivity, devices, volumes. Omit when nothing was established. -->

## Capabilities and Constraints

<!-- Confirmed features and capabilities, integrations with their third-party lead times, hard constraints (legal, budget, deadline), undecided facts marked as open with an owner. -->

## Brand Commitments

<!-- Existing name, voice, logo, colours and references the user made binding. Omit when none. -->

## Evidence on Hand

<!-- Real content, data, research, with paths. State absences that must not be fabricated. -->

## Product Principles

<!-- Three to five durable principles that decide trade-offs. No visual recipes, no best-practice platitudes. -->

## Accessibility & Inclusion

<!-- Required standard or known needs. Omit when none was established. -->

## Model

<!-- Delivery and tenancy (public multi-tenant SaaS | single-tenant for one client | on-premise | local or personal app) and business (product for sale | internal tool | personal use). This decides whether whole subsystems exist: tenant isolation, roles, billing, support. -->

## Critical Flows

<!-- The 3-5 end-to-end flows that must work, each ending in an observable result ("signs up -> connects X -> obtains Y"), not in a screen. -->

---

Inconsistencies between documents and code are corrected in the documents
or via ADR; this document only changes by explicit decision of the product
owner.
