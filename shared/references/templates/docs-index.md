# Documentation index

<One line per document: what it is and when to read it. List only what
actually exists. Series folders (adr/, plans/, designs/, domain/) get one
line as a folder, never one line per file inside them; the line appears
when the folder is born. The ../CHANGELOG.md line is added by the ship
close that creates that file, not at blueprint time.>

- [VISION.md](VISION.md) — what the product is and why; the source of truth every other doc derives from
- [MVP.md](MVP.md) — the gated phase-1 scope
- [ROADMAP.md](ROADMAP.md) — phases with verifiable exit criteria; where the project is going
- [ARCHITECTURE.md](ARCHITECTURE.md) — system shape, components, data flow
- <...one line per remaining singleton doc actually produced (DATA-MODEL, SECURITY, UI-DESIGN, INTEGRATIONS, SITUATION...)>
- [RUNBOOK.md](RUNBOOK.md) — how the service is deployed, rolled back and watched; read after every deploy and on every incident (only when the project deploys)
- [adr/](adr/) — architecture decision records, one per closed decision
- [plans/](plans/) — dated plans/specs, one per slice, user-requested change or incident (`*-incident-*`); `status:` frontmatter marks active/shipped/abandoned
- [designs/](designs/) — dated design documents
- [domain/](domain/) — central-domain rule docs (only when the project has one)
- [../CHANGELOG.md](../CHANGELOG.md) — summarized history of every shipped change, each line linking its plan when one exists
