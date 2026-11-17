#!/usr/bin/env node
/**
 * Accounts for publications that predate source binding.
 *
 * Every published candidate with no binding gets one `unknown_legacy` binding:
 * suspended, cause `legacy_no_provenance`, and every stage, hash and decision
 * column null. Nothing about their source is invented, and a check constraint
 * makes such a binding impossible to activate. They are resolved by re-review
 * through the publish path, or retired when the suspension timeout passes.
 *
 * Dry-run by default. Writing needs --apply and --confirm-database <name>, where
 * <name> must equal the database in DIRECTORY_DATABASE_URL, so a wrong URL
 * cannot be written to by accident.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only \
 *     scripts/local-directory-reviewed-binding-legacy.cjs [--apply --confirm-database <name>]
 */
const { DataSource } = require('typeorm');

const WITHOUT_BINDING = `
  FROM "directory_address_review_candidate" c
  WHERE c."status"='published'
    AND NOT EXISTS (SELECT 1 FROM "directory_reviewed_binding" b WHERE b."candidateId"=c."id")`;

/** Counts, and with apply inserts, the legacy bindings. Safe to repeat. */
async function accountLegacy(db, { apply = false } = {}) {
  const [{ pending }] = await db.query(
    `SELECT count(*)::int AS pending ${WITHOUT_BINDING}`
  );
  if (!apply) return { apply, publishedWithoutBinding: pending, inserted: 0 };
  const inserted = await db.transaction(async (manager) => {
    // Serialize concurrent runs; the unique (scan, row) index would otherwise reject the second.
    await manager.query(
      `SELECT pg_advisory_xact_lock(hashtext('directory_reviewed_binding_legacy'))`
    );
    const rows = await manager.query(
      `WITH legacy AS (
         INSERT INTO "directory_reviewed_binding"
           ("candidateId","communityId","scanId","sourceFileRowNumber","provenance","state","stateCause","suspendedAt")
         SELECT c."id",c."communityId",c."scanId",c."sourceFileRowNumber",'unknown_legacy','suspended','legacy_no_provenance',CURRENT_TIMESTAMP
         ${WITHOUT_BINDING}
         ON CONFLICT DO NOTHING
         RETURNING "id")
       SELECT "id" FROM legacy`
    );
    for (const row of rows) {
      await manager.query(
        `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause") VALUES ($1,'suspended','legacy_no_provenance') ON CONFLICT DO NOTHING`,
        [row.id]
      );
    }
    // An unknown_legacy binding can never be active, so it can never own a candidate-index row.
    const [{ leaked }] = await manager.query(
      `SELECT count(*)::int AS leaked FROM "directory_reviewed_spatial" p
       JOIN "directory_reviewed_binding" b ON b."id"=p."bindingId" WHERE b."provenance"='unknown_legacy'`
    );
    if (leaked !== 0) throw Error('Legacy binding owns a reviewed spatial row');
    return rows.length;
  });
  return { apply, publishedWithoutBinding: pending, inserted };
}

function databaseName(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

async function main(argv) {
  const url =
    process.env.DIRECTORY_DATABASE_URL ||
    process.env.DIRECTORY_REVIEW_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const apply = argv.includes('--apply');
  const at = argv.indexOf('--confirm-database');
  const confirmed = at >= 0 ? argv[at + 1] : undefined;
  if (apply && confirmed !== databaseName(url)) {
    throw Error(
      '--apply requires --confirm-database <name> matching the target database'
    );
  }
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    const result = await accountLegacy(db, { apply });
    const [health] = await db.query(
      `SELECT count(*) FILTER (WHERE provenance='unknown_legacy' AND state='suspended')::int AS "legacySuspended",
              count(*) FILTER (WHERE provenance='unknown_legacy' AND state='active')::int AS "legacyActive"
       FROM "directory_reviewed_binding"`
    );
    console.log(
      JSON.stringify({ database: databaseName(url), ...result, ...health })
    );
  } finally {
    await db.destroy();
  }
}

module.exports = { accountLegacy };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'legacy accounting failed'
    );
    process.exit(1);
  });
}
