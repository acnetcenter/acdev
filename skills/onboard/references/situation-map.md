# SITUATION.md template

Fill this template to produce `docs/SITUATION.md` for a repo being adopted
into acdev. Every factual line ends with its source tag: `[user]`, `[docs]`,
`[code]`, `[git]`, or `[gap]`. A line with no evidence behind it is a
declared gap, tagged `[gap]` — never a guess presented as fact.

```markdown
# SITUATION

Snapshot of the repo as found, before any acdev document rewrites it.
Dated at the point of onboarding; superseded by VISION/ROADMAP/ADRs once
adoption is complete.

## Product (observed)

<!-- What the product does, who it is for, and its delivery/business model,
as observed from the sources above. One sentence each fact, each with a
source tag. If the product's purpose cannot be established from any source,
say so as a gap instead of inferring it from the code's shape. -->

## Stack (observed)

<!-- Languages, frameworks, runtime, database, hosting/deploy target, and
key third-party integrations, each with a source tag. -->

## Layer state

| Layer | State | Evidence |
|---|---|---|
| Frontend | present / partial / absent / unknown | <one line, source tag> |
| API | present / partial / absent / unknown | <one line, source tag> |
| Data | present / partial / absent / unknown | <one line, source tag> |
| Auth | present / partial / absent / unknown | <one line, source tag> |
| Security | present / partial / absent / unknown | <one line, source tag> |
| Performance | present / partial / absent / unknown | <one line, source tag> |
| Delivery | present / partial / absent / unknown | <one line, source tag> |
| CI/CD | present / partial / absent / unknown | <one line, source tag> |

<!-- One row per acdev layer, always all 8, even when the state is
"unknown" or "absent" — a missing row reads as "not checked," which this
template does not allow. -->

## Documentation state

<!-- What documentation already exists (README, VISION, ADRs, wikis,
proyecto-kike-era docs), how current it looks against the code, and which
acdev documents have no equivalent yet. Each fact with a source tag. -->

## Tests and CI

<!-- Test presence and kind (unit/integration/e2e), coverage if measurable,
CI pipeline presence and what it runs, each with a source tag. -->

## Declared gaps

<!-- Everything looked for and not found, one line each, tagged [gap].
This section is the explicit alternative to guessing: if it is not here
and not backed by a source tag elsewhere, it should not appear anywhere
else in this document as fact. -->

## Risks

<!-- Risks implied by the gaps and partial states above: what could break
silently, what has no safety net, what nobody currently owns. -->

## Recommended adoption plan

<!-- Proposed in the confirm-and-adopt gate, after the map above is
confirmed by the user: which acdev artifacts are missing and worth
creating (VISION retroactively if absent, MVP.md only if unbuilt scope
remains worth gating, as-built ADRs for decisions already embodied in
code), and which pipeline stage the project should resume at. -->
```
