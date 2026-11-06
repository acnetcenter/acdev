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
// A skills dir with one skill: frontmatter plus the given body lines, and
// optional reference files.
function skillDir(prefix, name, bodyLines, references = {}) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  mkdirSync(join(dir, name, 'references'), { recursive: true });
  writeFileSync(join(dir, name, 'SKILL.md'), ['---', `name: ${name}`, `description: Use when testing ${name}.`, '---', '', `# ${name}`, '', ...bodyLines, ''].join('\n'));
  for (const [file, lines] of Object.entries(references)) writeFileSync(join(dir, name, 'references', file), [...lines, ''].join('\n'));
  return dir;
}

test('valid skills pass', () => {
  const r = runLint(join(here, 'fixtures', 'skills-valid'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK/);
});

test('the real tree passes: six skills, manifests, hooks, shims, evals, README and manual', () => {
  const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OK \(6 skills checked\)/);
});

test('invalid skills fail with named violations', () => {
  const r = runLint(join(here, 'fixtures', 'skills-invalid'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, /name "wrong-name"/);
  assert.match(r.stderr, /description .* chars/);
  assert.match(r.stderr, /skills\/broken: contains emoji/);
  assert.match(r.stderr, /broken\/references\/note\.md: contains emoji/);
  assert.match(r.stderr, /broken\/references\/flag\.md: contains emoji/);
  assert.match(r.stderr, /broken\/references\/keycap\.md: contains emoji/);
  assert.match(r.stderr, /no-frontmatter: missing frontmatter/);
  assert.match(r.stderr, /missing-file: missing SKILL\.md/);
  assert.match(r.stderr, /body-too-long: body \d+ lines > 250/);
  // Claude Code parses the frontmatter as strict YAML: an unquoted ": " in
  // the description drops the skill silently.
  assert.match(r.stderr, /unquoted-colon: description must be double-quoted for YAML/);
});

test('near-identical model-invocable descriptions fail the overlap check', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-overlap-'));
  const mk = (name, desc) => {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\n\n# ${name}\n\nBody.\n`);
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

test('a body over the character cap fails even when it is under the line cap', () => {
  const dir = skillDir('acdev-body-cap-', 'demo', ['Detail that belongs in a reference. '.repeat(180)]);
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /demo: body \d+ chars > 6000 \(detail goes to references\/\)/);
});

// The CLI is on PATH as `acdev`: an invocation is written that way. What
// fails is text that names something 0.5.0 removed.
test('mentions of removed commands, skills, placeholders and the old guard fail; current commands pass', () => {
  const dir = skillDir('acdev-stale-', 'demo', [
    'Run `acdev close --check --plan <plan>` and then `acdev status` (current commands: legal).',
    'A step that says run then close is prose, not a command.'
  ], {
    'note.md': [
      '# Note', '',
      'Then run acdev pack --layers api and read it.',
      'Run node "<plugin-root>/scripts/acdev.mjs" q -- npm test.',
      'TDD per the `tdd` skill, close through `ship`, and the `layer-api` checklist.',
      'Evidence: node .claude/hooks/acdev-guard.mjs status, after scaffold guard.'
    ]
  });
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /note\.md: "acdev pack" was removed/);
  assert.match(r.stderr, /note\.md: the <plugin-root> placeholder is gone/);
  assert.match(r.stderr, /note\.md: `tdd` names a skill that no longer exists/);
  assert.match(r.stderr, /note\.md: `ship` names a skill that no longer exists/);
  assert.match(r.stderr, /note\.md: `layer-api` names a skill that no longer exists/);
  assert.match(r.stderr, /note\.md: "acdev-guard\.mjs" is gone/);
  assert.match(r.stderr, /note\.md: "scaffold guard" is gone/);
  assert.doesNotMatch(r.stderr, /SKILL\.md/, 'the body with current commands is clean');
});

test('the old document name fails outside a migration note and passes inside one', () => {
  const stray = skillDir('acdev-vision-', 'demo', ['Every IN item traces to a flow in VISION section 5.']);
  const bad = runLint(stray);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /demo\/SKILL\.md: "VISION" outside a migration note: the product document is docs\/PRODUCT\.md/);
  const note = skillDir('acdev-vision-ok-', 'demo', ['A repo from an earlier acdev keeps `docs/VISION.md`; `acdev migrate` moves it over.']);
  assert.equal(runLint(note).status, 0, runLint(note).stderr);
});

