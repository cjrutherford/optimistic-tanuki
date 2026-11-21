import { IDEMPOTENCY_CONFLICT, ReviewConflictError } from './review-version';
import { markRightsCaseWithdrawn } from './rights-case';
import { OverturePrivateSink } from './overture-private-sink';
import {
  removeExportFiles,
  withdrawExportArtifacts,
  withdrawalScanIds,
} from './export-job';

/**
 * Authenticated, durable withdrawal (S7c). An operator holding `directory.rights` records a request; the
 * Directory's own worker (below, started by the runtime) drives the private sink's `withdraw`, `withdrawPolicy`
 * or `withdrawRow` until it reports completion. Requests are rows, so a restart resumes `pending` and `running`
 * ones; each sink call is itself revoke-first and idempotent, so re-driving a request is always safe.
 *
 * Withdrawal is ONE WAY. The sink keeps its scan, policy and row revocations on purpose, to fence resurrection:
 * a withdrawn scan, policy or row can never be served again. Restoring data needs a fresh acquisition or import
 * under a new, approved policy. There is no undo and no endpoint that lifts a withdrawal.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;
const ROW_TARGET = /^([0-9a-f]{64}):(0|[1-9][0-9]{0,15})$/;
export const WITHDRAWAL_KINDS = ['scan', 'policy', 'row'] as const;
export const WITHDRAWAL_STATUSES = [
  'pending',
  'running',
  'complete',
  'failed',
] as const;
export type WithdrawalKind = (typeof WITHDRAWAL_KINDS)[number];
/** The deliberate confirmation every create must carry. */
export const WITHDRAWAL_CONFIRMATION = 'WITHDRAW';
export const WITHDRAWAL_MAX_ATTEMPTS = 5;
const INVALID = 'Invalid withdrawal request';

export interface WithdrawalCreateInput {
  readonly id: string;
  readonly kind: WithdrawalKind;
  readonly target: string;
  readonly reason: string;
  readonly actorId: string;
  readonly confirm: string;
  readonly rightsCaseId?: string;
}

