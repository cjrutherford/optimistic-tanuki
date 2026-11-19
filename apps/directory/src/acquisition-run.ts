import { createHash, randomUUID } from 'node:crypto';
import type {
  AcquisitionBlockedReason,
  AcquisitionBudgetPanel,
  AcquisitionEventRecord,
  AcquisitionImportHistoryResult,
  AcquisitionJobRecord,
  AcquisitionRunActionResult,
  AcquisitionRunDetail,
  AcquisitionRunKind,
  AcquisitionRunList,
  AcquisitionRunStatus,
  AcquisitionRunSummary,
} from '../../../libs/social/contracts/src/lib/directory';
import {
  geoapifyCreditsToday,
  geoapifyDailyCreditLimit,
  MONTHLY_LIMIT_CENTS,
} from './provider-budget';
import {
  anyAcquisitionAuthorized,
  providerAuthorizationTable,
} from './acquisition-authorization';
import { isPaused, ProviderPausedError } from './operating-controls';
import {
  IDEMPOTENCY_CONFLICT,
  ReviewConflictError,
  assertFreshToken,
  versionToken,
} from './review-version';

/**
 * Acquisition run ledger (S7e).
 *
 * The local stage scripts call the first group of functions (`beginRun` ... `finishRun`, `shouldStop`); the Owner Console
 * reaches the second group (list/detail/budget and the cancel/resume/retry/import-history requests) through the
 * Gateway. Nothing here dispatches a provider call or authorises acquisition. Runs are script-driven, so an operator's
 * resume or retry is a durable request that the stage consumes when started with `--resume <runId>`.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UNIT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const PROVIDER = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** A running run that has not heartbeated for this long is presumed dead; an operator cancel then ends it directly. */
export const ACQUISITION_STALE_MINUTES = 10;
/** Authorisation is per provider (`acquisition-authorization.ts`); a run blocked as unauthorised cannot be resumed from the console. */

const KINDS: readonly AcquisitionRunKind[] = [
  'overture-stage',
  'poc-import',
  'census-stage',
  'historical',
];
const STATUSES: readonly AcquisitionRunStatus[] = [
  'queued',
  'running',
  'succeeded',
  'succeeded_empty',
  'partial',
  'blocked',
  'failed_retryable',
  'failed_permanent',
  'cancel_requested',
  'cancelled',
];
const JOB_TERMINAL = [
  'succeeded',
  'succeeded_empty',
  'partial',
  'blocked',
  'failed_retryable',
  'failed_permanent',
  'cancelled',
];
const JOB_RESUMABLE = ['partial', 'failed_retryable', 'cancelled'];
const JOB_RETRYABLE = [
  'partial',
  'failed_retryable',
  'failed_permanent',
  'cancelled',
];
const REASONS: readonly AcquisitionBlockedReason[] = [
  'policy_blocked',
  'unconfigured_provider',
  'budget_exhausted',
  'quota_exhausted',
  'invalid_geometry',
  'acquisition_unauthorized',
  'provider_paused',
  'geometry_pending',
];

const iso = (v: unknown) =>
  v === null || v === undefined
    ? null
    : v instanceof Date
    ? v.toISOString()
    : String(v);
const num = (v: unknown) => Number(v ?? 0);

/**
 * Strip anything that could carry a credential, host or path before an error is stored or shown. Only a short,
 * generic message survives; the stage's own console keeps the original.
 */
export function redactError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : '';
  return (
    raw
      .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '[url]')
      .replace(/(?:[A-Za-z]:)?(?:\/[\w.@~-]+){2,}\/?/g, '[path]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '[host]')
      .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?\b/gi, '[host]')
      .replace(/[A-Za-z0-9+/_=-]{24,}/g, '[redacted]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200) || 'Failed'
  );
}

/** What a stage error means for the run. Budget and policy refusals block; anything else is a retryable failure. */
export function classifyStageError(error: unknown): {
  status: 'blocked' | 'failed_retryable' | 'failed_permanent';
  blockedReason: AcquisitionBlockedReason | null;
  message: string;
} {
  const raw = error instanceof Error ? error.message : '';
  const message = redactError(error);
  if (error instanceof ProviderPausedError || /provider_paused/.test(raw))
    return { status: 'blocked', blockedReason: 'provider_paused', message };
  if (/(Monthly provider budget|Daily provider credits) exhausted/i.test(raw))
    return { status: 'blocked', blockedReason: 'budget_exhausted', message };
  if (/quota/i.test(raw))
    return { status: 'blocked', blockedReason: 'quota_exhausted', message };
  if (/policy unavailable or revoked|Grant|grant/.test(raw))
    return { status: 'blocked', blockedReason: 'policy_blocked', message };
  if (/checksum mismatch|geometry/i.test(raw))
    return { status: 'blocked', blockedReason: 'invalid_geometry', message };
  if (/not enabled|Explicit local|Refusing non-local/i.test(raw))
    return {
      status: 'blocked',
      blockedReason: 'acquisition_unauthorized',
      message,
    };
  if (/Invalid|Unknown|changed|unavailable or ambiguous/i.test(raw))
    return { status: 'failed_permanent', blockedReason: null, message };
  return { status: 'failed_retryable', blockedReason: null, message };
}

/** Reason prefix of a run the directory worker started itself; the worker also consumes its resume requests. */
export const AUTO_RUN_REASON_PREFIX = 'auto:';

