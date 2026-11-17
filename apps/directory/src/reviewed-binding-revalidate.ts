import { projectBinding, unprojectBinding, SpatialProjectionConflict } from './reviewed-spatial';
import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { type BindingKey, reviewedHash, stageContentHash } from './reviewed-binding';

/**
 * Revalidation of reviewed-field bindings against their source
 * (S5-item4-source-binding-design.md 2.2 and 2.4).
 *
 * The stage database is only ever read. Every state change happens in a live
 * transaction as a compare-and-set, `retired` is absorbing, and the event
 * unique key makes a repeated pass a no-op. When the stage cannot be read,
 * nothing changes and the lease is not extended, so reviewed fields lapse by
 * themselves.
 */

export interface StageQueryable {
  query(sql: string, params?: unknown[]): Promise<any[]>;
}

export interface BindingRow {
  id: string;
  candidateId: string;
  communityId: string;
  scanId: string;
  sourceFileRowNumber: string;
  provenance: string;
  stageInstallationId: string | null;
  stageScanId: string | null;
  stageSourceFileRowNumber: string | null;
  stagePolicyId: string | null;
  stageContentHash: string | null;
  reviewedHash: string | null;
  state: string;
  verifiedUntil: Date | null;
  suspendedAt: Date | null;
}

export type RetireCause =
  | 'stage_scan_revoked'
  | 'stage_row_revoked'
  | 'stage_policy_revoked'
  | 'live_row_withdrawn'
  | 'suspension_expired';
export type SuspendCause =
  | 'stage_row_missing'
  | 'stage_content_changed'
  | 'stage_superseded'
  | 'live_reviewed_drift';

export type StageState =
  | { kind: 'ok'; contentHash: string }
  | { kind: 'retire'; cause: RetireCause }
  | { kind: 'suspend'; cause: SuspendCause; observedHash?: string };

export type Plan =
  | { action: 'none' }
  | { action: 'confirm'; observedHash: string; verifiedAt: Date; verifiedUntil: Date }
  | { action: 'suspend'; cause: SuspendCause; observedHash?: string }
  | { action: 'retire'; cause: RetireCause; observedHash?: string };

export interface RevalidateOptions {
  /** Write transitions. Without it the pass only reports what it would do. */
  apply?: boolean;
  leaseMs?: number;
  suspensionTimeoutMs?: number;
  runId?: string;
  /** Bindings recorded against another stage are not evaluated. */
  stageInstallationId?: string;
  now?: () => Date;
}

export type Outcome =
  | 'confirmed'
  | 'extended'
  | 'suspended'
  | 'retired'
  | 'unchanged'
  | 'unreachable'
  | 'skipped'
  | 'gone';

export interface BindingResult {
  bindingId: string;
  outcome: Outcome;
  cause?: string;
}

export const DEFAULT_LEASE_MS = 24 * 3_600_000;
export const DEFAULT_SUSPENSION_TIMEOUT_MS = 30 * 86_400_000;

/** One read of the bound stage row. Throws when the stage cannot be read. */
export async function readStageState(
  stage: StageQueryable,
  binding: Pick<BindingRow, 'communityId' | 'stageScanId' | 'stageSourceFileRowNumber' | 'stagePolicyId'>,
  key: BindingKey
): Promise<StageState> {
  const { stageScanId, stageSourceFileRowNumber: row, stagePolicyId, communityId } = binding;
  if (!stageScanId || row === null || !stagePolicyId) throw Error('Binding has no stage identity');
  const [flags] = await stage.query(
    `SELECT
       EXISTS (SELECT 1 FROM "directory_overture_private_revocation" WHERE "scanId"=$1) AS "scanRevoked",
       EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2) AS "rowRevoked",
       (EXISTS (SELECT 1 FROM "directory_overture_private_policy" WHERE "policyId"=$3 AND revoked)
        OR EXISTS (SELECT 1 FROM "directory_overture_private_membership" m JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" WHERE m."scanId"=$1 AND p.revoked)) AS "policyRevoked"`,
    [stageScanId, row, stagePolicyId]
  );
  if (!flags) throw Error('Stage read returned nothing');
  if (flags.scanRevoked) return { kind: 'retire', cause: 'stage_scan_revoked' };
  if (flags.rowRevoked) return { kind: 'retire', cause: 'stage_row_revoked' };
  if (flags.policyRevoked) return { kind: 'retire', cause: 'stage_policy_revoked' };

  const exact = await stage.query(
    `SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "regionId"=$3 AND listing IS NOT NULL`,
    [stageScanId, row, communityId]
  );
  const expected = (listing: unknown) => stageContentHash(key, listing);
  if (exact.length === 1) {
    const observedHash = expected(exact[0].listing);
    return { kind: 'ok', contentHash: observedHash };
  }

  const newer = await stage.query(
    `SELECT r.listing FROM "directory_overture_private_row" r
     JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId" AND m."policyId"=$4
     JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" AND p.revoked=false
     JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
     WHERE r."regionId"=$1 AND r."sourceFileRowNumber"=$2 AND r."scanId"<>$3 AND r.listing IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_revocation" x WHERE x."scanId"=r."scanId")
       AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")`,
    [communityId, row, stageScanId, stagePolicyId]
  );
  if (newer.length === 0) return { kind: 'suspend', cause: 'stage_row_missing' };
  const hashes = newer.map((entry) => expected(entry.listing));
  return { kind: 'suspend', cause: 'stage_superseded', observedHash: hashes[0] };
}

