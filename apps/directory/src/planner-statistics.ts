/**
 * The served-row join (SERVED_ROW_FROM and the revocation, suppression, assertion and classification checks) reads
 * a dozen small control tables next to a table of millions of rows. A control table that has never held a row
 * (the revocation tables, usually) is never analyzed by autovacuum, so the planner assumes a default row count and
 * that every scan is revoked. It then estimates one served row per town, picks nested loops over the scan, and the
 * listing read ran for 6 s against a 2 s bound. Analyzing these tables once at start gives it real statistics.
 */
const TABLES = [
  'directory_overture_private_revocation',
  'directory_overture_private_row_revocation',
  'directory_overture_private_policy',
  'directory_overture_private_membership',
  'directory_overture_private_completion',
  'directory_business_assertion',
  'directory_listing_identity',
  'directory_listing_classification',
  'directory_listing_category_override',
  'directory_listing_suppression',
  'directory_reviewed_binding',
] as const;

interface Queryable {
  query(sql: string): Promise<unknown>;
}

/** Best effort: a failure leaves the planner on its defaults and never stops the service. */
export async function analyzeServedRowTables(db: Queryable): Promise<void> {
  for (const table of TABLES) {
    try {
      await db.query(`ANALYZE ${table}`);
    } catch {
      console.error('Directory could not analyze a served-row table');
    }
  }
}
