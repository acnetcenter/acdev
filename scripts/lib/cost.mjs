// The cost ledger: .acdev/cost.jsonl, one line per headless iteration
// written by `run`. `cost` sums it per slice so the plugin's token claims
// are numbers, not adjectives. Total counts every token a session
// processed (cache reads included, because each turn re-reads the
// context); fresh counts input, cache writes and output. Same definitions
// as the budget eval suite.
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
const money = (n) => (typeof n === 'number' ? `$${n.toFixed(3)}` : '?');

// Entries written before total/fresh existed are summed from their parts.
export function tokensOf(e) {
  return {
    total: typeof e.total_tokens === 'number' ? e.total_tokens : num(e.input_tokens) + num(e.output_tokens) + num(e.cache_read) + num(e.cache_create),
    fresh: typeof e.fresh_tokens === 'number' ? e.fresh_tokens : num(e.input_tokens) + num(e.output_tokens) + num(e.cache_create)
  };
}

// Per-model share, from the modelUsage the headless result carries.
export function modelShare(entries) {
  const models = {};
  for (const e of entries) {
    for (const [name, u] of Object.entries(e.model_usage ?? {})) {
      const m = models[name] ?? (models[name] = { cost_usd: 0, tokens: 0 });
      m.cost_usd += num(u.costUSD);
      m.tokens += num(u.inputTokens) + num(u.outputTokens) + num(u.cacheReadInputTokens) + num(u.cacheCreationInputTokens);
    }
  }
  return models;
}

export function summarizeLedger(entries) {
  const total = { cost_usd: 0, input_tokens: 0, output_tokens: 0, cache_read: 0, cache_create: 0, total_tokens: 0, fresh_tokens: 0, turns: 0, duration_ms: 0 };
  for (const e of entries) {
    for (const k of Object.keys(total)) if (k !== 'total_tokens' && k !== 'fresh_tokens') total[k] += num(e[k]);
    const t = tokensOf(e);
    total.total_tokens += t.total;
    total.fresh_tokens += t.fresh;
  }
  const closed = entries.filter((e) => e.commit_after && e.commit_after !== e.commit_before).length;
  return { total, closed, count: entries.length, models: modelShare(entries), avg: entries.length ? Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / entries.length])) : null };
}

export function renderCost(entries) {
  if (!entries.length) return 'cost: no .acdev/cost.jsonl yet (written by acdev run)';
  const rows = entries.map((e) => {
    const t = tokensOf(e);
    return [e.iteration ?? '', e.slice ?? '(none)', fmt(e.turns), fmt(t.total), fmt(t.fresh), fmt(e.output_tokens), money(e.cost_usd), e.stop ?? ''];
  });
  const head = ['#', 'slice', 'turns', 'total', 'fresh', 'out', 'cost', 'stop'];
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ').trimEnd();
  const s = summarizeLedger(entries);
  const out = [
    line(head), ...rows.map(line), '',
    `total: ${s.count} run(s), ${s.closed} closed slice(s), ${fmt(s.total.turns)} turns, total ${fmt(s.total.total_tokens)} fresh ${fmt(s.total.fresh_tokens)} out ${fmt(s.total.output_tokens)} tokens, $${s.total.cost_usd.toFixed(3)}`,
    s.closed ? `per closed slice: $${(s.total.cost_usd / s.closed).toFixed(3)}, ${fmt(Math.round(s.total.total_tokens / s.closed))} total / ${fmt(Math.round(s.total.fresh_tokens / s.closed))} fresh tokens` : 'per closed slice: n/a'
  ];
  const models = Object.entries(s.models);
  if (models.length) {
    const all = models.reduce((n, [, m]) => n + m.cost_usd, 0) || 1;
    out.push(`models: ${models.map(([name, m]) => `${name} $${m.cost_usd.toFixed(3)} (${Math.round((m.cost_usd / all) * 100)}%)`).join(', ')}`);
  }
  return out.join('\n');
}