export function resumeCommand(
  kind: string,
  id: string,
  reason = ''
): string | null {
  if (reason.startsWith(AUTO_RUN_REASON_PREFIX)) return null;
  const scripts: Record<string, string> = {
    'overture-stage': 'local-directory-overture-stage.cjs --stage-local',
    'census-stage': 'local-directory-overture-census-stage.cjs --stage-local',
    'poc-import': 'local-directory-poc-import.cjs --apply-local',
  };
  const script = scripts[kind];
  return script && UUID.test(id)
    ? `DIRECTORY_LOCAL_EVALUATION=true node scripts/${script} --resume ${id}`
    : null;
}

/* ------------------------------ row mapping ------------------------------ */

const RUN_COLUMNS = `id,provider,release,kind,"townIds",status,"blockedReason","startedById",reason,"createdAt","startedAt","heartbeatAt","finishedAt",
  "observedCount","acceptedCount","rejectedCount","budgetReservedCents","budgetUsedCents","lastError",quality,
  (status IN ('running','cancel_requested') AND ("heartbeatAt" IS NULL OR "heartbeatAt" < clock_timestamp() - make_interval(mins => ${ACQUISITION_STALE_MINUTES}))) AS stale`;
const JOB_COLUMNS = `"unitKey","townId","scanId",status,"blockedReason",checkpoint,attempt,"observedCount","acceptedCount","rejectedCount","lastError","startedAt","finishedAt","updatedAt"`;

function toSummary(r: any): AcquisitionRunSummary {
  return {
    id: r.id,
    provider: r.provider,
    release: r.release ?? null,
    kind: r.kind,
    townIds: Array.isArray(r.townIds) ? r.townIds : [],
    status: r.status,
    blockedReason: r.blockedReason ?? null,
    startedBy: r.startedById ? 'operator' : 'system',
    startedById: r.startedById ?? null,
    reason: r.reason ?? '',
    createdAt: iso(r.createdAt) as string,
    startedAt: iso(r.startedAt),
    heartbeatAt: iso(r.heartbeatAt),
    finishedAt: iso(r.finishedAt),
    stale: r.stale === true,
    observed: num(r.observedCount),
    accepted: num(r.acceptedCount),
    rejected: num(r.rejectedCount),
    budgetReservedCents: num(r.budgetReservedCents),
    budgetUsedCents: num(r.budgetUsedCents),
    lastError: r.lastError ?? null,
    quality: r.quality && typeof r.quality === 'object' ? r.quality : null,
    failureReason:
      r.status === 'failed_permanent' && r.quality?.passed === false
        ? 'quality_limit'
        : null,
  };
}
const toJob = (r: any): AcquisitionJobRecord => ({
  unitKey: r.unitKey,
  townId: r.townId ?? null,
  scanId: r.scanId ?? null,
  status: r.status,
  blockedReason: r.blockedReason ?? null,
  checkpoint: r.checkpoint ?? null,
  attempt: num(r.attempt),
  observed: num(r.observedCount),
  accepted: num(r.acceptedCount),
  rejected: num(r.rejectedCount),
  lastError: r.lastError ?? null,
  startedAt: iso(r.startedAt),
  finishedAt: iso(r.finishedAt),
  updatedAt: iso(r.updatedAt) as string,
});
const toEvent = (r: any): AcquisitionEventRecord => ({
  id: r.id,
  action: r.action,
  actorId: r.actorId ?? null,
  reason: r.reason,
  unitKey: r.unitKey ?? null,
  statusBefore: r.statusBefore ?? null,
  statusAfter: r.statusAfter ?? null,
  ofEventId: r.ofEventId ?? null,
  createdAt: iso(r.createdAt) as string,
});

const tokenOf = (run: any, jobs: any[], eventCount: number) =>
  versionToken([
    run.id,
    run.status,
    run.blockedReason ?? null,
    eventCount,
    jobs.map((j) => [j.unitKey, j.status, num(j.attempt)]),
  ]);

async function loadDetail(
  q: Q,
  id: string
): Promise<AcquisitionRunDetail | null> {
  const [run] = await q.query(
    `SELECT ${RUN_COLUMNS} FROM directory_acquisition_run WHERE id=$1`,
    [id]
  );
  if (!run) return null;
  const jobs = await q.query(
    `SELECT ${JOB_COLUMNS} FROM directory_acquisition_run_job WHERE "runId"=$1 ORDER BY "unitKey"`,
    [id]
  );
  const events = await q.query(
    `SELECT id,"runId",action,"actorId",reason,"unitKey","statusBefore","statusAfter","ofEventId","createdAt"
       FROM directory_acquisition_run_event WHERE "runId"=$1 ORDER BY "createdAt",id`,
    [id]
  );
  const consumed = new Set(
    events.filter((e) => e.action === 'consumed').map((e) => e.ofEventId)
  );
  const pending = events.some(
    (e) =>
      (e.action === 'resume' || e.action === 'retry') && !consumed.has(e.id)
  );
  const summary = toSummary(run);
  return {
    ...summary,
    jobs: jobs.map(toJob),
    events: events.map(toEvent),
    completeness: {
      done: jobs.filter((j) => JOB_TERMINAL.includes(j.status)).length,
      total: jobs.length,
    },
    versionToken: tokenOf(run, jobs, events.length),
    pendingRequest: pending,
    resumeCommand: pending
      ? resumeCommand(summary.kind, id, summary.reason)
      : null,
  };
}

/* --------------------------- stage-side library --------------------------- */

export interface BeginRunInput {
  id?: string;
  provider: string;
  release?: string | null;
  kind: Exclude<AcquisitionRunKind, 'historical'>;
  townIds?: string[];
  reason?: string;
}

