// The acdev guard: the pipeline's hard rules, enforced outside the model's
// context. The plugin's PreToolUse hook (hooks/guard.mjs) calls judge();
// the CLI calls verify(). Nothing is copied into the project: the guard
// ships with the plugin and reads the project's .acdev/ directory.
//
// Three rules, and only inside a project that has .acdev/state.md:
//   - zero product code before the build stage (deny)
//   - an approved document asks before it is edited again (ask)
//   - in build, a `git commit` that changes code needs a green receipt
//     for the current code (deny)
// Off switch: ACDEV_GUARD=off, or "enabled": false in .acdev/guard.json.
//
// The shell rules read a command the way a person skims it: they find the
// usual ways of writing a file, not every way. A missed exotic write is
// accepted; a false deny on ordinary work is the failure to avoid.
import { writeFileSync, existsSync, statSync, copyFileSync, rmSync, realpathSync } from 'node:fs';
import { join, resolve, relative, isAbsolute, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { STAGES, readState, readJsonIf, slashes } from './project.mjs';
import { runQuiet } from './quiet.mjs';

const RECEIPT = '.acdev/verify-receipt.json';
const CONFIG = '.acdev/guard.json';
const STATE = '.acdev/state.md';
const BUILD = STAGES.indexOf('build');
// What may be written before build, by the stage that unlocks it.
// Everything else is product code until the build stage starts.
const ALLOW_ALWAYS = ['docs/**', '.acdev/**', '.claude/**', '**/*.md', 'LICENSE', '.gitignore', '.gitattributes', '.editorconfig', '.env.example'];
const ALLOW_FROM = {
  mockups: ['mockups/**'],
  blueprint: [
    'spikes/**', 'scripts/verify/**', '.github/**', '.gitlab-ci.yml', 'Dockerfile', 'docker-compose*.yml',
    // The test runner is wired here with one trivial test; tests are not
    // product code.
    'tests/**', 'test/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*',
    'package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'pyproject.toml', 'requirements*.txt',
    'go.mod', 'go.sum', 'Cargo.toml', 'Cargo.lock', 'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock',
    '*.csproj', '*.sln', 'tsconfig*.json', '*.config.*', '.prettierrc*', '.eslintrc*', 'eslint.config.*',
    '.*ignore', '.npmrc', '.nvmrc', '.tool-versions', '.husky/**'
  ]
};
// Approved documents: free while their stage is open, ask once it closed.
// existingOnly: what was approved asks; a new file beside it does not (a
// new ADR is a new decision, a later phase adds mockup pages).
const PROTECTED = [
  { glob: 'docs/PRODUCT.md', after: 'product', what: 'the approved PRODUCT document. A tool may add to it; a rewrite that drops sections is refused' },
  { glob: 'docs/VISION.md', after: 'product', what: 'the approved product document (legacy name)' },
  { glob: 'docs/MVP.md', after: 'mvp', what: 'the approved MVP contract' },
  { glob: 'mockups/**', after: 'mockups', what: 'part of the frozen visual contract', existingOnly: true },
  { glob: 'docs/adr/**', after: 'blueprint', what: 'a recorded decision', existingOnly: true }
];
const RECEIPT_IGNORE = ['.acdev/**', 'docs/**', 'mockups/**', '**/*.md'];

export function loadGuardConfig(root) {
  const cfg = readJsonIf(join(root, CONFIG)) ?? {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  return {
    enabled: cfg.enabled !== false,
    verify: arr(cfg.verify),
    allow_before_build: arr(cfg.allow_before_build),
    protected: arr(cfg.protected),
    receipt_ignore: arr(cfg.receipt_ignore),
    changelog: { path: cfg.changelog?.path ?? 'CHANGELOG.md', section: cfg.changelog?.section ?? '## [Unreleased]' }
  };
}
export const guardEnabled = (cfg) => cfg.enabled && String(process.env.ACDEV_GUARD ?? '').toLowerCase() !== 'off';

export function globToRegex(glob) {
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
// A glob without a wildcard also names a directory: "coverage" covers
// everything under coverage/.
const withDirs = (globs) => globs.flatMap((g) => (/[*?]/.test(g) ? [g] : [g, `${g.replace(/\/+$/, '')}/**`]));
export const matches = (rel, globs) => withDirs(globs).some((g) => globToRegex(g).test(rel));

// Path relative to the project root with forward slashes, or null when the
// path lives outside the project (not this guard's business).
export function relPath(root, p, base = root) {
  if (!p) return null;
  // Git Bash on Windows writes drive paths as /c/Users/...
  if (process.platform === 'win32') p = String(p).replace(/^\/([A-Za-z])\//, '$1:/');
  const abs = isAbsolute(p) ? p : resolve(base, p);
  const rel = slashes(relative(root, abs));
  if (!rel || rel === '.' || rel.startsWith('../') || rel === '..' || isAbsolute(rel)) return null;
  return rel;
}

// --- the user's yes ------------------------------------------------------
// Claude Code does not stop for a hook's "ask" in bypass mode (measured on
// the real CLI: the edit simply went through), and those are the sessions
// that most need the gate. So where no prompt can reach the user the ask
// becomes a deny that says how to go on: put the question in chat, and on
// an explicit yes `acdev allow <path>` opens that path for a short window.
const NO_PROMPT = new Set(['bypassPermissions', 'dontAsk']);
const ALLOW_MINUTES = 15;
// Outside the repository, so a yes is never committed by accident.
function allowFile(root) {
  let path = resolve(root);
  try {
    path = realpathSync.native(path);
  } catch {
    // A path that cannot be resolved keeps its given form.
  }
  return join(tmpdir(), `acdev-allow-${createHash('sha1').update(slashes(path).toLowerCase()).digest('hex').slice(0, 16)}.json`);
}
const isAllowed = (root, rel) => {
  const a = readJsonIf(allowFile(root));
  return Boolean(a && a.until > Date.now() && Array.isArray(a.paths) && matches(rel, a.paths));
};
export function allowEdit(root, paths, cwd = process.cwd()) {
  const rels = paths.map((p) => relPath(root, p, cwd));
  if (!rels.length || rels.some((r) => !r)) return { ok: false, text: 'allow: name one or more paths inside this project (acdev allow docs/PRODUCT.md)' };
  writeFileSync(allowFile(root), JSON.stringify({ paths: rels, until: Date.now() + ALLOW_MINUTES * 60000 }));
  return { ok: true, text: `allow: ${rels.join(', ')} may be edited for the next ${ALLOW_MINUTES} minutes. Run this only after the user said yes in chat.` };
}
function forMode(verdict, mode) {
  if (verdict?.[0] !== 'ask' || !NO_PROMPT.has(mode)) return verdict;
  return ['deny', `${verdict[1]} No prompt reaches the user in ${mode} mode: put the question in chat, and only on an explicit yes run \`acdev allow <path>\` and repeat this edit.`];
}

// The path policy, in precedence order: the guard's own files, the stage
// ladder, the approved documents.
export function judgePath(root, rel, cfg, stage) {
  // The blueprint stage fills the config; from build on it is the user's.
  if (rel === CONFIG && stage >= BUILD && !isAllowed(root, rel)) return ['ask', `${rel} configures what the guard enforces in this project; the user decides.`];
  if (rel === STATE) return ['deny', `${rel} is the pipeline state. It is written by \`acdev checkpoint write\` at a gate the user closed, never by hand.`];
  if (stage >= 0 && stage < BUILD) {
    const allow = [...ALLOW_ALWAYS, ...cfg.allow_before_build];
    for (const s of STAGES.slice(0, stage + 1)) allow.push(...(ALLOW_FROM[s] ?? []));
    if (!matches(rel, allow)) {
      return ['deny', `Zero product code before build: this project is at stage "${STAGES[stage]}" and ${rel} is product code. Only docs, mockups, spikes and repo mechanics may be written before the build stage starts on the user's explicit order. Do not route around this with another tool; finish the pipeline stage instead.`];
    }
  }
  for (const p of [...PROTECTED, ...cfg.protected]) {
    if (stage <= STAGES.indexOf(p.after) || !matches(rel, [p.glob])) continue;
    if (p.existingOnly && !existsSync(join(root, rel))) continue;
    if (isAllowed(root, rel)) continue;
    return ['ask', `${rel} is ${p.what}. Changing it after its gate closed is a user-challenge decision: confirm with the user, then edit it in the same commit as the change that revealed the drift.`];
  }
  return null;
}

// --- reading a shell command -------------------------------------------
// Heredoc bodies and here-strings are data, not commands: only the line
// that opens them is kept. Inside quotes, the characters that separate
// commands are blanked so a quoted sentence stays one token.
export function skim(command) {
  return String(command)
    .replace(/(<<-?[ \t]*)(['"]?)([A-Za-z_]\w*)\2([^\n]*)\n[\s\S]*?\n[ \t]*\3(?=[ \t]*(?:\n|\)|$))/g, '$1$3$4')
    .replace(/@(['"])[ \t]*\r?\n[\s\S]*?\n\1@/g, "''")
    .replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, (q) => q.replace(/[;|&\n]/g, ' '));
}
const SEPARATORS = /&&|\|\||;|\|(?!\|)|\n/;
const WRAPPERS = new Set(['sudo', 'command', 'time', 'env', 'nohup']);
const clean = (t) => t.replace(/^["']|["']$/g, '');
// The words of one command, without leading VAR=value and wrappers.
function words(segment) {
  const toks = segment.match(/"[^"]*"|'[^']*'|\S+/g) ?? [];
  let i = 0;
  while (i < toks.length && (/^[A-Za-z_]\w*=/.test(toks[i]) || WRAPPERS.has(clean(toks[i])))) i++;
  return { toks, name: clean(toks[i] ?? ''), rest: toks.slice(i + 1).map(clean) };
}

// PowerShell cmdlets that write a file, and their common aliases.
const PS_WRITERS = new Set(['set-content', 'add-content', 'out-file', 'new-item', 'tee-object', 'sc', 'ac', 'ni']);
const PS_MOVERS = new Set(['copy-item', 'move-item', 'copy', 'move', 'cpi', 'mi']);
const PS_SWITCHES = new Set(['-force', '-recurse', '-nonewline', '-append', '-noclobber', '-passthru', '-confirm', '-whatif', '-verbose', '-asbytestream']);
// A parameter that is not a switch takes the next word as its value, so
// `New-Item -ItemType Directory docs\adr` has one positional: the path.
function psArgs(rest) {
  const named = {};
  const pos = [];
  for (let i = 0; i < rest.length; i++) {
    const t = rest[i];
    if (!/^-[A-Za-z]/.test(t)) {
      if (!/^(?:\d?>>?|&>)/.test(t)) pos.push(t);
      continue;
    }
    const colon = t.indexOf(':');
    const key = (colon > 0 ? t.slice(0, colon) : t).toLowerCase();
    if (colon > 0) named[key] = t.slice(colon + 1);
    else if (!PS_SWITCHES.has(key)) named[key] = rest[++i] ?? '';
  }
  return { named, pos };
}
const isDir = (p) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

// The files a command writes, as absolute paths: redirections plus the
// file arguments of tee, touch, cp, mv, sed -i and their PowerShell
// counterparts. A leading `cd` moves the base the rest resolves from.
export function shellWriteTargets(command, cwd) {
  const targets = [];
  let base = cwd;
  const add = (t, from = base) => {
    let v = String(t ?? '').replace(/\\/g, '/');
    if (!v || v.startsWith('/dev/') || v.startsWith('$') || v.startsWith('&') || /^nul$/i.test(v)) return;
    if (process.platform === 'win32') v = v.replace(/^\/([A-Za-z])\//, '$1:/');
    targets.push(isAbsolute(v) ? v : resolve(from, v));
  };
  for (const segment of skim(command).split(SEPARATORS)) {
    const { toks, name, rest } = words(segment);
    if (!name) continue;
    const lower = name.toLowerCase();
    if (lower === 'cd' || lower === 'pushd' || lower === 'set-location' || lower === 'sl') {
      const dir = rest.find((a) => !a.startsWith('-'));
      if (dir && !/^[~$]/.test(dir)) base = resolve(base, dir.replace(/\\/g, '/'));
      continue;
    }
    for (let i = 0; i < toks.length; i++) {
      const m = toks[i].match(/^(?:\d?>>?|&>)(.*)$/);
      if (m) add(m[1] ? clean(m[1]) : clean(toks[++i] ?? ''));
    }
    const args = rest.filter((a) => !a.startsWith('-') && !/^(?:\d?>>?|&>)/.test(a));
    if (lower === 'tee' || lower === 'touch') args.forEach((a) => add(a));
    if (lower === 'sed' && rest.some((t) => /^-i/.test(t))) args.slice(1).forEach((a) => add(a));
    if ((lower === 'cp' || lower === 'mv') && args.length >= 2) {
      // Into a directory, the files keep their names.
      const dest = args.at(-1);
      const into = /[\\/]$/.test(dest) || dest === '.' || isDir(resolve(base, dest));
      if (into) args.slice(0, -1).forEach((src) => add(join(dest, basename(src))));
      else add(dest);
    }
    // A project scaffolder writes a whole app: judged as a write under
    // the directory it is pointed at (`npx create-vite web`, `npm create
    // vite@latest`), so a spike folder passes and the repo root does not.
    const dashes = rest.indexOf('--');
    const plain = (dashes < 0 ? rest : rest.slice(0, dashes)).filter((a) => !a.startsWith('-') && !/^(?:\d?>>?|&>)/.test(a));
    let scaffoldDir = null;
    if (/^(?:npx|pnpx|bunx)$/.test(lower) && /^create-/.test(plain[0] ?? '')) scaffoldDir = plain[1] ?? '.';
    if (/^(?:npm|pnpm|yarn|bun)$/.test(lower) && plain[0] === 'create' && plain[1]) scaffoldDir = plain[2] ?? '.';
    if (lower === 'npm' && plain[0] === 'init' && plain[1]) scaffoldDir = plain[2] ?? '.';
    if (scaffoldDir) add(join(scaffoldDir, 'src', 'main'));
    if (PS_WRITERS.has(lower)) {
      const { named, pos } = psArgs(rest);
      const kind = String(named['-itemtype'] ?? named['-type'] ?? '').toLowerCase();
      if (kind === 'directory') continue; // a folder is not a file
      const path = named['-path'] ?? named['-filepath'] ?? named['-literalpath'] ?? pos[0];
      add(named['-name'] && path ? join(path, named['-name']) : path);
    }
    if (PS_MOVERS.has(lower)) {
      const { named, pos } = psArgs(rest);
      const dest = named['-destination'] ?? pos[1];
      const src = named['-path'] ?? named['-literalpath'] ?? pos[0];
      if (dest && src && (dest === '.' || /[\\/]$/.test(dest) || isDir(resolve(base, dest)))) add(join(dest, basename(src)));
      else add(dest);
    }
  }
  return targets;
}

// `git commit`, with any of git's own options before the subcommand
// (`git -C dir commit`, `git -c k=v commit`); not a mention of it inside
// an echo, a grep pattern or `git commit-tree`.
const GIT_OPTS_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path']);
export function isGitCommit(command) {
  return skim(command).split(SEPARATORS).some((segment) => {
    const { name, rest } = words(segment);
    if (!/(?:^|[\\/])git(?:\.exe)?$/i.test(name)) return false;
    let i = 0;
    while (i < rest.length && rest[i].startsWith('-')) i += GIT_OPTS_WITH_VALUE.has(rest[i]) ? 2 : 1;
    return rest[i] === 'commit';
  });
}
// --- the receipt ---------------------------------------------------------
function git(root, args, env) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: env ?? process.env });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${(r.stderr || r.error?.message || '').trim().split('\n')[0]}`);
  return r.stdout;
}
const excludes = (cfg) => withDirs([...RECEIPT_IGNORE, ...cfg.receipt_ignore]);
// Fingerprint of the code a receipt certifies: the tree git would record
// for the working files (tracked and untracked, .gitignore respected),
// without docs and acdev state, so the close's own bookkeeping never
// stales it. It is built in a throwaway index: the real index, HEAD and
// the working tree are not touched, and staging or committing the same
// files leaves the fingerprint as it was.
export function fingerprint(root, cfg) {
  const index = join(tmpdir(), `acdev-index-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const env = { ...process.env, GIT_INDEX_FILE: index };
  try {
    // Starting from the real index keeps git's stat cache, so unchanged
    // files are not hashed again.
    // Two lines: the project's path inside the repository ("" at its
    // root, "apps/web/" in a monorepo) and where the index lives (a linked
    // worktree keeps its own).
    const [prefix, indexPath] = git(root, ['rev-parse', '--show-prefix', '--git-path', 'index']).split('\n').map((l) => l.trim());
    const real = resolve(root, indexPath);
    if (existsSync(real)) {
      copyFileSync(real, index);
      git(root, ['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', ...excludes(cfg).map((g) => `:(glob)${g}`)], env);
    }
    git(root, ['add', '-A', '--', '.', ...excludes(cfg).map((g) => `:(glob,exclude)${g}`)], env);
    // Only this project's subtree counts: a sibling folder of the same
    // repository is someone else's code.
    return git(root, prefix ? ['write-tree', `--prefix=${prefix}`] : ['write-tree'], env).trim();
  } finally {
    rmSync(index, { force: true });
    rmSync(`${index}.lock`, { force: true });
  }
}
// Whether anything outside docs and acdev state differs from HEAD. A
// commit that changes no code has nothing to verify.
function codeChanged(root, cfg) {
  try {
    return git(root, ['status', '--porcelain', '--', '.', ...excludes(cfg).map((g) => `:(glob,exclude)${g}`)]).trim() !== '';
  } catch {
    return true;
  }
}
export function receiptState(root, cfg) {
  if (!cfg.verify.length) return { kind: 'unconfigured' };
  const r = readJsonIf(join(root, RECEIPT));
  if (!r) return { kind: 'missing' };
  if (!r.ok) return { kind: 'red', at: r.at, failed: r.failed };
  try {
    return fingerprint(root, cfg) === r.tree ? { kind: 'fresh', at: r.at } : { kind: 'stale', at: r.at };
  } catch (err) {
    return { kind: 'nogit', error: err.message };
  }
}

export function judgeShell(root, command, cfg, stage, cwd = root) {
  for (const target of shellWriteTargets(command, cwd)) {
    const rel = relPath(root, target);
    if (!rel) continue;
    const verdict = judgePath(root, rel, cfg, stage);
    if (verdict) return verdict;
  }
  if (stage === BUILD && cfg.verify.length && isGitCommit(command) && codeChanged(root, cfg)) {
    const r = receiptState(root, cfg);
    const run = 'acdev verify (or acdev close, which verifies and commits)';
    if (r.kind === 'missing') return ['deny', `No verification receipt. In build, a commit that changes code needs a green run recorded by: ${run}.`];
    if (r.kind === 'red') return ['deny', `The last verification (${r.at}) was red: ${r.failed}. A red check blocks the commit. Fix it and re-run: ${run}.`];
    if (r.kind === 'stale') return ['deny', `The verification receipt (${r.at}) is stale: code changed after the last green run. Re-run: ${run}.`];
    if (r.kind === 'nogit') console.error(`acdev guard: receipt check skipped (${r.error})`);
  }
  return null;
}

// One PreToolUse payload in, a [decision, reason] pair or null (allow) out.
// Inert outside an acdev project and when switched off.
export function judge(root, input) {
  const state = readState(root);
  if (!state) return null;
  const cfg = loadGuardConfig(root);
  if (!guardEnabled(cfg)) return null;
  const stage = STAGES.indexOf(state.stage);
  const tool = input?.tool_name ?? '';
  const cwd = typeof input?.cwd === 'string' && input.cwd ? input.cwd : root;
  if (tool === 'Bash' || tool === 'PowerShell') return forMode(judgeShell(root, String(input.tool_input?.command ?? ''), cfg, stage, cwd), input.permission_mode);
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const rel = relPath(root, input.tool_input?.file_path ?? input.tool_input?.notebook_path, cwd);
    return rel ? forMode(judgePath(root, rel, cfg, stage), input.permission_mode) : null;
  }
  return null;
}

// Runs the project's verification commands through the quiet runner and
// records the receipt the commit rule checks. The code is fingerprinted
// after the run: what the commands leave behind (a coverage report, a
// formatter's fix) is part of what they certified.
export function verify(root, { full = false, tail = 30 } = {}) {
  const cfg = loadGuardConfig(root);
  if (!cfg.verify.length) {
    return { ok: true, unconfigured: true, evidence: `verify: no commands configured (fill "verify" in ${CONFIG}); nothing ran` };
  }
  const lines = [];
  let failed = null;
  for (const cmd of cfg.verify) {
    const r = runQuiet(cmd, { cwd: root, full, tail });
    lines.push(`$ ${cmd}`, r.summary);
    if (r.status !== 0) {
      failed = `${cmd} (exit ${r.status})`;
      break;
    }
  }
  let receipt = '';
  try {
    const tree = fingerprint(root, cfg);
    writeFileSync(join(root, RECEIPT), JSON.stringify({ ok: !failed, at: new Date().toISOString(), tree, commands: cfg.verify, failed }, null, 2) + '\n');
    receipt = failed ? '; receipt written, a commit is blocked until a green run' : `; receipt written for tree ${tree.slice(0, 12)}`;
  } catch (err) {
    // No git here: the commands still ran, and the commit rule has
    // nothing to check against.
    receipt = `; no receipt written (${err.message})`;
  }
  lines.push(failed ? `verify: RED at ${failed}${receipt}` : `verify: GREEN (${cfg.verify.length} command(s))${receipt}`);
  return { ok: !failed, failed, evidence: lines.join('\n') };
}

export function guardStatusLine(root) {
  const cfg = loadGuardConfig(root);
  const r = receiptState(root, cfg);
  const receipt = `${r.kind}${r.at ? ` (${r.at})` : ''}${r.failed ? ` at ${r.failed}` : ''}`;
  const stage = readState(root)?.stage;
  const unknown = STAGES.includes(stage) ? '' : ` | STAGE "${stage ?? ''}" IS NOT A PIPELINE STAGE (${STAGES.slice(1).join(', ')}): the stage rules are off`;
  return `guard: ${guardEnabled(cfg) ? 'enabled' : 'DISABLED'} | verify: ${cfg.verify.length ? cfg.verify.join(' && ') : 'none configured'} | receipt: ${receipt}${unknown}`;
}
