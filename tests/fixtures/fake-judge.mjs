// Test stand-in for the claude CLI judge: consumes the prompt from stdin,
// replies with ACDEV_FAKE_ANSWER (default NONE). With ACDEV_FAKE_SEQ (a
// comma-separated answer list) and ACDEV_FAKE_STATE (a counter file path),
// consecutive calls walk the sequence — this is how retry behavior is
// tested. ACDEV_FAKE_HANG never answers (timeout path); ACDEV_FAKE_EXIT
// exits nonzero (judge-failure path). Lets run-evals.mjs be tested end to
// end without a model call.
import { readFileSync, writeFileSync } from 'node:fs';

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  if (process.env.ACDEV_FAKE_HANG) {
    // Stay alive silently until the runner's timeout kills us.
    setInterval(() => {}, 1000);
    return;
  }
  if (process.env.ACDEV_FAKE_EXIT) {
    console.error('fake judge failure');
    process.exit(Number(process.env.ACDEV_FAKE_EXIT));
  }
  if (process.env.ACDEV_FAKE_JSON) {
    // Budget suite: a headless-style result, preceded by a banner line the
    // parser must skip.
    console.log('banner');
    console.log(process.env.ACDEV_FAKE_JSON);
    return;
  }
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
