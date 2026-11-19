#!/usr/bin/env node
/*
 * Re-normalise staged Directory listings after a NORMALIZER_VERSION bump, without re-acquiring anything (D27).
 *
 *   DIRECTORY_DATABASE_URL=... node -r ts-node/register/transpile-only -r tsconfig-paths/register \
 *     scripts/directory-renormalize.cjs [--dry-run] [--scan <scanId>] [--limit <scans>]
 *
 * Idempotent: rows already on the current version are not touched and a second run changes nothing. With --dry-run
 * nothing is written; the report shows what a real run would update. Needs TS_NODE_PROJECT=apps/directory/tsconfig.json.
 */
const { DataSource } = require('typeorm');
const {
  renormalizePending,
  renormalizeScan,
} = require('../apps/directory/src/renormalize.ts');
const { NORMALIZER_VERSION } = require('../apps/directory/src/normalize.ts');

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const limit = arg('--limit') ? Number(arg('--limit')) : 100;
  if (!Number.isSafeInteger(limit) || limit < 1) throw Error('Invalid --limit');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    const scan = arg('--scan');
    const results = scan
      ? [await renormalizeScan(db, scan, { dryRun })]
      : await renormalizePending(db, { dryRun, limit });
    const total = results.reduce(
      (t, r) => ({
        scanned: t.scanned + r.scanned,
        updated: t.updated + r.updated,
        skipped: t.skipped + r.skipped,
      }),
      { scanned: 0, updated: 0, skipped: 0 }
    );
    console.log(
      JSON.stringify({
        version: NORMALIZER_VERSION,
        dryRun,
        scans: results.length,
        ...total,
      })
    );
  } finally {
    await db.destroy();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Failed');
  process.exitCode = 1;
});
