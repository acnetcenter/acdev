#!/usr/bin/env node
// On-demand behavioral evals for acdev's semantic surface: does a session
// route a user prompt to the right skill (routing suite), does a skill
// body produce the required decision at its hard rules (gates suite), and
// does a fixed scenario stay inside its token budget (budget suite)?
// Each case is at least one model call, so this runs on demand (npm run
// evals), never in CI. See the README "Evals" section.
//
// usage: run-evals.mjs [--suite routing|gates|budget|all] [--model M] [--dry-run]
//        [--filter SUBSTR] [--cases-dir DIR] [--concurrency N]
//
// `all` runs routing and gates. The budget suite runs whole headless
// sessions (`claude -p --output-format json` inside a fixture project) and
// is always explicit: --suite budget.
//
// Routing and gates judges run in --safe-mode with --tools ""; the budget
// suite keeps the full environment plus
// --exclude-dynamic-system-prompt-sections (see SUITE_FLAGS).
//
// ACDEV_EVAL_CMD replaces the default `claude -p --model M` judge with a
// custom command (split on spaces; the prompt always arrives on stdin;
// the suite's isolation flags are appended to it as well) so the pipeline
// is testable without a model call. ACDEV_EVAL_TIMEOUT_MS overrides the
// per-call judge timeout (test-only injection).
import { readFileSync, readdirSync, appendFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawn, spawnSync } from 'node:child_process';

