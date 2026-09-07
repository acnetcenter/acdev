#!/usr/bin/env node
// acdev guard: deterministic governance for this repository.
//
// acdev installs this file at .claude/hooks/acdev-guard.mjs and wires it as
// a PreToolUse hook in .claude/settings.json. The pipeline's hard rules are
// enforced here, outside the model's context, instead of relying on memory:
//   - zero product code before the build stage (stage ladder read from
//     .acdev/state.md; only docs, mockups, spikes and repo mechanics before)
//   - approved source-of-truth documents ask before being edited again
//   - frozen paths (a failing test under fix) cannot be edited at all
//   - secrets files ask; destructive git and rm ask
//   - in build, `git commit` needs a fresh green verification receipt
//
// Hook mode (no args): reads the PreToolUse JSON payload on stdin, prints a
// permissionDecision (allow is silent) and exits 0. Fail-open: any internal
// error allows the call and leaves a trace on stderr, so a broken guard can
// never take the session down with it.
// CLI mode: verify [--full] | status | freeze <glob...> [--reason T] | unfreeze
// verify prints each command's verdict lines (the whole log only on red or
// with --full) and records the receipt.
// Off switch: ACDEV_GUARD=off, or "enabled": false in .acdev/guard.json.
import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join, resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ACDEV = join(ROOT, '.acdev');
const CONFIG = join(ACDEV, 'guard.json');
const STATE = join(ACDEV, 'state.md');
const FREEZE = join(ACDEV, 'freeze.json');
const RECEIPT = join(ACDEV, 'verify-receipt.json');
const SELF = '.claude/hooks/acdev-guard.mjs';

const STAGES = ['intake', 'vision', 'mvp', 'mockups', 'blueprint', 'build'];
// What may be written before build, by the stage that unlocks it. Everything
// else is product code until the build stage starts.
const ALLOW_ALWAYS = ['docs/**', '.acdev/**', '.claude/**', '*.md', 'LICENSE', '.gitignore', '.gitattributes', '.editorconfig', '.env.example'];
const ALLOW_FROM = {
  mockups: ['mockups/**'],
  blueprint: [
    'spikes/**', 'scripts/verify/**', '.github/**', '.gitlab-ci.yml', 'Dockerfile', 'docker-compose*.yml',
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'pyproject.toml', 'requirements*.txt',
    'go.mod', 'go.sum', 'Cargo.toml', 'Cargo.lock', 'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock',
    '*.csproj', '*.sln', 'tsconfig*.json', '*.config.*', '.prettierrc*', '.eslintrc*', 'eslint.config.*',
    '.nvmrc', '.tool-versions'
  ]
};
// Approved documents: free while their stage is open, ask once it has closed.
const PROTECTED = [
  { glob: 'docs/VISION.md', after: 'vision', what: 'the approved VISION' },
  { glob: 'docs/MVP.md', after: 'mvp', what: 'the approved MVP contract' },
  { glob: 'mockups/**', after: 'mockups', what: 'the frozen visual contract' },
  { glob: 'docs/adr/**', after: 'blueprint', what: 'a recorded architecture decision' }
];
const SECRETS = ['.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', '**/*.key'];
const SECRETS_EXEMPT = ['.env.example', '.env.sample', '.env.template', '**/.env.example', '**/.env.sample', '**/.env.template'];
const RECEIPT_IGNORE = ['.acdev/**', 'docs/**', 'mockups/**', '**/*.md'];
const DESTRUCTIVE = [
  [/\bgit\s+push\b[^\n;&|]*\s(?:--force|-f|--force-with-lease)\b/, 'force push rewrites shared history'],
  [/\bgit\s+reset\s+--hard\b/, 'git reset --hard discards uncommitted work'],
  [/\bgit\s+clean\b[^\n;&|]*\s-[a-zA-Z]*f/, 'git clean -f deletes untracked files'],
  [/\bgit\s+(?:checkout|restore)\s+(?:--\s+)?\.(?:\s|$)/, 'discards every uncommitted change in the tree'],
  [/\bgit\s+branch\s+(?:-D|--delete\s+--force)\b/, 'force-deletes a branch'],
  [/\bgit\s+stash\s+(?:drop|clear)\b/, 'drops stashed work'],
  [/\brm\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*[fF]/, 'rm -f removes files without confirmation'],
  [/\b(?:DROP|TRUNCATE)\s+(?:TABLE|DATABASE|SCHEMA)\b/i, 'destroys database objects']
];

const norm = (p) => p.replace(/\\/g, '/');
const today = () => new Date().toISOString().slice(0, 10);

