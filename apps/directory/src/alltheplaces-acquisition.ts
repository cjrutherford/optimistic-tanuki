import type { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  AUTO_RUN_REASON_PREFIX,
  acquisitionBudgetPanel,
  beginJob,
  beginRun,
  classifyStageError,
  finishJob,
  finishRun,
  heartbeat,
  shouldStop,
} from './acquisition-run';
import {
  assertAcquisitionAuthorized,
  isAcquisitionAuthorized,
} from './acquisition-authorization';
import { isPaused, ProviderPausedError } from './operating-controls';
import {
  swapPendingSourceless,
  swapPendingSuperseded,
  swapSourcelessAfterRefresh,
  swapSupersededAfterRefresh,
} from './town-retirement';
import { consumeTownRequest, refreshSelectionSql } from './acquisition-refresh';
import {
  AutoAcquisitionConfig,
  AutoStageStopped,
  AutoSweepOutcome,
  AutoTown,
  DEFAULT_AUTO_CONFIG,
  TOWN_SQL,
  emptyOutcome,
  hasSourcelessRows,
  notRetired,
  orderNewestNeverAttemptedFirst,
  runSuperseded,
  tally,
  toTown,
  trackedSink,
  type ExtractRequest,
  type ExtractResult,
} from './overture-auto-acquisition';
import {
  anonymousAttemptReserver,
  newStageSigner,
  projectStagedRow,
  sha256Hex,
  type OvertureInventory,
} from './overture-stage-core';
import {
  ATP_PROJECTION_VERSION,
  ATP_PROVIDER,
  ATP_SCOPE,
  ATP_SOURCES,
  OvertureDedupeIndex,
  type AtpRightsPolicy,
  type DedupeReason,
  type StagedPlace,
} from './alltheplaces';

/**
 * Standalone AllThePlaces acquisition (owner decision D3). A town that is eligible, has an installed geometry, and has
 * already been through Overture acquisition gets one ledger run (provider `alltheplaces`, reason `auto: ...`) that reads
 * the town's rows from a local snapshot of the pinned archive into the same private sink the Overture stage uses. The
 * archive download is reserved in the budget ledger (`authorizeAnonymousAllThePlacesAttempt`, which honours the kill
 * switch and the policy row), and the stage logic is `overture-stage-core.ts`.
 */
export type Bounds = [number, number, number, number];

export interface AtpSnapshot {
  path: string;
  sha256: string;
  size: number;
  rows: number;
  bbox: Bounds;
}
export interface AtpAcquisitionDeps {
  db: DataSource;
  policy: AtpRightsPolicy;
  /**
   * The local snapshot of the pinned archive, built on first use. `reserve` is the budget-ledger reservation the build
   * must make before it downloads anything; a cached snapshot needs none.
   */
  ensureSnapshot: (
    reserve: (attempt: any) => Promise<unknown>
  ) => Promise<AtpSnapshot>;
  extract: (
    request: ExtractRequest & { sourcePath: string }
  ) => Promise<ExtractResult | undefined>;
  config?: Partial<AutoAcquisitionConfig>;
  signal?: AbortSignal;
  log?: (message: string) => void;
  heartbeatMs?: number;
}

export const ATP_UNIT = 'atp-snapshot';

export function atpApproval(policy: AtpRightsPolicy) {
  const approvalSha256 = sha256Hex(
    JSON.stringify({
      rights: policy,
      archive: policy.archive.sha256,
      scope: ATP_SCOPE,
    })
  );
  const projectionSha256 = sha256Hex(
    `${ATP_PROJECTION_VERSION}:${policy.releaseId}`
  );
  return {
    approvalSha256,
    projectionSha256,
    classifierSha256: projectionSha256,
  };
}

