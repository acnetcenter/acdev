#!/usr/bin/env node
// acdev CLI: one entry point for the pipeline's mechanical procedures, so a
// procedure costs the model one or two turns instead of a chain of tool
// calls read out of a skill body. Run from the project; the plugin root is
// derived from this file's location.
//
//   node "<plugin-root>/scripts/acdev.mjs" <command> [flags]
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pluginRoot, projectRoot } from './lib/project.mjs';

const USAGE = `usage: acdev.mjs <command> [flags]
  next [--change "topic"]                     the pipeline step that applies now (~300 tokens)
  status                                      resume snapshot in one call: state, checkpoint, open plans, current phase
  scaffold <what> [target] [--layers a,b] [--canary] [--force]   copy the mechanical files verbatim: guard | verify | <template> <target>
  scaffold mockup-variant <page> <state> | --state <empty|error|loading> [--force]   mockups/<page>-<state>.html: the page with <main> reduced to one marker line
  pack [--screens a,b] [--layers x,y] [--pitfalls]   slice context pack: decisions, phase, checkpoint, spec, checklists
  checklist --layers x,y [--pitfalls]         layer checklists filtered by .acdev/profile.json
  q [--tail N] [--full] -- <command>          quiet runner: the verdict lines, never the log
  drift                                       docs that mention the files changed since HEAD
  close --check [--plan P] [--verify]         what the close needs, without committing
  close --slice "n: name" --plan P --next "text" --changelog "text" [--message M] [--notes T] [--full]
  mockup-spec [--write]                       per-screen skeleton of mockups/*.html (writes mockups/SPEC.md)
  run [--max-slices N] [--model M] [--budget-usd N] [--mcp-config F] [--no-isolate] [--claude CMD] [--extra "flags"] [--prompt T] [--timeout-min N] [--dry-run]
                                              headless loop: one fresh session per slice, capped per iteration (--budget-usd 0 disables)
  cost [--json]                               the .acdev/cost.jsonl ledger written by run: total, fresh, per-model share
  checkpoint read | write ...                 scripts/checkpoint.mjs
  lessons list | add ... | promote ...        scripts/lessons.mjs`;

const ROOT = projectRoot();
const PLUGIN = pluginRoot();
const [command, ...rest] = process.argv.slice(2);

function opts(options, { positionals = false } = {}) {
  try {
    return parseArgs({ args: rest, options, allowPositionals: positionals });
  } catch (err) {
    console.error(`${err.message}\n\n${USAGE}`);
    process.exit(1);
  }
}
const list = (s) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const delegate = (script) => {
  const r = spawnSync(process.execPath, [join(PLUGIN, 'scripts', script), ...rest], { cwd: ROOT, stdio: 'inherit' });
  process.exit(r.status ?? 1);
};

