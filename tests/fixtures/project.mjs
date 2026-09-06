// Builds a throwaway acdev project for the CLI tests: git repo, .acdev
// state, docs, plans, ADRs, mockups, optional guard. Every test gets its
// own temp dir; nothing here touches the plugin tree.
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
export const PLUGIN = join(here, '..', '..');
export const CLI = join(PLUGIN, 'scripts', 'acdev.mjs');
export const CHECKPOINT = join(PLUGIN, 'scripts', 'checkpoint.mjs');
const NODE = process.execPath;

export const write = (root, rel, content) => {
  const p = join(root, ...rel.split('/'));
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
};

export function makeProject({ stage = 'build', git = true, guard = false, verify = null, plans = [], adrs = true, roadmap = true, mockups = false, profile = null, docs = true, commit = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'acdev-cli-'));
  const g = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const cli = (args, opts = {}) => spawnSync(NODE, [CLI, ...args], { cwd: root, encoding: 'utf8', ...opts });
  const checkpoint = (args) => spawnSync(NODE, [CHECKPOINT, 'write', '--stage', stage, '--branch', 'main', ...args], { cwd: root, encoding: 'utf8' });
  write(root, '.gitignore', '.acdev/verify-receipt.json\n.acdev/freeze.json\n');
  write(root, 'README.md', '# fixture\n');
  write(root, 'src/invoices.js', 'export const invoices = [];\n');
  if (docs) {
    write(root, 'docs/README.md', '# Docs index\n\n- [ROADMAP.md](ROADMAP.md)\n- [ARCHITECTURE.md](ARCHITECTURE.md)\n');
    write(root, 'docs/ARCHITECTURE.md', '# Architecture\n\nThe invoices module lives in src/invoices.js.\n');
  }
  if (roadmap) write(root, 'docs/ROADMAP.md', '# Roadmap\n\n## Phase 1: MVP\n\n- slice 1 walking skeleton\n- slice 2 create invoice\n\nExit criteria: users can create invoices.\n\n## Phase 2: Teams\n\n- team billing\n');
  if (adrs) {
    write(root, 'docs/adr/0001-stack.md', '# ADR-0001: Stack\n\n- Status: accepted\n- Date: 2026-09-01\n- Class: user-challenge\n\n## Context\nSmall team.\n\n## Decision\nNode 22 plus SQLite, deployed on Fly.\n\n## Consequences\nCheap to run.\n');
    write(root, 'docs/adr/0002-old.md', '# ADR-0002: Old auth\n\n- Status: superseded by ADR-0003\n\n## Decision\nIgnore me.\n');
  }
  for (const p of plans) write(root, `docs/plans/${p.name}`, `---\ndate: 2026-09-06\nstatus: ${p.status ?? 'active'}\n---\n\n# ${p.name}\n`);
  if (mockups) {
    write(root, 'mockups/index.html', '<html><head><title>Index</title></head><body><a href="invoice-list.html">Invoices</a></body></html>');
    write(root, 'mockups/invoice-list.html', '<html><head><title>Invoices</title></head><body><nav><a href="dashboard.html">Dashboard</a><a href="invoice-list.html">Invoices</a></nav><h1>Invoices</h1><h2>Open</h2><table><tr><th>Number</th><th>Client</th><th>Amount</th></tr></table><form><label for="q">Search</label><input id="q" name="q" type="search"><select name="status"><option>Open</option></select><input type="hidden" name="csrf"><button>New invoice</button><input type="submit" value="Filter"></form><a href="invoice-detail.html">INV-1</a></body></html>');
    write(root, 'mockups/invoice-list-empty.html', '<html><head><title>Invoices (empty)</title></head><body><h1>Invoices</h1><p>No invoices yet</p></body></html>');
    write(root, 'mockups/dashboard.html', '<html><head><title>Dashboard</title></head><body><h1>Dashboard</h1></body></html>');
  }
  if (profile) write(root, '.acdev/profile.json', JSON.stringify(profile));
  const guardCfg = { enabled: true, verify: verify ?? [], allow_before_build: [], protected: [], receipt_ignore: [] };
  write(root, '.acdev/guard.json', JSON.stringify(guardCfg));
  if (guard) {
    mkdirSync(join(root, '.claude', 'hooks'), { recursive: true });
    copyFileSync(join(PLUGIN, 'shared', 'references', 'templates', 'guard-hook.mjs'), join(root, '.claude', 'hooks', 'acdev-guard.mjs'));
  }
  if (git) {
    g(['init', '-q', '-b', 'main']);
    g(['config', 'user.email', 'cli@test']);
    g(['config', 'user.name', 'cli']);
    g(['config', 'commit.gpgsign', 'false']);
  }
  const ck = checkpoint(['--next', 'slice 1: walking skeleton', '--lang', 'english']);
  if (ck.status !== 0) throw new Error(ck.stderr);
  if (git && commit) {
    g(['add', '-A']);
    g(['commit', '-q', '-m', 'init']);
  }
  return { root, g, cli, checkpoint, write: (rel, c) => write(root, rel, c) };
}

export const ok = (cmd) => `"${NODE}" -e "console.log('# tests 3');console.log('# pass 3');console.log('# fail 0');${cmd ?? ''}"`;
export const red = () => `"${NODE}" -e "console.log('# tests 3');console.log('# pass 2');console.log('# fail 1');console.error('not ok 3 - total is wrong');console.error('  AssertionError: expected 2 got 3');process.exit(1)"`;