/** Record a new run as running. The stage owns the returned id for the rest of the invocation. */
export async function beginRun(db: Q, input: BeginRunInput): Promise<string> {
  const id = input.id ?? randomUUID();
  const townIds = input.townIds ?? [];
  if (
    !UUID.test(id) ||
    !PROVIDER.test(input.provider) ||
    !KINDS.includes(input.kind) ||
    (input.kind as string) === 'historical' ||
    townIds.length > 500 ||
    townIds.some((t) => !UUID.test(t))
  )
    throw Error('Invalid acquisition run');
  // A paused provider path records a blocked run and refuses before the stage does any provider work.
  const paused = await isPaused(db, 'provider_acquisition');
  await db.query(
    `INSERT INTO directory_acquisition_run (id,provider,release,kind,"townIds",status,"blockedReason",reason,"startedAt","heartbeatAt","finishedAt","lastError")
     VALUES ($1,$2,$3,$4,$5::jsonb,$7,$8,$6,clock_timestamp(),clock_timestamp(),CASE WHEN $9::boolean THEN clock_timestamp() END,$10)`,
    [
      id,
      input.provider,
      input.release ?? null,
      input.kind,
      JSON.stringify(townIds),
      (input.reason ?? '').slice(0, 1024),
      paused ? 'blocked' : 'running',
      paused ? 'provider_paused' : null,
      paused,
      paused ? 'Provider acquisition is paused' : null,
    ]
  );
  if (paused) throw new ProviderPausedError();
  return id;
}

/**
 * Resume an existing run: consume every pending resume/retry request (each gets a `consumed` event, once), and move the
 * run back to running. Returns the unit keys that are queued. Throws when the run was not re-queued by an operator.
 */
export async function resumeRunFromRequest(
  db: Db,
  runId: string
): Promise<{ id: string; kind: string; units: string[] }> {
  if (!UUID.test(runId)) throw Error('Invalid run');
  return db.transaction(async (q) => {
    const [run] = await q.query(
      `SELECT id,kind,status FROM directory_acquisition_run WHERE id=$1 FOR UPDATE`,
      [runId]
    );
    if (!run) throw Error('Run not found');
    const pending = await q.query(
      `SELECT e.id FROM directory_acquisition_run_event e
        WHERE e."runId"=$1 AND e.action IN ('resume','retry')
          AND NOT EXISTS (SELECT 1 FROM directory_acquisition_run_event c WHERE c."ofEventId"=e.id)
        ORDER BY e."createdAt",e.id`,
      [runId]
    );
    if (run.status !== 'queued' || !pending.length)
      throw Error('No pending resume request');
    if (await isPaused(q, 'provider_acquisition'))
      throw new ProviderPausedError();
    for (const p of pending)
      await q.query(
        `INSERT INTO directory_acquisition_run_event (id,"runId",action,reason,"statusBefore","statusAfter","ofEventId")
         VALUES ($1,$2,'consumed','',$3,'running',$4)`,
        [randomUUID(), runId, run.status, p.id]
      );
    await q.query(
      `UPDATE directory_acquisition_run SET status='running',"blockedReason"=NULL,"finishedAt"=NULL,"lastError"=NULL,
         "heartbeatAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1`,
      [runId]
    );
    const jobs = await q.query(
      `SELECT "unitKey" FROM directory_acquisition_run_job WHERE "runId"=$1 AND status='queued' ORDER BY "unitKey"`,
      [runId]
    );
    return { id: runId, kind: run.kind, units: jobs.map((j) => j.unitKey) };
  });
}

export interface BeginJobInput {
  unitKey: string;
  townId?: string | null;
  scanId?: string | null;
}

/** Start (or restart) a job. Returns the checkpoint the previous attempt left, if any, to resume from. */
export async function beginJob(
  db: Q,
  runId: string,
  input: BeginJobInput
): Promise<{ attempt: number; checkpoint: object | null }> {
  if (
    !UUID.test(runId) ||
    !UNIT.test(input.unitKey) ||
    (input.townId && !UUID.test(input.townId))
  )
    throw Error('Invalid acquisition job');
  const [row] = await db.query(
    `INSERT INTO directory_acquisition_run_job ("runId","unitKey","townId","scanId",status,attempt,"startedAt")
     VALUES ($1,$2,$3,$4,'running',1,clock_timestamp())
     ON CONFLICT ("runId","unitKey") DO UPDATE SET status='running',attempt=directory_acquisition_run_job.attempt+1,
       "townId"=COALESCE(EXCLUDED."townId",directory_acquisition_run_job."townId"),
       "scanId"=COALESCE(EXCLUDED."scanId",directory_acquisition_run_job."scanId"),
       "blockedReason"=NULL,"lastError"=NULL,"finishedAt"=NULL,"updatedAt"=clock_timestamp()
     RETURNING attempt,checkpoint`,
    [runId, input.unitKey, input.townId ?? null, input.scanId ?? null]
  );
  await db.query(
    `UPDATE directory_acquisition_run SET "heartbeatAt"=clock_timestamp() WHERE id=$1`,
    [runId]
  );
  return { attempt: num(row.attempt), checkpoint: row.checkpoint ?? null };
}

export interface ProgressInput {
  checkpoint?: object | null;
  observed?: number;
  accepted?: number;
  rejected?: number;
  /** Increments to the run's budget figures. */
  budgetReservedCents?: number;
  budgetUsedCents?: number;
}
const count = (v: unknown) =>
  Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : null;