function inventoryFor(policy: AtpRightsPolicy, snapshot: AtpSnapshot) {
  const items = [
    {
      id: ATP_UNIT,
      asset: policy.archive.url,
      etag: policy.archive.sha256,
      size: snapshot.size,
      rows: snapshot.rows,
      rowGroups: 1,
      bbox: snapshot.bbox,
      lastModified: policy.archive.runId,
    },
  ];
  return {
    release: policy.releaseId,
    inventorySha256: sha256Hex(JSON.stringify(items)),
    items,
  } as OvertureInventory;
}

const OVERTURE_DONE = `(EXISTS (SELECT 1 FROM directory_town_scan_target s
      JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
      WHERE s."communityId"=t."communityId"
        AND ${notRetired('s."scanId"', 's."communityId"')}
        AND NOT ${hasSourcelessRows('s."scanId"', 's."communityId"')}
        AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run_job j JOIN directory_acquisition_run q ON q.id=j."runId"
          WHERE j."scanId"=s."scanId" AND q.provider='alltheplaces'))
    OR EXISTS (SELECT 1 FROM directory_acquisition_run o WHERE o.provider='overture' AND o.kind='overture-stage'
      AND o."townIds" @> to_jsonb(t."communityId"::text) AND NOT ${runSuperseded(
        'o',
        't."communityId"'
      )} AND o.status IN ('succeeded','succeeded_empty','failed_permanent')))`;
/** The AllThePlaces scans of this archive that are live for a town, as a predicate over a scan-target alias `s`. */
const ATP_LIVE_SCAN = `EXISTS (SELECT 1 FROM directory_acquisition_run_job j JOIN directory_acquisition_run r ON r.id=j."runId"
      WHERE j."scanId"=s."scanId" AND j."townId"=s."communityId" AND r.provider='alltheplaces' AND r.release=$1)
    AND ${notRetired('s."scanId"', 's."communityId"')}
    AND NOT ${hasSourcelessRows('s."scanId"', 's."communityId"')}
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=s."scanId")`;
const ATP_RUN_OF_TOWN = `r.kind='overture-stage' AND r.provider='alltheplaces' AND r.release=$1
    AND r.reason LIKE '${AUTO_RUN_REASON_PREFIX}%' AND r."townIds" @> to_jsonb(t."communityId"::text)
    AND NOT ${runSuperseded('r', 't."communityId"')}`;

/** Eligible, geometry-ready towns that Overture has finished and that have no AllThePlaces acquisition for this archive. */
export async function selectAtpTowns(
  db: Pick<DataSource, 'query'>,
  release: string,
  config: AutoAcquisitionConfig
): Promise<AutoTown[]> {
  const rows = await db.query(
    refreshSelectionSql({
      townSql: TOWN_SQL,
      liveScan: ATP_LIVE_SCAN,
      runOfTown: ATP_RUN_OF_TOWN,
      extraWhere: OVERTURE_DONE,
      baseOrder: orderNewestNeverAttemptedFirst(ATP_RUN_OF_TOWN),
    }),
    [
      release,
      config.retryBackoffMs,
      config.maxAttempts,
      config.limit,
      ATP_PROVIDER,
    ]
  );
  return rows.map(toTown).filter((t: AutoTown | null): t is AutoTown => !!t);
}

