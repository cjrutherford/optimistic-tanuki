import type { DataSource } from 'typeorm';
import {
  AUTO_RUN_REASON_PREFIX,
  acquisitionBudgetPanel,
  beginJob,
  beginRun,
  classifyStageError,
  finishJob,
  finishRun,
  heartbeat,
  progress,
  resumeRunFromRequest,
  shouldStop,
} from './acquisition-run';
import {
  assertAcquisitionAuthorized,
  isAcquisitionAuthorized,
} from './acquisition-authorization';
import { isPaused, ProviderPausedError } from './operating-controls';
import { OverturePrivateSink } from './overture-private-sink';
import {
  OvertureInventory,
  InventoryItem,
  StageSigner,
  anonymousAttemptReserver,
  newStageSigner,
  projectStagedRow,
  sha256Hex,
} from './overture-stage-core';
import type { OvertureRightsPolicy } from './overture-rights';

/**
 * Automatic Overture acquisition (owner decision D1). A town that is eligible, has an installed geometry and no
 * successful acquisition for the pinned release gets one ledger run (`overture-stage`, reason `auto: ...`), one job
 * per source asset whose pinned bounds touch the town. The stage logic is the one the operator scripts use
 * (`overture-stage-core.ts`). It runs under the rights policy (the same file the rights sync reads), the budget ledger
 * (`authorizeAnonymousOvertureAttempt`, which also honours the kill switch) and the run ledger.
 */
export const AUTO_PROVIDER = 'overture';
export const AUTO_KIND = 'overture-stage' as const;
/** Bump when the local-evaluation projection changes: it is part of the scan identity. */
export const AUTO_PROJECTION_VERSION = 'overture-auto-projection-v1';
export const AUTO_SCOPE = 'auto-acquisition-overture-v1';

export interface AutoAcquisitionConfig {
  /** Towns acquired per sweep. */
  limit: number;
  /** Source assets scanned for one town in one run; the rest are queued and the run ends `partial`. */
  maxAssets: number;
  retryBackoffMs: number;
  maxAttempts: number;
}
export const DEFAULT_AUTO_CONFIG: AutoAcquisitionConfig = {
  limit: 2,
  maxAssets: 4,
  retryBackoffMs: 900_000,
  maxAttempts: 5,
};

type Bounds = [number, number, number, number];
export interface AutoTown {
  id: string;
  name: string;
  geometry: { type: string; coordinates: unknown };
  bounds: Bounds;
}

export interface ExtractRequest {
  inventory: OvertureInventory;
  policy: Record<string, unknown>;
  project: (input: { source: any }) => Promise<unknown>;
  reserveAttempt: (attempt: any) => Promise<unknown>;
  sink: unknown;
}
export interface ExtractResult {
  scanId?: string | null;
  sourceFileRowNumber?: number | null;
}
export interface AutoAcquisitionDeps {
  db: DataSource;
  inventory: OvertureInventory;
  rights: OvertureRightsPolicy;
  extract: (request: ExtractRequest) => Promise<ExtractResult | undefined>;
  config?: Partial<AutoAcquisitionConfig>;
  signal?: AbortSignal;
  log?: (message: string) => void;
  /** Heartbeat period while one asset streams (no batch boundary to report at). */
  heartbeatMs?: number;
}
export interface AutoSweepOutcome {
  status: 'ok' | 'paused' | 'blocked';
  examined: number;
  succeeded: number;
  empty: number;
  partial: number;
  failed: number;
  blocked: number;
  recordedPending: number;
}
export const emptyOutcome = (
  status: AutoSweepOutcome['status']
): AutoSweepOutcome => ({
  status,
  examined: 0,
  succeeded: 0,
  empty: 0,
  partial: 0,
  failed: 0,
  blocked: 0,
  recordedPending: 0,
});