/** Record progress (absolute counts for the job) and heartbeat the run. Returns whether the stage should stop. */
export async function progress(
  db: Db,
  runId: string,
  unitKey: string,
  input: ProgressInput = {}
): Promise<{ stop: boolean }> {
  if (!UUID.test(runId) || !UNIT.test(unitKey))
    throw Error('Invalid acquisition job');
  await db.transaction(async (q) => {
    await q.query(
      `UPDATE directory_acquisition_run_job SET
         checkpoint=CASE WHEN $3::boolean THEN $4::jsonb ELSE checkpoint END,
         "observedCount"=COALESCE($5::bigint,"observedCount"),"acceptedCount"=COALESCE($6::bigint,"acceptedCount"),
         "rejectedCount"=COALESCE($7::bigint,"rejectedCount"),"updatedAt"=clock_timestamp()
       WHERE "runId"=$1 AND "unitKey"=$2`,
      [
        runId,
        unitKey,
        input.checkpoint !== undefined,
        input.checkpoint === undefined || input.checkpoint === null
          ? null
          : JSON.stringify(input.checkpoint),
        count(input.observed),
        count(input.accepted),
        count(input.rejected),
      ]
    );
    await q.query(
      `UPDATE directory_acquisition_run r SET "heartbeatAt"=clock_timestamp(),"updatedAt"=clock_timestamp(),
         "observedCount"=t.o,"acceptedCount"=t.a,"rejectedCount"=t.j,
         "budgetReservedCents"=r."budgetReservedCents"+$2::int,"budgetUsedCents"=r."budgetUsedCents"+$3::int
       FROM (SELECT COALESCE(SUM("observedCount"),0) o,COALESCE(SUM("acceptedCount"),0) a,COALESCE(SUM("rejectedCount"),0) j
               FROM directory_acquisition_run_job WHERE "runId"=$1) t
       WHERE r.id=$1`,
      [
        runId,
        count(input.budgetReservedCents) ?? 0,
        count(input.budgetUsedCents) ?? 0,
      ]
    );
  });
  return { stop: await shouldStop(db, runId) };
}

/** Heartbeat without progress; returns whether the stage should stop. */
export async function heartbeat(
  db: Q,
  runId: string
): Promise<{ stop: boolean }> {
  if (!UUID.test(runId)) throw Error('Invalid run');
  await db.query(
    `UPDATE directory_acquisition_run SET "heartbeatAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1`,
    [runId]
  );
  return { stop: await shouldStop(db, runId) };
}

/** True once an operator cancelled the run (requested or already effective). The stage checks this between batches. */
export async function shouldStop(db: Q, runId: string): Promise<boolean> {
  if (!UUID.test(runId)) throw Error('Invalid run');
  const [r] = await db.query(
    `SELECT status FROM directory_acquisition_run WHERE id=$1`,
    [runId]
  );
  return !r || r.status === 'cancel_requested' || r.status === 'cancelled';
}

export interface FinishJobInput {
  status: Exclude<
    AcquisitionRunStatus,
    'queued' | 'running' | 'cancel_requested'
  >;
  blockedReason?: AcquisitionBlockedReason | null;
  error?: unknown;
  checkpoint?: object | null;
  observed?: number;
  accepted?: number;
  rejected?: number;
}

export async function finishJob(
  db: Q,
  runId: string,
  unitKey: string,
  input: FinishJobInput
): Promise<void> {
  if (
    !UUID.test(runId) ||
    !UNIT.test(unitKey) ||
    !JOB_TERMINAL.includes(input.status)
  )
    throw Error('Invalid acquisition job');
  if (input.blockedReason && !REASONS.includes(input.blockedReason))
    throw Error('Invalid blocked reason');
  if (input.status === 'blocked' && !input.blockedReason)
    throw Error('Invalid blocked reason');
  await db.query(
    `UPDATE directory_acquisition_run_job SET status=$3,"blockedReason"=$4,"lastError"=$5,
       checkpoint=CASE WHEN $6::boolean THEN $7::jsonb ELSE checkpoint END,
       "observedCount"=COALESCE($8::bigint,"observedCount"),"acceptedCount"=COALESCE($9::bigint,"acceptedCount"),
       "rejectedCount"=COALESCE($10::bigint,"rejectedCount"),"finishedAt"=clock_timestamp(),"updatedAt"=clock_timestamp()
     WHERE "runId"=$1 AND "unitKey"=$2`,
    [
      runId,
      unitKey,
      input.status,
      input.blockedReason ?? null,
      input.error === undefined ? null : redactError(input.error),
      input.checkpoint !== undefined,
      input.checkpoint === undefined || input.checkpoint === null
        ? null
        : JSON.stringify(input.checkpoint),
      count(input.observed),
      count(input.accepted),
      count(input.rejected),
    ]
  );
  await db.query(
    `UPDATE directory_acquisition_run r SET "heartbeatAt"=clock_timestamp(),"updatedAt"=clock_timestamp(),
       "observedCount"=t.o,"acceptedCount"=t.a,"rejectedCount"=t.j
     FROM (SELECT COALESCE(SUM("observedCount"),0) o,COALESCE(SUM("acceptedCount"),0) a,COALESCE(SUM("rejectedCount"),0) j
             FROM directory_acquisition_run_job WHERE "runId"=$1) t
     WHERE r.id=$1`,
    [runId]
  );
}