// Commands that print then set a status use process.exitCode, never
// process.exit(): on POSIX a non-TTY stdout is an async pipe, and exiting
// drops whatever console.log left buffered — a long `q --full` tail would
// reach the caller cut off.
try {
  switch (command) {
    case 'next': {
      const { values } = opts({ change: { type: 'string' } });
      const { renderNext } = await import('./lib/next.mjs');
      console.log(renderNext(ROOT, { pluginRoot: PLUGIN, change: values.change ?? null }));
      break;
    }
    case 'status': {
      opts({});
      const { renderStatus } = await import('./lib/status.mjs');
      console.log(renderStatus(ROOT, { pluginRoot: PLUGIN }));
      break;
    }
    case 'scaffold': {
      const { values, positionals } = opts({ layers: { type: 'string' }, canary: { type: 'boolean', default: false }, force: { type: 'boolean', default: false }, state: { type: 'string' } }, { positionals: true });
      const [what, target, third] = positionals;
      if (!what) {
        console.error(`scaffold: say what to scaffold (guard, verify, mockup-variant, or a template name and its target)\n\n${USAGE}`);
        process.exit(1);
      }
      const { scaffold } = await import('./lib/scaffold.mjs');
      // mockup-variant takes its state as a third positional or as --state.
      const r = scaffold(ROOT, { pluginRoot: PLUGIN, what, target: target ?? null, state: values.state ?? third ?? null, layers: list(values.layers), canary: values.canary, force: values.force });
      console.log(r.text);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }
    case 'pack': {
      const { values } = opts({ screens: { type: 'string' }, layers: { type: 'string' }, pitfalls: { type: 'boolean', default: false } });
      const { buildPack } = await import('./lib/pack.mjs');
      console.log(buildPack(ROOT, { pluginRoot: PLUGIN, screens: list(values.screens), layers: list(values.layers), pitfalls: values.pitfalls }));
      break;
    }
    case 'checklist': {
      const { values } = opts({ layers: { type: 'string' }, pitfalls: { type: 'boolean', default: false } });
      const layers = list(values.layers);
      if (!layers.length) {
        console.error(`checklist: --layers is required\n\n${USAGE}`);
        process.exit(1);
      }
      const { loadProfile, renderChecklists } = await import('./lib/checklist.mjs');
      console.log(renderChecklists(PLUGIN, layers, loadProfile(ROOT), { pitfalls: values.pitfalls }));
      break;
    }
    case 'q': {
      const { values, positionals } = opts({ tail: { type: 'string', default: '30' }, full: { type: 'boolean', default: false } }, { positionals: true });
      const cmd = positionals.join(' ').trim();
      if (!cmd) {
        console.error(`q: no command given (usage: q [--tail N] [--full] -- <command>)`);
        process.exit(1);
      }
      const { runQuiet } = await import('./lib/quiet.mjs');
      const r = runQuiet(cmd, { cwd: ROOT, tail: Number(values.tail) || 30, full: values.full });
      console.log(r.summary);
      process.exitCode = r.status === 0 ? 0 : 1;
      break;
    }
    case 'drift': {
      opts({});
      const { driftCandidates, renderDrift } = await import('./lib/drift.mjs');
      console.log(renderDrift(driftCandidates(ROOT)));
      break;
    }
    case 'close': {
      const { values } = opts({
        check: { type: 'boolean', default: false }, verify: { type: 'boolean', default: false }, full: { type: 'boolean', default: false },
        tail: { type: 'string', default: '30' }, slice: { type: 'string' }, plan: { type: 'string' }, next: { type: 'string' },
        changelog: { type: 'string' }, message: { type: 'string' }, notes: { type: 'string' }
      });
      const { closeCheck, closeSlice } = await import('./lib/close.mjs');
      const tail = Number(values.tail) || 30;
      const r = values.check
        ? closeCheck(ROOT, { plan: values.plan, verify: values.verify, full: values.full, tail })
        : closeSlice(ROOT, { ...values, tail, pluginRoot: PLUGIN });
      console.log(r.text);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }
    case 'mockup-spec': {
      const { values } = opts({ write: { type: 'boolean', default: false } });
      const { renderSpec, writeSpec } = await import('./lib/mockup-spec.mjs');
      if (values.write) {
        const w = writeSpec(ROOT);
        console.log(`mockup-spec: wrote ${w.path} (${w.screens} screen(s), ${w.chars} chars). Complete the Intent lines before the freeze.`);
      } else console.log(renderSpec(ROOT));
      break;
    }
    case 'run': {
      const { values } = opts({
        'max-slices': { type: 'string', default: '10' }, model: { type: 'string' }, claude: { type: 'string', default: 'claude' },
        extra: { type: 'string', default: '' }, prompt: { type: 'string' }, 'timeout-min': { type: 'string', default: '120' }, 'dry-run': { type: 'boolean', default: false },
        'budget-usd': { type: 'string' }, 'mcp-config': { type: 'string' }, 'no-isolate': { type: 'boolean', default: false }
      });
      // A cap that is not a number would silently become NaN and disable
      // the cap; 0 disables it on purpose, anything else must be >= 0.
      const budgetUsd = values['budget-usd'] === undefined ? null : Number(values['budget-usd']);
      if (budgetUsd !== null && (values['budget-usd'].trim() === '' || !Number.isFinite(budgetUsd) || budgetUsd < 0)) {
        console.error('run: --budget-usd must be a number >= 0');
        process.exit(1);
      }
      const { runLoop } = await import('./lib/run.mjs');
      const r = await runLoop(ROOT, {
        pluginRoot: PLUGIN, maxSlices: Number(values['max-slices']) || 10, model: values.model ?? null, claude: values.claude,
        extra: values.extra, prompt: values.prompt ?? null, timeoutMin: Number(values['timeout-min']) || 120, dryRun: values['dry-run'],
        budgetUsd, isolate: !values['no-isolate'], mcpConfig: values['mcp-config'] ?? null
      });
      console.log(`run: ${r.iterations} iteration(s), stop: ${r.reason}`);
      break;
    }
    case 'cost': {
      const { values } = opts({ json: { type: 'boolean', default: false } });
      const { readLedger, renderCost } = await import('./lib/cost.mjs');
      const entries = readLedger(ROOT);
      console.log(values.json ? JSON.stringify(entries, null, 2) : renderCost(entries));
      break;
    }
    case 'checkpoint':
      delegate('checkpoint.mjs');
      break;
    case 'lessons':
      delegate('lessons.mjs');
      break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      break;
    default:
      console.error(`unknown command "${command}"\n\n${USAGE}`);
      process.exit(1);
  }
} catch (err) {
  console.error(`acdev ${command}: ${err.message}`);
  process.exit(1);
}