/** Source assets whose pinned bounds touch the town, in id order. */
export function assetsForBounds(
  items: readonly InventoryItem[],
  bounds: Bounds
): InventoryItem[] {
  return items
    .filter(
      (i) =>
        Array.isArray(i.bbox) &&
        i.bbox[0] <= bounds[2] &&
        i.bbox[2] >= bounds[0] &&
        i.bbox[1] <= bounds[3] &&
        i.bbox[3] >= bounds[1]
    )
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The approval identity, derived from the owner-approved rights policy and the pinned inventory. */
export function autoApproval(
  rights: OvertureRightsPolicy,
  inventory: OvertureInventory
) {
  const approvalSha256 = sha256Hex(
    JSON.stringify({
      rights,
      inventory: inventory.inventorySha256,
      scope: AUTO_SCOPE,
    })
  );
  const projectionSha256 = sha256Hex(
    `${AUTO_PROJECTION_VERSION}:${inventory.release}`
  );
  return {
    approvalSha256,
    projectionSha256,
    classifierSha256: projectionSha256,
  };
}

export class AutoStageStopped extends Error {
  constructor() {
    super('Stopped at operator request');
    this.name = 'AutoStageStopped';
  }
}

export const TOWN_SQL = `SELECT t."communityId" AS id, t.name,
    ST_XMin(g.boundary) AS xmin, ST_YMin(g.boundary) AS ymin, ST_XMax(g.boundary) AS xmax, ST_YMax(g.boundary) AS ymax,
    ST_AsGeoJSON(ST_CollectionExtract(g.boundary,3)) AS geojson
  FROM directory_town t
  JOIN directory_town_geometry g ON g."communityId"=t."communityId" AND g.version=t."geometryVersion"`;

export function toTown(row: any): AutoTown | null {
  try {
    const geometry = JSON.parse(row.geojson);
    const bounds = [row.xmin, row.ymin, row.xmax, row.ymax].map(
      Number
    ) as Bounds;
    if (
      !['Polygon', 'MultiPolygon'].includes(geometry?.type) ||
      !bounds.every(Number.isFinite)
    )
      return null;
    return { id: row.id, name: String(row.name ?? ''), geometry, bounds };
  } catch {
    return null;
  }
}

/** A town counts as acquired once a live, completed scan target exists for it (any earlier staging included). */
const RETIRED = (scan: string, town: string): string =>
  `EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."scanId"=${scan} AND z."communityId"=${town})`;
/** A run is superseded when the scan it produced for this town has since been retired: it no longer counts as an attempt. */
export const runSuperseded = (run: string, town: string): string =>
  `EXISTS (SELECT 1 FROM directory_acquisition_run_job sj JOIN directory_town_scan_retirement sz
      ON sz."scanId"=sj."scanId" AND sz."communityId"=${town} WHERE sj."runId"=${run}.id)`;
export const notRetired = (scan: string, town: string): string =>
  `NOT ${RETIRED(scan, town)}`;
const ACQUIRED = `EXISTS (SELECT 1 FROM directory_town_scan_target s
    JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
    JOIN directory_overture_private_membership m ON m."scanId"=s."scanId"
    JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
    WHERE s."communityId"=t."communityId"
      AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=s."scanId")
      AND ${notRetired('s."scanId"', 's."communityId"')}
      AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run_job j JOIN directory_acquisition_run q ON q.id=j."runId"
        WHERE j."scanId"=s."scanId" AND q.provider='alltheplaces'))`;
const AUTO_RUN_OF_TOWN = `r.kind='overture-stage' AND r.provider='overture' AND r.release=$1
    AND r.reason LIKE '${AUTO_RUN_REASON_PREFIX}%' AND r."townIds" @> to_jsonb(t."communityId"::text)
    AND NOT ${runSuperseded('r', 't."communityId"')}`;

/**
 * Towns whose rows were retired come before everything else (they have nothing to serve until they are fetched again).
 * Towns never attempted for this provider/release come next, newest geometry first, so a brand-new town is not queued
 * behind the backlog; retries follow in the same newest-first order. `g` is the live geometry (its createdAt is when the
 * town became ready), and `RUN_OF_TOWN` is the provider's run predicate.
 */
export const orderNewestNeverAttemptedFirst = (runOfTown: string): string =>
  `EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=t."communityId") DESC,
   EXISTS (SELECT 1 FROM directory_acquisition_run r WHERE ${runOfTown}) ASC, g."createdAt" DESC, t.name, t."communityId"`;
const NEWEST_NEVER_ATTEMPTED_FIRST =
  orderNewestNeverAttemptedFirst(AUTO_RUN_OF_TOWN);

/** Eligible, geometry-ready towns with no acquisition for the release and nothing that should hold them back. */
export async function selectTowns(
  db: Pick<DataSource, 'query'>,
  release: string,
  config: AutoAcquisitionConfig
): Promise<AutoTown[]> {
  const rows = await db.query(
    `${TOWN_SQL}
     WHERE t.eligible IS TRUE AND t."geometryStatus"='ready'
       AND NOT ${ACQUIRED}
       AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run r WHERE ${AUTO_RUN_OF_TOWN} AND (
             r.status IN ('succeeded','succeeded_empty','failed_permanent','partial','queued','cancelled','cancel_requested')
             OR (r.status='running' AND r."heartbeatAt" > clock_timestamp() - interval '10 minutes')
             OR (r.status='blocked' AND r."blockedReason" IN ('invalid_geometry','policy_blocked'))))
       AND NOT EXISTS (SELECT 1 FROM (SELECT count(*) AS n, max(r."finishedAt") AS last FROM directory_acquisition_run r
             WHERE ${AUTO_RUN_OF_TOWN} AND r.status='failed_retryable') f
           WHERE f.n > 0 AND (f.n >= $3 OR f.last > clock_timestamp() - make_interval(secs => ($2::numeric / 1000) * power(2, f.n - 1))))
     ORDER BY ${NEWEST_NEVER_ATTEMPTED_FIRST}
     LIMIT $4`,
    [release, config.retryBackoffMs, config.maxAttempts, config.limit]
  );
  return rows.map(toTown).filter((t: AutoTown | null): t is AutoTown => !!t);
}

/** Records one blocked run per eligible town whose geometry is still pending, so the console says why it was skipped. */
export async function recordGeometryPending(
  db: DataSource,
  release: string,
  limit: number
): Promise<number> {
  const rows = await db.query(
    `SELECT t."communityId" AS id, t.name FROM directory_town t
      WHERE t.eligible IS TRUE AND t."geometryStatus"<>'ready'
        AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run r WHERE ${AUTO_RUN_OF_TOWN} AND r."blockedReason"='geometry_pending')
      ORDER BY t.name, t."communityId" LIMIT $2`,
    [release, limit]
  );
  for (const town of rows) {
    const runId = await beginRun(db, {
      provider: AUTO_PROVIDER,
      release,
      kind: AUTO_KIND,
      townIds: [town.id],
      reason: `${AUTO_RUN_REASON_PREFIX} ${town.name}`.slice(0, 1024),
    });
    await finishRun(db, runId, {
      status: 'blocked',
      blockedReason: 'geometry_pending',
      error: Error('Town geometry is pending; not acquired from a guess'),
    });
  }
  return rows.length;
}

/** A running auto run whose worker died is closed as retryable; the scan checkpoint makes the retry continue. */
export async function closeStaleAutoRuns(
  db: DataSource,
  release: string
): Promise<number> {
  const stale = await db.query(
    `SELECT id FROM directory_acquisition_run r WHERE r.kind='overture-stage' AND r.provider='overture' AND r.release=$1
       AND r.reason LIKE '${AUTO_RUN_REASON_PREFIX}%' AND r.status='running'
       AND (r."heartbeatAt" IS NULL OR r."heartbeatAt" < clock_timestamp() - interval '10 minutes')`,
    [release]
  );
  for (const { id } of stale) {
    await db.query(
      `UPDATE directory_acquisition_run_job SET status='failed_retryable',"finishedAt"=clock_timestamp(),"updatedAt"=clock_timestamp()
        WHERE "runId"=$1 AND status='running'`,
      [id]
    );
    await finishRun(db, id, {
      status: 'failed_retryable',
      error: Error('Worker interrupted'),
    });
  }
  return stale.length;
}

/**
 * The private sink, with each committed batch reported to the run ledger (and a stop request honoured between
 * batches). Shared by the Overture and the standalone AllThePlaces stages.
 */
export function trackedSink(
  db: DataSource,
  runId: string,
  unitKey: string,
  counts: { observed: number; accepted: number; rejected: number }
): OverturePrivateSink {
  return new Proxy(
    new OverturePrivateSink(db, { includeSourceProvenance: true }),
    {
      get(target: any, name) {
        const value = target[name];
        if (typeof value !== 'function') return value;
        if (name !== 'commit') return value.bind(target);
        return async (rows: any[], checkpoint: any) => {
          const out = await target.commit(rows, checkpoint);
          counts.observed += rows.length;
          for (const r of rows)
            counts[
              r.outcome?.status === 'eligible' ? 'accepted' : 'rejected'
            ]++;
          const stop = (
            await progress(db, runId, unitKey, {
              checkpoint: {
                scanId: checkpoint?.scanId ?? null,
                sourceFileRowNumber: checkpoint?.sourceFileRowNumber ?? null,
              },
              ...counts,
            })
          ).stop;
          if (stop) throw new AutoStageStopped();
          return out;
        };
      },
    }
  ) as OverturePrivateSink;
}

type RunState = {
  runId: string;
  counts: { observed: number; accepted: number; rejected: number };
};

async function runAsset(
  deps: AutoAcquisitionDeps,
  town: AutoTown,
  item: InventoryItem,
  state: RunState,
  approval: ReturnType<typeof autoApproval>,
  signer: StageSigner
): Promise<'succeeded' | 'succeeded_empty'> {
  const { db, inventory, rights } = deps;
  const log = deps.log ?? (() => undefined);
  await beginJob(db, state.runId, { unitKey: item.id, townId: town.id });
  const counts = { observed: 0, accepted: 0, rejected: 0 };
  const sink = trackedSink(db, state.runId, item.id, counts);
  const timer = setInterval(() => {
    heartbeat(db, state.runId).catch(() => undefined);
  }, deps.heartbeatMs ?? 30_000);
  timer.unref?.();
  try {
    log(`auto acquisition: ${town.name} asset ${item.id} started`);
    const done = await deps.extract({
      // The envelope only bounds the town region check and names the scan; the town's own bounds make it per-town.
      inventory: { ...inventory, envelope: town.bounds },
      policy: {
        authorized: true,
        inventorySha256: inventory.inventorySha256,
        itemId: item.id,
        approvalSha256: approval.approvalSha256,
        projectionSha256: approval.projectionSha256,
        classifierSha256: approval.classifierSha256,
        regions: [{ id: town.id, geometry: town.geometry }],
        localSnapshot: true,
        maxMemoryBytes: 2 * 1024 * 1024 * 1024,
        maxTransferBytes: 1024 * 1024 * 1024,
      },
      project: async ({ source }) =>
        projectStagedRow({ source, releaseId: inventory.release, rights }),
      reserveAttempt: anonymousAttemptReserver(db, {
        approvalSha256: approval.approvalSha256,
        item,
        signer,
        automatic: true,
      }),
      sink,
    });
    const scanId = done?.scanId ?? null;
    let rowCount = counts.accepted;
    if (scanId) {
      const [{ n }] = await db.query(
        `SELECT count(*)::int AS n FROM directory_overture_private_row WHERE "scanId"=$1`,
        [scanId]
      );
      rowCount = Number(n);
      await db.query(
        `UPDATE directory_acquisition_run_job SET "scanId"=$3 WHERE "runId"=$1 AND "unitKey"=$2`,
        [state.runId, item.id, scanId]
      );
    }
    const status = rowCount === 0 ? 'succeeded_empty' : 'succeeded';
    await finishJob(db, state.runId, item.id, {
      status,
      checkpoint: {
        scanId,
        sourceFileRowNumber: done?.sourceFileRowNumber ?? null,
      },
      ...counts,
    });
    state.counts.observed += counts.observed;
    state.counts.accepted += counts.accepted;
    state.counts.rejected += counts.rejected;
    return status;
  } finally {
    clearInterval(timer);
  }
}

/**
 * One town, one run. `units` (a resume) restricts the scan to the queued assets; otherwise the assets come from the
 * town's bounds, capped at `maxAssets` (the rest are queued and the run ends `partial`).
 */
export async function acquireTown(
  deps: AutoAcquisitionDeps,
  town: AutoTown,
  resume?: { runId: string; units: string[] }
): Promise<{ status: string; runId: string }> {
  const config = { ...DEFAULT_AUTO_CONFIG, ...deps.config };
  const { db, inventory } = deps;
  const log = deps.log ?? (() => undefined);
  assertAcquisitionAuthorized(AUTO_PROVIDER);
  const approval = autoApproval(deps.rights, inventory);
  const runId =
    resume?.runId ??
    (await beginRun(db, {
      provider: AUTO_PROVIDER,
      release: inventory.release,
      kind: AUTO_KIND,
      townIds: [town.id],
      reason: `${AUTO_RUN_REASON_PREFIX} ${town.name}`.slice(0, 1024),
    }));
  const state: RunState = {
    runId,
    counts: { observed: 0, accepted: 0, rejected: 0 },
  };
  let unit: string | null = null;
  try {
    const covering = assetsForBounds(inventory.items, town.bounds);
    const wanted = resume
      ? covering.filter((i) => resume.units.includes(i.id))
      : covering;
    if (!wanted.length)
      throw Error('Invalid geometry: no source asset covers the town');
    const now = wanted.slice(0, config.maxAssets);
    for (const item of wanted.slice(config.maxAssets))
      await db.query(
        `INSERT INTO directory_acquisition_run_job ("runId","unitKey","townId",status) VALUES ($1,$2,$3,'queued')
         ON CONFLICT ("runId","unitKey") DO UPDATE SET status='queued',"updatedAt"=clock_timestamp()`,
        [runId, item.id, town.id]
      );
    await db.query(
      `INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING`,
      [approval.approvalSha256]
    );
    const signer = newStageSigner();
    for (let i = 0; i < now.length; i++) {
      const item = now[i];
      if (deps.signal?.aborted || (await shouldStop(db, runId))) {
        // Remaining assets stay queued so a resume (console or worker) picks them up.
        for (const rest of now.slice(i))
          await db.query(
            `INSERT INTO directory_acquisition_run_job ("runId","unitKey","townId",status) VALUES ($1,$2,$3,'queued')
             ON CONFLICT ("runId","unitKey") DO UPDATE SET status='queued',"updatedAt"=clock_timestamp()`,
            [runId, rest.id, town.id]
          );
        throw new AutoStageStopped();
      }
      unit = item.id;
      await runAsset(deps, town, item, state, approval, signer);
      unit = null;
    }
    const status = await finishRun(db, runId);
    log(`auto acquisition: ${town.name} ${status}`);
    return { status, runId };
  } catch (error) {
    if (error instanceof AutoStageStopped) {
      if (unit)
        await finishJob(db, runId, unit, { status: 'cancelled' }).catch(
          () => undefined
        );
      const status = await finishRun(db, runId);
      return { status, runId };
    }
    const c = classifyStageError(error);
    if (unit)
      await finishJob(db, runId, unit, {
        status: c.status,
        blockedReason: c.blockedReason,
        error,
      }).catch(() => undefined);
    const status = await finishRun(db, runId, {
      status: c.status,
      blockedReason: c.blockedReason,
      error,
    });
    log(`auto acquisition: ${town.name} ${status}`);
    return { status, runId };
  }
}

async function loadTown(db: DataSource, id: string): Promise<AutoTown | null> {
  const rows = await db.query(
    `${TOWN_SQL} WHERE t."communityId"=$1 AND t."geometryStatus"='ready'`,
    [id]
  );
  return rows[0] ? toTown(rows[0]) : null;
}

/** Auto runs an operator re-queued from the console (resume or retry): the worker consumes the request. */
async function resumeRequested(
  deps: AutoAcquisitionDeps,
  out: AutoSweepOutcome
): Promise<void> {
  const { db, inventory } = deps;
  const runs = await db.query(
    `SELECT r.id, r."townIds" FROM directory_acquisition_run r
      WHERE r.kind='overture-stage' AND r.provider='overture' AND r.release=$1 AND r.reason LIKE '${AUTO_RUN_REASON_PREFIX}%'
        AND r.status='queued'
        AND EXISTS (SELECT 1 FROM directory_acquisition_run_event e WHERE e."runId"=r.id AND e.action IN ('resume','retry')
              AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run_event c WHERE c."ofEventId"=e.id))
      ORDER BY r."createdAt" LIMIT 1`,
    [inventory.release]
  );
  for (const r of runs) {
    const town = await loadTown(db, r.townIds?.[0]);
    if (!town) continue;
    const resumed = await resumeRunFromRequest(db, r.id);
    const result = await acquireTown(deps, town, {
      runId: r.id,
      units: resumed.units,
    });
    tally(out, result.status);
  }
}

export function tally(out: AutoSweepOutcome, status: string): void {
  out.examined++;
  if (status === 'succeeded') out.succeeded++;
  else if (status === 'succeeded_empty') out.empty++;
  else if (status === 'partial' || status === 'cancelled') out.partial++;
  else if (status === 'blocked') out.blocked++;
  else out.failed++;
}

/**
 * One sweep. The kill switch is checked first: while `provider_acquisition` is paused nothing is selected, recorded or
 * requested. A budget hard stop likewise ends the sweep before any provider work.
 */
export async function runAutoAcquisitionSweep(
  deps: AutoAcquisitionDeps
): Promise<AutoSweepOutcome> {
  const config = { ...DEFAULT_AUTO_CONFIG, ...deps.config };
  const { db, inventory } = deps;
  if (!isAcquisitionAuthorized(AUTO_PROVIDER)) return emptyOutcome('blocked');
  if (await isPaused(db, 'provider_acquisition')) return emptyOutcome('paused');
  if ((await acquisitionBudgetPanel(db)).hardStop)
    return emptyOutcome('blocked');
  const out = emptyOutcome('ok');
  await closeStaleAutoRuns(db, inventory.release);
  out.recordedPending = await recordGeometryPending(
    db,
    inventory.release,
    config.limit
  );
  await resumeRequested(deps, out);
  const towns = await selectTowns(db, inventory.release, config);
  for (const town of towns) {
    if (deps.signal?.aborted) break;
    if (await isPaused(db, 'provider_acquisition')) {
      out.status = 'paused';
      break;
    }
    let result: { status: string };
    try {
      result = await acquireTown(deps, town);
    } catch (error) {
      if (error instanceof ProviderPausedError) {
        out.status = 'paused';
        break;
      }
      throw error;
    }
    tally(out, result.status);
    // A retryable failure is usually the provider or the network, not the town; the backoff holds this town back and
    // the next sweep tries the next one, instead of every town in this sweep failing the same way.
    if (result.status === 'failed_retryable') break;
    if (result.status === 'blocked') {
      // A budget or kill-switch block holds for every town; stop instead of recording one blocked run per town.
      out.status = 'blocked';
      break;
    }
  }
  return out;
}