// Descriptions are double-quoted YAML scalars (they hold ": "); unwrap them.
const unquoteYaml = (v) => {
  const m = v.match(/^"(.*)"$/);
  return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : v;
};

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
if (!['routing', 'gates', 'budget', 'all'].includes(args.suite)) {
  console.error(`invalid --suite "${args.suite}" (expected routing, gates, budget or all)`);
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
      desc: unquoteYaml(m[1].match(/^description:\s*(.+)$/m)[1].trim()),
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
  const required = suite === 'routing' ? ['id', 'prompt', 'expect'] : suite === 'budget' ? ['id', 'prompt', 'max_total_tokens'] : ['id', 'context', 'scenario', 'options', 'expect'];
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

// Per-suite judge isolation. A routing or gates judge answers one line
// from the pasted text alone, so it runs with every host customization
// off (--safe-mode: no CLAUDE.md, skills, plugins, hooks or MCP servers;
// --tools "": no tools): a one-line answer does not pay for the whole
// Claude Code environment, and the installed acdev skills cannot sit next
// to the pasted copies and contaminate the routing answer. A budget case
// measures a real session, so it keeps the full environment and only
// moves the per-machine system prompt sections into the first message,
// so consecutive cases share the static prefix cache. Never --bare: it
// skips OAuth.
const SUITE_FLAGS = {
  routing: ['--safe-mode', '--tools', ''],
  gates: ['--safe-mode', '--tools', ''],
  budget: ['--exclude-dynamic-system-prompt-sections']
};

function judgeCmd(suite) {
  const suiteFlags = SUITE_FLAGS[suite];
  const custom = process.env.ACDEV_EVAL_CMD;
  if (custom) {
    // Split on spaces: enough for "node path/to/fake-judge.mjs"; a judge
    // command whose path contains spaces is not supported. A relative
    // script path is resolved against the runner's cwd here, because a
    // budget case spawns the judge inside its fixture project. The
    // suite flags travel too, so a stand-in sees what claude would.
    const [cmd, ...rest] = custom.split(' ').filter(Boolean);
    const args = rest.map((a) => (existsSync(resolve(process.cwd(), a)) ? resolve(process.cwd(), a) : a));
    return { cmd, args: [...args, ...suiteFlags], shell: false };
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(args.model)) {
    console.error(`invalid --model "${args.model}"`);
    process.exit(1);
  }
  const flags = ['-p', '--model', args.model, ...(suite === 'budget' ? ['--output-format', 'json'] : []), ...suiteFlags];
  // The claude CLI installs as a .cmd shim on Windows, which needs a
  // shell. A single concatenated string avoids DEP0190; only the
  // validated model name and fixed flags reach the line (the empty
  // --tools value quoted for cmd.exe), the prompt travels on stdin.
  if (process.platform === 'win32') {
    return { cmd: `claude ${flags.map((f) => (f === '' ? '""' : f)).join(' ')}`, args: [], shell: true };
  }
  return { cmd: 'claude', args: flags, shell: false };
}

// The command line a suite's judge runs with, for the dry run.
function judgeDisplay(suite) {
  const { cmd, args: cmdArgs } = judgeCmd(suite);
  return [cmd, ...cmdArgs.map((a) => (a === '' ? '""' : a))].join(' ');
}

// A budget case runs a whole headless session inside a fixture project;
// the JSON result carries the usage the budget is checked against.
function callJudge(prompt, { cwd = process.cwd(), suite = 'gates' } = {}) {
  const { cmd, args: cmdArgs, shell } = judgeCmd(suite);
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { shell, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
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

// The headless result is the last JSON object on stdout. Totals: every
// token the session processed (cache reads included, because each turn
// re-reads the context) and the fresh ones (input, cache writes, output).
function parseBudget(raw) {
  const lines = norm(raw).trim().split('\n').reverse();
  for (const l of lines) {
    const t = l.trim();
    if (!t.startsWith('{')) continue;
    try {
      const r = JSON.parse(t);
      const u = r.usage ?? {};
      const n = (v) => (typeof v === 'number' ? v : 0);
      return {
        turns: r.num_turns ?? null,
        cost: typeof r.total_cost_usd === 'number' ? r.total_cost_usd : null,
        fresh: n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.output_tokens),
        total: n(u.input_tokens) + n(u.cache_creation_input_tokens) + n(u.cache_read_input_tokens) + n(u.output_tokens),
        error: r.is_error ? String(r.result ?? 'error').slice(0, 120) : null
      };
    } catch {
      // keep looking
    }
  }
  return null;
}
function budgetVerdict(c, got) {
  if (!got) return { pass: false, why: 'no JSON result' };
  if (got.error) return { pass: false, why: `session error: ${got.error}` };
  const over = [];
  if (got.total > c.max_total_tokens) over.push(`total ${got.total} > ${c.max_total_tokens}`);
  if (c.max_fresh_tokens !== undefined && got.fresh > c.max_fresh_tokens) over.push(`fresh ${got.fresh} > ${c.max_fresh_tokens}`);
  if (c.max_turns !== undefined && got.turns !== null && got.turns > c.max_turns) over.push(`turns ${got.turns} > ${c.max_turns}`);
  if (c.max_cost_usd !== undefined && got.cost !== null && got.cost > c.max_cost_usd) over.push(`cost $${got.cost.toFixed(3)} > $${c.max_cost_usd}`);
  return { pass: over.length === 0, why: over.join(', ') };
}
const budgetLine = (got) => (got ? `${got.turns ?? '?'} turns, ${got.total} total / ${got.fresh} fresh tokens${got.cost !== null ? `, $${got.cost.toFixed(3)}` : ''}` : 'no result');

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
    console.log(`judge: ${judgeDisplay('gates')}`);
    cases.forEach((c, i) => console.log(`=== case ${c.id} (ablated) ===\n${prompts[i]}\n`));
    console.log(`gates ablation: ${cases.length} case(s), dry run only`);
    process.exit(0);
  }
  const answers = await runPool(prompts, (p) => callJudge(p, { suite: 'gates' }), Number(args.concurrency) || 4);
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
  const prompts = cases.map((c) => (suite === 'routing' ? routingPrompt(surface, c.prompt) : suite === 'budget' ? c.prompt.replaceAll('<plugin-root>', ROOT.replace(/\\/g, '/')) : gatePrompt(c)));
  const cwdOf = (c) => (suite === 'budget' ? resolve(args['cases-dir'], c.cwd ?? '.') : process.cwd());
  total += cases.length;
  if (args['dry-run']) {
    console.log(`judge: ${judgeDisplay(suite)}`);
    cases.forEach((c, i) => console.log(`=== case ${c.id} ===\n${suite === 'budget' ? `cwd: ${cwdOf(c)}\nbudget: total <= ${c.max_total_tokens}${c.max_fresh_tokens !== undefined ? `, fresh <= ${c.max_fresh_tokens}` : ''}${c.max_turns !== undefined ? `, turns <= ${c.max_turns}` : ''}${c.max_cost_usd !== undefined ? `, cost <= $${c.max_cost_usd}` : ''}\n` : ''}${prompts[i]}\n`));
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
        const a = await callJudge(prompt, { cwd: cwdOf(c), suite });
        if (suite === 'budget') {
          const got = a.ok || a.out ? parseBudget(a.out) : null;
          const v = budgetVerdict(c, got);
          last = { pass: v.pass, got, why: v.why, raw: a, attempt };
        } else {
          const got = a.ok ? (suite === 'routing' ? parseRouting(a.out, skillNames) : parseGate(a.out)) : null;
          const pass = got !== null && (got === c.expect || (c.accept ?? []).includes(got));
          last = { pass, got, raw: a, attempt };
        }
        if (last.pass) break;
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
    if (suite === 'budget') {
      if (r.pass) {
        passed++;
        console.log(`  ok ${c.id}: ${budgetLine(r.got)}`);
        if (r.attempt > 0) onRetry.push(c.id);
      } else {
        failed.push(c.id);
        console.log(`  FAIL ${c.id}: ${r.why} (${budgetLine(r.got)})`);
      }
      return;
    }
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
      ? `evals: ${total - failures}/${total} passed${suffix} — a failing case means the description, the gate text, the budget or the case itself needs fixing`
      : `evals: ${total}/${total} passed${suffix}`
  );
  // The only memory between runs: a chronic retry-passer is a finding,
  // not noise, and a single run cannot see chronic. Written only for the
  // real case set (never for test fixtures), gitignored. Each row carries
  // the judge flags per suite, so a result stays tied to its environment.
  if (args['cases-dir'] === join(ROOT, 'evals')) {
    const entry = {
      date: new Date().toISOString(),
      model: process.env.ACDEV_EVAL_CMD ? 'custom-judge' : args.model,
      judge: Object.fromEntries(suites.map((s) => [s, SUITE_FLAGS[s]])),
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
