#!/usr/bin/env node
/**
 * Backfill `directory_town_scan_target` for scans that completed before targets were recorded.
 *
 *   --check (default)                          print counts as JSON; writes nothing
 *   --apply --confirm-database <name>          insert the missing rows; <name> must equal the database in
 *                                              DIRECTORY_DATABASE_URL
 *
 * For every scan with a completion row, each distinct uuid-shaped regionId among its rows becomes a target
 * (completedAt NULL, rowCount = that scan's rows for the region, provenance 'backfill-rows'). A region that
 * produced no rows leaves no trace in the data, so it cannot be inferred here; its town reads as unknown until a
 * new scan records it. A NULL completedAt on a backfill row still means complete: the completion row is the proof.
 * Existing targets are never changed (ON CONFLICT DO NOTHING).
 */
const { DataSource } = require('typeorm');

const UUID = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const SOURCE = `SELECT lower(r."regionId")::uuid AS "communityId", r."scanId", count(*)::int AS "rowCount"
  FROM directory_overture_private_row r
  JOIN directory_overture_private_completion c ON c."scanId"=r."scanId"
  WHERE r."regionId" ~* '${UUID}'
  GROUP BY 1, 2`;

const databaseName = (url) =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
const option = (argv, name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};

async function counts(db) {
  const [{ present }] = await db.query(
    `SELECT to_regclass('public.directory_town_scan_target') IS NOT NULL AS present`
  );
  const existing = present
    ? `(SELECT count(*)::int FROM s WHERE NOT EXISTS (SELECT 1 FROM directory_town_scan_target t WHERE t."communityId"=s."communityId" AND t."scanId"=s."scanId"))`
    : `(SELECT count(*)::int FROM s)`;
  const [row] = await db.query(
    `WITH s AS (${SOURCE})
     SELECT (SELECT count(*)::int FROM directory_overture_private_completion) AS "completedScans",
       (SELECT count(DISTINCT "scanId")::int FROM s) AS "scansWithTargets",
       (SELECT count(*)::int FROM s) AS "candidateTargets",
       ${existing} AS "missingTargets",
       (SELECT count(DISTINCT "communityId")::int FROM s) AS towns,
       ${
         present
           ? '(SELECT count(*)::int FROM directory_town_scan_target)'
           : '0'
       } AS "existingTargets"`
  );
  return { tablePresent: present, ...row };
}

async function backfill(db, { apply = false } = {}) {
  const before = await counts(db);
  if (apply && !before.tablePresent)
    throw Error(
      'directory_town_scan_target does not exist; run migrations first'
    );
  if (!apply) return { mode: 'check', ...before };
  const inserted = await db.transaction(async (manager) => {
    const rows = await manager.query(
      `INSERT INTO directory_town_scan_target ("communityId","scanId","completedAt","rowCount",provenance)
       SELECT "communityId","scanId",NULL,"rowCount",'backfill-rows' FROM (${SOURCE}) s
       ON CONFLICT DO NOTHING RETURNING "scanId"`
    );
    return rows.length;
  });
  return { mode: 'apply', ...before, inserted };
}

async function main(argv) {
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const apply = argv.includes('--apply');
  if (apply && argv.includes('--check'))
    throw Error('--check and --apply are exclusive');
  if (apply && option(argv, '--confirm-database') !== databaseName(url))
    throw Error(
      '--apply requires --confirm-database <name> matching the target database'
    );
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    console.log(
      JSON.stringify({
        database: databaseName(url),
        ...(await backfill(db, { apply })),
      })
    );
  } finally {
    await db.destroy();
  }
}

module.exports = { backfill };
if (require.main === module)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