/** A running run whose worker died is closed as retryable; the scan checkpoint makes the retry continue. */
export async function closeStaleAtpRuns(
  db: DataSource,
  release: string
): Promise<number> {
  const stale = await db.query(
    `SELECT id FROM directory_acquisition_run r WHERE r.provider='alltheplaces' AND r.release=$1
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

/** The town's staged Overture places (every completed, unrevoked scan that is not itself an AllThePlaces scan). */
export async function stagedOverturePlaces(
  db: Pick<DataSource, 'query'>,
  townId: string
): Promise<StagedPlace[]> {
  const rows = await db.query(
    `SELECT r.listing->>'name' AS name,
        (r.listing->'location'->'coordinates'->>0)::float8 AS x,
        (r.listing->'location'->'coordinates'->>1)::float8 AS y,
        COALESCE(r.listing->'sources' @> '[{"dataset":"AllThePlaces"}]'::jsonb, false) AS atp
       FROM directory_town_scan_target s
       JOIN directory_overture_private_completion c ON c."scanId"=s."scanId"
       JOIN directory_overture_private_row r ON r."scanId"=s."scanId"
      WHERE s."communityId"=$1 AND r.listing IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=s."scanId")
        AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation v
              WHERE v."scanId"=r."scanId" AND v."sourceFileRowNumber"=r."sourceFileRowNumber")
        AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run_job j JOIN directory_acquisition_run q ON q.id=j."runId"
              WHERE j."scanId"=s."scanId" AND q.provider='alltheplaces')`,
    [townId]
  );
  return rows
    .filter(
      (r: any) =>
        typeof r.name === 'string' &&
        Number.isFinite(Number(r.x)) &&
        Number.isFinite(Number(r.y))
    )
    .map((r: any) => ({
      name: r.name,
      coordinates: [Number(r.x), Number(r.y)] as [number, number],
      carriesAtpSource: r.atp === true,
    }));
}

export async function acquireAtpTown(
  deps: AtpAcquisitionDeps,
  town: AutoTown
): Promise<{ status: string; runId: string }> {
  const { db, policy } = deps;
  const log = deps.log ?? (() => undefined);
  assertAcquisitionAuthorized(ATP_PROVIDER);
  const approval = atpApproval(policy);
  const runId = await beginRun(db, {
    provider: ATP_PROVIDER,
    release: policy.releaseId,
    kind: 'overture-stage',
    townIds: [town.id],
    reason: `${AUTO_RUN_REASON_PREFIX} ${town.name}`.slice(0, 1024),
  });
  await consumeTownRequest(db, town.id, ATP_PROVIDER, runId);
  const counts = { observed: 0, accepted: 0, rejected: 0 };
  let unitStarted = false;
  const timer = setInterval(() => {
    heartbeat(db, runId).catch(() => undefined);
  }, deps.heartbeatMs ?? 30_000);
  timer.unref?.();
  try {
    if (deps.signal?.aborted || (await shouldStop(db, runId)))
      throw new AutoStageStopped();
    await beginJob(db, runId, { unitKey: ATP_UNIT, townId: town.id });
    unitStarted = true;
    await db.query(
      `INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING`,
      [approval.approvalSha256]
    );
    const signer = newStageSigner();
    const reserve = anonymousAttemptReserver(db, {
      approvalSha256: approval.approvalSha256,
      item: { asset: policy.archive.url, etag: policy.archive.sha256 },
      signer,
      automatic: true,
      provider: 'alltheplaces',
    });
    const snapshot = await deps.ensureSnapshot((attempt) =>
      reserve({ ...attempt, attemptId: attempt?.attemptId ?? randomUUID() })
    );
    const inventory = inventoryFor(policy, snapshot);
    const staged = await stagedOverturePlaces(db, town.id);
    const index = new OvertureDedupeIndex(staged);
    const deduped: Record<DedupeReason, number> = {
      overture_atp_source_same_place: 0,
      overture_same_place: 0,
    };
    log(
      `atp acquisition: ${town.name} started (${staged.length} staged Overture places to dedupe against)`
    );
    const sink = trackedSink(db, runId, ATP_UNIT, counts);
    const done = await deps.extract({
      inventory,
      sourcePath: snapshot.path,
      policy: {
        authorized: true,
        inventorySha256: inventory.inventorySha256,
        itemId: ATP_UNIT,
        assetSha256: snapshot.sha256,
        approvalSha256: approval.approvalSha256,
        projectionSha256: approval.projectionSha256,
        classifierSha256: approval.classifierSha256,
        regions: [{ id: town.id, geometry: town.geometry }],
        maxMemoryBytes: 2 * 1024 * 1024 * 1024,
      },
      project: async ({ source }: { source: any }) => {
        const geometry =
          typeof source.geometry === 'string'
            ? JSON.parse(source.geometry)
            : source.geometry;
        const name = source?.names?.primary;
        const coordinates = geometry?.coordinates;
        if (typeof name === 'string' && Array.isArray(coordinates)) {
          const reason = index.match(name, coordinates as [number, number]);
          if (reason) {
            deduped[reason]++;
            return { status: 'quarantined' as const };
          }
        }
        const outcome = projectStagedRow({
          source: { ...source, sources: ATP_SOURCES },
          releaseId: policy.releaseId,
          rights: policy,
        });
        // The upstream id only ever becomes a keyed hash in the sink; the listing never carries it.
        return typeof source.id === 'string' && outcome.status === 'eligible'
          ? { ...outcome, upstreamId: source.id }
          : outcome;
      },
      reserveAttempt: async () => {
        throw Error('The snapshot is local; no provider call is made here');
      },
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
        [runId, ATP_UNIT, scanId]
      );
    }
    await finishJob(db, runId, ATP_UNIT, {
      status: rowCount === 0 ? 'succeeded_empty' : 'succeeded',
      checkpoint: {
        scanId,
        sourceFileRowNumber: done?.sourceFileRowNumber ?? null,
        // What the Overture dedupe did, so the run says why rows were not listed.
        dedupedAgainstOverture: deduped,
        stagedOvertureCompared: staged.length,
      },
      ...counts,
    });
    const status = await finishRun(db, runId);
    log(`atp acquisition: ${town.name} ${status}`);
    await swapSourcelessAfterRefresh(db, town.id, 'alltheplaces', status);
    await swapSupersededAfterRefresh(db, town.id, 'alltheplaces', status);
    return { status, runId };
  } catch (error) {
    if (error instanceof AutoStageStopped) {
      if (unitStarted)
        await finishJob(db, runId, ATP_UNIT, { status: 'cancelled' }).catch(
          () => undefined
        );
      return { status: await finishRun(db, runId), runId };
    }
    const c = classifyStageError(error);
    if (unitStarted)
      await finishJob(db, runId, ATP_UNIT, {
        status: c.status,
        blockedReason: c.blockedReason,
        error,
      }).catch(() => undefined);
    const status = await finishRun(db, runId, {
      status: c.status,
      blockedReason: c.blockedReason,
      error,
    });
    log(`atp acquisition: ${town.name} ${status}`);
    return { status, runId };
  } finally {
    clearInterval(timer);
  }
}

/**
 * One sweep. The kill switch is checked first; a budget hard stop likewise ends the sweep before any provider work.
 */
export async function runAtpAcquisitionSweep(
  deps: AtpAcquisitionDeps
): Promise<AutoSweepOutcome> {
  const config = { ...DEFAULT_AUTO_CONFIG, ...deps.config };
  const { db, policy } = deps;
  if (!isAcquisitionAuthorized(ATP_PROVIDER)) return emptyOutcome('blocked');
  if (await isPaused(db, 'provider_acquisition')) return emptyOutcome('paused');
  if ((await acquisitionBudgetPanel(db)).hardStop)
    return emptyOutcome('blocked');
  const out = emptyOutcome('ok');
  await closeStaleAtpRuns(db, policy.releaseId);
  await swapPendingSourceless(db, 'alltheplaces');
  await swapPendingSuperseded(db, 'alltheplaces');
  const towns = await selectAtpTowns(db, policy.releaseId, config);
  for (const town of towns) {
    if (deps.signal?.aborted) break;
    if (await isPaused(db, 'provider_acquisition')) {
      out.status = 'paused';
      break;
    }
    let result: { status: string };
    try {
      result = await acquireAtpTown(deps, town);
    } catch (error) {
      if (error instanceof ProviderPausedError) {
        out.status = 'paused';
        break;
      }
      throw error;
    }
    tally(out, result.status);
    // A retryable failure is usually the archive host or the network, not the town; back off instead of failing every town.
    if (result.status === 'failed_retryable') break;
    if (result.status === 'blocked') {
      out.status = 'blocked';
      break;
    }
  }
  return out;
}
