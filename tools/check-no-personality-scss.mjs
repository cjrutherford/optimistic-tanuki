#!/usr/bin/env node
/**
 * Drift guard for the dead personality SCSS estate removed in the
 * 2026-07-18 "Personality Styles" refactor (Workstream A1/A4 —
 * docs/plans/2026-07-18-personality-styles-refactor.md).
 *
 * Every UI library used to carry its own copy of
 * `src/lib/styles/personality-tokens.scss` and
 * `src/lib/styles/personality-effects.scss`. Both were verified dead
 * (zero `@include` consumers repo-wide) and deleted in one pass. This
 * script fails CI if either filename reappears under any
 * `libs/<lib>/src/lib/styles` directory — whether resurrected wholesale,
 * copy-pasted into a new library, or reintroduced by a bad merge.
 *
 * Run manually with `node tools/check-no-personality-scss.mjs`, or via
 * `pnpm run check:no-personality-scss`. No dependencies beyond Node's
 * built-in `fs`/`path`.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = process.cwd();
const libsRoot = join(repoRoot, 'libs');

const FORBIDDEN_FILENAMES = new Set([
  'personality-tokens.scss',
  'personality-effects.scss',
]);

/** @type {string[]} */
const offenders = [];

function walk(directory) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && FORBIDDEN_FILENAMES.has(entry.name)) {
      offenders.push(fullPath);
    }
  }
}

if (!statSync(libsRoot, { throwIfNoEntry: false })) {
  console.error(
    `Expected libs/ directory at ${libsRoot} — run from repo root.`
  );
  process.exit(2);
}

walk(libsRoot);

if (offenders.length > 0) {
  console.error(
    'Found forbidden personality SCSS file(s). These were deleted as dead code ' +
      '(docs/plans/2026-07-18-personality-styles-refactor.md, Workstream A1) — ' +
      'zero mixin consumers repo-wide. Do not reintroduce them; if new shared ' +
      'personality styles are needed, add them to libs/theme-styles per Workstream A2/A3.'
  );
  for (const offender of offenders) {
    console.error(`  - ${relative(repoRoot, offender)}`);
  }
  process.exit(1);
}

console.log(
  'OK: no personality-tokens.scss / personality-effects.scss files found under libs/*/src/lib/styles/.'
);
