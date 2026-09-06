Build: the latest checkpoint is blocked.

Report `blocked_on` to the user in one short paragraph: the question or the trap, the evidence, and what each answer would change. Then wait. Do not plan, build or close anything until the user answers; autonomy covers execution, never decisions.

On the answer: record it where it lasts (an ADR for a technical decision; a `docs/VISION.md` or `docs/MVP.md` amendment, same commit as the code, if product behavior changed), write a checkpoint without `--blocked` naming the resumed slice, then run `next` again.
