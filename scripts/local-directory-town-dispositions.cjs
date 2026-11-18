#!/usr/bin/env node
// Operator action (S10 D19-D26): record the owner's town merges and retire the blank-name town.
//
// Reads merges[] and retire[] from docs/plans/town-square-directory/s10-evidence/s10-locked-boundaries.json.
// - merge: sets directory_town.mergedIntoCommunityId on the absorbed town. Refuses a town Social still reports
//   eligible (retire it in Social first: seed the Social communities, let the register reconcile), and refuses a
//   target that is missing, ineligible or itself merged. The target is found by community id and must carry the
//   manifest slug; where the manifest has no id (Edisto Beach, created by the Social seed) it is found by slug.
// - retire: deletes the blank-name ineligible town when no other table holds rows for it; otherwise keeps it and
//   reports which tables do.
// Idempotent: repeat runs report "unchanged" / "absent". --dry-run runs every check and writes nothing.
//
//   DIRECTORY_REVIEW_DATABASE_URL=postgres://...@127.0.0.1:PORT/ot_directory \
//   TS_NODE_PROJECT=apps/directory/tsconfig.json node -r ts-node/register/transpile-only -r tsconfig-paths/register \
//     scripts/local-directory-town-dispositions.cjs [--dry-run] [--manifest <file>]
// Only a local ot_directory database (or a disposable s10_geom_* one) is accepted.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parseArgs } = require('node:util');
const { DataSource } = require('typeorm');
const {
  mergeTownInto,
  retireBlankTown,
} = require('../apps/directory/src/town-merge');

const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!databaseUrl) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
const parsed = new URL(databaseUrl);
if (
  !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
  !(
    parsed.pathname === '/ot_directory' ||
    /^\/s10_geom_[a-z0-9_]+$/.test(parsed.pathname) ||
    /^\/directory_test_[a-f0-9]{32}$/.test(parsed.pathname)
  )
)
  throw Error(
    'Only the local ot_directory database or a disposable one is allowed'
  );

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    manifest: { type: 'string' },
  },
});
const dryRun = values['dry-run'];
const manifestPath = resolve(
  values.manifest ??
    'docs/plans/town-square-directory/s10-evidence/s10-locked-boundaries.json'
);

async function resolveTarget(db, into) {
  if (into.communityId) {
    const [row] = await db.query(
      'SELECT "communityId",slug FROM directory_town WHERE "communityId"=$1',
      [into.communityId]
    );
    if (!row) throw Error(`Merge target ${into.townName} is not registered`);
    if (row.slug !== into.slug)
      throw Error(`Merge target ${into.townName} has an unexpected slug`);
    return row.communityId;
  }
  const rows = await db.query(
    'SELECT "communityId" FROM directory_town WHERE slug=$1',
    [into.slug]
  );
  if (rows.length !== 1)
    throw Error(
      `Merge target ${into.townName} is not registered yet; seed Social and let the register reconcile first`
    );
  return rows[0].communityId;
}

(async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.merges) || !Array.isArray(manifest.retire))
    throw Error('Manifest needs merges[] and retire[]');
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  const report = [];
  let failed = 0;
  try {
    for (const m of manifest.merges) {
      try {
        const intoCommunityId = await resolveTarget(db, m.into);
        const result = await mergeTownInto(
          db,
          { communityId: m.communityId, intoCommunityId },
          { dryRun }
        );
        report.push({
          action: 'merge',
          decision: m.decision,
          town: m.townName,
          into: m.into.townName,
          ...result,
        });
      } catch (error) {
        failed++;
        report.push({
          action: 'merge',
          decision: m.decision,
          town: m.townName,
          status: 'failed',
          error: error.message,
        });
      }
    }
    for (const r of manifest.retire) {
      try {
        const result = await retireBlankTown(
          db,
          { communityId: r.communityId },
          { dryRun }
        );
        report.push({
          action: 'retire',
          decision: r.decision,
          town: r.townName,
          ...result,
        });
      } catch (error) {
        failed++;
        report.push({
          action: 'retire',
          decision: r.decision,
          town: r.townName,
          status: 'failed',
          error: error.message,
        });
      }
    }
  } finally {
    await db.destroy();
  }
  console.log(
    JSON.stringify({ mode: dryRun ? 'dry-run' : 'applied', failed, report })
  );
  if (failed) process.exitCode = 1;
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
