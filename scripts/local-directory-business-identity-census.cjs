#!/usr/bin/env node
/**
 * Read-only census for the cross-release business identity work (S5 item 1).
 *
 * Counts what exists today: imported rows and cohorts, listing identities with
 * and without a surviving row, link requests, bindings and candidates. It never
 * writes: every query runs in one READ ONLY transaction, and the only mode is
 * --check. The output is counts only; no name, address, id or credential.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... node scripts/local-directory-business-identity-census.cjs --check
 */
const { DataSource } = require('typeorm');

const one = async (manager, sql) => (await manager.query(sql))[0];
const grouped = async (manager, column, table, where = 'true') => {
  const out = {};
  for (const row of await manager.query(`SELECT ${column} AS k, count(*)::int AS n FROM ${table} WHERE ${where} GROUP BY 1 ORDER BY 1`)) out[String(row.k)] = row.n;
  return out;
};

/** Runs every census query inside one read-only transaction. */
async function census(db) {
  return db.transaction('REPEATABLE READ', async (manager) => {
    await manager.query('SET TRANSACTION READ ONLY');
    const hasSourceKey = (await one(manager, `SELECT to_regclass('directory_overture_source_key') IS NOT NULL AS present`)).present;
    const cohorts = await manager.query(
      `SELECT m."policyId" AS "policyId", coalesce(p.revoked,false) AS revoked,
              count(DISTINCT m."scanId")::int AS scans,
              count(DISTINCT c."scanId")::int AS "completedScans",
              count(r."scanId")::int AS rows,
              count(r."scanId") FILTER (WHERE r.listing IS NOT NULL)::int AS "eligibleRows",
              count(DISTINCT r."regionId")::int AS towns
         FROM directory_overture_private_membership m
         LEFT JOIN directory_overture_private_policy p ON p."policyId"=m."policyId"
         LEFT JOIN directory_overture_private_completion c ON c."scanId"=m."scanId"
         LEFT JOIN directory_overture_private_row r ON r."scanId"=m."scanId"
        GROUP BY m."policyId", p.revoked ORDER BY m."policyId"`
    );
    const rows = await one(manager,
      `SELECT count(*)::int AS total, count(*) FILTER (WHERE listing IS NOT NULL)::int AS eligible,
              count(*) FILTER (WHERE listing IS NULL)::int AS quarantined,
              (SELECT count(*)::int FROM directory_overture_private_row_revocation) AS "withdrawnRows",
              (SELECT count(*)::int FROM directory_overture_private_completion) AS "completedScans",
              (SELECT count(*)::int FROM directory_overture_private_membership) AS scans
         FROM directory_overture_private_row`);
    const repeatedKeys = await one(manager,
      `SELECT count(*)::int AS n FROM (
         SELECT r."regionId", r."sourceFileRowNumber" FROM directory_overture_private_row r
           JOIN directory_overture_private_completion c ON c."scanId"=r."scanId"
          GROUP BY 1,2 HAVING count(DISTINCT r."scanId") > 1) x`);
    const identities = await one(manager,
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=i."scanId" AND r."sourceFileRowNumber"=i."sourceFileRowNumber"))::int AS "withRow",
              count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=i."scanId" AND r."sourceFileRowNumber"=i."sourceFileRowNumber"))::int AS "withoutRow",
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM directory_business_link_request q WHERE q."listingId"=i.id))::int AS "withLinkRequest",
              count(*) FILTER (WHERE EXISTS (SELECT 1 FROM directory_business_link_active a WHERE a."listingId"=i.id))::int AS "withActiveLink"
         FROM directory_listing_identity i`);
    const sourceKeys = hasSourceKey
      ? await one(manager, `SELECT count(*)::int AS total, count(DISTINCT "upstreamKeyHash")::int AS distinctHashes FROM directory_overture_source_key`)
      : null;
    return {
      mode: 'check',
      rows,
      repeatedRegionRowKeysAcrossCompletedScans: repeatedKeys.n,
      cohorts,
      listingIdentities: identities,
      linkRequestsByStatus: await grouped(manager, 'status', 'directory_business_link_request'),
      activeLinks: (await one(manager, 'SELECT count(*)::int AS n FROM directory_business_link_active')).n,
      bindingsByState: await grouped(manager, `"state"||'/'||"provenance"`, 'directory_reviewed_binding'),
      candidatesByStatus: await grouped(manager, 'status', 'directory_address_review_candidate'),
      sourceKeys,
    };
  });
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== '--check') throw Error('Only --check is supported; this command never writes');
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    console.log(JSON.stringify(await census(db), null, 1));
  } finally {
    await db.destroy();
  }
}

module.exports = { census };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'census failed');
    process.exit(1);
  });
}
