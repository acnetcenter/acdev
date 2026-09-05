#!/usr/bin/env node
// acdev canary - post-deploy release check. Blueprint copies this to
// scripts/verify/canary.mjs and adjusts the checks to docs/RUNBOOK.md; the
// runbook's Canary section names the environment variables it reads.
// Contract: exit 0 = release green, exit 1 = red (roll back per RUNBOOK),
// one evidence line per check. Runs on Node >= 20 with no dependencies.
import { spawnSync } from 'node:child_process';

const base = (process.env.CANARY_BASE_URL ?? '').replace(/\/$/, '');
const healthPath = process.env.CANARY_HEALTH_PATH ?? '/health';
const smokePaths = (process.env.CANARY_SMOKE_PATHS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const p95Budget = Number(process.env.CANARY_P95_BUDGET_MS ?? 0);
const samples = Number(process.env.CANARY_SAMPLES ?? 20);
const errorRateCmd = process.env.CANARY_ERROR_RATE_CMD;
const errorRateMax = Number(process.env.CANARY_ERROR_RATE_MAX ?? 0);
const timeoutMs = Number(process.env.CANARY_TIMEOUT_MS ?? 5000);

if (!base) {
  console.error('fail: CANARY_BASE_URL is not set (see docs/RUNBOOK.md, Canary)');
  process.exit(1);
}

let red = 0;
const report = (ok, line) => {
  console.log(`${ok ? 'ok' : 'fail'}: ${line}`);
  if (!ok) red++;
};

async function probe(path) {
  const started = performance.now();
  try {
    const res = await fetch(base + path, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
    return { status: res.status, ms: performance.now() - started };
  } catch (err) {
    return { status: 0, ms: performance.now() - started, error: err.message };
  }
}
const p95 = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)];
};

// 1. Health: two consecutive probes must both answer 2xx (one flake is not an outage).
const h1 = await probe(healthPath);
const h2 = await probe(healthPath);
const healthy = [h1, h2].every((h) => h.status >= 200 && h.status < 300);
report(healthy, `health ${healthPath} -> ${h1.status}/${h2.status} in ${Math.round(h1.ms)}/${Math.round(h2.ms)} ms${h1.error ? ` (${h1.error})` : ''}`);

// 2. Smoke paths: every one answers 2xx, and their p95 stays inside the budget.
for (const path of smokePaths) {
  const results = [];
  for (let i = 0; i < samples; i++) results.push(await probe(path));
  const bad = results.filter((r) => r.status < 200 || r.status >= 300);
  report(bad.length === 0, `smoke ${path} -> ${results.length - bad.length}/${results.length} 2xx${bad.length ? ` (first failure: ${bad[0].status}${bad[0].error ? ` ${bad[0].error}` : ''})` : ''}`);
  if (p95Budget > 0) {
    const value = Math.round(p95(results.map((r) => r.ms)));
    report(value <= p95Budget, `p95 ${path} -> ${value} ms (budget ${p95Budget} ms)`);
  }
}

// 3. Error rate, when the platform can report it through a command.
if (errorRateCmd) {
  const r = spawnSync(errorRateCmd, { shell: true, encoding: 'utf8' });
  const value = Number((r.stdout ?? '').trim());
  const ok = r.status === 0 && Number.isFinite(value) && (errorRateMax <= 0 || value <= errorRateMax);
  report(ok, `error rate -> ${Number.isFinite(value) ? `${value}%` : `unreadable (${(r.stderr || r.stdout || '').trim().slice(0, 80)})`} (max ${errorRateMax}%)`);
}

if (red) {
  console.log(`canary RED: ${red} check(s) failed; roll back per docs/RUNBOOK.md, then diagnose`);
  process.exit(1);
}
console.log('canary GREEN');
