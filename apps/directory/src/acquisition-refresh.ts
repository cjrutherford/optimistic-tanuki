import type { DataSource } from 'typeorm';
import { FRESH_DAYS } from './source-freshness';
import { IDEMPOTENCY_CONFLICT, ReviewConflictError } from './review-version';

type Db = Pick<DataSource, 'query' | 'transaction'>;
type Provider = 'overture' | 'alltheplaces';

/**
 * Owner target: a town's listings are refreshed at least this often. It is the freshness "due" threshold
 * (`FRESH_DAYS`, 90), not a second clock; the 120-day stale label stays the freshness code's.
 */
export const REFRESH_DAYS = FRESH_DAYS;
/** D15: a registered town (or a town whose boundary changed) reaches a terminal acquisition state within this many days. */
export const FILL_TARGET_DAYS = 7;

const OK_RUN = `r.status IN ('succeeded','succeeded_empty')`;

/**
 * The refresh-aware selection of towns for one provider sweep. A town is picked when it was never acquired, or when
 * its newest live scan is more than `REFRESH_DAYS` old, or when its boundary (geometry version) changed after that
 * scan was cut, or when an operator asked for it (`manual`). A re-run that resolved to the very same scan (same pinned
 * release and boundary) counts as a refresh at its finish time, so it is not repeated every sweep.
 *
 * `liveScan` is the provider's predicate over a `directory_town_scan_target` alias `s` that says the scan is live
 * (complete, unrevoked, not retired, sourced) and its provider's. `runOfTown` is the provider's run predicate over alias
 * `r` and the outer town `t` (it uses `$1` for the release). The query parameters are
 * `[release, retryBackoffMs, maxAttempts, limit, provider]`.
 */
export function refreshSelectionSql(o: {
  townSql: string;
  liveScan: string;
  runOfTown: string;
  /** Provider-specific extra predicate over `t`, such as "Overture has finished this town". */
  extraWhere?: string;
  /** The never-attempted-first ordering for the provider, over `runOfTown`. */
  baseOrder: string;
}): string {
  const days = `(${REFRESH_DAYS}::int * interval '1 day')`;
  const manual = `EXISTS (SELECT 1 FROM directory_acquisition_town_request q
       WHERE q."communityId"=t."communityId" AND q.provider=$5 AND q."consumedAt" IS NULL)`;
  const runSince = `${o.runOfTown} AND (rf.since IS NULL OR r."createdAt" > rf.since)`;
  return `${o.townSql}
     LEFT JOIN LATERAL (SELECT s."scanId", COALESCE(s."completedAt", s."targetedAt") AS at, s."geometryVersion" AS gv
          FROM directory_town_scan_target s
          JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
         WHERE s."communityId"=t."communityId" AND ${o.liveScan}
         ORDER BY COALESCE(s."completedAt", s."targetedAt") DESC, s."scanId" LIMIT 1) ls ON true
     LEFT JOIN LATERAL (SELECT max(r."finishedAt") AS at FROM directory_acquisition_run r
         WHERE ${o.runOfTown} AND ${OK_RUN}) ok ON true
     LEFT JOIN LATERAL (SELECT CASE
          WHEN ls."scanId" IS NULL THEN NULL
          WHEN ls.gv IS NOT NULL AND ls.gv < t."geometryVersion" AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run r
                WHERE ${
                  o.runOfTown
                } AND ${OK_RUN} AND r."createdAt" > g."createdAt") THEN g."createdAt"
          WHEN GREATEST(ls.at, ok.at) < clock_timestamp() - ${days} THEN GREATEST(ls.at, ok.at) + ${days}
        END AS since) rf ON true
     WHERE t.eligible IS TRUE AND t."geometryStatus"='ready'
       ${o.extraWhere ? `AND ${o.extraWhere}` : ''}
       AND (ls."scanId" IS NULL OR rf.since IS NOT NULL OR ${manual})
       AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run r WHERE ${runSince} AND (
             r.status IN ('queued','cancel_requested')
             OR (r.status='running' AND r."heartbeatAt" > clock_timestamp() - interval '10 minutes')))
       AND (${manual} OR NOT EXISTS (SELECT 1 FROM directory_acquisition_run r WHERE ${runSince} AND (
             r.status IN ('succeeded','succeeded_empty','failed_permanent','partial','cancelled')
             OR (r.status='blocked' AND r."blockedReason" IN ('invalid_geometry','policy_blocked')))))
       AND (${manual} OR NOT EXISTS (SELECT 1 FROM (SELECT count(*) AS n, max(r."finishedAt") AS last FROM directory_acquisition_run r
             WHERE ${runSince} AND r.status='failed_retryable') f
           WHERE f.n > 0 AND (f.n >= $3 OR f.last > clock_timestamp() - make_interval(secs => ($2::numeric / 1000) * power(2, f.n - 1)))))
     ORDER BY ${manual} DESC, (ls."scanId" IS NOT NULL) ASC, ${o.baseOrder}
     LIMIT $4`;
}

