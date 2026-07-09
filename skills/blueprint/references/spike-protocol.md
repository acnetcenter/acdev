# Spike protocol

Reference for `blueprint` (and later, `build`) when an ADR depends on
something unproven. A spike is the technical symmetric of a mockup: a
mockup lets the user "see before building," a spike lets the team "touch
before committing." It answers exactly one concrete technical question,
then it is thrown away.

## The contract

1. **Trigger.** While drafting an ADR, the decision depends on something
   unproven: a third-party API of unknown shape or reliability, a critical
   integration nobody on the team has used, or a performance requirement
   that is doubtful on the chosen stack. Any of these triggers a spike
   before the ADR is frozen.
2. **Success criterion written BEFORE any code.** State precisely what
   "it works" means, as an observable, checkable fact — never an
   open-ended "explore the API" or "see if this is feasible."
3. **Timebox: 2-6 hours.** Pick a number inside that range up front and
   stop at it, whether or not the criterion was met. A spike that needs
   more than 6 hours is answering the wrong question or is not actually a
   spike — split it or replace it with a smaller question.
4. **Location: `spikes/NNN-question/`**, outside the product tree.
   `NNN` is a zero-padded sequence number; `question` is a short slug of
   what is being tested.
5. **Result recorded in the ADR.** The spike's outcome — works, does not
   work, or works with these specific limits — is written back into the
   `Context` or `Consequences` section of the ADR that triggered it, with
   enough detail that a future reader does not have to re-run the spike to
   understand the decision.
6. **Spike code never merges into product code.** The folder stays in the
   repo as evidence of what was tried and learned; it is never imported by,
   copy-pasted into, or otherwise reused as the real implementation. Build
   re-implements the proven approach properly, inside the product tree,
   under normal review and test discipline.
7. **Optional by design.** A CRUD feature on a known, already-proven stack
   triggers zero spikes. Do not manufacture spikes for decisions that are
   not actually in doubt.

## Worked example

- **Question:** Can the accounting API X export invoices with line items?
- **Success criterion:** Obtain an OAuth token against API X and read 10
  real invoices, each with its line items, using only documented calls.
- **Timebox:** 4 hours.
- **Folder:** `spikes/001-x-api-invoices/`.
- **Outcome template** (pick one and fill it in):
  - **Works.** "Obtained a token via client-credentials grant; read 10
    invoices from the sandbox tenant, each with 1-14 line items, in under
    2s per call." Evidence snippet: the raw JSON of one sample invoice
    response, trimmed to the fields that matter, saved in the spike
    folder.
  - **Does not work.** "The documented invoices endpoint returns line
    items only on the Enterprise tier; the sandbox account is on
    Standard and the endpoint 403s." Evidence snippet: the request and
    the 403 response body.
  - **Works with limits.** "Line items are readable, but the API caps
    responses at 25 invoices per call and requires a 1s delay between
    calls to avoid rate limiting — a full export needs pagination and
    throttling." Evidence snippet: the paginated request sequence and the
    rate-limit response header values observed.
- **ADR update line:** In `ADR-000X: Invoice export via API X`, under
  Context: "Spike `spikes/001-x-api-invoices/` confirmed line items are
  readable on the Enterprise tier only, capped at 25/call with 1s
  throttling (see spike folder for evidence)." The Decision and
  Consequences sections then account for that limit explicitly (e.g.
  budget for pagination, note the Enterprise-tier cost implication).
- **Disposal rule:** the spike code in `spikes/001-x-api-invoices/` is
  never merged into the product; the folder is kept in the repo as
  evidence backing the ADR, not as a starting point for the real
  integration.
