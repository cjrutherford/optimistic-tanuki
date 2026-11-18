#!/usr/bin/env node
// Operator action (S10): install the researched Census boundaries as owner-locked town geometry.
//
// Reads docs/plans/town-square-directory/s10-evidence/s10-locked-boundaries.json, takes each town's polygon from the
// pinned Census TIGER archive (digest checked against the pins and the manifest, same reader the reviewed install
// uses), validates it (valid polygon, SRID 4326, area band, geometry and evidence hashes) and installs it with a lock
// the geometry sweep, the register re-reconcile and the recovery resets never override. Idempotent: a town already
// locked with the same evidence is reported "unchanged". Every install bumps the town's geometry version, so the
// refresh rule refills the town.
//
// Run through ts-node (the directory sources are TypeScript):
//   DIRECTORY_REVIEW_DATABASE_URL=postgres://...@127.0.0.1:PORT/ot_directory \
//   TS_NODE_PROJECT=apps/directory/tsconfig.json node -r ts-node/register/transpile-only -r tsconfig-paths/register \
//     scripts/local-directory-locked-boundaries.cjs [--dry-run] [--archive-dir <dir>] [--manifest <file>] [--town <name>]...
// --dry-run runs every check, including the database checks, and writes nothing.
// Only a local ot_directory database (or a disposable s10_geom_* one) is accepted.
const { readFileSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { tmpdir } = require('node:os');
const { parseArgs } = require('node:util');
const { DataSource } = require('typeorm');
const {
  installLockedBoundary,
} = require('../apps/directory/src/locked-boundary');
const {
  assertOwnerApprovalForEntity,
} = require('../apps/directory/src/locked-boundary-manifest');
const {
  CENSUS_TIGER_PINS,
  CENSUS_TIGER_VINTAGE,
} = require('../apps/directory/src/census-tiger-pins');
const {
  CensusArchiveStore,
  SpatialSession,
} = require('../apps/directory-worker/src/geometry-sweep');

const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!databaseUrl) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
const parsed = new URL(databaseUrl);
if (
  !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
  !(
    parsed.pathname === '/ot_directory' ||
    /^\/s10_geom_[a-z0-9_]+$/.test(parsed.pathname)
  )
)
  throw Error(
    'Only the local ot_directory database or a disposable s10_geom_* one is allowed'
  );

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'archive-dir': { type: 'string' },
    manifest: { type: 'string' },
    town: { type: 'string', multiple: true, default: [] },
  },
});
const dryRun = values['dry-run'];
const manifestPath = resolve(
  values.manifest ??
    'docs/plans/town-square-directory/s10-evidence/s10-locked-boundaries.json'
);
const archiveDir = resolve(
  values['archive-dir'] ??
    process.env.DIRECTORY_AUTO_GEOMETRY_CACHE_DIR ??
    join(tmpdir(), 'directory-census')
);
const only = values.town;

function checkEntry(e) {
  assertOwnerApprovalForEntity(e);
  const pin = CENSUS_TIGER_PINS[e.stateFips]?.[e.layer];
  if (!pin || pin !== e.archiveSha256)
    throw Error('Manifest archive digest is not the pinned Census digest');
  if (e.vintage !== CENSUS_TIGER_VINTAGE)
    throw Error('Unsupported TIGER vintage');
  if (
    e.sourceUrl !==
    `https://www2.census.gov/geo/tiger/TIGER${
      e.vintage
    }/${e.layer.toUpperCase()}/tl_${e.vintage}_${e.stateFips}_${e.layer}.zip`
  )
    throw Error('Manifest source URL is not the pinned Census archive');
  if (
    !Array.isArray(e.censusPoint) ||
    e.censusPoint.length !== 2 ||
    e.censusPointInside !== true
  )
    throw Error('Manifest needs a Census point inside the entity');
}

(async () => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (!Array.isArray(manifest.locked)) throw Error('Manifest has no locked[]');
  const entries = manifest.locked.filter(
    (e) => !only.length || only.includes(e.townName)
  );
  if (only.length && entries.length !== only.length)
    throw Error('A --town name is not in the manifest');
  const reader = require('../scripts/census-boundary-reader.mjs');
  const store = new CensusArchiveStore(archiveDir);
  const spatial = new SpatialSession();
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  const report = [];
  let failed = 0;
  try {
    for (const e of entries) {
      try {
        checkEntry(e);
        const archive = await store.ensure(e.stateFips, e.layer);
        if (archive.sha256 !== e.archiveSha256)
          throw Error('Archive digest differs from the manifest');
        const candidate = await reader.readCensusBoundaryCandidate({
          connection: await spatial.connection(),
          archivePath: archive.path,
          archiveBytes: archive.bytes,
          archiveSha256: archive.sha256,
          vintage: e.vintage,
          stateFips: e.stateFips,
          layer: e.layer,
          geoid: e.geoid,
          referencePoint: e.censusPoint,
        });
        if (candidate.name !== e.censusName || candidate.lsad !== e.lsad)
          throw Error('Census entity name or type differs from the manifest');
        const result = await installLockedBoundary(
          db,
          {
            communityId: e.communityId,
            expectedName: e.townName,
            geoid: e.geoid,
            layer: e.layer,
            vintage: e.vintage,
            stateFips: e.stateFips,
            archiveSha256: e.archiveSha256,
            sourceUrl: e.sourceUrl,
            geometry: candidate.geometry,
            areaSqKm: e.areaSqKm,
            evidence: {
              entityType: e.entityType,
              lsad: e.lsad,
              censusName: e.censusName,
              censusPoint: e.censusPoint,
              socialReferencePoint: e.socialReferencePoint,
              socialPointInside: e.socialPointInside,
              socialPointDistanceMeters: e.socialPointDistanceMeters,
              rationale: e.rationale,
              ...(e.ownerDecision ? { ownerDecision: e.ownerDecision } : {}),
            },
          },
          { dryRun }
        );
        report.push({ town: e.townName, geoid: e.geoid, ...result });
      } catch (error) {
        failed++;
        report.push({
          town: e.townName,
          status: 'failed',
          error: error.message,
        });
      }
    }
  } finally {
    spatial.close();
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