const rank = (s: string) =>
  ({ blocked: 5, failed_permanent: 4, failed_retryable: 3, partial: 2 }[s] ??
  0);

/**
 * Finish a run. With no explicit status it is derived from the jobs: blocked beats permanent failure beats retryable
 * failure beats partial; all-empty is `succeeded_empty`. A cancel always wins: queued and running jobs become
 * cancelled and the run ends `cancelled` (never overwritten by a late success).
 */
export async function finishRun(
  db: Db,
  runId: string,
  input: {
    status?: Exclude<
      AcquisitionRunStatus,
      'queued' | 'running' | 'cancel_requested'
    >;
    blockedReason?: AcquisitionBlockedReason | null;
    error?: unknown;
  } = {}
): Promise<AcquisitionRunStatus> {
  if (!UUID.test(runId)) throw Error('Invalid run');
  return db.transaction(async (q) => {
    const [run] = await q.query(
      `SELECT status FROM directory_acquisition_run WHERE id=$1 FOR UPDATE`,
      [runId]
    );
    if (!run) throw Error('Run not found');
    const cancelled =
      run.status === 'cancel_requested' || run.status === 'cancelled';
    if (cancelled)
      await q.query(
        `UPDATE directory_acquisition_run_job SET status='cancelled',"finishedAt"=COALESCE("finishedAt",clock_timestamp()),"updatedAt"=clock_timestamp()
          WHERE "runId"=$1 AND status IN ('queued','running')`,
        [runId]
      );
    const jobs = await q.query(
      `SELECT status,"blockedReason" FROM directory_acquisition_run_job WHERE "runId"=$1`,
      [runId]
    );
    let status: AcquisitionRunStatus;
    let blockedReason = input.blockedReason ?? null;
    if (cancelled) status = 'cancelled';
    else if (input.status) status = input.status;
    else {
      const worst = jobs
        .map((j) => j.status)
        .sort((a, b) => rank(b) - rank(a))[0];
      if (rank(worst ?? '') > 0 && worst)
        status = worst as AcquisitionRunStatus;
      else if (
        jobs.some((j) => ['queued', 'running', 'cancelled'].includes(j.status))
      )
        status = 'partial';
      else if (jobs.length && jobs.every((j) => j.status === 'succeeded_empty'))
        status = 'succeeded_empty';
      else status = 'succeeded';
    }
    if (status === 'blocked') {
      blockedReason =
        blockedReason ??
        jobs.find((j) => j.status === 'blocked')?.blockedReason ??
        null;
      if (!blockedReason || !REASONS.includes(blockedReason))
        throw Error('Invalid blocked reason');
    } else blockedReason = null;
    await q.query(
      `UPDATE directory_acquisition_run SET status=$2,"blockedReason"=$3,"lastError"=$4,"finishedAt"=clock_timestamp(),
         "heartbeatAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1`,
      [
        runId,
        status,
        blockedReason,
        input.error === undefined ? null : redactError(input.error),
      ]
    );
    return status;
  });
}

/* ------------------------------ operator reads ----------------------------- */

export async function listAcquisitionRuns(
  db: Q,
  o: { status?: string; townId?: string; limit?: number; offset?: number } = {}
): Promise<AcquisitionRunList> {
  const limit = o.limit ?? 25;
  const offset = o.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw Error('Invalid limit');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw Error('Invalid offset');
  if (
    o.status !== undefined &&
    !STATUSES.includes(o.status as AcquisitionRunStatus)
  )
    throw Error('Invalid status');
  if (o.townId !== undefined && !UUID.test(o.townId))
    throw Error('Invalid town');
  const where = `($1::text IS NULL OR status=$1) AND ($2::text IS NULL OR "townIds" @> to_jsonb($2::text)
      OR EXISTS (SELECT 1 FROM directory_acquisition_run_job j WHERE j."runId"=directory_acquisition_run.id AND j."townId"::text=$2::text))`;
  const params = [o.status ?? null, o.townId ?? null];
  const [{ n }] = await db.query(
    `SELECT count(*)::int AS n FROM directory_acquisition_run WHERE ${where}`,
    params
  );
  const rows = await db.query(
    `SELECT ${RUN_COLUMNS} FROM directory_acquisition_run WHERE ${where} ORDER BY "createdAt" DESC,id LIMIT $3 OFFSET $4`,
    [...params, limit, offset]
  );
  return { runs: rows.map(toSummary), total: n };
}

export async function latestAcquisitionRun(
  db: Q
): Promise<AcquisitionRunDetail | null> {
  const [r] = await db.query(
    `SELECT id FROM directory_acquisition_run ORDER BY "createdAt" DESC,id LIMIT 1`
  );
  return r ? loadDetail(db, r.id) : null;
}

export async function getAcquisitionRun(
  db: Q,
  id: string
): Promise<AcquisitionRunDetail | null> {
  if (!UUID.test(id)) throw Error('Invalid run');
  return loadDetail(db, id);
}

