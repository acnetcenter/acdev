#!/usr/bin/env node
// acdev CLI: one entry point for the pipeline's mechanical procedures, so a
// procedure costs the model one or two turns instead of a chain of tool
// calls read out of a skill body. Run from the project; the plugin root is
// derived from this file's location. The plugin's bin/ puts it on PATH as
// `acdev`; the session-start line carries the absolute path as a fallback.
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pluginRoot, projectRoot } from './lib/project.mjs';

const USAGE = `usage: acdev <command> [flags]
  status                                      resume snapshot in one call: state, checkpoint, open plans, phase, guard, what continues
  init [--force]                              .acdev/guard.json and the .gitignore line (the guard itself ships with the plugin)
  checkpoint write --stage S --branch B --next "text" [--slice T] [--plan P] [--files a,b] [--blocked T] [--notes T] [--lang L]
  checkpoint read                             state plus the latest checkpoint
  q [--tail N] [--full] -- <command>          quiet runner: the verdict lines, never the log (quote the whole command if it has shell metacharacters)
  verify [--full]                             the project's verification commands; records the receipt a commit needs in build
  close --check [--plan P] [--verify]         what the close needs, without committing
  close --slice "n: name" --next "text" --changelog "text" [--plan P] [--message M] [--notes T] [--full]
  allow <path...>                             after the user's explicit yes: lets an approved document be edited for 15 minutes
  drift                                       docs that mention the files changed since HEAD
  scaffold <template> <target> [--force]      product | mvp | adr | runbook | incident | claude-md | mockups-inventory | canary
  scaffold mockup-variant <page> <state> [--force]   mockups/<page>-<state>.html with <main> reduced to one marker line
  mockup-spec [--write]                       per-screen skeleton of mockups/*.html (writes mockups/SPEC.md)
  migrate [--apply]                           move a pre-0.5 project over (VISION.md -> PRODUCT.md, old guard copy); dry run by default`;

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
    case 'status': {
      opts({});
      const { renderStatus } = await import('./lib/status.mjs');
      console.log(renderStatus(ROOT));
      break;
    }
    case 'init':
    case 'scaffold': {
      const { values, positionals } = opts({ force: { type: 'boolean', default: false }, state: { type: 'string' } }, { positionals: true });
      const [what, target, third] = command === 'init' ? ['init'] : positionals;
      if (!what) {
        console.error(`scaffold: say what to scaffold (a template name and its target, or mockup-variant)\n\n${USAGE}`);
        process.exit(1);
      }
      const { scaffold } = await import('./lib/scaffold.mjs');
      // mockup-variant takes its state as a third positional or as --state.
      const r = scaffold(ROOT, { pluginRoot: PLUGIN, what, target: target ?? null, state: values.state ?? third ?? null, force: values.force });
      console.log(r.text);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }
    case 'verify': {
      const { values } = opts({ full: { type: 'boolean', default: false }, tail: { type: 'string', default: '30' } });
      const { verify } = await import('./lib/guard.mjs');
      const r = verify(ROOT, { full: values.full, tail: Number(values.tail) || 30 });
      console.log(r.evidence);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }
    case 'allow': {
      const { positionals } = opts({}, { positionals: true });
      const { allowEdit } = await import('./lib/guard.mjs');
      const r = allowEdit(ROOT, positionals);
      console.log(r.text);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }
    case 'migrate': {
      const { values } = opts({ apply: { type: 'boolean', default: false } });
      const { migrate } = await import('./lib/migrate.mjs');
      const r = migrate(ROOT, { apply: values.apply });
      console.log(r.text);
      process.exitCode = r.ok ? 0 : 1;
      break;
    }
    case 'q': {
      const { values, positionals } = opts({ tail: { type: 'string', default: '30' }, full: { type: 'boolean', default: false } }, { positionals: true });
      // One word is a command line as written. Several are the words the
      // shell already split: one that holds a space gets its quotes back.
      const cmd = (positionals.length === 1 ? positionals[0] : positionals.map((a) => (/\s/.test(a) && !/^".*"$/.test(a) ? `"${a}"` : a)).join(' ')).trim();
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
    case 'checkpoint':
      delegate('checkpoint.mjs');
      break;
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(USAGE);
      break;
    case 'next':
    case 'pack':
    case 'checklist':
    case 'run':
    case 'cost':
    case 'lessons':
      console.error(`"${command}" was removed in 0.5.0: \`acdev status\` says what continues, and the skills hold the rest.`);
      process.exit(1);
      break;
    default:
      console.error(`unknown command "${command}"\n\n${USAGE}`);
      process.exit(1);
  }
} catch (err) {
  console.error(`acdev ${command}: ${err.message}`);
  process.exit(1);
}
