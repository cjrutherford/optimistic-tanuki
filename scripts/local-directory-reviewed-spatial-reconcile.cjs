#!/usr/bin/env node
/**
 * Reports on, and rebuilds, the reviewed-address candidate index
 * (`directory_reviewed_spatial`) that bounds search reads.
 *
 * The index is never authority: every bounds request re-checks the live binding,
 * lease, policy, revocation, content digest and assignment. A stale or extra row
 * therefore cannot disclose anything; a missing row only hides a listing from the
 * map. This command measures and repairs both, and records when a full rebuild
 * completed so readiness can refuse bounds requests until it has.
 *
 * Dry-run (--check) by default and read-only. Writing needs --apply and
 * --confirm-database <name>, where <name> must equal the database in
 * DIRECTORY_DATABASE_URL, so a wrong URL cannot be written to by accident.
 *
 * It never changes a binding, a listing, a lease or an assignment token, and
 * never creates rows for bindings that are not active. Active bindings whose
 * listing has no current assignment token are reported, never repaired.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only \
 *     scripts/local-directory-reviewed-spatial-reconcile.cjs [--check | --apply --confirm-database <name>]
 */
const { DataSource } = require('typeorm');
const {
  REVIEWED_SPATIAL_VALIDATOR_VERSION,
  SpatialProjectionConflict,
  measureSpatialDrift,
  projectBinding,
  readSpatialState,
} = require('../apps/directory/src/reviewed-spatial');

const BATCH = 500;
const PASSES = 5;

/** Active bindings whose index row is absent, of another version, or describes other content. */
const NEEDS_WORK = `SELECT b."id" FROM "directory_reviewed_binding" b
  JOIN "directory_overture_private_row" r ON r."scanId"=b."scanId" AND r."sourceFileRowNumber"=b."sourceFileRowNumber" AND r."regionId"=b."communityId"::text
  WHERE b."state"='active' AND b."id">$1::uuid
    AND NOT EXISTS (SELECT 1 FROM "directory_reviewed_spatial" p WHERE p."bindingId"=b."id" AND p."validatorVersion"=$2 AND p."listingDigest"=md5(r.listing::text))
  ORDER BY b."id" LIMIT ${BATCH}`;

const NIL = '00000000-0000-0000-0000-000000000000';

/** Counts, and with apply repairs, the projection. Safe to repeat. `hooks.afterBatch` exists for tests. */
async function reconcile(db, { apply = false, hooks = {} } = {}) {
  const version = REVIEWED_SPATIAL_VALIDATOR_VERSION;
  const before = await measureSpatialDrift(db, version);
  if (!apply) return { apply, version, ...before, projected: 0, deleted: 0, locked: 0, conflicts: 0, completed: false };

  await db.query(
    `INSERT INTO "directory_reviewed_spatial_state" ("id","validatorVersion","rebuildStartedAt","rebuildCompletedAt")
     VALUES ('current',$1,CURRENT_TIMESTAMP,NULL)
     ON CONFLICT ("id") DO UPDATE SET "validatorVersion"=EXCLUDED."validatorVersion","rebuildStartedAt"=CURRENT_TIMESTAMP,"rebuildCompletedAt"=NULL`,
    [version]
  );

  let projected = 0, deleted = 0, locked = 0, conflicts = 0;
  for (let pass = 0; pass < PASSES; pass += 1) {
    locked = 0; conflicts = 0;
    let last = NIL;
    for (;;) {
      const ids = (await db.query(NEEDS_WORK, [last, version])).map((row) => row.id);
      if (!ids.length) break;
      last = ids[ids.length - 1];
      await db.transaction(async (manager) => {
        const held = await manager.query(
          `SELECT "id","scanId","sourceFileRowNumber","communityId" FROM "directory_reviewed_binding"
           WHERE "id"=ANY($1::uuid[]) AND "state"='active' ORDER BY "id" FOR UPDATE SKIP LOCKED`,
          [ids]
        );
        const [{ stillActive }] = await manager.query(
          `SELECT count(*)::int AS "stillActive" FROM "directory_reviewed_binding" WHERE "id"=ANY($1::uuid[]) AND "state"='active'`,
          [ids]
        );
        locked += stillActive - held.length;
        for (const binding of held) {
          try {
            await manager.query('SAVEPOINT spatial_one');
            await projectBinding(manager, binding);
            await manager.query('RELEASE SAVEPOINT spatial_one');
            projected += 1;
          } catch (error) {
            if (!(error instanceof SpatialProjectionConflict)) throw error;
            await manager.query('ROLLBACK TO SAVEPOINT spatial_one');
            conflicts += 1;
          }
        }
      });
      if (hooks.afterBatch) await hooks.afterBatch({ pass, last });
    }
    if (locked === 0) break;
  }

  // Extra rows: no active binding of the same row, or no live row at all.
  for (;;) {
    const gone = await db.query(
      `WITH doomed AS (
         SELECT p."scanId",p."sourceFileRowNumber" FROM "directory_reviewed_spatial" p
         WHERE NOT EXISTS (SELECT 1 FROM "directory_reviewed_binding" b WHERE b."id"=p."bindingId" AND b."state"='active' AND b."scanId"=p."scanId" AND b."sourceFileRowNumber"=p."sourceFileRowNumber")
            OR NOT EXISTS (SELECT 1 FROM "directory_overture_private_row" r WHERE r."scanId"=p."scanId" AND r."sourceFileRowNumber"=p."sourceFileRowNumber")
         LIMIT ${BATCH}),
       removed AS (
         DELETE FROM "directory_reviewed_spatial" p USING doomed d
         WHERE p."scanId"=d."scanId" AND p."sourceFileRowNumber"=d."sourceFileRowNumber" RETURNING 1)
       SELECT count(*)::int AS n FROM removed`
    );
    deleted += gone[0].n;
    if (gone[0].n === 0) break;
  }

  const after = await measureSpatialDrift(db, version);
  const completed = locked === 0 && conflicts === 0;
  await db.query(
    `UPDATE "directory_reviewed_spatial_state" SET "validatorVersion"=$1,"reconciledAt"=CURRENT_TIMESTAMP,
       "missing"=$2,"stale"=$3,"orphaned"=$4,"rebuildCompletedAt"=CASE WHEN $5::boolean THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE "id"='current'`,
    [version, after.missing, after.stale, after.orphaned, completed]
  );
  return { apply, version, ...after, before, projected, deleted, locked, conflicts, completed };
}

function databaseName(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

async function main(argv) {
  const url = process.env.DIRECTORY_DATABASE_URL || process.env.DIRECTORY_REVIEW_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const apply = argv.includes('--apply');
  if (apply && argv.includes('--check')) throw Error('--check and --apply are exclusive');
  const at = argv.indexOf('--confirm-database');
  const confirmed = at >= 0 ? argv[at + 1] : undefined;
  if (apply && confirmed !== databaseName(url)) {
    throw Error('--apply requires --confirm-database <name> matching the target database');
  }
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    const result = await reconcile(db, { apply });
    const state = await readSpatialState(db);
    console.log(JSON.stringify({ database: databaseName(url), ...result, state }));
    if (apply && !result.completed) process.exitCode = 2;
  } finally {
    await db.destroy();
  }
}

module.exports = { reconcile };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'spatial reconcile failed');
    process.exit(1);
  });
}