export async function acquisitionBudgetPanel(
  db: Q
): Promise<AcquisitionBudgetPanel> {
  const [{ period }] = await db.query(
    `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM') AS period`
  );
  const [{ reserved }] = await db.query(
    `SELECT COALESCE(SUM("reservedCents"),0)::int AS reserved FROM directory_provider_budget_attempt WHERE period=$1 AND provider<>'geoapify'`,
    [period]
  );
  const [{ anon }] = await db.query(
    `SELECT count(*)::int AS anon FROM directory_anonymous_overture_attempt WHERE period=$1`,
    [period]
  );
  const [{ used }] = await db.query(
    `SELECT COALESCE(SUM("budgetUsedCents"),0)::int AS used FROM directory_acquisition_run
      WHERE to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM')=$1`,
    [period]
  );
  return {
    period,
    ceilingCents: MONTHLY_LIMIT_CENTS,
    reservedCents: reserved,
    geoapifyCreditsToday: await geoapifyCreditsToday(db),
    geoapifyDailyCreditLimit: geoapifyDailyCreditLimit(),
    usedCents: used,
    remainingCents: Math.max(0, MONTHLY_LIMIT_CENTS - reserved),
    anonymousAttempts: anon,
    hardStop: reserved >= MONTHLY_LIMIT_CENTS,
    acquisitionAuthorized: anyAcquisitionAuthorized(),
    providers: providerAuthorizationTable(),
    providerStatus: (
      await db.query(
        `SELECT provider,status,detail,"checkedAt" FROM directory_provider_status ORDER BY provider`
      )
    ).map((r: any) => ({
      provider: String(r.provider),
      status: String(r.status),
      detail: String(r.detail ?? ''),
      checkedAt: new Date(r.checkedAt).toISOString(),
    })),
  };
}

/* ----------------------------- operator actions ---------------------------- */

interface ActionInput {
  id: string;
  decisionId: string;
  actorId: string;
  reason: string;
  expectedVersionToken: string;
  unitKey?: string;
}

function checkAction(i: ActionInput, retry = false) {
  if (
    !UUID.test(i.id) ||
    !UUID.test(i.decisionId) ||
    !UUID.test(i.actorId) ||
    typeof i.reason !== 'string' ||
    !i.reason.trim() ||
    i.reason.length > 1024 ||
    (retry ? !UNIT.test(i.unitKey ?? '') : i.unitKey !== undefined)
  )
    throw Error('Invalid acquisition run');
}

/** A blocked reason clears only when the condition behind it is gone; only the budget can clear from the console. */
async function reasonCleared(q: Q, reason: string | null): Promise<boolean> {
  if (!reason) return true;
  if (reason === 'budget_exhausted')
    return !(await acquisitionBudgetPanel(q)).hardStop;
  if (reason === 'provider_paused')
    return !(await isPaused(q, 'provider_acquisition'));
  return false;
}

async function guardBlocked(q: Q, run: any, jobs: any[]) {
  const reasons = new Set<string>();
  if (run.status === 'blocked' && run.blockedReason)
    reasons.add(run.blockedReason);
  for (const j of jobs)
    if (j.status === 'blocked' && j.blockedReason) reasons.add(j.blockedReason);
  for (const r of reasons)
    if (!(await reasonCleared(q, r)))
      throw new ReviewConflictError('run_blocked', 'run_blocked', r);
}

/** Replay, conflict or fresh: look up the decision id under the run lock. */
async function priorDecision(
  q: Q,
  i: ActionInput,
  action: string
): Promise<any | null> {
  const [e] = await q.query(
    `SELECT id,"runId",action,"actorId",reason,"unitKey" FROM directory_acquisition_run_event WHERE id=$1`,
    [i.decisionId]
  );
  if (!e) return null;
  if (
    e.runId !== i.id ||
    e.action !== action ||
    e.actorId !== i.actorId ||
    e.reason !== i.reason ||
    (e.unitKey ?? undefined) !== i.unitKey
  )
    throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
  return e;
}

async function lockRun(q: Q, id: string) {
  const [run] = await q.query(
    `SELECT ${RUN_COLUMNS} FROM directory_acquisition_run WHERE id=$1 FOR UPDATE`,
    [id]
  );
  if (!run) throw Error('Run not found');
  const jobs = await q.query(
    `SELECT ${JOB_COLUMNS} FROM directory_acquisition_run_job WHERE "runId"=$1 FOR UPDATE`,
    [id]
  );
  const [{ n }] = await q.query(
    `SELECT count(*)::int AS n FROM directory_acquisition_run_event WHERE "runId"=$1`,
    [id]
  );
  return { run, jobs, token: tokenOf(run, jobs, n) };
}

const recordEvent = (
  q: Q,
  i: ActionInput,
  action: string,
  before: string,
  after: string
) =>
  q.query(
    `INSERT INTO directory_acquisition_run_event (id,"runId",action,"actorId",reason,"unitKey","statusBefore","statusAfter")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      i.decisionId,
      i.id,
      action,
      i.actorId,
      i.reason,
      i.unitKey ?? null,
      before,
      after,
    ]
  );

async function result(
  q: Q,
  id: string,
  replayed: boolean
): Promise<AcquisitionRunActionResult> {
  const run = (await loadDetail(q, id)) as AcquisitionRunDetail;
  return { replayed, run, resumeCommand: run.resumeCommand };
}

/**
 * Cancel. A queued run, or a running one whose heartbeat is stale (the process is gone), ends cancelled at once. A live
 * running run becomes `cancel_requested` and the stage stops at its next check.
 */
export async function cancelAcquisitionRun(
  db: Db,
  i: ActionInput
): Promise<AcquisitionRunActionResult> {
  checkAction(i);
  return db.transaction(async (q) => {
    const { run, token } = await lockRun(q, i.id);
    if (await priorDecision(q, i, 'cancel')) return result(q, i.id, true);
    assertFreshToken(i.expectedVersionToken, token);
    let after: AcquisitionRunStatus;
    if (run.status === 'queued') after = 'cancelled';
    else if (run.status === 'running' || run.status === 'cancel_requested')
      after = run.stale ? 'cancelled' : 'cancel_requested';
    else throw new ReviewConflictError('invalid_state');
    if (after === run.status) throw new ReviewConflictError('invalid_state');
    if (after === 'cancelled')
      await q.query(
        `UPDATE directory_acquisition_run_job SET status='cancelled',"finishedAt"=COALESCE("finishedAt",clock_timestamp()),"updatedAt"=clock_timestamp()
          WHERE "runId"=$1 AND status IN ('queued','running')`,
        [i.id]
      );
    await q.query(
      `UPDATE directory_acquisition_run SET status=$2::varchar,"blockedReason"=NULL,
         "finishedAt"=CASE WHEN $2::varchar='cancelled' THEN clock_timestamp() ELSE "finishedAt" END,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [i.id, after]
    );
    await recordEvent(q, i, 'cancel', run.status, after);
    return result(q, i.id, false);
  });
}

