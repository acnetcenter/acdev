// Test stand-in for the claude CLI judge: consumes the prompt from stdin,
// replies with ACDEV_FAKE_ANSWER (default NONE). With ACDEV_FAKE_SEQ (a
// comma-separated answer list) and ACDEV_FAKE_STATE (a counter file path),
// consecutive calls walk the sequence — this is how retry behavior is
// tested. Lets run-evals.mjs be tested end to end without a model call.
import { readFileSync, writeFileSync } from 'node:fs';

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  const seq = process.env.ACDEV_FAKE_SEQ;
  const state = process.env.ACDEV_FAKE_STATE;
  if (seq && state) {
    let n = 0;
    try {
      n = Number(readFileSync(state, 'utf8')) || 0;
    } catch {
      // first call: no counter file yet
    }
    writeFileSync(state, String(n + 1));
    const answers = seq.split(',');
    console.log(answers[Math.min(n, answers.length - 1)]);
    return;
  }
  console.log(process.env.ACDEV_FAKE_ANSWER ?? 'NONE');
});
