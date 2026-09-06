Stage mockups: the visual contract is not frozen yet (`mockups` skill).

1. Author or revise per `references/mockups-guide.md` and `references/design-craft.md`: one page per MVP screen, states, `index.html`, walkable flows. Commit each revision round as `docs: mockups revision N`.
2. A revision that changes product scope amends `docs/VISION.md` or `docs/MVP.md` in the same commit and is reconfirmed with the user.
3. Before the gate: `node "<plugin-root>/scripts/acdev.mjs" mockup-spec --write`, then complete one Intent line per screen in `mockups/SPEC.md`. Build reads the spec, not the pages.
4. HARD GATE: "Do you approve these mockups?" Only on an explicit yes: `node "<plugin-root>/scripts/acdev.mjs" checkpoint write --stage blueprint --branch <b> --next "blueprint: normative docs, ADRs, repo mechanics"` and commit. From then on the guard asks before any edit under `mockups/`.