function loadConfig() {
  const base = { enabled: true, verify: [], allow_before_build: [], protected: [], receipt_ignore: [] };
  if (!existsSync(CONFIG)) return base;
  try {
    return { ...base, ...JSON.parse(readFileSync(CONFIG, 'utf8')) };
  } catch (err) {
    console.error(`acdev guard: unreadable .acdev/guard.json (${err.message}); using defaults`);
    return base;
  }
}
function stageIndex() {
  try {
    const stage = readFileSync(STATE, 'utf8').match(/^stage:\s*(.+)$/m)?.[1]?.trim();
    return STAGES.indexOf(stage);
  } catch {
    return -1; // no pipeline state: stage rules are inert, the rest still applies
  }
}
function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const matches = (rel, globs) => globs.some((g) => globToRegex(g).test(rel));

// Path relative to the repo root with forward slashes, or null when the
// path lives outside the repo (not this guard's business).
function relPath(p) {
  if (!p) return null;
  const abs = isAbsolute(p) ? p : resolve(ROOT, p);
  const rel = norm(relative(ROOT, abs));
  if (!rel || rel === '.' || rel.startsWith('../') || isAbsolute(rel)) return null;
  return rel;
}
function readFreeze() {
  try {
    return existsSync(FREEZE) ? JSON.parse(readFileSync(FREEZE, 'utf8')) : null;
  } catch {
    return null;
  }
}

// The path policy, in precedence order: freeze > guard files > stage ladder >
// protected documents > secrets.
function judgePath(rel, cfg, stage) {
  const freeze = readFreeze();
  if (freeze?.paths?.length && matches(rel, freeze.paths)) {
    return ['deny', `${rel} is frozen (${freeze.reason || 'no reason recorded'}, since ${freeze.since}). A frozen file is the spec of the fix in progress: changing it is a decision for the user, not a fix. Unfreeze with: node ${SELF} unfreeze`];
  }
  if (rel === SELF || rel === '.acdev/guard.json' || rel === '.claude/settings.json') {
    return ['ask', `${rel} is the guard itself. Changing it changes what this repo enforces; the user decides.`];
  }
  if (stage >= 0 && stage < STAGES.indexOf('build')) {
    const allow = [...ALLOW_ALWAYS, ...cfg.allow_before_build];
    for (const s of STAGES.slice(0, stage + 1)) allow.push(...(ALLOW_FROM[s] ?? []));
    if (!matches(rel, allow)) {
      return ['deny', `Zero product code before build: this project is at stage "${STAGES[stage]}" and ${rel} is product code. Only docs, mockups, spikes and repo mechanics may be written before the build stage starts on the user's explicit order. Do not route around this with another tool; finish the pipeline stage instead.`];
    }
  }
  for (const p of [...PROTECTED, ...cfg.protected]) {
    if (stage > STAGES.indexOf(p.after) && matches(rel, [p.glob])) {
      return ['ask', `${rel} is ${p.what}. Changing it after its gate closed is a user-challenge decision under the drift rule: confirm with the user, then edit it in the same commit as the change that revealed the drift.`];
    }
  }
  if (matches(rel, SECRETS) && !matches(rel, SECRETS_EXEMPT)) {
    return ['ask', `${rel} holds secrets. Real values never pass through the agent; the user fills them in.`];
  }
  return null;
}

