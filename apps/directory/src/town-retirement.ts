import type { DataSource } from 'typeorm';
import { AUTO_RUN_REASON_PREFIX } from './acquisition-run';

type Db = Pick<DataSource, 'query' | 'transaction'>;
export type SweepProvider = 'overture' | 'alltheplaces';

const IS_ATP_SCAN = (scan: string) =>
  `EXISTS (SELECT 1 FROM directory_acquisition_run_job aj JOIN directory_acquisition_run aq ON aq.id=aj."runId"
      WHERE aj."scanId"=${scan} AND aq.provider='alltheplaces')`;

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
  options: {
    communityId: string;
    actor: string;
    reason: string;
    /** Retire only scans acquired by this provider (AllThePlaces scans are the ones a job of that provider produced). */
    provider?: SweepProvider;
  }
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
          ${
            options.provider === 'alltheplaces'
              ? `AND ${IS_ATP_SCAN('s."scanId"')}`
              : options.provider === 'overture'
              ? `AND NOT ${IS_ATP_SCAN('s."scanId"')}`
              : ''
          }
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

export const REFRESH_SWAP_ACTOR = 'system:refresh-swap';
export const REFRESH_SWAP_REASON =
  'replaced by a fresh scan that records its source (owner decision D12, refresh-first)';

/**
 * Refresh first, swap after: the old sourceless scans of a town stay in service until a fresh sourced scan for the
 * same provider has completed, so a town never goes without listings. Only then are those predecessors retired (and
 * audited) through the same retirement path as the pilot. The fresh scan must come from a succeeded, current
 * automatic run for the provider, not a partial one, or rows the missing assets would have supplied would vanish.
 */
export async function swapSourcelessForTown(
  db: Db,
  townId: string,
  provider: SweepProvider
): Promise<RetireOutcome | null> {
  const fresh: unknown[] = await db.query(
    `SELECT 1 FROM directory_town_scan_target s
       JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
      WHERE s."communityId"=$1::uuid
        AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId")
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=s."scanId")
        AND EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=s."scanId" AND r."regionId"=$1::text)
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=s."scanId" AND r."regionId"=$1::text
              AND (r.listing IS NULL OR NOT (r.listing ? 'sources')))
        AND ${provider === 'alltheplaces' ? '' : 'NOT '}${IS_ATP_SCAN(
      's."scanId"'
    )}
        AND EXISTS (SELECT 1 FROM directory_acquisition_run_job j JOIN directory_acquisition_run q ON q.id=j."runId"
              WHERE j."scanId"=s."scanId" AND q.provider=$2 AND q.status='succeeded')
      LIMIT 1`,
    [townId, provider]
  );
  if (!fresh.length) return null;
  const out = await retireSourcelessTownRows(db, {
    communityId: townId,
    actor: REFRESH_SWAP_ACTOR,
    reason: REFRESH_SWAP_REASON,
    provider,
  });
  return out.scans.length ? out : null;
}

/** After one town's run: swap when the run succeeded. Best effort; the sweep-start pass picks up anything missed. */
export async function swapSourcelessAfterRefresh(
  db: Db,
  townId: string,
  provider: SweepProvider,
  status: string
): Promise<void> {
  if (status !== 'succeeded') return;
  try {
    await swapSourcelessForTown(db, townId, provider);
  } catch {
    // Retried by swapPendingSourceless at the next sweep.
  }
}

/** Towns that still hold live sourceless scans of this provider and have a fresh sourced one: swap them now. */
export async function swapPendingSourceless(
  db: Db,
  provider: SweepProvider
): Promise<number> {
  const towns: { id: string }[] = await db.query(
    `SELECT DISTINCT s."communityId" AS id FROM directory_town_scan_target s
       JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
      WHERE NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId")
        AND EXISTS (SELECT 1 FROM directory_overture_private_row r WHERE r."scanId"=s."scanId" AND r."regionId"=s."communityId"::text
              AND (r.listing IS NULL OR NOT (r.listing ? 'sources')))
        AND ${provider === 'alltheplaces' ? '' : 'NOT '}${IS_ATP_SCAN(
      's."scanId"'
    )}`
  );
  let swapped = 0;
  for (const { id } of towns)
    try {
      if (await swapSourcelessForTown(db, id, provider)) swapped++;
    } catch {
      // Left for the next sweep.
    }
  return swapped;
}

export const REFRESH_REPLACED_ACTOR = 'system:refresh-swap';
export const REFRESH_REPLACED_REASON =
  'replaced by a newer scan from a succeeded automatic run (scheduled refresh or boundary refill)';

const IS_PROVIDER_SCAN = (scan: string, provider: SweepProvider) =>
  `${provider === 'alltheplaces' ? '' : 'NOT '}${IS_ATP_SCAN(scan)}`;

