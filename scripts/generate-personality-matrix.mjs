#!/usr/bin/env node
/**
 * Generates the personality distinctiveness matrix Markdown section consumed
 * by `docs/design-system/personalities.md` (Workstream D1 of
 * `docs/plans/2026-07-14-theme-personality-distinctiveness.md`; extended by
 * Workstream D5 of `docs/plans/2026-07-18-personality-styles-refactor.md`
 * to also list the compared dimensions, including the shadow-profile,
 * page-background, and surface-character fields Phases 3/5/5b added).
 *
 * The matrix, summary, and dimensions list are computed directly from the
 * committed metric (`libs/theme-models/src/lib/personality-distinctiveness.ts`)
 * against the live personality registry
 * (`libs/theme-models/src/lib/personalities.ts`) and product mapping
 * (`libs/theme-models/src/lib/product-personalities.ts`), so the doc can
 * never silently drift from the code the way the old hand-maintained table
 * did.
 *
 * `.mjs` cannot `import` these `.ts` sources directly in this repo, so this
 * script shells out to the already-installed esbuild CLI to bundle each
 * source file to a temporary ESM file, then imports the bundles. The
 * distinctiveness thresholds are not hardcoded here — they are read straight
 * out of `personality-distinctiveness.spec.ts` (the enforcement test) via a
 * small regex, so this doc generator and the build-failing test can never
 * silently disagree. The dimensions list is read the same read-only way:
 * `personalityDistanceBreakdown()` (already exported by the metric module)
 * is called once and its `{id, weight}` entries are used directly — no new
 * export was added to theme-models just to support this generator.
 *
 * Usage:
 *   node scripts/generate-personality-matrix.mjs            # print Markdown to stdout
 *   node scripts/generate-personality-matrix.mjs --write     # regenerate the
 *     generated section of docs/design-system/personalities.md in place
 *   pnpm run docs:personalities                              # same as --write
 *
 * Re-run this whenever a personality definition changes. Re-running with
 * --write is idempotent: the only inputs are the committed registry/metric/
 * spec files, so the output is byte-identical across consecutive runs on the
 * same day (the "generated on" line is the only thing that can change, and
 * only across a calendar-day boundary).
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ESBUILD = join(REPO_ROOT, 'node_modules', '.bin', 'esbuild');
const DOC_PATH = join(REPO_ROOT, 'docs', 'design-system', 'personalities.md');
const SPEC_PATH = join(
  REPO_ROOT,
  'libs',
  'theme-models',
  'src',
  'lib',
  'personality-distinctiveness.spec.ts'
);

const GENERATED_START =
  '<!-- BEGIN GENERATED: personality-distinctiveness-matrix -->';
const GENERATED_END =
  '<!-- END GENERATED: personality-distinctiveness-matrix -->';

function bundle(relativeSourcePath, outDir) {
  const sourcePath = join(REPO_ROOT, relativeSourcePath);
  const outfile = join(
    outDir,
    relativeSourcePath.replace(/[\\/]/g, '_') + '.mjs'
  );
  execFileSync(
    ESBUILD,
    [
      sourcePath,
      '--bundle',
      '--format=esm',
      '--platform=node',
      `--outfile=${outfile}`,
    ],
    { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'inherit'] }
  );
  return outfile;
}

/** Pulls `NAME = <number>;` out of the enforcement spec so the doc and the
 * build-failing test can never quietly disagree on the threshold values. */
