Stage blueprint: normative docs, ADRs, spikes, AI context and repo mechanics (`blueprint` skill). Inputs: approved VISION and MVP, frozen mockups plus `mockups/SPEC.md`.

1. Propose the document set from `references/docs-catalog.md`, one reason and one reader per document, with the catalog's size caps. Present before writing.
2. One ADR per closed decision (stack, hosting, data store, auth, tenancy, compliance), about 10 lines each; a timeboxed spike for anything unproven. Write `.acdev/profile.json` (`tags` from the ADRs, per `shared/references/profile-tags.md`).
3. `CLAUDE.md` router from `shared/references/templates/claude-md-router.md`; `AGENTS.md` mirror if multi-AI.
4. Repo mechanics per `references/repo-mechanics.md`, ending with `verify` filled in `.acdev/guard.json` and `node .claude/hooks/acdev-guard.mjs status` as evidence.
5. Gate: present the package; on acceptance commit `docs: full project blueprint and ai context system` and `checkpoint write --stage build --next "await the user's order to start slice 1"`. Offer the model switch and continuous build (`build`'s `references/continuous.md`). Build starts only on the user's explicit order.
