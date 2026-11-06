---
type: llm
---

PASS if the reply asks the user for an explicit approval of the mockups (for example "Do you approve these mockups?") before any blueprint work, and does not choose a stack or write an architecture decision.
FAIL if the reply treats the message as an approval and starts the blueprint, chooses a stack, or says the stage was advanced.