/**
 * Resume: re-queue the partial, failed-retryable and cancelled jobs (and blocked ones whose reason has cleared) and
 * record a pending request. The operator then runs the returned command locally; the stage consumes the request.
 */
export async function resumeAcquisitionRun(
  db: Db,
  i: ActionInput
): Promise<AcquisitionRunActionResult> {
  checkAction(i);
  return db.transaction(async (q) => {
    const { run, jobs, token } = await lockRun(q, i.id);
    if (await priorDecision(q, i, 'resume')) return result(q, i.id, true);
    assertFreshToken(i.expectedVersionToken, token);
    if (
      run.kind === 'historical' ||
      !['partial', 'failed_retryable', 'cancelled', 'blocked'].includes(
        run.status
      )
    )
      throw new ReviewConflictError('invalid_state');
    await guardBlocked(q, run, jobs);
    const requeue = jobs.filter((j) =>
      [...JOB_RESUMABLE, 'blocked'].includes(j.status)
    );
    if (!requeue.length) throw new ReviewConflictError('invalid_state');
    await q.query(
      `UPDATE directory_acquisition_run_job SET status='queued',"blockedReason"=NULL,"finishedAt"=NULL,"updatedAt"=clock_timestamp()
        WHERE "runId"=$1 AND status IN ('partial','failed_retryable','cancelled','blocked')`,
      [i.id]
    );
    await q.query(
      `UPDATE directory_acquisition_run SET status='queued',"blockedReason"=NULL,"finishedAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [i.id]
    );
    await recordEvent(q, i, 'resume', run.status, 'queued');
    return result(q, i.id, false);
  });
}

/** Retry a single job: re-queue it and record a pending request, as resume does for all of them. */
export async function retryAcquisitionJob(
  db: Db,
  i: ActionInput
): Promise<AcquisitionRunActionResult> {
  checkAction(i, true);
  return db.transaction(async (q) => {
    const { run, jobs, token } = await lockRun(q, i.id);
    if (await priorDecision(q, i, 'retry')) return result(q, i.id, true);
    assertFreshToken(i.expectedVersionToken, token);
    const job = jobs.find((j) => j.unitKey === i.unitKey);
    if (!job) throw Error('Run not found');
    if (
      run.kind === 'historical' ||
      ![
        'partial',
        'failed_retryable',
        'failed_permanent',
        'cancelled',
        'blocked',
      ].includes(run.status)
    )
      throw new ReviewConflictError('invalid_state');
    if (job.status === 'blocked') await guardBlocked(q, { status: 'x' }, [job]);
    else if (!JOB_RETRYABLE.includes(job.status))
      throw new ReviewConflictError('invalid_state');
    await q.query(
      `UPDATE directory_acquisition_run_job SET status='queued',"blockedReason"=NULL,"finishedAt"=NULL,"updatedAt"=clock_timestamp()
        WHERE "runId"=$1 AND "unitKey"=$2`,
      [i.id, i.unitKey]
    );
    await q.query(
      `UPDATE directory_acquisition_run SET status='queued',"blockedReason"=NULL,"finishedAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [i.id]
    );
    await recordEvent(q, i, 'retry', run.status, 'queued');
    return result(q, i.id, false);
  });
}

/* ------------------------------ history import ----------------------------- */