test('the stale-text check catches the forms a stale instruction takes and leaves prose alone', () => {
  const stale = [
    'Close with /acdev:ship when done.',
    'Dispatch subagent_type: acdev:acdev-builder for the layer.',
    'Follow acdev:tdd for the loop.',
    'Close through the ship skill.',
    'Run node "$CLI/scripts/acdev.mjs" pack to get the context.',
    'Derived from docs/vision.md, section 2.',
    'Traces to the Vision document.',
    'Set the tags in .acdev/profile.json.',
    'Record it in .acdev/lessons.md.',
    // "migrate" two lines away excuses nothing: the note must be on the line.
    'Read docs/VISION.md section 5.\n\nThe tests migrate the schema.'
  ];
  for (const line of stale) {
    const r = runLint(skillDir('acdev-stale-form-', 'demo', [line]));
    assert.equal(r.status, 1, `should fail: ${line}`);
  }
  const fine = skillDir('acdev-prose-', 'demo', [
    'Each acdev run of the evals costs a few cents.',
    'The git alias `ship` is yours to keep.',
    'The product or vision docs the repo already has are read first.',
    'An earlier acdev kept `docs/VISION.md`; `acdev migrate` renames it.'
  ]);
  const ok = runLint(fine);
  assert.equal(ok.status, 0, ok.stderr);
});

test('an eval case the native runner would refuse fails here first; a valid one passes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'acdev-evals-'));
  const put = (rel, text) => {
    const p = join(dir, ...rel.split('/'));
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, text);
  };
  put('bad/prompt.md', '---\nmax_turn: 15\n---\n\nGo.\n');
  put('bad/graders/a.md', '---\ntype: file-exists\n---\n');
  put('bad/graders/b.md', "---\ntype: tool_used\ntool: Bash\ninput_match: '(?i)acdev status'\n---\n");
  put('empty/prompt.md', '---\nmax_turns: 5\n---\n\nGo.\n');
  put('yaml-only/case.yaml', 'schema_version: "1.1"\nname: yaml-only\nexecution:\n  prompt: Go\n');
  put('yaml-only/graders/a.md', '---\ntype: regex\npattern: ok\n---\n');
  const r = runLint(join(here, 'fixtures', 'skills-valid'), { ACDEV_EVALS_DIR: dir });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /evals\/bad\/prompt\.md: unknown frontmatter key "max_turn"/);
  assert.match(r.stderr, /evals\/bad\/graders\/a\.md: unknown grader type "file-exists"/);
  assert.match(r.stderr, /evals\/bad\/graders\/b\.md: inline \(\?i\) is not supported/);
  assert.match(r.stderr, /evals\/empty: no grader under graders\//);
  assert.doesNotMatch(r.stderr, /yaml-only/, 'a case.yaml with its own prompt is a valid case');
});

test('a pointer into references/ must resolve from the file that names it', () => {
  const dir = skillDir('acdev-pointers-', 'demo', [
    'Read `references/guide.md` (resolves) and `references/missing.md` (does not).',
    'The shared rules: `../other/references/nope.md`.'
  ], { 'guide.md': ['# Guide', '', 'See `../../demo/references/guide.md`. A sentence follows.'] });
  const r = runLint(dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /2 violation\(s\)/);
  assert.match(r.stderr, /demo\/SKILL\.md: pointer references\/missing\.md does not resolve/);
  assert.match(r.stderr, /demo\/SKILL\.md: pointer \.\.\/other\/references\/nope\.md does not resolve/);
  assert.doesNotMatch(r.stderr, /guide\.md/);
});

test('an empty skills dir fails instead of passing green', () => {
  const empty = mkdtempSync(join(tmpdir(), 'acdev-noskills-'));
  const r = runLint(empty);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no skill directories/);
});
