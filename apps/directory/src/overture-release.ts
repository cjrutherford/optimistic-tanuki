import type { DataSource } from 'typeorm';
import {
  AutoAcquisitionConfig,
  AutoAcquisitionDeps,
  AutoSweepOutcome,
  DEFAULT_AUTO_CONFIG,
  acquireTown,
  assetsForBounds,
  closeStaleAutoRuns,
  emptyOutcome,
  tally,
  toTown,
  TOWN_SQL,
  type AutoTown,
} from './overture-auto-acquisition';
import { acquisitionBudgetPanel } from './acquisition-run';
import { isAcquisitionAuthorized } from './acquisition-authorization';
import { isPaused, ProviderPausedError } from './operating-controls';
import { ReviewConflictError, IDEMPOTENCY_CONFLICT } from './review-version';
import type { OvertureInventory } from './overture-stage-core';
import type { OvertureRightsPolicy } from './overture-rights';
import { QUALITY_FAILURE_REASON, type QualityLimits } from './run-quality';

/**
 * Overture release updates (owner decision D29).
 *
 * The worker watches the release source for a release newer than the active one, records it with a licence check
 * against the rights policy the active release runs under, runs it on a few canary towns and promotes it only when
 * every canary run succeeded and none failed the quality scorecard (`quality_limit`). A failed canary holds the
 * release with the reason; an operator can retry it or reject it. Promotion makes the release the active one, so the
 * per-town refresh rule (which keys on the release) acquires every town under it.
 *
 * Everything is stored in `directory_overture_release_candidate`, so a restart resumes where it was: the canary towns
 * are chosen once, runs are looked up from the run ledger rather than remembered in memory, and promotion is a single
 * guarded UPDATE. The kill switch and the budget ledger are honoured because every canary run is an ordinary
 * `acquireTown` (anonymous attempt reservation, kill switch), and the sweep refuses to start while either stops it.
 */

/** The release the owner pinned (D1). It is active until a later release is promoted. */
export const PINNED_OVERTURE_RELEASE = '2026-10-21.0';
export const DEFAULT_CANARY_TOWNS = 3;
/** A canary town whose run ended retryable, partial or cancelled is run again this many times before it counts as failed. */
export const MAX_CANARY_ATTEMPTS = 3;

const RELEASE = /^\d{4}-\d{2}-\d{2}\.\d+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isReleaseId = (value: unknown): value is string =>
  typeof value === 'string' && RELEASE.test(value);

/** Orders release ids by date, then by the revision after the dot. */
export function compareReleases(a: string, b: string): number {
  const [ad, ar] = a.split('.');
  const [bd, br] = b.split('.');
  return ad === bd ? Number(ar) - Number(br) : ad < bd ? -1 : 1;
}

/** Where releases come from: Overture's public release metadata (STAC), the same source the preflight script reads. */
export interface ReleaseSource {
  listReleases(): Promise<string[]>;
  /** The licence declaration of the release's places collection (value and licence link), or null when it declares none. */
  licenseOf(release: string): Promise<string | null>;
  /** The pinned inventory for the release over the envelope (public metadata only). */
  buildInventory(
    release: string,
    envelope: [number, number, number, number]
  ): Promise<OvertureInventory>;
}

export interface ActiveRelease {
  release: string;
  source: 'pinned' | 'promoted';
  inventory: OvertureInventory | null;
  rights: OvertureRightsPolicy | null;
}