/**
 * Refresh first, retire after, for scans that carry source provenance. The old scans of a town stay in service until
 * the newest succeeded automatic run for the provider has completed its scans with rows for the town; only then are
 * the provider's older live scans of that town retired (the town's rows revoked, one audit row each) through the same
 * retirement table the sourceless swap uses. The run's own scans (one per source asset) are never retired, and a
 * re-run that resolved to the same scans (same pinned release and boundary) retires nothing, so no duplicates and no
 * gap. Only this town's rows are touched.
 */
export async function swapSupersededForTown(
  db: Db,
  townId: string,
  provider: SweepProvider
): Promise<RetireOutcome | null> {
  return db.transaction(async (tx: Pick<DataSource, 'query'>) => {
    const [run] = await tx.query(
      `SELECT q.id FROM directory_acquisition_run q
        WHERE q.provider=$2 AND q.kind='overture-stage' AND q.reason LIKE $3 AND q.status='succeeded'
          AND q."townIds" @> to_jsonb($1::text)
        ORDER BY q."finishedAt" DESC NULLS LAST, q.id LIMIT 1`,
      [townId, provider, `${AUTO_RUN_REASON_PREFIX}%`]
    );
    if (!run) return null;
    const fresh: { scanId: string; at: Date; rows: number }[] = await tx.query(
      `SELECT j."scanId", COALESCE(s."completedAt", s."targetedAt") AS at,
              (SELECT count(*)::int FROM directory_overture_private_row r WHERE r."scanId"=j."scanId" AND r."regionId"=$2::text) AS rows
         FROM directory_acquisition_run_job j
         JOIN directory_town_scan_target s ON s."scanId"=j."scanId" AND s."communityId"=$2::uuid
         JOIN directory_overture_private_completion c ON c."scanId"=j."scanId"
        WHERE j."runId"=$1 AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=j."scanId")`,
      [run.id, townId]
    );
    if (!fresh.length || !fresh.some((f) => Number(f.rows) > 0)) return null;
    const keep = fresh.map((f) => f.scanId);
    const since = new Date(Math.min(...fresh.map((f) => +new Date(f.at))));
    const old: { scanId: string }[] = await tx.query(
      `SELECT s."scanId" FROM directory_town_scan_target s
         JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
        WHERE s."communityId"=$1::uuid AND NOT (s."scanId" = ANY($2::text[]))
          AND COALESCE(s."completedAt", s."targetedAt") < $3::timestamptz
          AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId")
          AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=s."scanId")
          AND ${IS_PROVIDER_SCAN('s."scanId"', provider)}
        ORDER BY s."scanId" FOR UPDATE OF s`,
      [townId, keep, since]
    );
    const retired: RetireOutcome['scans'] = [];
    for (const { scanId } of old) {
      const [{ n }] = await tx.query(
        `WITH revoked AS (
           INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber")
           SELECT r."scanId", r."sourceFileRowNumber" FROM directory_overture_private_row r
            WHERE r."scanId"=$1 AND r."regionId"=$2::text
           ON CONFLICT DO NOTHING RETURNING 1)
         SELECT count(*)::int AS n FROM revoked`,
        [scanId, townId]
      );
      await tx.query(
        `INSERT INTO directory_town_scan_retirement ("communityId","scanId",reason,actor,"rowsRevoked")
         VALUES ($1::uuid,$2,$3,$4,$5)`,
        [townId, scanId, REFRESH_REPLACED_REASON, REFRESH_REPLACED_ACTOR, n]
      );
      retired.push({ scanId, rowsRevoked: n });
    }
    return retired.length ? { communityId: townId, scans: retired } : null;
  });
}

/** After one town's run: retire what a succeeded run replaced. Best effort; the sweep-start pass picks up the rest. */
export async function swapSupersededAfterRefresh(
  db: Db,
  townId: string,
  provider: SweepProvider,
  status: string
): Promise<void> {
  if (status !== 'succeeded') return;
  try {
    await swapSupersededForTown(db, townId, provider);
  } catch {
    // Retried by swapPendingSuperseded at the next sweep.
  }
}

/** Towns holding more than one live scan of this provider: each is checked, most have one run's sibling scans only. */
export async function swapPendingSuperseded(
  db: Db,
  provider: SweepProvider
): Promise<number> {
  const towns: { id: string }[] = await db.query(
    `SELECT s."communityId" AS id FROM directory_town_scan_target s
       JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
      WHERE NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=s."communityId" AND z."scanId"=s."scanId")
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=s."scanId")
        AND ${IS_PROVIDER_SCAN('s."scanId"', provider)}
      GROUP BY s."communityId" HAVING count(*) > 1
      ORDER BY s."communityId" LIMIT 500`
  );
  let swapped = 0;
  for (const { id } of towns)
    try {
      if (await swapSupersededForTown(db, id, provider)) swapped++;
    } catch {
      // Left for the next sweep.
    }
  return swapped;
}
