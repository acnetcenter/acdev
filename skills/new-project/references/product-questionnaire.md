# Questionnaire for PRODUCT.md

PRODUCT.md is the durable, factual context of the product: who it is for,
what it does and refuses to do, how it is delivered. It stays short (about
120 lines), holds confirmed facts and explicitly marked open decisions,
and omits a section rather than fill it with generic prose. Design tools
read the same file, so the first eleven headings keep their order; the
last two (`Model`, `Critical Flows`) are what the rest of this pipeline
derives from.

## Procedure

1. `acdev scaffold product docs/PRODUCT.md`, then replace each
   `<!-- ... -->` guidance comment with real content, in the documentation
   language. Keep the `<!-- impeccable:product-schema 1 -->` line under
   the title as it is: design tools look for it. An existing
   `docs/PRODUCT.md` is read and completed, never overwritten.
2. For every question offer your best draft answer, seeded from what the
   user already told: they correct a draft better than they compose one
   cold. Ask in the conversation order below, not the file order.
3. Challenge weak answers. "For everyone" gets "who is not a customer?";
   "as complete as possible" gets "what is explicitly out of the first
   version?". A product document says as much through what it excludes.
4. Show each agreed section as document text in the reply (a quoted or
   fenced block, verbatim, with the question below it) and Edit it into
   the file before moving on. On the short path the same applies to the
   whole draft at once. There is no separate whole-document write at the
   end: by the last section the file holds every line and the user has
   read every line.
5. Gate and state change: in the skill body.

## Conversation order

1. **Product Purpose.** The product in one sentence, without jargon. The
   concrete problem, and how people solve it today. Then what it is NOT:
   this is the vaccine against scope creep for every later session.
2. **Users.** The target user and their technical level. If the payer is
   not the user, who is each one.
3. **Model.** Two axes that do not always move together. Delivery and
   tenancy: public multi-tenant SaaS, single-tenant for one client,
   on-premise, local or personal app. Business: product for sale, internal
   tool, personal use. This is the highest-leverage section: it decides
   whether whole subsystems exist (tenant isolation, roles, billing,
   support) and becomes the project's golden rules at blueprint.
4. **Critical Flows.** The 3-5 end-to-end flows that must work, each
   ending in an observable result ("signs up -> connects X -> obtains Y"),
   not in a screen.
5. **Capabilities and Constraints.** The feature list, the integrations
   and their third-party lead times (an approval can block a phase), hard
   constraints, and what is still undecided, with an owner.
6. **Positioning.** The approach in 2-4 sentences. No architecture or
   stack talk: if the conversation drifts there, note the point as
   blueprint input and steer back.
7. **Platform and Operating Context.** Where it runs, and in which
   countries or regions it operates and holds user data. Ask this; never
   assume it from the product's domain. The compliance decision itself is
   made at blueprint, from this answer.
8. **Product Principles.** Three to five that would actually decide a
   trade-off.
9. **Brand Commitments, Evidence on Hand, Accessibility & Inclusion.** One
   question for the three: is anything already binding (a name, a voice,
   real content, a required standard)? Omit the sections that get a no.
10. **Stack.** Only the user's stated preference, or "decided at
    blueprint". The decision and its reasons are an ADR, later.

Security constraints (roles, who sees what) and other answers that are
not product identity are noted for the blueprint stage, not written here.

The file ends with this rule, verbatim, in the documentation language:
"Inconsistencies between documents and code are corrected in the documents
or via ADR; this document only changes by explicit decision of the product
owner."