/* ------------------------------ manual request ----------------------------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDERS: Provider[] = ['overture', 'alltheplaces'];

export interface TownRequestInput {
  communityId: string;
  decisionId: string;
  actorId: string;
  reason: string;
}
export interface TownRequestResult {
  communityId: string;
  /** The decision id was seen before: nothing changed. */
  replayed: boolean;
  /** A different pending request for the town already existed: this one added nothing. */
  alreadyPending: boolean;
  requestedAt: string;
  providers: Provider[];
}

/**
 * "Run this town now". Records one pending request per provider; the next sweeps put the town first. The sweeps still
 * check authorization, the kill switch and the budget ledger, and the run still ends in the refresh-then-swap.
 * Idempotent: the decision id replays, and a town with a pending request gets no second one.
 */
export async function requestTownAcquisition(
  db: Db,
  i: TownRequestInput
): Promise<TownRequestResult> {
  if (
    !UUID.test(i.communityId) ||
    !UUID.test(i.decisionId) ||
    !UUID.test(i.actorId) ||
    typeof i.reason !== 'string' ||
    !i.reason.trim() ||
    i.reason.length > 1024
  )
    throw Error('Invalid acquisition request');
  return db.transaction(async (q: Pick<DataSource, 'query'>) => {
    await q.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('directory-town-request:' || $1::text, 0))`,
      [i.communityId]
    );
    const prior: any[] = await q.query(
      `SELECT provider,"communityId","actorId",reason,"requestedAt" FROM directory_acquisition_town_request WHERE id=$1`,
      [i.decisionId]
    );
    if (prior.length) {
      const p = prior[0];
      if (
        p.communityId !== i.communityId ||
        p.actorId !== i.actorId ||
        p.reason !== i.reason
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return {
        communityId: i.communityId,
        replayed: true,
        alreadyPending: false,
        requestedAt: new Date(p.requestedAt).toISOString(),
        providers: prior.map((r) => r.provider as Provider),
      };
    }
    const [town] = await q.query(
      `SELECT eligible, "geometryStatus" FROM directory_town WHERE "communityId"=$1`,
      [i.communityId]
    );
    if (!town) throw Error('Town not found');
    if (town.eligible !== true || town.geometryStatus !== 'ready')
      throw new ReviewConflictError('invalid_state');
    const pending: any[] = await q.query(
      `SELECT provider,"requestedAt" FROM directory_acquisition_town_request
        WHERE "communityId"=$1 AND "consumedAt" IS NULL ORDER BY provider`,
      [i.communityId]
    );
    if (pending.length)
      return {
        communityId: i.communityId,
        replayed: false,
        alreadyPending: true,
        requestedAt: new Date(pending[0].requestedAt).toISOString(),
        providers: pending.map((r) => r.provider as Provider),
      };
    const [{ at }] = await q.query(`SELECT clock_timestamp() AS at`);
    for (const provider of PROVIDERS)
      await q.query(
        `INSERT INTO directory_acquisition_town_request (id,provider,"communityId","actorId",reason,"requestedAt")
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [i.decisionId, provider, i.communityId, i.actorId, i.reason, at]
      );
    return {
      communityId: i.communityId,
      replayed: false,
      alreadyPending: false,
      requestedAt: new Date(at).toISOString(),
      providers: [...PROVIDERS],
    };
  });
}