/** The newest promoted release, or the pinned one when none has been promoted. */
export async function activeOvertureRelease(
  db: Pick<DataSource, 'query'>
): Promise<ActiveRelease> {
  const rows = await db.query(
    `SELECT release, inventory, "rightsPolicy" FROM directory_overture_release_candidate
      WHERE status='promoted' ORDER BY "decidedAt" DESC NULLS LAST, release DESC LIMIT 1`
  );
  const row = rows[0];
  return row
    ? {
        release: row.release,
        source: 'promoted',
        inventory: row.inventory ?? null,
        rights: row.rightsPolicy ?? null,
      }
    : {
        release: PINNED_OVERTURE_RELEASE,
        source: 'pinned',
        inventory: null,
        rights: null,
      };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface ReleaseRightsCheck {
  status: 'approved' | 'mismatch';
  detail: Record<string, unknown>;
  policy: OvertureRightsPolicy | null;
}

/**
 * The licence check. Overture's release metadata declares the licence as a collection-level value plus a link to its
 * attribution and licensing page (the per-dataset licences are on each row's sources and are mapped by the rights
 * policy). A release is approved for acquisition only when that declaration is identical to the one the active release
 * was approved under and the policy approves ingest; the candidate then runs under the same policy with the release id
 * and the attribution month changed. A changed or missing declaration is a mismatch: the release is held and only the
 * owner can approve new terms. A dataset the policy does not map still lands in rights review row by row, exactly as it
 * does for the pinned release.
 */
export function checkReleaseRights(
  release: string,
  declared: string | null,
  activeDeclared: string | null,
  base: OvertureRightsPolicy
): ReleaseRightsCheck {
  const detail = {
    declared: declared?.trim() || null,
    approvedDeclaration: activeDeclared?.trim() || null,
    approvedLicenses: [
      ...new Set((base.terms ?? []).map((t) => String(t.license))),
    ].sort(),
  };
  if (
    !detail.declared ||
    detail.declared !== detail.approvedDeclaration ||
    base.operations?.ingest !== true ||
    !(base.terms ?? []).length
  )
    return { status: 'mismatch', detail, policy: null };
  const month = Number(release.slice(5, 7));
  const label = `${MONTHS[month - 1] ?? ''} ${release.slice(0, 4)}`.trim();
  return {
    status: 'approved',
    detail,
    policy: {
      ...base,
      releaseId: release,
      terms: (base.terms ?? []).map((t) => ({
        ...t,
        attribution: t.attribution.replace(/\([A-Za-z]+ \d{4}\)/, `(${label})`),
      })),
    },
  };
}

/** Canary towns: eligible, geometry ready, not owner-locked, populated first, the same towns every time. */
export async function selectCanaryTowns(
  db: Pick<DataSource, 'query'>,
  inventory: OvertureInventory,
  count: number,
  maxAssets: number
): Promise<AutoTown[]> {
  const rows = await db.query(
    `${TOWN_SQL}
      WHERE t.eligible IS TRUE AND t."geometryStatus"='ready' AND t."mergedIntoCommunityId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=t."communityId")
      ORDER BY (SELECT count(*) FROM directory_overture_private_row r
                  WHERE r."regionId"=t."communityId"::text) DESC, t."communityId"`
  );
  const picked: AutoTown[] = [];
  for (const row of rows) {
    const town = toTown(row);
    if (!town) continue;
    const covering = assetsForBounds(inventory.items, town.bounds).length;
    if (covering === 0 || covering > maxAssets) continue;
    picked.push(town);
    if (picked.length >= count) break;
  }
  return picked;
}

export interface CanaryResult {
  townId: string;
  townName: string;
  runId: string | null;
  status: string | null;
  outcome: 'ok' | 'pending' | 'failed';
  reason: string | null;
}

export interface ReleaseSweepDeps {
  db: DataSource;
  source: ReleaseSource;
  /** The inputs the active release runs under: the rights policy the candidate's check compares with, and the envelope. */
  active: {
    release: string;
    inventory: OvertureInventory;
    rights: OvertureRightsPolicy;
  };
  extract: AutoAcquisitionDeps['extract'];
  canaryTowns?: number;
  config?: Partial<AutoAcquisitionConfig>;
  qualityLimits?: QualityLimits;
  signal?: AbortSignal;
  log?: (message: string) => void;
  heartbeatMs?: number;
}

const bboxOf = (
  inventory: OvertureInventory
): [number, number, number, number] => {
  if (inventory.envelope) return inventory.envelope;
  const b = inventory.items.map((i) => i.bbox);
  return [
    Math.min(...b.map((x) => x[0])),
    Math.min(...b.map((x) => x[1])),
    Math.max(...b.map((x) => x[2])),
    Math.max(...b.map((x) => x[3])),
  ];
};

async function latestCanaryRun(
  db: DataSource,
  release: string,
  townId: string,
  since: Date | null
): Promise<{
  id: string;
  status: string;
  failedQuality: boolean;
  runs: number;
} | null> {
  const rows = await db.query(
    `SELECT id, status, quality, "blockedReason",
            (SELECT count(*)::int FROM directory_acquisition_run a WHERE a.kind='overture-stage' AND a.provider='overture'
               AND a.release=$1 AND a."townIds" @> to_jsonb($2::text) AND ($3::timestamptz IS NULL OR a."createdAt">=$3)) AS runs
       FROM directory_acquisition_run r
      WHERE r.kind='overture-stage' AND r.provider='overture' AND r.release=$1 AND r."townIds" @> to_jsonb($2::text)
        AND ($3::timestamptz IS NULL OR r."createdAt">=$3)
      ORDER BY r."createdAt" DESC, r.id DESC LIMIT 1`,
    [release, townId, since]
  );
  const r = rows[0];
  return r
    ? {
        id: r.id,
        status: r.status,
        failedQuality:
          r.status === 'failed_permanent' &&
          (r.quality?.passed === false ||
            r.blockedReason === QUALITY_FAILURE_REASON),
        runs: Number(r.runs),
      }
    : null;
}

const RETRYABLE = new Set(['failed_retryable', 'partial', 'cancelled']);

function classify(
  town: AutoTown,
  run: Awaited<ReturnType<typeof latestCanaryRun>>
): CanaryResult {
  const base = { townId: town.id, townName: town.name };
  if (!run)
    return {
      ...base,
      runId: null,
      status: null,
      outcome: 'pending',
      reason: null,
    };
  const mk = (outcome: CanaryResult['outcome'], reason: string | null) => ({
    ...base,
    runId: run.id,
    status: run.status,
    outcome,
    reason,
  });
  if (run.status === 'succeeded') return mk('ok', null);
  // A populated town that yields nothing is not evidence the release works.
  if (run.status === 'succeeded_empty') return mk('failed', 'canary_empty');
  if (run.failedQuality) return mk('failed', QUALITY_FAILURE_REASON);
  if (run.status === 'failed_permanent') return mk('failed', 'canary_failed');
  if (RETRYABLE.has(run.status) && run.runs >= MAX_CANARY_ATTEMPTS)
    return mk('failed', 'canary_failed');
  return mk('pending', null);
}

async function hold(
  db: DataSource,
  release: string,
  reason: string,
  results?: CanaryResult[]
): Promise<void> {
  await db.query(
    `UPDATE directory_overture_release_candidate
        SET status='held',"holdReason"=$2,"canaryResults"=COALESCE($3::jsonb,"canaryResults"),"updatedAt"=clock_timestamp()
      WHERE release=$1 AND status IN ('detected','canary_running')`,
    [release, reason, results ? JSON.stringify(results) : null]
  );
}

/** Records the newest release newer than the active one (and marks older unseen ones superseded). Returns its id. */
async function detect(deps: ReleaseSweepDeps): Promise<string | null> {
  const { db, source, active } = deps;
  const log = deps.log ?? (() => undefined);
  const newer = (await source.listReleases())
    .filter((r) => isReleaseId(r) && compareReleases(r, active.release) > 0)
    .sort(compareReleases);
  if (!newer.length) return null;
  const newest = newer[newer.length - 1];
  for (const older of newer.slice(0, -1))
    await db.query(
      `INSERT INTO directory_overture_release_candidate (release,status,"rightsStatus","rightsDetail","holdReason")
       VALUES ($1,'rejected','mismatch','{}'::jsonb,$2) ON CONFLICT (release) DO NOTHING`,
      [older, `superseded_by_${newest}`]
    );
  const [known] = await db.query(
    `SELECT 1 FROM directory_overture_release_candidate WHERE release=$1`,
    [newest]
  );
  if (!known) {
    const check = checkReleaseRights(
      newest,
      await source.licenseOf(newest),
      await source.licenseOf(active.release),
      active.rights
    );
    await db.query(
      `INSERT INTO directory_overture_release_candidate (release,status,"rightsStatus","rightsDetail","rightsPolicy","holdReason")
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6) ON CONFLICT (release) DO NOTHING`,
      [
        newest,
        check.status === 'approved' ? 'detected' : 'held',
        check.status,
        JSON.stringify(check.detail),
        check.policy ? JSON.stringify(check.policy) : null,
        check.status === 'approved' ? null : 'rights_mismatch',
      ]
    );
    log(`overture release: found ${newest}, rights ${check.status}`);
  }
  return newest;
}

/** Brings a candidate that has no inventory or canary towns yet to the point where it can run. Returns false when it is held or waiting. */
async function prepare(
  deps: ReleaseSweepDeps,
  release: string
): Promise<boolean> {
  const { db, source, active } = deps;
  const maxAssets = Math.min(
    16,
    deps.config?.maxAssets ?? DEFAULT_AUTO_CONFIG.maxAssets
  );
  let [row] = await db.query(
    `SELECT * FROM directory_overture_release_candidate WHERE release=$1`,
    [release]
  );
  if (!row || !['detected', 'canary_running'].includes(row.status))
    return false;
  if (row.rightsStatus === 'mismatch' || !row.rightsPolicy) {
    // An operator retry after the owner approved the licence: check again.
    const check = checkReleaseRights(
      release,
      await source.licenseOf(release),
      await source.licenseOf(active.release),
      active.rights
    );
    if (check.status === 'mismatch') {
      await db.query(
        `UPDATE directory_overture_release_candidate SET status='held',"holdReason"='rights_mismatch',"rightsDetail"=$2::jsonb,"updatedAt"=clock_timestamp() WHERE release=$1`,
        [release, JSON.stringify(check.detail)]
      );
      return false;
    }
    await db.query(
      `UPDATE directory_overture_release_candidate SET "rightsStatus"='approved',"rightsDetail"=$2::jsonb,"rightsPolicy"=$3::jsonb,"updatedAt"=clock_timestamp() WHERE release=$1`,
      [release, JSON.stringify(check.detail), JSON.stringify(check.policy)]
    );
    [row] = await db.query(
      `SELECT * FROM directory_overture_release_candidate WHERE release=$1`,
      [release]
    );
  }
  if (!row.inventory) {
    try {
      const inventory = await source.buildInventory(
        release,
        bboxOf(active.inventory)
      );
      if (
        inventory?.release !== release ||
        !Array.isArray(inventory.items) ||
        !inventory.items.length
      )
        return await hold(db, release, 'inventory_invalid'), false;
      await db.query(
        `UPDATE directory_overture_release_candidate SET inventory=$2::jsonb,"lastError"=NULL,"updatedAt"=clock_timestamp() WHERE release=$1`,
        [release, JSON.stringify(inventory)]
      );
      row.inventory = inventory;
    } catch (error) {
      // Public metadata unreachable: try again on the next sweep, the release stays as it is.
      await db.query(
        `UPDATE directory_overture_release_candidate SET "lastError"=$2,"updatedAt"=clock_timestamp() WHERE release=$1`,
        [
          release,
          (error instanceof Error
            ? error.message
            : 'Inventory unavailable'
          ).slice(0, 512),
        ]
      );
      return false;
    }
  }
  if (!(row.canaryTownIds as string[]).length) {
    const towns = await selectCanaryTowns(
      db,
      row.inventory,
      deps.canaryTowns ?? DEFAULT_CANARY_TOWNS,
      maxAssets
    );
    if (!towns.length) return await hold(db, release, 'no_canary_towns'), false;
    await db.query(
      `UPDATE directory_overture_release_candidate SET "canaryTownIds"=$2::jsonb,"updatedAt"=clock_timestamp() WHERE release=$1`,
      [release, JSON.stringify(towns.map((t) => t.id))]
    );
  }
  await db.query(
    `UPDATE directory_overture_release_candidate SET status='canary_running',"canaryStartedAt"=COALESCE("canaryStartedAt",clock_timestamp()),"updatedAt"=clock_timestamp()
      WHERE release=$1 AND status='detected'`,
    [release]
  );
  return true;
}

async function loadTownById(
  db: DataSource,
  id: string
): Promise<AutoTown | null> {
  const rows = await db.query(
    `${TOWN_SQL} WHERE t."communityId"=$1 AND t."geometryStatus"='ready'`,
    [id]
  );
  return rows[0] ? toTown(rows[0]) : null;
}

/**
 * One sweep: detect, prepare, run the canaries that still need a run, then promote or hold. Safe to call at any
 * interval and after any restart; a sweep with nothing to do reads and returns.
 */
export async function runOvertureReleaseSweep(
  deps: ReleaseSweepDeps
): Promise<AutoSweepOutcome> {
  const { db } = deps;
  const log = deps.log ?? (() => undefined);
  if (!isAcquisitionAuthorized('overture')) return emptyOutcome('blocked');
  if (await isPaused(db, 'provider_acquisition')) return emptyOutcome('paused');
  if ((await acquisitionBudgetPanel(db)).hardStop)
    return emptyOutcome('blocked');
  const out = emptyOutcome('ok');
  let release: string | null;
  try {
    release = await detect(deps);
  } catch (error) {
    log(
      `overture release: source unavailable (${
        error instanceof Error ? error.message : 'error'
      })`
    );
    return out;
  }
  if (!release || !(await prepare(deps, release))) return out;
  const [row] = await db.query(
    `SELECT * FROM directory_overture_release_candidate WHERE release=$1`,
    [release]
  );
  const inventory = row.inventory as OvertureInventory;
  const rights = row.rightsPolicy as OvertureRightsPolicy;
  const config = {
    ...DEFAULT_AUTO_CONFIG,
    ...deps.config,
    maxAssets: Math.min(
      16,
      Math.max(deps.config?.maxAssets ?? 0, DEFAULT_AUTO_CONFIG.maxAssets)
    ),
  };
  const canaryDeps: AutoAcquisitionDeps = {
    db,
    inventory,
    rights,
    extract: deps.extract,
    config,
    qualityLimits: deps.qualityLimits,
    signal: deps.signal,
    log: deps.log,
    heartbeatMs: deps.heartbeatMs,
  };
  await closeStaleAutoRuns(db, release);
  const since: Date | null = row.canaryStartedAt ?? null;
  const results: CanaryResult[] = [];
  for (const townId of row.canaryTownIds as string[]) {
    if (deps.signal?.aborted) return out;
    const town = await loadTownById(db, townId);
    if (!town) {
      results.push({
        townId,
        townName: '',
        runId: null,
        status: null,
        outcome: 'failed',
        reason: 'canary_town_unavailable',
      });
      continue;
    }
    let run = await latestCanaryRun(db, release, townId, since);
    let result = classify(town, run);
    const needsRun =
      !run || (result.outcome === 'pending' && RETRYABLE.has(run.status));
    if (needsRun) {
      if (await isPaused(db, 'provider_acquisition')) {
        out.status = 'paused';
        return out;
      }
      try {
        const done = await acquireTown(canaryDeps, town);
        tally(out, done.status);
        if (done.status === 'blocked') {
          // A budget or kill-switch block holds every run; the release is neither promoted nor held for it.
          out.status = 'blocked';
          return out;
        }
      } catch (error) {
        if (error instanceof ProviderPausedError) {
          out.status = 'paused';
          return out;
        }
        throw error;
      }
      run = await latestCanaryRun(db, release, townId, since);
      result = classify(town, run);
    }
    results.push(result);
  }
  const failed = results.find((r) => r.outcome === 'failed');
  if (failed) {
    // A quality failure names itself; any other failed canary is reported as such.
    const reason = results.some((r) => r.reason === QUALITY_FAILURE_REASON)
      ? QUALITY_FAILURE_REASON
      : failed.reason ?? 'canary_failed';
    await hold(db, release, reason, results);
    log(`overture release: ${release} held (${reason})`);
    return out;
  }
  await db.query(
    `UPDATE directory_overture_release_candidate SET "canaryResults"=$2::jsonb,"updatedAt"=clock_timestamp() WHERE release=$1`,
    [release, JSON.stringify(results)]
  );
  if (results.length && results.every((r) => r.outcome === 'ok')) {
    await db.query(
      `UPDATE directory_overture_release_candidate
          SET status='promoted',"holdReason"=NULL,"decidedAt"=clock_timestamp(),"updatedAt"=clock_timestamp()
        WHERE release=$1 AND status='canary_running'`,
      [release]
    );
    log(`overture release: ${release} promoted`);
  }
  return out;
}

export interface ReleaseDecisionInput {
  release: string;
  actorId: string;
  decisionId: string;
  reason: string;
}

/** Operator retry of a held release: clears the canary state so the next sweep runs the canaries again. */
export async function retryReleaseCandidate(
  db: DataSource,
  input: ReleaseDecisionInput
) {
  return decide(db, input, 'retry');
}
/** Operator rejection: the release is never considered again. */
export async function rejectReleaseCandidate(
  db: DataSource,
  input: ReleaseDecisionInput
) {
  return decide(db, input, 'reject');
}

async function decide(
  db: DataSource,
  input: ReleaseDecisionInput,
  action: 'retry' | 'reject'
) {
  if (
    !isReleaseId(input.release) ||
    !UUID.test(input.actorId) ||
    !UUID.test(input.decisionId) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 1024
  )
    throw Error('Invalid release decision');
  return db.transaction(async (m) => {
    const [row] = await m.query(
      `SELECT release,status,"decisionId","holdReason" FROM directory_overture_release_candidate WHERE release=$1 FOR UPDATE`,
      [input.release]
    );
    if (!row) throw Error('Release not found');
    const [seen] = await m.query(
      `SELECT release,status FROM directory_overture_release_candidate WHERE "decisionId"=$1`,
      [input.decisionId]
    );
    if (seen) {
      // The same decision again is a replay; a different release or action under the same id is a conflict.
      if (seen.release !== input.release)
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { release: seen.release, status: seen.status, replayed: true };
    }
    const allowed =
      action === 'retry' ? ['held'] : ['held', 'detected', 'canary_running'];
    if (!allowed.includes(row.status))
      throw new ReviewConflictError('invalid_state', undefined, row.status);
    const next = action === 'retry' ? 'detected' : 'rejected';
    await m.query(
      `UPDATE directory_overture_release_candidate
          SET status=$2,"decidedAt"=clock_timestamp(),"decidedBy"=$3,"decisionId"=$4,"decisionReason"=$5,"updatedAt"=clock_timestamp()
              ${
                action === 'retry'
                  ? `,"holdReason"=NULL,"lastError"=NULL,"canaryTownIds"='[]'::jsonb,"canaryResults"='[]'::jsonb,"canaryStartedAt"=NULL`
                  : ''
              }
        WHERE release=$1`,
      [
        input.release,
        next,
        input.actorId,
        input.decisionId,
        input.reason.trim(),
      ]
    );
    return { release: input.release, status: next, replayed: false };
  });
}

export interface ReleasePanel {
  active: { release: string; source: 'pinned' | 'promoted' };
  candidates: {
    release: string;
    status: string;
    rightsStatus: string;
    holdReason: string | null;
    lastError: string | null;
    canary: CanaryResult[];
    canaryTownCount: number;
    detectedAt: string;
    updatedAt: string;
    decidedAt: string | null;
  }[];
}

const iso = (v: unknown): string | null =>
  v instanceof Date
    ? v.toISOString()
    : v
    ? new Date(String(v)).toISOString()
    : null;

/** What the Owner Console and the ops metrics show: the active release and the newest candidates. */
export async function overtureReleasePanel(
  db: Pick<DataSource, 'query'>,
  limit = 10
): Promise<ReleasePanel> {
  const active = await activeOvertureRelease(db);
  const rows = await db.query(
    `SELECT release,status,"rightsStatus","holdReason","lastError","canaryTownIds","canaryResults","detectedAt","updatedAt","decidedAt"
       FROM directory_overture_release_candidate ORDER BY "detectedAt" DESC, release DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 50)]
  );
  return {
    active: { release: active.release, source: active.source },
    candidates: rows.map((r: any) => ({
      release: r.release,
      status: r.status,
      rightsStatus: r.rightsStatus,
      holdReason: r.holdReason ?? null,
      lastError: r.lastError ?? null,
      canary: Array.isArray(r.canaryResults) ? r.canaryResults : [],
      canaryTownCount: Array.isArray(r.canaryTownIds)
        ? r.canaryTownIds.length
        : 0,
      detectedAt: iso(r.detectedAt) as string,
      updatedAt: iso(r.updatedAt) as string,
      decidedAt: iso(r.decidedAt),
    })),
  };
}

/**
 * Rights policies of promoted releases, for the synchronous `policyFor` lookups the export and rights-sync paths use.
 * `primePromotedRights` fills it from the database; the policy file stays the first source.
 */
const promotedRights = new Map<string, OvertureRightsPolicy>();
export async function primePromotedRights(
  db: Pick<DataSource, 'query'>
): Promise<void> {
  const rows = await db.query(
    `SELECT release,"rightsPolicy" FROM directory_overture_release_candidate WHERE status='promoted' AND "rightsPolicy" IS NOT NULL`
  );
  promotedRights.clear();
  for (const r of rows) promotedRights.set(r.release, r.rightsPolicy);
}
export const promotedRightsPolicy = (
  release: string
): OvertureRightsPolicy | undefined => promotedRights.get(release);
