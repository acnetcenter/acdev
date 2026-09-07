import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '..', 'scripts', 'lint-budgets.mjs');

function runLint(skillsDir, extraEnv = {}) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, ACDEV_SKILLS_DIR: skillsDir, ...extraEnv },
    encoding: 'utf8'
  });
}

test('valid skills pass', () => {
  const r = runLint(join(here, 'fixtures', 'skills-valid'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('the real skill tree passes, including README drift checks', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('invalid skills fail with named violations', () => {
  const r = runLint(join(here, 'fixtures', 'skills-invalid'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /layer-broken/);
  assert.match(r.stderr, /name "wrong-name"/);
  assert.match(r.stderr, /description .* chars/);
  assert.match(r.stderr, /missing required heading/);
  assert.match(r.stderr, /layer-broken: contains emoji/);
  assert.match(r.stderr, /no-frontmatter: missing frontmatter/);
  assert.match(r.stderr, /missing-file: missing SKILL\.md/);
  assert.match(r.stderr, /body-too-long: body \d+ lines > 250/);
  assert.match(r.stderr, /layer-broken\/references\/note\.md: contains emoji/);
  assert.match(r.stderr, /layer-broken\/references\/flag\.md: contains emoji/);
  assert.match(r.stderr, /layer-broken\/references\/keycap\.md: contains emoji/);
  assert.match(r.stderr, /layer-broken: missing required heading "## Before advising"/);
  assert.match(r.stderr, /layer-broken\/references\/checklist\.md: missing required heading "## Pitfalls"/);
  assert.match(r.stderr, /layer-broken: "How to verify" is missing the shared verify-probe sentence/);
  // Claude Code parses the frontmatter as strict YAML: an unquoted ": " in
  // the description drops the skill silently (18 of 22 vanished once).
  assert.match(r.stderr, /unquoted-colon: description must be double-quoted for YAML/);
});

// A layer skill in its stub shape: the gate in "Before advising", the probe
// sentence in "How to verify", and the items in references/checklist.md.
function makeLayer(dir, name, advice, { checklist = true } = {}) {
  mkdirSync(join(dir, name, 'references'), { recursive: true });
  writeFileSync(join(dir, name, 'SKILL.md'), [
    '---', `name: ${name}`, `description: Use when testing ${name}.`, '---', '',
    `# ${name}`, '',
    '## Before advising', '', advice, '',
    '## How to verify', '',
    'Otherwise run the `verify:` probe attached to each checklist item directly.', ''
  ].join('\n'));
  if (checklist) {
    writeFileSync(join(dir, name, 'references', 'checklist.md'), [
      `# ${name}: checklist`, '', '## Production checklist', '', '- item — verify: probe', '', '## Pitfalls', '', '- none', ''
    ].join('\n'));
  }
}
const gate = (layer) => `Read the ADRs first. Then run \`node "<plugin-root>/scripts/acdev.mjs" checklist --layers ${layer} --pitfalls\` and cite it.`;

test('diverging layer "Before advising" blocks fail', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-layers-'));
  makeLayer(dir, 'layer-one', gate('one'));
  makeLayer(dir, 'layer-two', 'Read something else entirely.');
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /"Before advising" blocks diverge: layer-(one|two)\s+vs\s+layer-(one|two)/);
});

test('layer blocks that differ only in the --layers name of the checklist command pass', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-layers-same-'));
  makeLayer(dir, 'layer-one', gate('one'));
  makeLayer(dir, 'layer-two', gate('two'));
  const r = runLint(dir);
  assert.equal(r.status, 0, r.stderr);
});

test('a layer skill without references/checklist.md fails', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-layers-nochecklist-'));
  makeLayer(dir, 'layer-one', gate('one'), { checklist: false });
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /layer-one: missing references\/checklist\.md/);
});

test('near-identical model-invocable descriptions fail the overlap check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-overlap-'));
  const mk = (name, desc) => {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: ${desc}\n---\n\n# ${name}\n\nBody.\n`);
  };
  mk('first-skill', 'Use when implementing any feature or bugfix with tests and verification evidence.');
  mk('second-skill', 'Use when implementing any feature or bugfix with verification tests and evidence.');
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /description overlap \d\.\d+ > 0\.25 between "first-skill" and "second-skill"/);
});