function readThresholdFromSpec(constName) {
  const source = readFileSync(SPEC_PATH, 'utf8');
  const match = new RegExp(`${constName}\\s*=\\s*([0-9.]+)`).exec(source);
  if (!match) {
    throw new Error(`Could not find ${constName} in ${SPEC_PATH}`);
  }
  return parseFloat(match[1]);
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function fmt(distance) {
  return distance.toFixed(4);
}

/**
 * A human-readable group label for a field-spec id, purely for grouping the
 * generated "dimensions compared" table into the same sections the metric's
 * own doc comment describes (color / typography / structure / animation /
 * presentation / color-generation+icon / surface). Falls back to the id's
 * first path segment if it doesn't match a known prefix.
 */
function dimensionGroup(id) {
  if (id.startsWith('colorHarmony.')) return 'Color';
  if (
    id.startsWith('tokens.typography') ||
    id.startsWith('fonts.') ||
    id === 'tokens.lineHeight' ||
    id === 'tokens.letterSpacing'
  ) {
    return 'Typography';
  }
  if (id.startsWith('tokens.')) return 'Structure / tokens';
  if (id.startsWith('animations.')) return 'Animation';
  if (id.startsWith('presentation.')) return 'Presentation';
  if (id === 'pageBackground.pattern') return 'Color generation + icon';
  if (id.startsWith('colorGeneration.surface')) return 'Surface character';
  if (id.startsWith('colorGeneration.') || id === 'iconStyle') {
    return 'Color generation + icon';
  }
  return id.split('.')[0];
}

/**
 * Builds the "Dimensions compared" Markdown table straight from the metric's
 * own field specs — read via `personalityDistanceBreakdown()` (the only
 * exported way to see `{id, weight}` pairs; `weight` is intrinsic to the
 * field spec, not the pair, so any two distinct personalities give the same
 * `{id, weight}` set back). New fields land here automatically the next time
 * this script runs — nothing about a new dimension needs to be hand-typed
 * into this generator OR the doc.
 */
function buildDimensionsMarkdown(breakdown) {
  const rows = [...breakdown]
    .sort((a, b) => b.weight - a.weight)
    .map(
      (field) =>
        `| ${dimensionGroup(field.id)} | \`${
          field.id
        }\` | ${field.weight.toFixed(3)} |`
    );
  const totalWeight = breakdown.reduce((sum, f) => sum + f.weight, 0);
  return [
    '| Group | Field | Weight |',
    '| --- | --- | --- |',
    ...rows,
    '',
    `Weights sum to ${totalWeight.toFixed(
      2
    )} (normalized by the actual sum, not required to equal exactly 1 — see \`personality-distinctiveness.ts\`'s module doc comment). Categorical fields (marked with a single distinct/non-distinct outcome — e.g. \`tokens.shadowProfile\`, \`colorGeneration.surfaceHueBias\`, \`pageBackground.pattern\`) count as a full unit of difference when they differ; numeric fields are normalized against a perceptual just-noticeable-difference scale, not their raw numeric range.`,
  ].join('\n');
}

function buildMatrixMarkdown(personalities, allPairDistances) {
  const distanceByPair = new Map();
  for (const { a, b, distance } of allPairDistances) {
    distanceByPair.set(`${a.id}|${b.id}`, distance);
    distanceByPair.set(`${b.id}|${a.id}`, distance);
  }

  const ids = personalities.map((p) => p.id);
  const header = `| Personality | ${ids
    .map((id) => `\`${id}\``)
    .join(' | ')} |`;
  const divider = `| --- | ${ids.map(() => '---').join(' | ')} |`;
  const rows = ids.map((rowId, rowIndex) => {
    const cells = ids.map((colId, colIndex) => {
      if (colIndex === rowIndex) return '—';
      if (colIndex > rowIndex) return '';
      const distance = distanceByPair.get(`${rowId}|${colId}`);
      return distance === undefined ? '' : distance.toFixed(3);
    });
    return `| \`${rowId}\` | ${cells.join(' | ')} |`;
  });

  return [header, divider, ...rows].join('\n');
}