/** The run that starts for a town satisfies its pending request for that provider. */
export async function consumeTownRequest(
  db: Pick<DataSource, 'query'>,
  townId: string,
  provider: Provider,
  runId: string
): Promise<void> {
  await db.query(
    `UPDATE directory_acquisition_town_request SET "consumedAt"=clock_timestamp(), "runId"=$3
      WHERE "communityId"=$1 AND provider=$2 AND "consumedAt" IS NULL`,
    [townId, provider, runId]
  );
}

/* ------------------------------ fill-time metric --------------------------- */

export interface FillTimeMetrics {
  targetDays: number;
  /** Eligible towns still without a terminal acquisition state whose wait already exceeds the target. */
  waitingOverTarget: number;
  /** Eligible towns that did reach a terminal state, but only after more than the target. */
  resolvedLate: number;
  /** waitingOverTarget + resolvedLate. */
  overTargetTowns: number;
  /** Eligible towns whose clock is running (no terminal state yet), within or over the target. */
  waiting: number;
  alert: boolean;
}

/**
 * Wait = from the clock start to the first terminal acquisition state after it. The clock starts at registration, or at
 * the current boundary's creation when the boundary is a later version than the town's first. Terminal = a completed
 * live scan (filled), or an automatic run that ended `succeeded`, `succeeded_empty` (zero), `blocked` or
 * `failed_permanent`. A `geometry_pending` block is not terminal (the town has not been tried), and a retryable
 * failure is not either (it will be tried again). `alert` is true while any town is still waiting past the target.
 */
export async function fillTimeMetrics(db: {
  query(sql: string, params?: unknown[]): Promise<any[]>;
}): Promise<FillTimeMetrics> {
  const [r] = await db.query(
    `WITH w AS (
       SELECT t."communityId" AS id,
              (g.version > (SELECT min(g0.version) FROM directory_town_geometry g0 WHERE g0."communityId"=t."communityId")) AS regeo,
              CASE WHEN g.version > (SELECT min(g0.version) FROM directory_town_geometry g0 WHERE g0."communityId"=t."communityId")
                   THEN g."createdAt" ELSE t."registeredAt" END AS start
         FROM directory_town t
         LEFT JOIN directory_town_geometry g ON g."communityId"=t."communityId" AND g.version=t."geometryVersion"
        WHERE t.eligible IS TRUE),
     e AS (
       SELECT w.id, w.start,
              COALESCE((SELECT min(x.at) FROM (
                 SELECT COALESCE(s."completedAt", s."targetedAt") AS at
                   FROM directory_town_scan_target s
                   JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
                  WHERE s."communityId"=w.id
                 UNION ALL
                 SELECT r."finishedAt" FROM directory_acquisition_run r
                  WHERE r.kind='overture-stage' AND r.reason LIKE 'auto:%' AND r."townIds" @> to_jsonb(w.id::text)
                    AND (r.status IN ('succeeded','succeeded_empty','failed_permanent')
                         OR (r.status='blocked' AND r."blockedReason" IS DISTINCT FROM 'geometry_pending'))) x
                WHERE x.at >= w.start),
                -- A town filled before its clock started (scans older than the registration column) waited no time.
                CASE WHEN NOT COALESCE(w.regeo, false) AND EXISTS (SELECT 1 FROM directory_town_scan_target s
                       JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
                      WHERE s."communityId"=w.id) THEN w.start END) AS done
         FROM w)
     SELECT count(*) FILTER (WHERE done IS NULL)::int AS waiting,
            count(*) FILTER (WHERE done IS NULL AND clock_timestamp() - start > ($1::int * interval '1 day'))::int AS waiting_over,
            count(*) FILTER (WHERE done IS NOT NULL AND done - start > ($1::int * interval '1 day'))::int AS late
       FROM e`,
    [FILL_TARGET_DAYS]
  );
  const waiting = Number(r?.waiting ?? 0);
  const waitingOverTarget = Number(r?.waiting_over ?? 0);
  const resolvedLate = Number(r?.late ?? 0);
  return {
    targetDays: FILL_TARGET_DAYS,
    waitingOverTarget,
    resolvedLate,
    overTargetTowns: waitingOverTarget + resolvedLate,
    waiting,
    alert: waitingOverTarget > 0,
  };
}