export interface WithdrawalRecord {
  id: string;
  kind: string;
  target: string;
  reason: string;
  actorId: string;
  rightsCaseId: string | null;
  status: string;
  attempts: number;
  steps: number;
  progress: Record<string, unknown>;
  lastError: string | null;
  requestedAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const COLUMNS = `id,kind,target,reason,"actorId","rightsCaseId",status,attempts,steps,progress,"lastError","requestedAt","updatedAt","completedAt"`;
const record = (r: any): WithdrawalRecord => ({
  id: r.id,
  kind: r.kind,
  target: r.target,
  reason: r.reason,
  actorId: r.actorId,
  rightsCaseId: r.rightsCaseId ?? null,
  status: r.status,
  attempts: Number(r.attempts),
  steps: Number(r.steps),
  progress: r.progress && typeof r.progress === 'object' ? r.progress : {},
  lastError: r.lastError ?? null,
  requestedAt: iso(r.requestedAt),
  updatedAt: iso(r.updatedAt),
  completedAt: r.completedAt ? iso(r.completedAt) : null,
});

export function validateWithdrawal(input: WithdrawalCreateInput): void {
  if (
    !input ||
    input.confirm !== WITHDRAWAL_CONFIRMATION ||
    !UUID.test(input.id) ||
    !UUID.test(input.actorId) ||
    !(WITHDRAWAL_KINDS as readonly string[]).includes(input.kind) ||
    typeof input.target !== 'string' ||
    (input.kind === 'row'
      ? !ROW_TARGET.test(input.target)
      : !HEX64.test(input.target)) ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 1024 ||
    (input.rightsCaseId !== undefined && !UUID.test(input.rightsCaseId))
  )
    throw Error(INVALID);
}

/** Idempotent on `id`: the same input replays the stored request; different input is `decision_conflict`. */
export async function createWithdrawal(
  db: Db,
  input: WithdrawalCreateInput
): Promise<{ replayed: boolean; request: WithdrawalRecord }> {
  validateWithdrawal(input);
  return db.transaction(async (q) => {
    if (input.rightsCaseId) {
      const [c] = await q.query(
        'SELECT 1 FROM directory_rights_case WHERE id=$1',
        [input.rightsCaseId]
      );
      if (!c) throw Error(INVALID);
    }
    const inserted = await q.query(
      `INSERT INTO directory_withdrawal_request (id,kind,target,reason,"actorId","rightsCaseId","requestedAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,clock_timestamp(),clock_timestamp()) ON CONFLICT (id) DO NOTHING RETURNING ${COLUMNS}`,
      [
        input.id,
        input.kind,
        input.target,
        input.reason,
        input.actorId,
        input.rightsCaseId ?? null,
      ]
    );
    if (inserted.length)
      return { replayed: false, request: record(inserted[0]) };
    const [prior] = await q.query(
      `SELECT ${COLUMNS} FROM directory_withdrawal_request WHERE id=$1`,
      [input.id]
    );
    if (
      prior.kind !== input.kind ||
      prior.target !== input.target ||
      prior.reason !== input.reason ||
      prior.actorId !== input.actorId ||
      (prior.rightsCaseId ?? undefined) !== input.rightsCaseId
    )
      throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
    return { replayed: true, request: record(prior) };
  });
}

export async function listWithdrawals(
  db: Q,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<{ requests: WithdrawalRecord[] }> {
  if (
    options.status !== undefined &&
    !(WITHDRAWAL_STATUSES as readonly string[]).includes(options.status)
  )
    throw Error('Invalid status');
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw Error('Invalid limit');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw Error('Invalid offset');
  const rows = await db.query(
    `SELECT ${COLUMNS} FROM directory_withdrawal_request WHERE ($1::text IS NULL OR status=$1)
     ORDER BY "requestedAt" DESC, id LIMIT $2 OFFSET $3`,
    [options.status ?? null, limit, offset]
  );
  return { requests: rows.map(record) };
}

export async function getWithdrawal(
  db: Q,
  id: string
): Promise<WithdrawalRecord | null> {
  if (!UUID.test(id)) throw Error(INVALID);
  const [row] = await db.query(
    `SELECT ${COLUMNS} FROM directory_withdrawal_request WHERE id=$1`,
    [id]
  );
  return row ? record(row) : null;
}

export interface WithdrawalWorkerOptions {
  /** Batches per `withdrawPolicy` call (the sink's own bound applies). */
  readonly maxBatches?: number;
  /** Most requests one pass may drive. */
  readonly maxRequests?: number;
  /** Export artifact directory; withdrawn export files are deleted from it once the request commits. */
  readonly exportDir?: string;
}

/** Errors that retrying cannot fix. */
const permanent = (message: string) =>
  /^Invalid /.test(message) || message === 'Scan not bound to policy';

async function remaining(
  q: Q,
  request: { kind: string; target: string }
): Promise<Record<string, number>> {
  try {
    if (request.kind === 'policy') {
      const [r] = await q.query(
        `SELECT (SELECT count(*)::int FROM directory_overture_private_row r JOIN directory_overture_private_membership m ON m."scanId"=r."scanId" WHERE m."policyId"=$1) AS "rowsRemaining",
                (SELECT count(*)::int FROM directory_overture_private_row_revocation x JOIN directory_overture_private_membership m ON m."scanId"=x."scanId" WHERE m."policyId"=$1) AS "markersRemaining"`,
        [request.target]
      );
      return {
        rowsRemaining: Number(r.rowsRemaining),
        markersRemaining: Number(r.markersRemaining),
      };
    }
    if (request.kind === 'scan') {
      const [r] = await q.query(
        `SELECT count(*)::int AS "rowsRemaining" FROM directory_overture_private_row WHERE "scanId"=$1`,
        [request.target]
      );
      return { rowsRemaining: Number(r.rowsRemaining) };
    }
    const m = ROW_TARGET.exec(request.target)!;
    const [r] = await q.query(
      `SELECT count(*)::int AS "rowsRemaining" FROM directory_overture_private_row WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
      [m[1], m[2]]
    );
    return { rowsRemaining: Number(r.rowsRemaining) };
  } catch {
    // Progress is informational; a slow count never fails a withdrawal.
    return {};
  }
}

async function drive(
  db: Db,
  request: any,
  options: WithdrawalWorkerOptions
): Promise<boolean> {
  const sink = new OverturePrivateSink(db as never);
  if (request.kind === 'scan') {
    await sink.withdraw(request.target);
    return true;
  }
  if (request.kind === 'policy')
    return (
      await sink.withdrawPolicy(request.target, {
        maxBatches: options.maxBatches ?? 32,
      })
    ).complete;
  const m = ROW_TARGET.exec(request.target);
  if (!m) throw Error('Invalid withdrawal target');
  await sink.withdrawRow(m[1], Number(m[2]));
  return true;
}

/**
 * One pass: claim each pending or running request (oldest update first), drive it one step, record progress.
 * Returns how many requests were stepped. Safe to run from several processes; the sink serialises on its locks.
 */
export async function runWithdrawalPass(
  db: Db,
  options: WithdrawalWorkerOptions = {}
): Promise<number> {
  const max = options.maxRequests ?? 10;
  const seen = new Set<string>();
  let stepped = 0;
  while (stepped < max) {
    const claimedResult = await db.query(
      `UPDATE directory_withdrawal_request SET status='running',"updatedAt"=clock_timestamp()
       WHERE id=(SELECT id FROM directory_withdrawal_request WHERE status IN ('pending','running')
                 ORDER BY "updatedAt",id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING ${COLUMNS}`
    );
    // TypeORM returns [rows, affected] for UPDATE ... RETURNING; a plain driver returns rows.
    const claimedRows: any[] = Array.isArray(claimedResult?.[0])
      ? claimedResult[0]
      : claimedResult;
    const claimed = claimedRows[0];
    if (!claimed || seen.has(claimed.id)) break;
    seen.add(claimed.id);
    stepped++;
    let complete = false;
    let error: string | null = null;
    let fatal = false;
    try {
      complete = await drive(db, claimed, options);
    } catch (e) {
      error = (e instanceof Error ? e.message : 'Withdrawal failed').slice(
        0,
        500
      );
      fatal =
        permanent(error) ||
        Number(claimed.attempts) + 1 >= WITHDRAWAL_MAX_ATTEMPTS;
    }
    const progress = await remaining(db, claimed);
    let withdrawnArtifacts: string[] = [];
    await db.transaction(async (q) => {
      if (error !== null) {
        await q.query(
          `UPDATE directory_withdrawal_request SET attempts=attempts+1,"lastError"=$2,status=$3,"updatedAt"=clock_timestamp() WHERE id=$1`,
          [claimed.id, error, fatal ? 'failed' : 'running']
        );
        return;
      }
      await q.query(
        `UPDATE directory_withdrawal_request SET steps=steps+1,"lastError"=NULL,attempts=0,progress=$2::jsonb,
           status=$3,"completedAt"=CASE WHEN $4 THEN clock_timestamp() ELSE NULL END,"updatedAt"=clock_timestamp() WHERE id=$1`,
        [
          claimed.id,
          JSON.stringify({ ...progress, steps: Number(claimed.steps) + 1 }),
          complete ? 'complete' : 'running',
          complete,
        ]
      );
      // A finished withdrawal also withdraws every export artifact that holds data from the withdrawn scans.
      if (complete)
        withdrawnArtifacts = (
          await withdrawExportArtifacts(q, {
            scanIds: await withdrawalScanIds(q, claimed),
          })
        ).artifactNames;
      if (complete && claimed.rightsCaseId)
        await markRightsCaseWithdrawn(q, {
          caseId: claimed.rightsCaseId,
          requestId: claimed.id,
          actorId: claimed.actorId,
          reason:
            `Withdrawal ${claimed.kind} complete: ${claimed.reason}`.slice(
              0,
              1024
            ),
        });
    });
    if (options.exportDir && withdrawnArtifacts.length)
      await removeExportFiles(options.exportDir, withdrawnArtifacts);
  }
  return stepped;
}

/**
 * In-process loop for the Directory runtime: drives requests every `intervalMs`, resuming after a restart.
 * Deliberately NOT pausable via operating controls: withdrawals are rights obligations and must always run.
 */
export function startWithdrawalWorker(
  db: Db,
  options: WithdrawalWorkerOptions & {
    intervalMs?: number;
    onError?: (error: unknown) => void;
  } = {}
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    let busy = false;
    try {
      busy = (await runWithdrawalPass(db, options)) > 0;
    } catch (error) {
      options.onError?.(error);
    }
    if (!stopped)
      timer = setTimeout(tick, busy ? 1000 : options.intervalMs ?? 5000);
  };
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