async function main() {
  const write = process.argv.includes('--write');

  const outDir = mkdtempSync(join(tmpdir(), 'personality-matrix-'));
  try {
    const personalitiesBundle = bundle(
      'libs/theme-models/src/lib/personalities.ts',
      outDir
    );
    const distinctivenessBundle = bundle(
      'libs/theme-models/src/lib/personality-distinctiveness.ts',
      outDir
    );
    const productPersonalitiesBundle = bundle(
      'libs/theme-models/src/lib/product-personalities.ts',
      outDir
    );

    const { PREDEFINED_PERSONALITIES } = await import(
      pathToFileURL(personalitiesBundle).href
    );
    const {
      allPairDistances,
      closestPair,
      minPairDistance,
      personalityDistanceBreakdown,
    } = await import(pathToFileURL(distinctivenessBundle).href);
    const { PRODUCT_PERSONALITIES } = await import(
      pathToFileURL(productPersonalitiesBundle).href
    );

    const DISTINCTIVENESS_THRESHOLD = readThresholdFromSpec(
      'DISTINCTIVENESS_THRESHOLD'
    );
    const PRODUCT_DISTINCTIVENESS_THRESHOLD = readThresholdFromSpec(
      'PRODUCT_DISTINCTIVENESS_THRESHOLD'
    );

    const pairs = allPairDistances(PREDEFINED_PERSONALITIES);
    const meanDistance = mean(pairs.map((p) => p.distance));
    const globalClosest = closestPair(PREDEFINED_PERSONALITIES);

    const productIds = new Set(Object.values(PRODUCT_PERSONALITIES));
    const productPersonalities = PREDEFINED_PERSONALITIES.filter((p) =>
      productIds.has(p.id)
    );
    const productClosest = closestPair(productPersonalities);
    const productMin = minPairDistance(productPersonalities);

    const generatedAt = new Date().toISOString().slice(0, 10);

    const matrixTable = buildMatrixMarkdown(PREDEFINED_PERSONALITIES, pairs);
    // `weight` is intrinsic to each field spec, not to the pair compared, so
    // any two distinct personalities yield the same {id, weight} set.
    const dimensionsBreakdown = personalityDistanceBreakdown(
      PREDEFINED_PERSONALITIES[0],
      PREDEFINED_PERSONALITIES[1]
    );
    const dimensionsTable = buildDimensionsMarkdown(dimensionsBreakdown);

    const summary = [
      `- **Personalities compared:** ${PREDEFINED_PERSONALITIES.length} (all of \`PREDEFINED_PERSONALITIES\`)`,
      `- **Mean pairwise distance:** ${fmt(meanDistance)}`,
      `- **Global closest pair:** \`${globalClosest.a.id}\` vs \`${
        globalClosest.b.id
      }\` — ${fmt(globalClosest.distance)}`,
      `- **Product-set closest pair** (${[...productIds]
        .sort()
        .join(', ')}): \`${productClosest.a.id}\` vs \`${
        productClosest.b.id
      }\` — ${fmt(productClosest.distance)}`,
      `- **\`DISTINCTIVENESS_THRESHOLD\`:** ${DISTINCTIVENESS_THRESHOLD} (global closest pair clears it: ${
        globalClosest.distance >= DISTINCTIVENESS_THRESHOLD
          ? 'yes'
          : 'NO — regression!'
      })`,
      `- **\`PRODUCT_DISTINCTIVENESS_THRESHOLD\`:** ${PRODUCT_DISTINCTIVENESS_THRESHOLD} (product-set floor clears it: ${
        productMin >= PRODUCT_DISTINCTIVENESS_THRESHOLD
          ? 'yes'
          : 'NO — regression!'
      })`,
    ].join('\n');

    const section = [
      GENERATED_START,
      `<!-- Generated by \`scripts/generate-personality-matrix.mjs\` on ${generatedAt}. -->`,
      `<!-- Do not edit this section by hand — run \`node scripts/generate-personality-matrix.mjs --write\` to regenerate it. -->`,
      '',
      '#### Summary',
      '',
      summary,
      '',
      '#### Pairwise perceptual distance (lower triangle; 0 = identical, 1 = maximally different)',
      '',
      matrixTable,
      '',
      '#### Dimensions compared',
      '',
      dimensionsTable,
      '',
      GENERATED_END,
    ].join('\n');

    if (!write) {
      process.stdout.write(section + '\n');
      return;
    }

    if (!existsSync(DOC_PATH)) {
      throw new Error(`Doc not found: ${DOC_PATH}`);
    }
    const doc = readFileSync(DOC_PATH, 'utf8');
    const startIndex = doc.indexOf(GENERATED_START);
    const endIndex = doc.indexOf(GENERATED_END);
    if (startIndex === -1 || endIndex === -1) {
      throw new Error(
        `Could not find ${GENERATED_START} / ${GENERATED_END} markers in ${DOC_PATH}. ` +
          'Add them once, then re-run with --write.'
      );
    }
    const before = doc.slice(0, startIndex);
    const after = doc.slice(endIndex + GENERATED_END.length);
    const updated = `${before}${section}${after}`;
    writeFileSync(DOC_PATH, updated);
    process.stdout.write(`Updated ${DOC_PATH}\n`);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