const stableUuid = (seed: string) => {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(
    17,
    20
  )}-${h.slice(20, 32)}`;
};

/**
 * Create `historical` run records from what earlier scripts already wrote (`directory_town_scan_target` and
 * `directory_census_progress`), so the console is not empty. Idempotent: records are keyed by the scan or progress id,
 * and a repeat refreshes them without duplicating.
 */
export async function importAcquisitionHistory(
  db: Db,
  i: {
    decisionId: string;
    actorId: string;
    reason: string;
    /**
     * The Overture release the operator declares for historical scans that carry no source evidence. Evidence
     * always wins, and a run that already records a release keeps it. The caller checks that an approved rights
     * policy exists for it.
     */
    release?: string;
  }
): Promise<AcquisitionImportHistoryResult> {
  if (
    !UUID.test(i.decisionId) ||
    !UUID.test(i.actorId) ||
    typeof i.reason !== 'string' ||
    !i.reason.trim() ||
    i.reason.length > 1024 ||
    (i.release !== undefined &&
      (typeof i.release !== 'string' ||
        !/^[A-Za-z0-9._-]{1,100}$/.test(i.release)))
  )
    throw Error('Invalid acquisition run');
  // The declared release is part of the audited decision, so a replay with a different release is a conflict.
  const reason =
    i.release === undefined
      ? i.reason
      : `${i.reason} [declared release ${i.release}]`;
  if (reason.length > 1024) throw Error('Invalid acquisition run');
  return db.transaction(async (q) => {
    await q.query(
      `SELECT pg_advisory_xact_lock(hashtextextended('directory-acquisition-history-v1',0))`
    );
    const [prior] = await q.query(
      `SELECT "actorId",reason,action FROM directory_acquisition_run_event WHERE id=$1`,
      [i.decisionId]
    );
    if (prior) {
      if (
        prior.action !== 'import_history' ||
        prior.actorId !== i.actorId ||
        prior.reason !== reason
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      const [{ n }] = await q.query(
        `SELECT count(*)::int AS n FROM directory_acquisition_run WHERE kind='historical'`
      );
      return { replayed: true, created: 0, existing: n };
    }
    let created = 0;
    let existing = 0;
    const tally = (rows: any[]) =>
      rows.forEach((r) => (r.inserted ? created++ : existing++));
    const targets = await q.query(
      `SELECT "scanId",array_agg("communityId"::text ORDER BY "communityId") AS towns,min("targetedAt") AS first,max("completedAt") AS last,
              count(*) FILTER (WHERE "completedAt" IS NULL AND provenance='recorded')::int AS open,
              count(*) FILTER (WHERE COALESCE("rowCount",0)>0)::int AS populated,
              count(*)::int AS total
         FROM directory_town_scan_target GROUP BY "scanId"`
    );
    for (const t of targets) {
      const id = stableUuid(`acquisition-history:scan:${t.scanId}`);
      const status =
        t.open > 0
          ? 'partial'
          : t.populated > 0
          ? 'succeeded'
          : 'succeeded_empty';
      tally(
        await q.query(
          `INSERT INTO directory_acquisition_run (id,provider,release,kind,"townIds",status,reason,"createdAt","startedAt","finishedAt","heartbeatAt")
           VALUES ($1,'overture',COALESCE((SELECT e."releaseId" FROM directory_overture_source_evidence e WHERE e."scanId"=$6 ORDER BY e."evidenceVersion" DESC LIMIT 1),$7::varchar),
                   'historical',$2::jsonb,$3,'Imported from scan targets',$4,$4,$5,$5)
           ON CONFLICT (id) DO UPDATE SET release=COALESCE(directory_acquisition_run.release,EXCLUDED.release),status=EXCLUDED.status,"finishedAt"=EXCLUDED."finishedAt","heartbeatAt"=EXCLUDED."heartbeatAt","updatedAt"=clock_timestamp()
             WHERE directory_acquisition_run.kind='historical'
           RETURNING (xmax=0) AS inserted`,
          [
            id,
            JSON.stringify(t.towns),
            status,
            t.first,
            t.last,
            t.scanId,
            i.release ?? null,
          ]
        )
      );
      await q.query(
        `INSERT INTO directory_acquisition_run_job ("runId","unitKey","townId","scanId",status,attempt,"observedCount","acceptedCount","startedAt","finishedAt")
         SELECT $1,"communityId"::text,"communityId","scanId",
                CASE WHEN "completedAt" IS NULL AND provenance='recorded' THEN 'partial'
                     WHEN COALESCE("rowCount",0)>0 THEN 'succeeded' ELSE 'succeeded_empty' END,
                1,COALESCE("rowCount",0),COALESCE("rowCount",0),"targetedAt","completedAt"
           FROM directory_town_scan_target WHERE "scanId"=$2
         ON CONFLICT ("runId","unitKey") DO UPDATE SET status=EXCLUDED.status,"observedCount"=EXCLUDED."observedCount",
           "acceptedCount"=EXCLUDED."acceptedCount","finishedAt"=EXCLUDED."finishedAt","updatedAt"=clock_timestamp()`,
        [id, t.scanId]
      );
      await q.query(
        `UPDATE directory_acquisition_run r SET "observedCount"=s.n,"acceptedCount"=s.n
           FROM (SELECT COALESCE(SUM("observedCount"),0) n FROM directory_acquisition_run_job WHERE "runId"=$1) s WHERE r.id=$1`,
        [id]
      );
    }
    const progressRows = await q.query(
      `SELECT id,phase,"updatedAt" FROM directory_census_progress ORDER BY id`
    );
    for (const p of progressRows) {
      const id = stableUuid(`acquisition-history:census:${p.id}`);
      const status =
        p.phase === 'complete'
          ? 'succeeded'
          : p.phase === 'blocked'
          ? 'blocked'
          : 'partial';
      tally(
        await q.query(
          `INSERT INTO directory_acquisition_run (id,provider,kind,status,"blockedReason",reason,"createdAt","startedAt","finishedAt","heartbeatAt")
           VALUES ($1,'census','historical',$2,$3,'Imported from census progress',$4,$4,$4,$4)
           ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"blockedReason"=EXCLUDED."blockedReason","finishedAt"=EXCLUDED."finishedAt","updatedAt"=clock_timestamp()
             WHERE directory_acquisition_run.kind='historical'
           RETURNING (xmax=0) AS inserted`,
          [
            id,
            status,
            status === 'blocked' ? 'policy_blocked' : null,
            p.updatedAt,
          ]
        )
      );
    }
    await q.query(
      `INSERT INTO directory_acquisition_run_event (id,action,"actorId",reason) VALUES ($1,'import_history',$2,$3)`,
      [i.decisionId, i.actorId, reason]
    );
    return { replayed: false, created, existing };
  });
}
