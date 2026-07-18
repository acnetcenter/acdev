#!/usr/bin/env node
// On-demand behavioral evals for acdev's semantic surface: does a session
// route a user prompt to the right skill (routing suite), and does a skill
// body produce the required decision at its hard rules (gates suite)?
// Each case is one model call, so this runs on demand (npm run evals),
// never in CI. See the README "Evals" section.
//
// usage: run-evals.mjs [--suite routing|gates|all] [--model M] [--dry-run]
//        [--filter SUBSTR] [--cases-dir DIR] [--concurrency N]
//
// ACDEV_EVAL_CMD replaces the default `claude -p --model M` judge with a
// custom command (split on spaces; the prompt always arrives on stdin) so
// the pipeline is testable without a model call. ACDEV_EVAL_TIMEOUT_MS
// overrides the per-call judge timeout (test-only injection).
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
const norm = (s) => s.replace(/\r\n/g, '\n');
const TIMEOUT_MS = Number(process.env.ACDEV_EVAL_TIMEOUT_MS) || 120000;

let args;
try {
  ({ values: args } = parseArgs({
    args: process.argv.slice(2),
    options: {
      suite: { type: 'string', default: 'all' },
      model: { type: 'string', default: 'haiku' },
      'dry-run': { type: 'boolean', default: false },
      filter: { type: 'string' },
      'cases-dir': { type: 'string', default: join(ROOT, 'evals') },
      concurrency: { type: 'string', default: '4' },
      retries: { type: 'string', default: '1' },
      ablate: { type: 'boolean', default: false }
    }
  }));
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
if (!['routing', 'gates', 'all'].includes(args.suite)) {
  console.error(`invalid --suite "${args.suite}" (expected routing, gates or all)`);
  process.exit(1);
}

// The session-start activation surface: the gateway body the hook injects,
// plus the model-invocable descriptions. The per-prompt stage line that
// hooks/prompt-context.mjs adds inside a project is NOT simulated here.
// using-acdev's own description is omitted — its full body is present.
function skillSurface() {
  const dir = join(ROOT, 'skills');
  const skills = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const raw = readFileSync(join(dir, d.name, 'SKILL.md'), 'utf8');
    const m = raw.match(FRONTMATTER);
    skills.push({
      name: m[1].match(/^name:\s*(.+)$/m)[1].trim(),
      desc: m[1].match(/^description:\s*(.+)$/m)[1].trim(),
      noModel: /^disable-model-invocation:\s*true$/m.test(m[1]),
      body: norm(raw.slice(m[0].length)).trim()
    });
  }
  return skills;
}

function routingPrompt(surface, userPrompt) {
  const gateway = surface.find((s) => s.name === 'using-acdev');
  const invocable = surface.filter((s) => !s.noModel && s.name !== 'using-acdev');
  return [
    "You are simulating Claude Code's skill selection for the acdev plugin.",
    '',
    'This gateway text was injected at session start:',
    '---',
    gateway.body,
    '---',
    '',
    'These skill descriptions are loaded and can auto-activate:',
    '',
    ...invocable.map((s) => `- ${s.name}: ${s.desc}`),
    '',
    'A user sends this prompt (it may be in any language):',
    '---',
    userPrompt,
    '---',
    '',
    'Which acdev skill should activate first for this prompt? Reply with EXACTLY one line and nothing else:',
    '- the skill name alone (e.g. tdd) if one skill clearly applies first',
    '- RECOMMEND:<name> if the rules say to recommend a user-run /acdev command instead of invoking it',
    '- OFFER if it is genuinely ambiguous which skill applies and the rule is to offer the matching /acdev commands and let the user choose',
    '- NONE if no acdev skill applies'
  ].join('\n');
}

function gatePrompt(c, ablate = false) {
  // ablate: drop the governing text entirely — a case a judge still
  // answers correctly is non-discriminative (answerable from priors).
  const ctx = ablate
    ? '(no governing text provided)'
    : c.context
        .map((p) => {
          const raw = norm(readFileSync(join(ROOT, p), 'utf8'));
          return `--- ${p} ---\n${raw.replace(FRONTMATTER, '').trim()}`;
        })
        .join('\n\n');
  return [
    'You are Claude Code running the acdev plugin. The governing acdev text for this situation:',
    '',
    ctx,
    '',
    'Situation:',
    c.scenario,
    '',
    'Per the text above, what is the required next action?',
    ...['A', 'B', 'C', 'D'].map((k) => `${k}) ${c.options[k]}`),
    '',
    'Reply with the single letter only.'
  ].join('\n');
}

