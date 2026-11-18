import type { DataSource } from 'typeorm';

type Db = Pick<DataSource, 'query' | 'transaction'>;

export type RetireOutcome = {
  communityId: string;
  scans: { scanId: string; rowsRevoked: number }[];
};

/** Operator/system actions are named so the audit row says who acted. */
const ACTOR = /^[a-z0-9][a-z0-9:_-]{0,62}$/;

/**
 * Takes a town's rows that carry no source provenance out of service, per scan. Rows are revoked through the
 * existing row-revocation list (so every reader that honours it, public export included, stops serving them), and
 * one audit row per (town, scan) records who, why and how many. Acquisition then no longer counts the retired
 * scan, or a run that produced it, as done, so the automatic sweeps fetch the town again.
 *
 * Only this town's rows are touched: a scan that other towns also use stays live for them. Re-running is a no-op
 * for scans already retired. Undo is a restore from backup, not a code path.
 */
export async function retireSourcelessTownRows(
  db: Db,
  options: { communityId: string; actor: string; reason: string }
): Promise<RetireOutcome> {
  if (!ACTOR.test(options.actor)) throw Error('Invalid actor');
  if (!options.reason.trim() || options.reason.length > 500)
    throw Error('Invalid reason');
  return db.transaction(async (tx: Pick<DataSource, 'query'>) => {
    const scans: { scanId: string }[] = await tx.query(
      `SELECT s."scanId" FROM directory_town_scan_target s
         JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
        WHERE s."communityId"=$1::uuid
          AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId")
          AND EXISTS (SELECT 1 FROM directory_overture_private_row r
                       WHERE r."scanId"=s."scanId" AND r."regionId"=$1::text AND (r.listing IS NULL OR NOT (r.listing ? 'sources')))
        ORDER BY s."scanId" FOR UPDATE OF s`,
      [options.communityId]
    );
    const retired: RetireOutcome['scans'] = [];
    for (const { scanId } of scans) {
      const [{ n }] = await tx.query(
        `WITH revoked AS (
           INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber")
           SELECT r."scanId", r."sourceFileRowNumber" FROM directory_overture_private_row r
            WHERE r."scanId"=$1 AND r."regionId"=$2::text AND (r.listing IS NULL OR NOT (r.listing ? 'sources'))
           ON CONFLICT DO NOTHING RETURNING 1)
         SELECT count(*)::int AS n FROM revoked`,
        [scanId, options.communityId]
      );
      await tx.query(
        `INSERT INTO directory_town_scan_retirement ("communityId","scanId",reason,actor,"rowsRevoked")
         VALUES ($1::uuid,$2,$3,$4,$5)`,
        [options.communityId, scanId, options.reason, options.actor, n]
      );
      retired.push({ scanId, rowsRevoked: n });
    }
    return { communityId: options.communityId, scans: retired };
  });
}
