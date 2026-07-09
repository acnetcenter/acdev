#!/usr/bin/env node
// acdev verify template: mechanical scan for common AI-design tells.
// blueprint copies this into scripts/verify/ for the frontend layer and
// adjusts targets/rules to the project. Contract: exit 0 = clean,
// exit 1 = violations (one evidence line each) or nothing scanned.
// Rules mirror skills/layer-frontend/references/motion-craft.md.
// A justified exception (recorded in the audit table) is silenced by
// putting `motion-ok` in a comment on the offending line.
// Token files (name matches token|theme|variables) are skipped entirely:
// they DECLARE the motion/color scale (including slow durations and
// ease-in tokens for exits); the rules police USAGE, not declarations.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const TARGETS = process.argv.length > 2 ? process.argv.slice(2) : ['src', 'app', 'mockups'];
const EXTS = new Set(['.css', '.scss', '.html', '.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte']);
const TOKEN_FILE = /token|theme|variables/i;
const MAX_MS = 500; // continuous loops (infinite) and *-delay values exempt

// Covers CSS, camelCase JS object styles, Framer Motion props and Tailwind.
const RULES = [
  { name: 'transition-all', why: 'animates unintended properties',
    re: /\btransition(?:-property|Property)?\s*:\s*['"]?all\b|\btransition-all\b/ },
  { name: 'lone-ease-in', why: 'entrances should ease-out',
    re: /\bease-in\b(?!-out)|\bease\s*:\s*['"]easeIn['"]/ },
  { name: 'scale-from-zero', why: 'enter from 0.9-0.97, not 0',
    re: /\bscale(?:3d)?\(\s*0(?:\.0+)?\s*[,)]|\bscale\s*:\s*['"]?0(?:\.0+)?\s*[,;}'"]|\bscale-(?:[xy]-)?0\b/ },
  { name: 'gradient-text', why: 'decorative gradient text',
    re: /background-?clip\s*:\s*['"]?text\b/i }
];

// Blank out comments while preserving line numbers, so prose like
// "/* never use transition: all */" cannot trip the rules.
function stripComments(src) {
  const blank = (m) => m.replace(/[^\n]/g, ' ');
  return src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(?<!:)\/\/[^\n]*/g, blank);
}

const files = [];
function walk(p) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) if (e !== 'node_modules') walk(join(p, e));
  } else if (EXTS.has(extname(p))) {
    files.push(p);
  }
}
TARGETS.forEach(walk);

const violations = [];
const warnings = [];
for (const f of files) {
  if (TOKEN_FILE.test(basename(f))) continue;
  let src;
  try { src = readFileSync(f, 'utf8'); } catch (err) {
    warnings.push(`warn: could not read ${f} (${err.code ?? err.message})`);
    continue;
  }
  const rawLines = src.split('\n');
  stripComments(src).split('\n').forEach((line, i) => {
    if (/motion-ok/.test(rawLines[i])) return; // justified in the audit table
    const at = `${f}:${i + 1}`;
    for (const r of RULES) if (r.re.test(line)) violations.push(`${at}: ${r.name} (${r.why})`);
    if (/transition|animation|duration/i.test(line) && !/infinite/.test(line) && !/-delay|Delay/.test(line)) {
      // "0.3s" / ".3s" / "300ms" in CSS; unitless Framer/WAAPI durations in JS.
      let unitSeen = false;
      for (const m of line.matchAll(/(\d+(?:\.\d+)?|\.\d+)(ms|s)\b/g)) {
        unitSeen = true;
        const ms = m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1]);
        if (ms > MAX_MS) violations.push(`${at}: duration ${m[0]} > ${MAX_MS}ms`);
      }
      const u = unitSeen ? null : line.match(/\bduration\s*:\s*(\d+(?:\.\d+)?|\.\d+)\s*[,}\s]/);
      if (u) {
        const n = parseFloat(u[1]);
        const ms = n <= 30 ? n * 1000 : n; // Framer counts seconds, WAAPI ms
        if (ms > MAX_MS) violations.push(`${at}: duration ${u[1]} (~${ms}ms) > ${MAX_MS}ms`);
      }
      const tw = line.match(/\bduration-(\d+)\b/);
      if (tw && parseInt(tw[1], 10) > MAX_MS) violations.push(`${at}: duration-${tw[1]} > ${MAX_MS}ms`);
    }
    // Raw hex as a property VALUE (after a colon) belongs in the token file.
    // Selector ids (#fade) and SVG attributes (fill="#fff") do not match.
    if (/\.(css|scss|html)$/.test(f) && /:[^;{]*#[0-9a-fA-F]{3,8}\b/.test(line)) {
      violations.push(`${at}: raw hex color outside the token file`);
    }
  });
}

warnings.forEach((w) => console.error(w));
if (files.length === 0) {
  console.error(`fail: nothing scanned - no matching files under: ${TARGETS.join(', ')}`);
  process.exit(1);
}
if (violations.length) {
  violations.forEach((v) => console.error(`fail: ${v}`));
  console.error(`fail: ${violations.length} design tell(s) in ${files.length} file(s) scanned`);
  process.exit(1);
}
console.log(`ok: no AI-design tells in ${files.length} file(s) scanned`);
