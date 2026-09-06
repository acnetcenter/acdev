// The cost ledger: .acdev/cost.jsonl, one line per headless iteration
// written by `run`. `cost` sums it per slice so the plugin's token claims
// are numbers, not adjectives.
import { join } from 'node:path';
import { readIf } from './project.mjs';

export function readLedger(root) {
  const raw = readIf(join(root, '.acdev', 'cost.jsonl'));
  if (raw === null) return [];
  return raw.split('\n').filter((l) => l.trim()).map((l) => {
    try {
      return JSON.parse(l);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

const num = (v) => (typeof v === 'number' ? v : 0);
const fmt = (n) => (n === null || n === undefined ? '?' : n.toLocaleString('en-US'));

export function summarizeLedger(entries) {
  const total = { cost_usd: 0, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_create: 0, turns: 0, duration_ms: 0 };
  for (const e of entries) for (const k of Object.keys(total)) total[k] += num(e[k]);
  const closed = entries.filter((e) => e.commit_after && e.commit_after !== e.commit_before).length;
  return { total, closed, count: entries.length, avg: entries.length ? Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / entries.length])) : null };
}

export function renderCost(entries) {
  if (!entries.length) return 'cost: no .acdev/cost.jsonl yet (written by acdev run)';
  const rows = entries.map((e) => [e.iteration ?? '', e.slice ?? '(none)', fmt(e.turns), fmt(e.input_tokens), fmt(e.output_tokens), fmt(e.cache_read), e.cost_usd === null || e.cost_usd === undefined ? '?' : `$${e.cost_usd.toFixed(3)}`, e.stop ?? '']);
  const head = ['#', 'slice', 'turns', 'in', 'out', 'cache_r', 'cost', 'stop'];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd();
  const s = summarizeLedger(entries);
  return [
    line(head), ...rows.map(line), '',
    `total: ${s.count} run(s), ${s.closed} closed slice(s), ${fmt(s.total.turns)} turns, in ${fmt(s.total.input_tokens)} out ${fmt(s.total.output_tokens)} cache ${fmt(s.total.cache_read)}, $${s.total.cost_usd.toFixed(3)}`,
    s.closed ? `per closed slice: $${(s.total.cost_usd / s.closed).toFixed(3)}, ${fmt(Math.round((s.total.input_tokens + s.total.output_tokens) / s.closed))} tokens (in+out)` : 'per closed slice: n/a'
  ].join('\n');
}