test('a pipeline body missing a required phrase fails, naming the phrase', () => {
  const r = runLint(join(here, 'fixtures', 'skills-required-phrases-fail'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /mockups: body is missing the required phrase "Do you approve these mockups\?"/);
  // The phrases it kept are not reported, even when wrapped across lines.
  assert.ok(!r.stderr.includes('normative'), r.stderr);
  assert.ok(!r.stderr.includes('Reopening'), r.stderr);
});

test('a pipeline body that keeps every required phrase passes, wrapped lines included', () => {
  const r = runLint(join(here, 'fixtures', 'skills-required-phrases-pass'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('a pipeline body over its per-skill cap fails even under the generic body cap', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-pipeline-cap-'));
  mkdirSync(join(dir, 'mockups'));
  const rules = [
    'Ask "Do you approve these mockups?" and wait for an explicit approval.',
    'The freeze is normative for what the mockups actually draw; what they do not draw',
    'is illustrative: `build` decides those as taste-class decisions in its audit table.',
    'Reopening the contract after approval requires re-approval through this skill again.'
  ].join('\n');
  const padding = 'Procedure that belongs in a step file. '.repeat(150); // ~6k chars, under 8,000
  writeFileSync(join(dir, 'mockups', 'SKILL.md'),
    `---\nname: mockups\ndescription: Use when testing the per-skill cap.\n---\n\n# Mockups\n\n${rules}\n\n${padding}\n`);
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /mockups: body \d+ chars > 5500 \(thinned pipeline body/);
  assert.ok(!/chars > 8000/.test(r.stderr), r.stderr);
});

// There is no `acdev` executable: a reference that writes an invocation
// shape (subcommand plus flag) sends a subagent hunting for a binary.
test('an invocation-shaped "acdev <cmd> --flag" mention in a reference fails; prose mentions pass', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-bare-command-'));
  mkdirSync(join(dir, 'demo', 'references'), { recursive: true });
  writeFileSync(join(dir, 'demo', 'SKILL.md'), [
    '---', 'name: demo', 'description: Use when testing the bare command rule.', '---', '', '# Demo', '',
    '`acdev close` clears the receipt (prose, no flags: legal).',
    // Prose with a `--` dash later on the line: the separator counts only
    // directly after the subcommand, so this stays legal.
    'acdev close clears the freeze -- and the receipt -- once green.',
    // A closing backtick ends the token walk before the flag.
    '`acdev close` runs the verify commands; `--check` previews them.', ''
  ].join('\n'));
  writeFileSync(join(dir, 'demo', 'references', 'note.md'), [
    '# Note', '',
    'Then run acdev pack --layers api and read it.',
    // A flag after positional tokens is still an invocation shape.
    'Then acdev checkpoint write --stage build and commit.', ''
  ].join('\n'));
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /2 violation\(s\)/);
  assert.match(r.stderr, /skills\/demo\/references\/note\.md: "acdev pack" names no executable; write node "<plugin-root>\/scripts\/acdev\.mjs" pack/);
  assert.match(r.stderr, /skills\/demo\/references\/note\.md: "acdev checkpoint" names no executable/);
  assert.doesNotMatch(r.stderr, /"acdev close"/);
});

// A step is read in a headless session with no skill directory in sight:
// pointers must be absolute and resolve, and commands must name node.
test('a step with a dangling pointer, a relative pointer and a bare command fails on all three', () => {
  const steps = mkdtempSync(join(tmpdir(), 'acdev-steps-'));
  writeFileSync(join(steps, 'build-construct.md'), [
    '# Construct', '',
    'Read <plugin-root>/skills/planning/SKILL.md first (resolves).',
    'Then <plugin-root>/skills/nope/references/x.md (does not).',
    'Nor <plugin-root>/skills/nope/SKILL.md. Next sentence.',
    'See references/x.md for the checklist.',
    'Verify with acdev q -- npm test.', ''
  ].join('\n'));
  const r = runLint(join(here, 'fixtures', 'skills-valid'), { ACDEV_STEPS_DIR: steps });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /4 violation\(s\)/);
  assert.match(r.stderr, /scripts\/steps\/build-construct\.md: pointer <plugin-root>\/skills\/nope\/references\/x\.md does not resolve/);
  // The dangling pointer is reported without the sentence's full stop.
  assert.match(r.stderr, /pointer <plugin-root>\/skills\/nope\/SKILL\.md does not resolve/);
  assert.doesNotMatch(r.stderr, /SKILL\.md\. does not resolve/);
  assert.match(r.stderr, /scripts\/steps\/build-construct\.md: relative pointer "references\/x\.md"; write <plugin-root>\/skills\/<skill>\/references\/x\.md/);
  assert.match(r.stderr, /scripts\/steps\/build-construct\.md: "acdev q" names no executable; write node "<plugin-root>\/scripts\/acdev\.mjs" q/);
  assert.doesNotMatch(r.stderr, /skills\/planning\/SKILL\.md does not resolve/);
  // The dispenser ids are a real-tree contract, not a fixture one.
  assert.doesNotMatch(r.stderr, /missing \(the dispenser can select it\)/);
});

test('a clean step dir under the override passes, pointers at the end of a sentence included', () => {
  const steps = mkdtempSync(join(tmpdir(), 'acdev-steps-clean-'));
  writeFileSync(join(steps, 'build-construct.md'), [
    '# Construct', '',
    'Run node "<plugin-root>/scripts/acdev.mjs" q -- npm test.',
    // The full stop after a pointer is punctuation, not part of the path.
    'Read <plugin-root>/skills/planning/SKILL.md.',
    'See <plugin-root>/shared/references/decision-classification.md. Then classify.', ''
  ].join('\n'));
  const r = runLint(join(here, 'fixtures', 'skills-valid'), { ACDEV_STEPS_DIR: steps });
  assert.equal(r.status, 0, r.stderr);
});

test('an empty skills dir fails instead of passing green', () => {
  const empty = mkdtempSync(join(tmpdir(), 'acdev-noskills-'));
  const r = runLint(empty);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no skill directories/);
});
