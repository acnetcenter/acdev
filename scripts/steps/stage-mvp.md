Stage mvp: `docs/MVP.md` is approved; the next gate is the mockups.

Run the `mockups` skill: one HTML page per MVP screen with realistic data, empty/error/loading states for key screens, `index.html` grouped by flow, every critical flow walkable. Before the gate, `node "<plugin-root>/scripts/acdev.mjs" mockup-spec --write` and complete one Intent line per screen in `mockups/SPEC.md`. The gate asks "Do you approve these mockups?" and only an explicit yes freezes them.