// Write targets of a shell command: redirections plus the file arguments of
// tee, cp, mv, touch and sed -i. Heuristic by design; the model-side rule
// (never route around a denial) covers what a parser cannot.
function bashWriteTargets(command) {
  const targets = [];
  for (const seg of command.split(/&&|\|\||;|\|(?!\|)|\n/)) {
    const toks = seg.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const clean = (t) => t.replace(/^["']|["']$/g, '');
    for (let i = 0; i < toks.length; i++) {
      const m = toks[i].match(/^(?:\d?>>?|&>)(.*)$/);
      if (m) {
        const target = m[1] ? clean(m[1]) : clean(toks[++i] ?? '');
        if (target) targets.push(target);
      }
    }
    const cmd = toks.findIndex((t) => !/^[A-Z_]+=/.test(t));
    if (cmd < 0) continue;
    const name = clean(toks[cmd]);
    const args = toks.slice(cmd + 1).map(clean).filter((a) => !a.startsWith('-') && !/^(?:\d?>>?|&>)/.test(a));
    if (name === 'tee' || name === 'touch') targets.push(...args);
    if ((name === 'cp' || name === 'mv') && args.length >= 2) targets.push(args.at(-1));
    if (name === 'sed' && toks.some((t) => /^-i/.test(t))) targets.push(...args.slice(1));
  }
  return targets.filter((t) => !t.startsWith('/dev/') && !t.startsWith('$') && !t.startsWith('&'));
}

// Inline node code: `node -e/-p/--eval/--print/--input-type`, `node -` and a
// bare `node` fed by a pipe run a program the path policy cannot read, and
// `Bash(node *)` is pre-allowed so no permission prompt catches it either.
// Script files stay allowed: their paths went through the policy when
// they were written.
const NODE_BIN = /(?:^|[\\/])node(?:\.exe)?$/i;
const NODE_INLINE_FLAG = /^(?:-e|-p|-pe|-ep|--eval|--print|--input-type)(?:=|$)/;
function bashInlineNode(command) {
  for (const seg of command.split(/&&|\|\||;|\|(?!\|)|\n/)) {
    const toks = seg.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
    const clean = (t) => t.replace(/^["']|["']$/g, '');
    const cmd = toks.findIndex((t) => !/^[A-Z_]+=/.test(t));
    if (cmd < 0 || !NODE_BIN.test(clean(toks[cmd]))) continue;
    const args = toks.slice(cmd + 1).map(clean);
    // Only node's own flags count: past the script file, `-e` belongs to it.
    const at = args.findIndex((a) => !a.startsWith('-') && !/^(?:\d?>>?|&>|<)/.test(a));
    const flags = at < 0 ? args : args.slice(0, at);
    if (flags.some((a) => NODE_INLINE_FLAG.test(a))) return 'inline code (-e/-p/--eval/--print/--input-type)';
    // No script file: the program comes from a pipe, a heredoc or `node -`.
    // `node < file.js` is left alone (the file went through the policy).
    if (at < 0 && (flags.includes('-') || /<<-?\s*['"]?\w/.test(seg) || command.split(/\|(?!\|)/).length > 1)) return 'a program read from stdin';
  }
  return null;
}

function git(args) {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || r.error?.message || '').trim()}`);
  return r.stdout;
}
// Fingerprint of the code tree the receipt certifies: tracked changes versus
// HEAD plus untracked files, ignoring docs and acdev state so the close's own
// bookkeeping (checkpoint, CHANGELOG line, drift fixes) never stales it.
function fingerprint(cfg) {
  const ignore = [...RECEIPT_IGNORE, ...cfg.receipt_ignore];
  const spec = ['--', '.', ...ignore.map((g) => `:(glob,exclude)${g}`)];
  const diff = git(['diff', 'HEAD', '--no-color', ...spec]);
  const untracked = git(['ls-files', '--others', '--exclude-standard']).split('\n')
    .map((f) => f.trim()).filter((f) => f && !matches(f, ignore))
    .map((f) => {
      const st = statSync(join(ROOT, f));
      return `${f}:${st.size}:${Math.floor(st.mtimeMs)}`;
    });
  return createHash('sha256').update(diff).update('\n').update(untracked.join('\n')).digest('hex');
}
function receiptState(cfg) {
  if (!cfg.verify.length) return { kind: 'unconfigured' };
  if (!existsSync(RECEIPT)) return { kind: 'missing' };
  let r;
  try {
    r = JSON.parse(readFileSync(RECEIPT, 'utf8'));
  } catch {
    return { kind: 'missing' };
  }
  if (!r.ok) return { kind: 'red', at: r.at, failed: r.failed };
  try {
    return fingerprint(cfg) === r.tree ? { kind: 'fresh', at: r.at } : { kind: 'stale', at: r.at };
  } catch (err) {
    return { kind: 'nogit', error: err.message };
  }
}

function judgeBash(command, cfg, stage) {
  for (const target of bashWriteTargets(command)) {
    const rel = relPath(target);
    if (!rel) continue;
    const verdict = judgePath(rel, cfg, stage);
    if (verdict) return verdict;
  }
  const inline = bashInlineNode(command);
  if (inline) return ['ask', `node runs ${inline}: the guard cannot see which files it writes, so the stage, freeze and protected-document rules do not apply to it. Write files with the Edit or Write tools, or run the code from a script file; the user confirms this one.`];
  for (const [re, why] of DESTRUCTIVE) {
    if (re.test(command)) return ['ask', `Destructive command: ${why}. The user confirms this one.`];
  }
  if (/\bgit\s+commit\b/.test(command) && stage === STAGES.indexOf('build')) {
    const r = receiptState(cfg);
    const run = `node ${SELF} verify`;
    if (r.kind === 'missing') return ['deny', `No verification receipt. In build, a commit needs a green run recorded by: ${run} (runs the project's verification commands and records the tree it certified).`];
    if (r.kind === 'red') return ['deny', `The last verification (${r.at}) was red: ${r.failed}. A red check blocks the close. Fix it and re-run: ${run}`];
    if (r.kind === 'stale') return ['deny', `Verification receipt (${r.at}) is stale: code changed after the last green run. Re-run: ${run}`];
    if (r.kind === 'nogit') console.error(`acdev guard: receipt check skipped (${r.error})`);
  }
  return null;
}

async function hook() {
  let payload = '';
  for await (const chunk of process.stdin) payload += chunk;
  const input = JSON.parse(payload);
  const cfg = loadConfig();
  if (!cfg.enabled || process.env.ACDEV_GUARD === 'off') return;
  const stage = stageIndex();
  const tool = input.tool_name ?? '';
  let verdict = null;
  if (tool === 'Bash') {
    verdict = judgeBash(input.tool_input?.command ?? '', cfg, stage);
  } else if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const rel = relPath(input.tool_input?.file_path ?? input.tool_input?.notebook_path);
    if (rel) verdict = judgePath(rel, cfg, stage);
  }
  if (!verdict) return;
  const [permissionDecision, permissionDecisionReason] = verdict;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason }
  }) + '\n');
}