function loadCases(suite) {
  const path = join(args['cases-dir'], `${suite}.cases.json`);
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    console.error(`cannot load ${path}: ${err.message}`);
    process.exit(1);
  }
  const required = suite === 'routing' ? ['id', 'prompt', 'expect'] : ['id', 'context', 'scenario', 'options', 'expect'];
  for (const c of data.cases ?? []) {
    const missing = required.filter((k) => c[k] === undefined);
    if (missing.length) {
      console.error(`${path}: case "${c.id ?? '?'}" missing ${missing.join(', ')}`);
      process.exit(1);
    }
  }
  const cases = data.cases ?? [];
  return args.filter ? cases.filter((c) => c.id.includes(args.filter)) : cases;
}

function judgeCmd() {
  const custom = process.env.ACDEV_EVAL_CMD;
  if (custom) {
    // Split on spaces: enough for "node path/to/fake-judge.mjs"; a judge
    // command whose path contains spaces is not supported.
    const [cmd, ...rest] = custom.split(' ').filter(Boolean);
    return { cmd, args: rest, shell: false };
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(args.model)) {
    console.error(`invalid --model "${args.model}"`);
    process.exit(1);
  }
  // The claude CLI installs as a .cmd shim on Windows, which needs a
  // shell. A single concatenated string avoids DEP0190; only the
  // validated model name reaches the line, the prompt travels on stdin.
  if (process.platform === 'win32') {
    return { cmd: `claude -p --model ${args.model}`, args: [], shell: true };
  }
  return { cmd: 'claude', args: ['-p', '--model', args.model], shell: false };
}

function callJudge(prompt) {
  const { cmd, args: cmdArgs, shell } = judgeCmd();
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { shell, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    let settled = false;
    const settle = (r) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    const timer = setTimeout(() => {
      // Settle directly: with shell:true (win32) the child is cmd.exe and
      // kill() would orphan the claude grandchild, whose open pipes keep
      // 'close' from ever firing — the one scenario a timeout exists for.
      settle({ ok: false, out: `judge timeout after ${TIMEOUT_MS}ms` });
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      } else {
        child.kill();
      }
    }, TIMEOUT_MS);
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    // A judge that dies without draining stdin must cost one FAIL, not
    // crash the whole run with an unhandled EPIPE/EOF write error.
    child.stdin.on('error', () => {});
    child.on('error', (e) => {
      clearTimeout(timer);
      settle({ ok: false, out: `judge spawn failed: ${e.message}` });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) settle({ ok: true, out });
      else settle({ ok: false, out: `judge exit ${code}: ${(err || out).trim().slice(0, 200)}` });
    });
    child.stdin.end(prompt);
  });
}

function parseRouting(raw, skillNames) {
  // Top-down: the prompt demands the answer first, so the first line that
  // parses wins ("tdd\nBecause..." reads tdd, "NONE\ntdd" reads NONE). A
  // bare word only counts as an answer when it names a real skill, so a
  // lone word opening an explanation ("Sure.") is skipped, not scored.
  // Whitespace after RECOMMEND's colon is accepted — the prompt's
  // "RECOMMEND:<name>" template invites it.
  const lines = norm(raw).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  for (const rawLine of lines) {
    const line = rawLine.replace(/^["'`*]+|["'`*.]+$/g, '');
    const m = line.match(/^(NONE|OFFER|RECOMMEND:\s*[a-z][a-z0-9-]*|[a-z][a-z0-9-]*)$/i);
    if (!m) continue;
    const v = m[1];
    if (/^none$/i.test(v)) return 'NONE';
    if (/^offer$/i.test(v)) return 'OFFER';
    if (/^recommend:/i.test(v)) return `RECOMMEND:${v.slice(v.indexOf(':') + 1).trim().toLowerCase()}`;
    if (skillNames.has(v.toLowerCase())) return v.toLowerCase();
  }
  return null;
}

function parseGate(raw) {
  const lines = norm(raw).trim().split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^[^A-Za-z]*([A-D])[^A-Za-z]*$/i);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

async function runPool(items, worker, limit) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, limit) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(lanes);
  return results;
}

const surface = skillSurface();
const skillNames = new Set(surface.map((s) => s.name));

// Diagnostic mode: how many gate cases can a judge answer with NO context?
// Those cases measure priors, not the governing text — they need sharper
// distractors. Always exits 0: this measures the suite, it does not gate.
if (args.ablate) {
  const cases = loadCases('gates');
  const prompts = cases.map((c) => gatePrompt(c, true));
  if (args['dry-run']) {
    cases.forEach((c, i) => console.log(`=== case ${c.id} (ablated) ===\n${prompts[i]}\n`));
    console.log(`gates ablation: ${cases.length} case(s), dry run only`);
    process.exit(0);
  }
  const answers = await runPool(prompts, callJudge, Number(args.concurrency) || 4);
  let hits = 0;
  cases.forEach((c, i) => {
    const got = answers[i].ok ? parseGate(answers[i].out) : null;
    if (got === c.expect) {
      hits++;
      console.log(`  ablate ${c.id}: answerable without context`);
    }
  });
  console.log(`gates ablation: ${hits}/${cases.length} answerable without context (non-discriminative)`);
  process.exit(0);
}

