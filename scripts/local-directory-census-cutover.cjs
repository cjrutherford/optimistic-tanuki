/**
 * Local Census cohort cutover: append the re-staged cohort and retire the previous census cohort in ONE live
 * transaction, so a town never shows two active private rows for the same business.
 *
 * The append is `local-directory-census-append.cjs` (reused through its beforeCommit hook). The retirement is
 * row-scoped, not a policy revoke, so a held town keeps its old-cohort rows: every old row outside a held town
 * gets a `directory_overture_private_row_revocation` and loses its reviewed-spatial projection row. The old
 * policy stays unrevoked, and the held town's old rows stay the single active rows for that town.
 *
 *   --inspect-local (default)  read-only plan: counts per town, drops over 10%, held towns
 *   --apply-local              append + retire in one transaction
 * Env: DIRECTORY_LOCAL_EVALUATION=true, LOCAL_DIRECTORY_DATABASE_URL, LOCAL_STAGE_DATABASE_URL.
 */
const { DataSource } = require('typeorm');
const { main: append } = require('./local-directory-census-append.cjs');

// Owner decision 2026-11-20: 05243ac4 got no rows in the re-stage; keep its old rows active.
const HELD_REGIONS = new Set(['05243ac4-9ac1-4f8a-9bf7-ab902331c8bc']);

/** Retire every old-cohort row outside the held towns. Runs inside the caller's live transaction. */
async function retireOldCohort(q, { oldPolicyId, newPolicyId, held }) {
  const heldIds = [...held];
  const scans = (
    await q.query(
      'SELECT "scanId" FROM directory_overture_private_membership WHERE "policyId"=$1 ORDER BY "scanId"',
      [oldPolicyId]
    )
  ).map((r) => r.scanId);
  if (!scans.length) throw Error('Old cohort has no scans');
  const target = await q.query(
    'SELECT 1 FROM directory_overture_private_membership WHERE "policyId"=$1 LIMIT 1',
    [newPolicyId]
  );
  if (!target.length) throw Error('New cohort is not imported');
  await q.query(
    'SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=ANY($1::text[]) ORDER BY "scanId" FOR UPDATE',
    [scans]
  );
  const revoked = await q.query(
    `INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber")
     SELECT r."scanId",r."sourceFileRowNumber" FROM directory_overture_private_row r
      WHERE r."scanId"=ANY($1::text[]) AND (r."regionId" IS NULL OR r."regionId"<>ALL($2::text[]))
     ON CONFLICT DO NOTHING RETURNING 1`,
    [scans, heldIds]
  );
  const unprojected = await q.query(
    `DELETE FROM directory_reviewed_spatial s WHERE s."scanId"=ANY($1::text[])
       AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=s."scanId"
         AND r."sourceFileRowNumber"=s."sourceFileRowNumber" AND r."regionId"=ANY($2::text[])) RETURNING 1`,
    [scans, heldIds]
  );
  return {
    scans: scans.length,
    revoked: revoked.length,
    unprojected: unprojected.length,
  };
}

/** Names holding more than one non-revoked private row at one point within the census cohorts (the invariant after cutover). */
async function duplicateActiveRows(q, policyIds) {
  return q.query(
    `SELECT r."regionId", btrim(r.listing->>'name') AS name, count(*)::int AS n
       FROM directory_overture_private_row r
       JOIN directory_overture_private_membership m ON m."scanId"=r."scanId"
       JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
       JOIN directory_overture_private_completion c ON c."scanId"=r."scanId"
      WHERE r."regionId" IS NOT NULL AND m."policyId"=ANY($1::text[])
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId")
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
      GROUP BY 1,2,r.listing->'location' HAVING count(*)>1`,
    [policyIds]
  );
}

async function run(mode) {
  const oldPolicyId = process.env.CENSUS_OLD_POLICY_ID;
  if (!/^[a-f0-9]{64}$/.test(oldPolicyId || ''))
    throw Error('CENSUS_OLD_POLICY_ID (64 hex) is required');
  if (mode === '--inspect-local') {
    await append('--inspect-local');
    const live = new DataSource({
      type: 'postgres',
      url: process.env.LOCAL_DIRECTORY_DATABASE_URL,
    });
    await live.initialize();
    try {
      const [o] = await live.query(
        `SELECT count(DISTINCT m."scanId")::int AS scans,
           count(*) FILTER (WHERE r."regionId" IS NOT NULL)::int AS rows,
           count(*) FILTER (WHERE r."regionId"=ANY($2::text[]))::int AS held
         FROM directory_overture_private_membership m
         LEFT JOIN directory_overture_private_row r ON r."scanId"=m."scanId"
        WHERE m."policyId"=$1`,
        [oldPolicyId, [...HELD_REGIONS]]
      );
      console.log(
        JSON.stringify({
          oldPolicy: { scans: o.scans, rows: o.rows, heldRowsKept: o.held },
          held: [...HELD_REGIONS],
          duplicateActiveNow: (await duplicateActiveRows(live, [oldPolicyId]))
            .length,
        })
      );
    } finally {
      await live.destroy();
    }
    return;
  }
  await append('--apply-local', {
    skipRegions: HELD_REGIONS,
    beforeCommit: async (lr, { policyId }) => {
      const result = await retireOldCohort(lr, {
        oldPolicyId,
        newPolicyId: policyId,
        held: HELD_REGIONS,
      });
      const dupes = await duplicateActiveRows(lr, [oldPolicyId, policyId]);
      if (dupes.length)
        throw Error(
          `Cutover would leave ${dupes.length} duplicate active private rows`
        );
      console.log(JSON.stringify({ retired: result }));
    },
  });
}

module.exports = { retireOldCohort, duplicateActiveRows, HELD_REGIONS };
if (require.main === module)
  run(process.argv[2] || '--inspect-local').catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