/**
 * Compares a stage read with what was bound. Kept separate from the read so the
 * decision table is plain data in, plan out.
 */
export function stageVerdict(read: StageState, bound: string | null): StageState {
  if (read.kind !== 'ok') return read;
  return read.contentHash === bound
    ? read
    : { kind: 'suspend', cause: 'stage_content_changed', observedHash: read.contentHash };
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** The identical-newer-scan rule (decision 6): same content elsewhere keeps the binding. */
export async function readBoundStageState(
  stage: StageQueryable,
  binding: BindingRow,
  key: BindingKey
): Promise<StageState> {
  const read = await readStageState(stage, binding, key);
  if (read.kind === 'ok') return stageVerdict(read, binding.stageContentHash);
  if (read.kind === 'suspend' && read.cause === 'stage_superseded') {
    // readStageState reports the first newer hash; recheck all of them for an identical one.
    const identical = await hasIdenticalNewerScan(stage, binding, key);
    if (identical) return { kind: 'ok', contentHash: binding.stageContentHash as string };
  }
  return read;
}

async function hasIdenticalNewerScan(stage: StageQueryable, binding: BindingRow, key: BindingKey): Promise<boolean> {
  const newer = await stage.query(
    `SELECT r.listing FROM "directory_overture_private_row" r
     JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId" AND m."policyId"=$4
     JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" AND p.revoked=false
     JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
     WHERE r."regionId"=$1 AND r."sourceFileRowNumber"=$2 AND r."scanId"<>$3 AND r.listing IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_revocation" x WHERE x."scanId"=r."scanId")
       AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")`,
    [binding.communityId, binding.stageSourceFileRowNumber, binding.stageScanId, binding.stagePolicyId]
  );
  return newer.some((entry) => stageContentHash(key, entry.listing) === binding.stageContentHash);
}

/** Live-side signals: the served row must still carry exactly the reviewed fields. */
async function readLiveSignal(
  manager: EntityManager,
  binding: BindingRow,
  key: BindingKey
): Promise<{ kind: 'ok' } | { kind: 'retire'; cause: RetireCause } | { kind: 'suspend'; cause: SuspendCause }> {
  const [row] = await manager.query(
    `SELECT r.listing->'reviewed' AS reviewed,
       EXISTS (SELECT 1 FROM "directory_overture_private_revocation" x WHERE x."scanId"=r."scanId") AS "scanRevoked",
       EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber") AS "rowRevoked",
       EXISTS (SELECT 1 FROM "directory_overture_private_membership" m JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" WHERE m."scanId"=r."scanId" AND p.revoked) AS "policyRevoked"
     FROM "directory_overture_private_row" r
     WHERE r."scanId"=$1 AND r."sourceFileRowNumber"=$2 AND r."regionId"=$3`,
    [binding.scanId, binding.sourceFileRowNumber, binding.communityId]
  );
  if (!row || row.scanRevoked || row.rowRevoked || row.policyRevoked || !row.reviewed) {
    return { kind: 'retire', cause: 'live_row_withdrawn' };
  }
  if (binding.reviewedHash && reviewedHash(key, row.reviewed) !== binding.reviewedHash) {
    return { kind: 'suspend', cause: 'live_reviewed_drift' };
  }
  return { kind: 'ok' };
}

/**
 * Applies one planned transition as a compare-and-set. Returns whether this call
 * made the change; a lost race or a repeat returns false and writes nothing.
 * The caller holds the candidate and binding locks.
 */
export async function transitionBinding(
  manager: EntityManager,
  binding: BindingRow,
  plan: Plan,
  runId: string | null
): Promise<boolean> {
  if (plan.action === 'none') return false;
  if (plan.action === 'confirm') {
    const changed = await manager.query(
      `WITH t AS (UPDATE "directory_reviewed_binding"
         SET "state"='active',"stateCause"='confirmed',"verifiedAt"=$2,
             "verifiedUntil"=GREATEST("verifiedUntil",$3::timestamptz)
         WHERE "id"=$1 AND "state" IN ('pending','active') AND "provenance"='contact_stage' RETURNING "id","state") SELECT "id" FROM t`,
      [binding.id, plan.verifiedAt, plan.verifiedUntil]
    );
    if (changed.length !== 1) return false;
    // Every confirmation and lease extension (re)writes the candidate index row.
    await projectBinding(manager, binding);
    if (binding.state === 'pending') {
      await manager.query(
        `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause","observedStageHash","runId")
         VALUES ($1,'confirmed','confirmed',$2,$3) ON CONFLICT DO NOTHING`,
        [binding.id, plan.observedHash, runId]
      );
    }
    return true;
  }
  if (plan.action === 'suspend') {
    const changed = await manager.query(
      `WITH t AS (UPDATE "directory_reviewed_binding"
         SET "state"='suspended',"stateCause"=$2,"suspendedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1 AND "state" IN ('pending','active') RETURNING "id") SELECT "id" FROM t`,
      [binding.id, plan.cause]
    );
    if (changed.length !== 1) return false;
    await unprojectBinding(manager, binding.id);
    await manager.query(
      `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause","observedStageHash","runId")
       VALUES ($1,'suspended',$2,$3,$4) ON CONFLICT DO NOTHING`,
      [binding.id, plan.cause, plan.observedHash ?? null, runId]
    );
    return true;
  }
  // retire: lock order is candidate -> binding (held) -> policy -> scan lock -> row.
  const [membership] = await manager.query('SELECT "policyId" FROM "directory_overture_private_membership" WHERE "scanId"=$1', [binding.scanId]);
  if (membership) await manager.query('SELECT 1 FROM "directory_overture_private_policy" WHERE "policyId"=$1 FOR UPDATE', [membership.policyId]);
  await manager.query('SELECT 1 FROM "directory_overture_private_scan_lock" WHERE "scanId"=$1 FOR UPDATE', [binding.scanId]);
  const changed = await manager.query(
    `WITH t AS (UPDATE "directory_reviewed_binding"
       SET "state"='retired',"stateCause"=$2,"retiredAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 AND "state"<>'retired' RETURNING "id") SELECT "id" FROM t`,
    [binding.id, plan.cause]
  );
  if (changed.length !== 1) return false;
  await unprojectBinding(manager, binding.id);
  // Withdrawn content must not linger in a hidden column.
  await manager.query(
    `UPDATE "directory_overture_private_row" SET listing=listing-'reviewed'
     WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "regionId"=$3 AND listing ? 'reviewed'`,
    [binding.scanId, binding.sourceFileRowNumber, binding.communityId]
  );
  let decisionId: string | null = null;
  const [candidate] = await manager.query('SELECT "status" FROM "directory_address_review_candidate" WHERE "id"=$1', [binding.candidateId]);
  if (candidate?.status === 'published') {
    const [decision] = await manager.query(
      `INSERT INTO "directory_address_review_decision"
         ("candidateId","actorKind","actorId","decision","evidenceUrl","evidenceHash","reason","checks","policyVersion","appliedAt")
       VALUES ($1,'auto',NULL,'revoke',NULL,NULL,$2,$3::jsonb,'reviewed-binding-v1',CURRENT_TIMESTAMP) RETURNING "id"`,
      [binding.candidateId, plan.cause, JSON.stringify({ bindingId: binding.id, cause: plan.cause, runId })]
    );
    decisionId = decision.id;
    await manager.query(
      `UPDATE "directory_address_review_candidate" SET "status"='revoked',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
      [binding.candidateId]
    );
  }
  await manager.query(
    `INSERT INTO "directory_reviewed_binding_event" ("bindingId","kind","cause","observedStageHash","runId","decisionId")
     VALUES ($1,'retired',$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
    [binding.id, plan.cause, plan.observedHash ?? null, runId, decisionId]
  );
  return true;
}

async function plan(
  manager: EntityManager,
  stage: StageQueryable,
  key: BindingKey,
  binding: BindingRow,
  options: Required<Pick<RevalidateOptions, 'leaseMs' | 'suspensionTimeoutMs'>> & { now: () => Date; stageInstallationId?: string }
): Promise<Plan | 'unreachable'> {
  const live = await readLiveSignal(manager, binding, key);
  if (live.kind === 'retire') return { action: 'retire', cause: live.cause };

  let stageRead: StageState | undefined;
  let unreachable = false;
  if (binding.provenance === 'contact_stage') {
    const wrongStage = options.stageInstallationId !== undefined && binding.stageInstallationId !== options.stageInstallationId;
    if (wrongStage) {
      unreachable = true;
    } else {
      try {
        stageRead = await readBoundStageState(stage, binding, key);
      } catch {
        unreachable = true;
      }
    }
  }
  if (stageRead?.kind === 'retire') return { action: 'retire', cause: stageRead.cause };

  if (binding.state !== 'suspended') {
    if (live.kind === 'suspend') return { action: 'suspend', cause: live.cause };
    if (stageRead?.kind === 'suspend') return { action: 'suspend', cause: stageRead.cause, observedHash: stageRead.observedHash };
  }
  if (binding.state === 'suspended') {
    const since = binding.suspendedAt ? new Date(binding.suspendedAt).getTime() : NaN;
    if (Number.isFinite(since) && options.now().getTime() - since >= options.suspensionTimeoutMs) {
      return { action: 'retire', cause: 'suspension_expired' };
    }
    return { action: 'none' };
  }
  if (unreachable) return 'unreachable';
  // source_file bindings have no revalidation source and never become active (decision 12).
  if (binding.provenance !== 'contact_stage' || stageRead?.kind !== 'ok') return { action: 'none' };
  return { action: 'confirm', observedHash: stageRead.contentHash, verifiedAt: options.now(), verifiedUntil: new Date(options.now().getTime() + options.leaseMs) };
}

/**
 * One binding: lock, read, decide, and (with apply) transition, in one live
 * transaction. Locks that another writer already holds are skipped, never waited
 * on, so overlapping sweeps and a human revoke cannot deadlock.
 */
export async function revalidateBinding(
  live: DataSource,
  stage: StageQueryable,
  key: BindingKey,
  bindingId: string,
  options: RevalidateOptions = {}
): Promise<BindingResult> {
  const settings = {
    leaseMs: options.leaseMs ?? DEFAULT_LEASE_MS,
    suspensionTimeoutMs: options.suspensionTimeoutMs ?? DEFAULT_SUSPENSION_TIMEOUT_MS,
    now: options.now ?? (() => new Date()),
    stageInstallationId: options.stageInstallationId,
  };
  try {
    return await live.transaction(async (manager): Promise<BindingResult> => {
      const [pre] = await manager.query('SELECT "candidateId" FROM "directory_reviewed_binding" WHERE "id"=$1', [bindingId]);
      if (!pre) return { bindingId, outcome: 'gone' };
      const exists = await manager.query('SELECT 1 FROM "directory_address_review_candidate" WHERE "id"=$1', [pre.candidateId]);
      if (exists.length === 1) {
        const locked = await manager.query('SELECT 1 FROM "directory_address_review_candidate" WHERE "id"=$1 FOR UPDATE SKIP LOCKED', [pre.candidateId]);
        if (locked.length !== 1) return { bindingId, outcome: 'skipped' };
      }
      const [binding] = (await manager.query('SELECT * FROM "directory_reviewed_binding" WHERE "id"=$1 FOR UPDATE SKIP LOCKED', [bindingId])) as BindingRow[];
      if (!binding) return { bindingId, outcome: 'skipped' };
      if (binding.state === 'retired') return { bindingId, outcome: 'unchanged' };
      const decided = await plan(manager, stage, key, binding, settings);
      if (decided === 'unreachable') return { bindingId, outcome: 'unreachable' };
      if (decided.action === 'none') return { bindingId, outcome: 'unchanged' };
      const cause = decided.action === 'confirm' ? 'confirmed' : decided.cause;
      const outcome: Outcome =
        decided.action === 'confirm' ? (binding.state === 'pending' ? 'confirmed' : 'extended') : decided.action === 'suspend' ? 'suspended' : 'retired';
      if (options.apply) {
        await transitionBinding(manager, binding, decided, options.runId ?? null);
      }
      return { bindingId, outcome, cause };
    });
  } catch (error) {
    // The row changed between the read and the projection write; the transaction rolled back and the next sweep retries.
    if (error instanceof SpatialProjectionConflict) return { bindingId, outcome: 'skipped' };
    throw error;
  }
}

/** Confirms a freshly published (pending) binding; the step that follows publish. */
export function confirmBinding(
  live: DataSource,
  stage: StageQueryable,
  key: BindingKey,
  bindingId: string,
  options: RevalidateOptions = {}
): Promise<BindingResult> {
  return revalidateBinding(live, stage, key, bindingId, { ...options, apply: options.apply ?? true });
}

export interface SweepSummary {
  examined: number;
  counts: Record<Outcome, number>;
  results: BindingResult[];
}

function emptyCounts(): Record<Outcome, number> {
  return { confirmed: 0, extended: 0, suspended: 0, retired: 0, unchanged: 0, unreachable: 0, skipped: 0, gone: 0 };
}

async function runBatch(
  live: DataSource,
  stage: StageQueryable,
  key: BindingKey,
  ids: string[],
  options: RevalidateOptions
): Promise<SweepSummary> {
  const summary: SweepSummary = { examined: ids.length, counts: emptyCounts(), results: [] };
  for (const id of ids) {
    const result = await revalidateBinding(live, stage, key, id, options);
    summary.counts[result.outcome] += 1;
    summary.results.push(result);
  }
  return summary;
}

/** Revalidates a batch of non-retired bindings, oldest lease first. */
export async function sweepBindings(
  live: DataSource,
  stage: StageQueryable,
  key: BindingKey,
  options: RevalidateOptions & { limit?: number } = {}
): Promise<SweepSummary> {
  const limit = Math.max(1, Math.min(options.limit ?? 500, 5000));
  const rows = await live.query(
    `SELECT "id" FROM "directory_reviewed_binding" WHERE "state"<>'retired'
     ORDER BY "verifiedUntil" ASC NULLS FIRST,"createdAt" ASC LIMIT $1`,
    [limit]
  );
  return runBatch(live, stage, key, rows.map((row: { id: string }) => row.id), { ...options, runId: options.runId ?? sha(String(Date.now())).slice(0, 16) });
}

/**
 * Push accelerator: after a stage withdrawal commits, revalidate the bindings it
 * touches right away. Nothing depends on this; the lease is the safety net.
 */
export async function invalidateForStage(
  live: DataSource,
  stage: StageQueryable,
  key: BindingKey,
  target: { scanId?: string; policyId?: string; sourceFileRowNumber?: string },
  options: RevalidateOptions = {}
): Promise<SweepSummary> {
  if (!target.scanId && !target.policyId) throw Error('A stage scan or policy is required');
  const rows = await live.query(
    `SELECT "id" FROM "directory_reviewed_binding" WHERE "state"<>'retired'
       AND ($1::text IS NULL OR "stageScanId"=$1) AND ($2::text IS NULL OR "stagePolicyId"=$2)
       AND ($3::bigint IS NULL OR "stageSourceFileRowNumber"=$3)`,
    [target.scanId ?? null, target.policyId ?? null, target.sourceFileRowNumber ?? null]
  );
  return runBatch(live, stage, key, rows.map((row: { id: string }) => row.id), { ...options, apply: options.apply ?? true });
}