const suites = args.suite === 'all' ? ['routing', 'gates'] : [args.suite];
let failures = 0;
let total = 0;
const suiteStats = [];
for (const suite of suites) {
  const cases = loadCases(suite);
  const prompts = cases.map((c) => (suite === 'routing' ? routingPrompt(surface, c.prompt) : gatePrompt(c)));
  total += cases.length;
  if (args['dry-run']) {
    cases.forEach((c, i) => console.log(`=== case ${c.id} ===\n${prompts[i]}\n`));
    console.log(`${suite}: ${cases.length} case(s), dry run only`);
    continue;
  }
  // A single-sample judge is noisy; a failing answer is retried before the
  // case is marked failed. A case that fails --retries + 1 times in a row
  // is a real finding; a pass on retry is reported as a flake signal.
  const maxRetries = Math.max(0, Number(args.retries) || 0);
  const results = await runPool(
    cases.map((c, i) => ({ c, prompt: prompts[i] })),
    async ({ c, prompt }) => {
      let last;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const a = await callJudge(prompt);
        const got = a.ok ? (suite === 'routing' ? parseRouting(a.out, skillNames) : parseGate(a.out)) : null;
        const pass = got !== null && (got === c.expect || (c.accept ?? []).includes(got));
        last = { pass, got, raw: a, attempt };
        if (pass) break;
      }
      return last;
    },
    Number(args.concurrency) || 4
  );
  let passed = 0;
  const onRetry = [];
  const viaAccept = [];
  const failed = [];
  cases.forEach((c, i) => {
    const r = results[i];
    if (r.pass) {
      passed++;
      if (r.attempt > 0) {
        onRetry.push(c.id);
        console.log(`  retry ${c.id}: passed on attempt ${r.attempt + 1}`);
      }
      if (r.got !== c.expect) {
        viaAccept.push(c.id);
        console.log(`  accept ${c.id}: passed via ${r.got}`);
      }
    } else {
      failed.push(c.id);
      const accept = c.accept?.length ? ` (accept: ${c.accept.join(', ')})` : '';
      console.log(`  FAIL ${c.id}: expected ${c.expect}${accept}, got ${r.got ?? `unparseable: ${r.raw.out.trim().slice(0, 120)}`}`);
    }
  });
  const notes = [];
  if (onRetry.length) notes.push(`${onRetry.length} on retry: ${onRetry.join(', ')}`);
  if (viaAccept.length) notes.push(`${viaAccept.length} via accept: ${viaAccept.join(', ')}`);
  console.log(`${suite}: ${passed}/${cases.length} passed${notes.length ? ` (${notes.join('; ')})` : ''}`);
  failures += cases.length - passed;
  suiteStats.push({ suite, passed, total: cases.length, onRetry, viaAccept, failed });
}
// An empty selection is an error, not a green run: a typoed --filter or
// an empty cases file must not report success over zero cases.
if (total === 0) {
  console.error(args.filter ? `--filter "${args.filter}" matched no cases` : 'no cases found');
  process.exit(1);
}
if (!args['dry-run']) {
  const allRetry = suiteStats.flatMap((s) => s.onRetry);
  const suffix = allRetry.length ? ` (${allRetry.length} on retry: ${allRetry.join(', ')})` : '';
  console.log(
    failures
      ? `evals: ${total - failures}/${total} passed${suffix} — a failing case means the description, the gate text or the case itself needs fixing`
      : `evals: ${total}/${total} passed${suffix}`
  );
  // The only memory between runs: a chronic retry-passer is a finding,
  // not noise, and a single run cannot see chronic. Written only for the
  // real case set (never for test fixtures), gitignored.
  if (args['cases-dir'] === join(ROOT, 'evals')) {
    const entry = {
      date: new Date().toISOString(),
      model: process.env.ACDEV_EVAL_CMD ? 'custom-judge' : args.model,
      suites: suiteStats.map(({ suite, passed, total: t, onRetry, viaAccept, failed }) => ({ suite, passed, total: t, onRetry, viaAccept, failed }))
    };
    try {
      appendFileSync(join(ROOT, 'evals', 'history.jsonl'), JSON.stringify(entry) + '\n');
    } catch {
      // History is best-effort; a read-only checkout must not fail the run.
    }
  }
}
process.exit(failures ? 1 : 0);