// What a verify run puts in front of the agent: the verdict lines a runner
// ends with plus a short tail on green; the failure lines and a short tail
// on red; everything with --full. The log never enters the context whole.
// --- shared with the plugin's scripts/lib/quiet.mjs (verdictLines) ---
// This file is copied into projects as is, so the block is duplicated here
// instead of imported; the plugin's tests/guard-quiet-parity.test.mjs keeps
// the two copies producing the same text. Change both or neither.
// Lines a runner prints as its verdict: counts, totals, TAP summaries.
const SUMMARY = /\b\d+\s+(passed|passing|failed|failing|pending|skipped|todo|problems?|errors?|warnings?|tests?|specs?|examples?)\b|^#\s+(tests|pass|fail|suites|skipped|todo|cancelled)\s+\d+|\bTests?:|\bTest Files\b|\bTest Suites:|\btest result:|\bPassed!|\bFailed!|^ok\s+\S|^FAIL\b|^PASS\b|✖|\bDuration\b|\bTime:/i;
// Lines that explain a red run: the assertion, the error, the stack head.
const FAILURE = /\b(fail|failed|failing|error|errors|exception|assert|assertion|expected|received|actual|not ok|panic|traceback|denied|cannot|unhandled)\b|✗|×|✖|^\s+at\s+\S+\s+\(/i;
// Stack frames, and the ones that point outside the project's own code.
const FRAME = /^\s+at\s/;
const VENDOR = /node_modules[\\/]|\bdist[\\/]|\bnode:/;

const dedupe = (lines) => {
  const seen = new Set();
  return lines.filter((l) => {
    const k = l.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// The failure lines of a red log. A failing test starts at a non-frame
// failure line; its frames follow. Project frames are capped at two per test
// because the third never names a new file; vendor frames are dropped, except
// the first one when the test has no project frame at all (the only lead).
function failureLines(lines) {
  const out = [];
  let project = 0;
  let vendor = null;
  const flush = () => {
    if (!project && vendor) out.push(vendor);
    project = 0;
    vendor = null;
  };
  for (const l of lines) {
    if (!FAILURE.test(l)) continue;
    if (!FRAME.test(l)) {
      flush();
      out.push(l);
    } else if (VENDOR.test(l)) {
      vendor ??= l;
    } else if (project < 2) {
      project++;
      out.push(l);
    }
  }
  flush();
  return out;
}

// Body lines of a verdict: green keeps the summary lines plus the last three;
// red keeps the failure lines and a tail of at most ten lines that the failure
// section has not already shown, so a red never repeats itself. Vendor frames
// stay out of the tail too: dropped above, they must not resurface below.
function verdictLines(lines, ok, tail) {
  if (ok) {
    const summary = dedupe(lines.filter((l) => SUMMARY.test(l))).slice(-12);
    const last = dedupe(lines.slice(-3).filter((l) => !summary.includes(l)));
    return [...summary, ...last].map((l) => `  ${l.trim()}`);
  }
  const failures = dedupe(failureLines(lines)).slice(0, 40);
  const printed = new Set(failures.map((l) => l.trim()));
  const tailLines = dedupe(lines.slice(-Math.min(tail, 10))).filter((l) => !printed.has(l.trim()) && !(FRAME.test(l) && VENDOR.test(l)));
  const out = [];
  if (failures.length) out.push(`--- failure lines (first ${failures.length}) ---`, ...failures.map((l) => `  ${l.trimEnd()}`));
  out.push(`--- tail (last ${tailLines.length} line(s)) ---`, ...tailLines.map((l) => `  ${l.trimEnd()}`));
  return out;
}
// --- end of the shared block ---
function condense(output, ok, full) {
  // eslint-disable-next-line no-control-regex
  const lines = output.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim());
  if (full) return lines.join('\n');
  return verdictLines(lines, ok, 30).join('\n');
}

function verify(cfg, full = false) {
  if (!cfg.verify.length) {
    console.error('acdev guard: no verify commands in .acdev/guard.json; nothing to run');
    process.exit(1);
  }
  let tree;
  try {
    tree = fingerprint(cfg);
  } catch (err) {
    console.error(`acdev guard: cannot fingerprint the tree (${err.message}); is this a git repository?`);
    process.exit(1);
  }
  let failed = null;
  for (const cmd of cfg.verify) {
    console.log(`acdev guard: running ${cmd}`);
    const r = spawnSync(cmd, { cwd: ROOT, shell: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    const out = condense(`${r.stdout ?? ''}\n${r.stderr ?? ''}${r.error ? `\nspawn error: ${r.error.message}` : ''}`, r.status === 0, full);
    if (out) console.log(out);
    if (r.status !== 0) {
      failed = `${cmd} (exit ${r.status ?? 'signal'})`;
      break;
    }
  }
  const receipt = { ok: !failed, at: new Date().toISOString(), tree, commands: cfg.verify, failed };
  writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
  if (failed) {
    console.log(`acdev guard: verification RED at ${failed}; receipt written, git commit is blocked until a green run`);
    process.exit(1);
  }
  console.log(`acdev guard: verification GREEN (${cfg.verify.length} command(s)); receipt written for tree ${tree.slice(0, 12)}`);
}

function status(cfg) {
  const stage = stageIndex();
  const freeze = readFreeze();
  const r = receiptState(cfg);
  console.log(`acdev guard: ${cfg.enabled && process.env.ACDEV_GUARD !== 'off' ? 'enabled' : 'DISABLED'}`);
  console.log(`stage: ${stage >= 0 ? STAGES[stage] : 'none (.acdev/state.md missing; stage rules inert)'}`);
  console.log(`freeze: ${freeze?.paths?.length ? `${freeze.paths.join(', ')} (${freeze.reason || 'no reason'}, since ${freeze.since})` : 'none'}`);
  console.log(`verify commands: ${cfg.verify.length ? cfg.verify.join(' && ') : 'none configured'}`);
  console.log(`receipt: ${r.kind}${r.at ? ` (${r.at})` : ''}${r.failed ? ` failed at ${r.failed}` : ''}`);
}

function freeze(args) {
  const reasonAt = args.indexOf('--reason');
  const reason = reasonAt >= 0 ? args[reasonAt + 1] ?? '' : '';
  const paths = (reasonAt >= 0 ? [...args.slice(0, reasonAt), ...args.slice(reasonAt + 2)] : args).map(norm);
  if (!paths.length) {
    console.error(`usage: node ${SELF} freeze <glob...> [--reason TEXT]`);
    process.exit(1);
  }
  const prev = readFreeze();
  const merged = [...new Set([...(prev?.paths ?? []), ...paths])];
  writeFileSync(FREEZE, JSON.stringify({ paths: merged, reason: reason || prev?.reason || '', since: prev?.since ?? today() }, null, 2) + '\n');
  console.log(`acdev guard: frozen ${merged.join(', ')}`);
}
function unfreeze() {
  if (existsSync(FREEZE)) unlinkSync(FREEZE);
  console.log('acdev guard: freeze cleared');
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (!cmd) await hook();
  else if (cmd === 'verify') verify(loadConfig(), rest.includes('--full'));
  else if (cmd === 'status') status(loadConfig());
  else if (cmd === 'freeze') freeze(rest);
  else if (cmd === 'unfreeze') unfreeze();
  else {
    console.error(`usage: node ${SELF} [verify [--full]|status|freeze <glob...> [--reason T]|unfreeze]`);
    process.exit(1);
  }
} catch (err) {
  // Hook mode fails open: an exception must never block the session.
  console.error(`acdev guard: ${cmd ? 'error' : 'hook failed open'}: ${err.message}`);
  process.exit(cmd ? 1 : 0);
}
