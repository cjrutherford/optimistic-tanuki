#!/usr/bin/env node
/**
 * personality-audit — measures how much of a codebase's styling actually
 * reads the personality system, and ratchets hard-coded values down.
 *
 * Dependency-free (Node >= 18). Copy to optimistic-tanuki/tools/ and run from
 * the repo root.
 *
 *   node tools/personality-audit.mjs report                 # per-project table
 *   node tools/personality-audit.mjs baseline > tools/personality-audit.baseline.json
 *   node tools/personality-audit.mjs check tools/personality-audit.baseline.json
 *
 * `check` fails (exit 1) if any file gained hard-coded literals relative to
 * the baseline, or a new file introduces any. Files that improve pass and
 * should be re-baselined in the same PR (the ratchet only turns one way).
 *
 * What counts as a hard-coded literal in component SCSS:
 *   - border-radius / box-shadow / font-family / line-height / letter-spacing
 *     values that don't go through var(...)
 *   - font-size in px/rem/em outside var(...)
 * `0`, `none`, `inherit`, `50%` and `9999px` (explicit pill/circle) are allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOTS = ['libs', 'apps'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', 'coverage']);
// The theme system itself defines the contract; don't audit it.
const SKIP_PATHS = [/libs\/theme-(styles|lib|models|ui)\//];

const PERSONALITY_USE =
  /var\(--(personality-|type-|heading-|accent-ground|on-accent-ground|line-height|letter-spacing|touch-target|layout-max-width|stagger-delay|shadow-|font-heading|font-body|font-mono|border-radius-)|@include\s+p\./;
const LITERAL_RULES = [
  [
    'border-radius',
    /^\s*border-radius\s*:\s*(?!var\()(?!0\s*;)(?!none)(?!inherit)(?!50%)(?!9999px)[^;]*\d/,
  ],
  ['box-shadow', /^\s*box-shadow\s*:\s*(?!var\()(?!none)(?!inherit)[^;]*\d/],
  ['font-family', /^\s*font-family\s*:\s*(?!var\()(?!inherit)[^;]+/],
  ['font-size', /^\s*font-size\s*:\s*(?!var\()[^;]*\d(px|rem|em)/],
  ['line-height', /^\s*line-height\s*:\s*(?!var\()(?!inherit)[^;]*\d/],
  [
    'letter-spacing',
    /^\s*letter-spacing\s*:\s*(?!var\()(?!normal)(?!inherit)[^;]*\d/,
  ],
];

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name.endsWith('.scss') && !SKIP_PATHS.some((re) => re.test(full)))
      out.push(full);
  }
  return out;
}

function auditFile(file) {
  const text = readFileSync(file, 'utf8');
  const literals = {};
  for (const line of text.split('\n')) {
    if (line.trim().startsWith('//')) continue;
    for (const [prop, re] of LITERAL_RULES)
      if (re.test(line)) literals[prop] = (literals[prop] ?? 0) + 1;
  }
  return { usesPersonality: PERSONALITY_USE.test(text), literals };
}

function audit() {
  const files = ROOTS.flatMap((r) => walk(r, []));
  return Object.fromEntries(files.map((f) => [f, auditFile(f)]));
}

const project = (file) => file.split(path.sep).slice(0, 2).join('/');
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

const [cmd = 'report', baselinePath] = process.argv.slice(2);
const result = audit();

if (cmd === 'baseline') {
  const baseline = Object.fromEntries(
    Object.entries(result)
      .filter(([, r]) => sum(r.literals) > 0)
      .map(([f, r]) => [f, r.literals])
  );
  process.stdout.write(JSON.stringify(baseline, null, 2) + '\n');
} else if (cmd === 'check') {
  if (!baselinePath) throw new Error('usage: check <baseline.json>');
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const regressions = [];
  const improved = [];
  for (const [file, r] of Object.entries(result)) {
    const before = baseline[file] ?? {};
    for (const [prop, n] of Object.entries(r.literals)) {
      if (n > (before[prop] ?? 0))
        regressions.push(`${file}: ${prop} ${before[prop] ?? 0} -> ${n}`);
    }
    if (sum(r.literals) < sum(before)) improved.push(file);
  }
  for (const line of regressions) console.error(`ratchet  ${line}`);
  if (improved.length)
    console.log(
      `${improved.length} file(s) improved — re-run \`baseline\` to lock it in.`
    );
  console.log(
    regressions.length
      ? `\n${regressions.length} regression(s)`
      : 'no new hard-coded style literals'
  );
  process.exit(regressions.length ? 1 : 0);
} else {
  const byProject = {};
  for (const [file, r] of Object.entries(result)) {
    const p = (byProject[project(file)] ??= {
      files: 0,
      reading: 0,
      literals: 0,
      withLiterals: 0,
    });
    p.files++;
    if (r.usesPersonality) p.reading++;
    const n = sum(r.literals);
    p.literals += n;
    if (n) p.withLiterals++;
  }
  const rows = Object.entries(byProject).sort(
    (a, b) => b[1].literals - a[1].literals
  );
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `${pad('project', 42)}${pad('scss', 6)}${pad('reads personality', 19)}${pad(
      'files w/ literals',
      19
    )}literals`
  );
  for (const [name, p] of rows) {
    console.log(
      `${pad(name, 42)}${pad(p.files, 6)}${pad(
        `${p.reading} (${Math.round((p.reading / p.files) * 100)}%)`,
        19
      )}${pad(p.withLiterals, 19)}${p.literals}`
    );
  }
  const t = rows.reduce(
    (a, [, p]) => ({
      files: a.files + p.files,
      reading: a.reading + p.reading,
      literals: a.literals + p.literals,
      withLiterals: a.withLiterals + p.withLiterals,
    }),
    { files: 0, reading: 0, literals: 0, withLiterals: 0 }
  );
  console.log(
    `\nTOTAL ${t.files} scss files · ${
      t.reading
    } read the personality system (${Math.round(
      (t.reading / t.files) * 100
    )}%) · ${t.withLiterals} carry ${t.literals} hard-coded literals`
  );
}
