import { createHash } from 'node:crypto';
import {
  TAXONOMY_APPLY_CONFIRMATION,
  type TaxonomyRunRecord,
  type TaxonomyRunSummary,
  type TaxonomyTransition,
} from '../../../libs/social/contracts/src/lib/directory';
import { IDEMPOTENCY_CONFLICT, ReviewConflictError } from './review-version';
import { SERVED_ROW_FROM } from './town-coverage';
import { isPaused } from './operating-controls';
import {
  effectiveClassification,
  loadMapping,
  mappingHash,
  taxonomyCaseFlag,
  type LoadedMapping,
} from './taxonomy-mapping';
import { findTaxonomyMapping } from './taxonomy-mapping-data';
import { raiseAutomaticTaxonomyCase } from './taxonomy-case';

/**
 * Reclassification runs (S7d): apply a mapping version to the persisted classification projection.
 *
 * A `dry_run` plans only: it scans the scope, writes nothing to the projection, and records a summary of
 * the category transitions plus a plan hash (a digest chain over every row's computed classification). An `apply`
 * run must name the plan hash of a completed dry run of the same mapping and scope and carry the deliberate
 * confirmation; it replays the plan pass first, refuses to write when the hash no longer matches (the data
 * moved), and then applies batch by batch. Every batch commits its writes, before-images and the run's durable
 * cursor in ONE transaction, so an interrupted run resumes from the cursor and never double-counts. A run can be
 * canceled between batches, and an applied run can be rolled back from its before-images, again batch by batch.
 *
 * Runs never touch overrides: an operator's per-listing category beats every mapping. `attempts` counts
 * consecutive failed batches; after `TAXONOMY_MAX_ATTEMPTS` the run fails (and can be rolled back).
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any[]> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[0-9a-f]{64}$/;
export const TAXONOMY_MAX_ATTEMPTS = 5;
export const TAXONOMY_BATCH_SIZE = 500;
const MAX_TRANSITIONS = 200;
const MAX_SAMPLES = 3;
const ACTIVE = ['pending', 'running', 'rolling_back'];

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const sha = (v: string) => createHash('sha256').update(v).digest('hex');

const RUN_COLUMNS = `id,"mappingVersion",scope,"communityId",mode,phase,status,"actorId",reason,"expectedPlanHash","planHash","planAccumulator",
  "cursorScanId","cursorRow","scannedRows","changedRows","appliedRows","restoredRows","driftedRows",attempts,summary,"lastError","cancelRequested",
  "canceledById","cancelReason","rollbackById","rollbackReason","createdAt","updatedAt","completedAt"`;

const emptySummary = (): TaxonomyRunSummary => ({
  transitions: [],
  unchanged: 0,
  unmapped: 0,
  excluded: 0,
  truncatedTransitions: 0,
});

function toRecord(r: any): TaxonomyRunRecord {
  const s = (r.summary ?? {}) as Partial<TaxonomyRunSummary>;
  return {
    id: r.id,
    mappingVersion: r.mappingVersion,
    scope: r.scope,
    townId: r.communityId ?? null,
    mode: r.mode,
    phase: r.phase,
    status: r.status,
    actorId: r.actorId ?? null,
    reason: r.reason,
    expectedPlanHash: r.expectedPlanHash ?? null,
    planHash: r.planHash ?? null,
    scannedRows: Number(r.scannedRows),
    changedRows: Number(r.changedRows),
    appliedRows: Number(r.appliedRows),
    restoredRows: Number(r.restoredRows),
    driftedRows: Number(r.driftedRows ?? 0),
    attempts: Number(r.attempts),
    cancelRequested: r.cancelRequested === true,
    summary: { ...emptySummary(), ...s },
    lastError: r.lastError ?? null,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
    completedAt: r.completedAt ? iso(r.completedAt) : null,
  };
}

export interface TaxonomyRunInput {
  readonly id: string;
  readonly mappingVersion: string;
  readonly scope: string;
  readonly townId?: string;
  readonly mode: string;
  readonly actorId: string;
  readonly reason: string;
  readonly expectedPlanHash?: string;
  readonly confirm?: string;
}

function validateRun(i: TaxonomyRunInput): void {
  if (
    !UUID.test(i.id) ||
    !UUID.test(i.actorId) ||
    typeof i.mappingVersion !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(i.mappingVersion) ||
    (i.scope !== 'town' && i.scope !== 'all') ||
    (i.mode !== 'dry_run' && i.mode !== 'apply') ||
    typeof i.reason !== 'string' ||
    !i.reason.trim() ||
    i.reason.length > 1024
  )
    throw Error('Invalid taxonomy run');
  if ((i.scope === 'town') !== (i.townId !== undefined))
    throw Error('Invalid taxonomy run');
  if (i.townId !== undefined && !UUID.test(i.townId))
    throw Error('Invalid taxonomy run');
  if (i.mode === 'apply') {
    if (
      typeof i.expectedPlanHash !== 'string' ||
      !HEX64.test(i.expectedPlanHash) ||
      i.confirm !== TAXONOMY_APPLY_CONFIRMATION
    )
      throw Error('Invalid taxonomy run');
  } else if (i.expectedPlanHash !== undefined || i.confirm !== undefined)
    throw Error('Invalid taxonomy run');
}

export async function createTaxonomyRun(
  db: Db,
  input: TaxonomyRunInput
): Promise<{ replayed: boolean; run: TaxonomyRunRecord }> {
  validateRun(input);
  return db.transaction(async (q) => {
    await q.query(
      `SELECT pg_advisory_xact_lock(hashtext('directory_taxonomy_run'))`
    );
    const [prior] = await q.query(
      `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1`,
      [input.id]
    );
    if (prior) {
      if (
        prior.mappingVersion !== input.mappingVersion ||
        prior.scope !== input.scope ||
        (prior.communityId ?? undefined) !== input.townId ||
        prior.mode !== input.mode ||
        prior.actorId !== input.actorId ||
        prior.reason !== input.reason ||
        (prior.expectedPlanHash ?? undefined) !== input.expectedPlanHash
      )
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, run: toRecord(prior) };
    }
    const [version] = await q.query(
      `SELECT id,active FROM directory_taxonomy_mapping_version WHERE id=$1`,
      [input.mappingVersion]
    );
    if (!version) throw Error('Invalid taxonomy run: unknown mapping version');
    const [busy] = await q.query(
      `SELECT id FROM directory_taxonomy_run WHERE status = ANY($1::text[]) LIMIT 1`,
      [ACTIVE]
    );
    // One run at a time: two runs interleaving would make each one's plan and before-images meaningless.
    if (busy) throw new ReviewConflictError('invalid_state');
    if (input.mode === 'apply') {
      if (version.active !== true)
        throw new ReviewConflictError('invalid_state');
      const [plan] = await q.query(
        `SELECT id FROM directory_taxonomy_run WHERE mode='dry_run' AND status='complete' AND "planHash"=$1
           AND "mappingVersion"=$2 AND scope=$3 AND "communityId" IS NOT DISTINCT FROM $4::uuid LIMIT 1`,
        [
          input.expectedPlanHash,
          input.mappingVersion,
          input.scope,
          input.townId ?? null,
        ]
      );
      if (!plan) throw new ReviewConflictError('invalid_state');
    }
    await q.query(
      `INSERT INTO directory_taxonomy_run (id,"mappingVersion",scope,"communityId",mode,phase,status,"actorId",reason,"expectedPlanHash","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'plan','pending',$6,$7,$8,clock_timestamp(),clock_timestamp())`,
      [
        input.id,
        input.mappingVersion,
        input.scope,
        input.townId ?? null,
        input.mode,
        input.actorId,
        input.reason,
        input.expectedPlanHash ?? null,
      ]
    );
    const [row] = await q.query(
      `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1`,
      [input.id]
    );
    return { replayed: false, run: toRecord(row) };
  });
}

export async function listTaxonomyRuns(
  db: Q,
  options: { limit?: number; offset?: number } = {}
): Promise<{ runs: TaxonomyRunRecord[] }> {
  const limit = options.limit ?? 25;
  const offset = options.offset ?? 0;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw Error('Invalid limit');
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
    throw Error('Invalid offset');
  const rows = await db.query(
    `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run ORDER BY "createdAt" DESC,id LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { runs: rows.map(toRecord) };
}

export async function getTaxonomyRun(
  db: Q,
  id: string
): Promise<TaxonomyRunRecord | null> {
  if (!UUID.test(id)) throw Error('Invalid run');
  const [row] = await db.query(
    `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1`,
    [id]
  );
  return row ? toRecord(row) : null;
}

const checkActor = (actorId: string, reason: string) => {
  if (
    !UUID.test(actorId) ||
    typeof reason !== 'string' ||
    !reason.trim() ||
    reason.length > 1024
  )
    throw Error('Invalid taxonomy run');
};

export async function cancelTaxonomyRun(
  db: Db,
  input: { id: string; actorId: string; reason: string }
): Promise<{ replayed: boolean; run: TaxonomyRunRecord }> {
  if (!UUID.test(input.id)) throw Error('Invalid run');
  checkActor(input.actorId, input.reason);
  return db.transaction(async (q) => {
    const [r] = await q.query(
      `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1 FOR UPDATE`,
      [input.id]
    );
    if (!r) throw Error('Run not found');
    if (r.cancelRequested === true || r.status === 'canceled') {
      if (r.canceledById !== input.actorId || r.cancelReason !== input.reason)
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, run: toRecord(r) };
    }
    if (r.status !== 'pending' && r.status !== 'running')
      throw new ReviewConflictError('invalid_state');
    // A pending run has written nothing, so it ends now; a running one stops at its next batch boundary.
    await q.query(
      `UPDATE directory_taxonomy_run SET "cancelRequested"=true,"canceledById"=$2,"cancelReason"=$3,
         status=CASE WHEN status='pending' THEN 'canceled' ELSE status END,
         "completedAt"=CASE WHEN status='pending' THEN clock_timestamp() ELSE "completedAt" END,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [input.id, input.actorId, input.reason]
    );
    const [row] = await q.query(
      `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1`,
      [input.id]
    );
    return { replayed: false, run: toRecord(row) };
  });
}

export async function rollbackTaxonomyRun(
  db: Db,
  input: { id: string; actorId: string; reason: string }
): Promise<{ replayed: boolean; run: TaxonomyRunRecord }> {
  if (!UUID.test(input.id)) throw Error('Invalid run');
  checkActor(input.actorId, input.reason);
  return db.transaction(async (q) => {
    await q.query(
      `SELECT pg_advisory_xact_lock(hashtext('directory_taxonomy_run'))`
    );
    const [r] = await q.query(
      `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1 FOR UPDATE`,
      [input.id]
    );
    if (!r) throw Error('Run not found');
    if (r.status === 'rolling_back' || r.status === 'rolled_back') {
      if (r.rollbackById !== input.actorId || r.rollbackReason !== input.reason)
        throw new ReviewConflictError(IDEMPOTENCY_CONFLICT);
      return { replayed: true, run: toRecord(r) };
    }
    // Only an apply that has stopped can be rolled back; a running one must be canceled first.
    if (
      r.mode !== 'apply' ||
      !['complete', 'canceled', 'failed'].includes(r.status)
    )
      throw new ReviewConflictError('invalid_state');
    const [busy] = await q.query(
      `SELECT id FROM directory_taxonomy_run WHERE status = ANY($1::text[]) LIMIT 1`,
      [ACTIVE]
    );
    if (busy) throw new ReviewConflictError('invalid_state');
    await q.query(
      `UPDATE directory_taxonomy_run SET status='rolling_back',phase='rollback',"cursorScanId"=NULL,"cursorRow"=NULL,"restoredRows"=0,
         attempts=0,"lastError"=NULL,"rollbackById"=$2,"rollbackReason"=$3,"completedAt"=NULL,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [input.id, input.actorId, input.reason]
    );
    const [row] = await q.query(
      `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE id=$1`,
      [input.id]
    );
    return { replayed: false, run: toRecord(row) };
  });
}

const PROJECTION_KEYS = [
  'mappingVersion',
  'categoryId',
  'placeTypeId',
  'basis',
  'excluded',
  'exclusionReason',
] as const;

/** The digest of one row's planned projection; the apply phase compares it with the row's projection at write time. */
const rowDigest = (next: Record<string, unknown>) =>
  sha(PROJECTION_KEYS.map((k) => String(next[k])).join('|'));

function projectionOf(r: any): Record<string, unknown> | null {
  return r.hasProjection
    ? {
        mappingVersion: r.lcVersion,
        categoryId: r.lcCategory ?? null,
        placeTypeId: r.lcPlace ?? null,
        basis: r.lcBasis,
        excluded: r.lcExcluded === true,
        exclusionReason: r.lcReason ?? null,
      }
    : null;
}

const labelOf = (categoryId: unknown, excluded: unknown) =>
  excluded === true ? 'excluded' : String(categoryId ?? 'none');

function addTransition(
  s: TaxonomyRunSummary,
  from: string,
  to: string,
  sample: { scanId: string; row: string; name: string }
): void {
  const found = s.transitions.find((t) => t.from === from && t.to === to);
  if (found) {
    found.count += 1;
    if (found.samples.length < MAX_SAMPLES) found.samples.push(sample);
  } else if (s.transitions.length < MAX_TRANSITIONS)
    s.transitions.push({ from, to, count: 1, samples: [sample] });
  else s.truncatedTransitions += 1;
}

export interface TaxonomyPassOptions {
  readonly batchSize?: number;
  /** Stop after this many batches (a pass resumes from the durable cursor). */
  readonly maxBatches?: number;
  /** Test seam: runs inside a batch's transaction just before it commits; a throw rolls the batch back. */
  readonly beforeCommit?: () => void | Promise<void>;
}

const ROW_BATCH_SQL = `SELECT r."scanId",r."sourceFileRowNumber",r."regionId",r.listing,
    lc."mappingVersion" AS "lcVersion",lc."categoryId" AS "lcCategory",lc."placeTypeId" AS "lcPlace",lc.basis AS "lcBasis",
    lc.excluded AS "lcExcluded",lc."exclusionReason" AS "lcReason",(lc."scanId" IS NOT NULL) AS "hasProjection",
    ov."categoryId" AS "ovCategory",ov."placeTypeId" AS "ovPlace"
  FROM ${SERVED_ROW_FROM}
  WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId")
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")
    AND ($1::text IS NULL OR r."regionId"=$1)
    AND ($2='' OR (r."scanId",r."sourceFileRowNumber")>($2,$3::bigint))
  ORDER BY r."scanId",r."sourceFileRowNumber" LIMIT $4`;

const UPSERT_PROJECTION = `INSERT INTO directory_listing_classification ("scanId","sourceFileRowNumber","mappingVersion","categoryId","placeTypeId",basis,excluded,"exclusionReason","runId","updatedAt")
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp())
  ON CONFLICT ("scanId","sourceFileRowNumber") DO UPDATE SET "mappingVersion"=EXCLUDED."mappingVersion","categoryId"=EXCLUDED."categoryId","placeTypeId"=EXCLUDED."placeTypeId",
    basis=EXCLUDED.basis,excluded=EXCLUDED.excluded,"exclusionReason"=EXCLUDED."exclusionReason","runId"=EXCLUDED."runId","updatedAt"=EXCLUDED."updatedAt"`;

/** The plan hash chain's seed: it binds the hash to the mapping content, the scope and the mapping's identity. */
function planSeed(run: any, mapping: LoadedMapping): string {
  const file = findTaxonomyMapping(run.mappingVersion);
  return sha(
    [
      'taxonomy-plan',
      run.mappingVersion,
      file ? mappingHash(file) : 'installed',
      run.scope,
      run.communityId ?? '',
      mapping.unmappedPolicy,
    ].join('|')
  );
}

async function step(
  q: Q,
  run: any,
  mapping: LoadedMapping,
  options: TaxonomyPassOptions
): Promise<void> {
  const batch = options.batchSize ?? TAXONOMY_BATCH_SIZE;
  const rows = await q.query(ROW_BATCH_SQL, [
    run.communityId ?? null,
    run.cursorScanId ?? '',
    run.cursorRow ?? '0',
    batch,
  ]);
  const summary = {
    ...emptySummary(),
    ...(run.summary ?? {}),
  } as TaxonomyRunSummary;
  summary.transitions = (summary.transitions ?? []).map(
    (t: TaxonomyTransition) => ({ ...t, samples: [...t.samples] })
  );
  let acc: string = run.planAccumulator ?? planSeed(run, mapping);
  let changed = 0;
  let applied = 0;
  const applying = run.phase === 'apply';
  let drifted = 0;
  // Apply phase: what the plan pass computed for the rows of this batch, to re-check each row before writing it.
  const planned = new Map<string, string>();
  if (applying && rows.length) {
    const first = rows[0];
    const lastRow = rows[rows.length - 1];
    const stored = await q.query(
      `SELECT "scanId","sourceFileRowNumber",digest FROM directory_taxonomy_run_plan
       WHERE "runId"=$1 AND ("scanId","sourceFileRowNumber")>=($2,$3::bigint) AND ("scanId","sourceFileRowNumber")<=($4,$5::bigint)`,
      [
        run.id,
        first.scanId,
        first.sourceFileRowNumber,
        lastRow.scanId,
        lastRow.sourceFileRowNumber,
      ]
    );
    for (const s of stored)
      planned.set(`${s.scanId}:${s.sourceFileRowNumber}`, s.digest);
  }
  for (const r of rows) {
    const e = effectiveClassification(
      mapping,
      r.ovCategory
        ? { categoryId: r.ovCategory, placeTypeId: r.ovPlace ?? null }
        : null,
      r.listing
    );
    const next = {
      mappingVersion: mapping.id,
      categoryId: e.categoryId,
      placeTypeId: e.placeTypeId,
      basis: e.basis,
      excluded: e.excluded,
      exclusionReason: e.exclusionReason,
    };
    const current = projectionOf(r);
    const differs =
      !current || PROJECTION_KEYS.some((k) => current[k] !== next[k]);
    if (!applying) {
      acc = sha(
        `${acc}|${r.scanId}:${r.sourceFileRowNumber}|${PROJECTION_KEYS.map(
          (k) => String(next[k])
        ).join('|')}`
      );
      if (differs) changed += 1;
      const from = current
        ? labelOf(current['categoryId'], current['excluded'])
        : labelOf(r.listing?.category, false);
      const to = labelOf(next.categoryId, next.excluded);
      if (from === to) summary.unchanged += 1;
      else
        addTransition(summary, from, to, {
          scanId: r.scanId,
          row: String(r.sourceFileRowNumber),
          name: String(r.listing?.name ?? '').slice(0, 200),
        });
      if (e.basis === 'legacy') summary.unmapped += 1;
      if (e.excluded) summary.excluded += 1;
      if (run.mode === 'apply' && differs)
        await q.query(
          `INSERT INTO directory_taxonomy_run_plan ("runId","scanId","sourceFileRowNumber",digest) VALUES ($1,$2,$3,$4)
           ON CONFLICT DO NOTHING`,
          [run.id, r.scanId, r.sourceFileRowNumber, rowDigest(next)]
        );
      // A listing the mapping cannot decide needs an operator. An operator's own override already decided it.
      if (!r.ovCategory && UUID.test(String(r.regionId ?? ''))) {
        const flag = taxonomyCaseFlag(mapping, r.listing);
        if (flag)
          await raiseAutomaticTaxonomyCase(q, {
            runId: run.id,
            mappingVersion: mapping.id,
            actorId: run.actorId ?? null,
            townId: r.regionId,
            scanId: r.scanId,
            row: String(r.sourceFileRowNumber),
            name: String(r.listing?.name ?? ''),
            reason: flag.reason,
            observed: flag.observed,
          });
      }
    } else if (differs) {
      // The row moved after the plan pass (or was never planned to change): report it, never overwrite it.
      if (
        planned.get(`${r.scanId}:${r.sourceFileRowNumber}`) !== rowDigest(next)
      ) {
        drifted += 1;
        continue;
      }
      await q.query(
        `INSERT INTO directory_taxonomy_run_before ("runId","scanId","sourceFileRowNumber","hadProjection",before)
         VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT DO NOTHING`,
        [
          run.id,
          r.scanId,
          r.sourceFileRowNumber,
          current !== null,
          current ? JSON.stringify(current) : null,
        ]
      );
      await q.query(UPSERT_PROJECTION, [
        r.scanId,
        r.sourceFileRowNumber,
        next.mappingVersion,
        next.categoryId,
        next.placeTypeId,
        next.basis,
        next.excluded,
        next.exclusionReason,
        run.id,
      ]);
      applied += 1;
    }
  }
  const last = rows[rows.length - 1];
  const done = rows.length < batch;
  await options.beforeCommit?.();
  if (!applying) {
    const planHash = acc;
    let status = 'running';
    let phase = 'plan';
    let lastError: string | null = null;
    let completedAt = false;
    let hash: string | null = null;
    if (done) {
      hash = planHash;
      if (run.mode === 'dry_run') {
        status = 'complete';
        completedAt = true;
      } else if (planHash === run.expectedPlanHash) phase = 'apply';
      else {
        status = 'failed';
        completedAt = true;
        lastError =
          'The data changed since the dry run (plan hash mismatch); run a new dry run';
      }
    }
    await q.query(
      `UPDATE directory_taxonomy_run SET status=$2,phase=$3,"planAccumulator"=$4,"planHash"=$5,
         "cursorScanId"=$6,"cursorRow"=$7,"scannedRows"="scannedRows"+$8,"changedRows"="changedRows"+$9,summary=$10::jsonb,
         attempts=0,"lastError"=$11,"completedAt"=CASE WHEN $12 THEN clock_timestamp() ELSE NULL END,"updatedAt"=clock_timestamp() WHERE id=$1`,
      [
        run.id,
        status,
        phase,
        planHash,
        hash,
        // Moving from plan to apply restarts the scan from the beginning for the write pass.
        done ? null : last?.scanId ?? run.cursorScanId ?? null,
        done ? null : last?.sourceFileRowNumber ?? run.cursorRow ?? null,
        rows.length,
        changed,
        JSON.stringify(summary),
        lastError,
        completedAt,
      ]
    );
    return;
  }
  await q.query(
    `UPDATE directory_taxonomy_run SET status=$2,"cursorScanId"=$3,"cursorRow"=$4,"appliedRows"="appliedRows"+$5,"driftedRows"="driftedRows"+$7,attempts=0,"lastError"=NULL,
       "completedAt"=CASE WHEN $6 THEN clock_timestamp() ELSE NULL END,"updatedAt"=clock_timestamp() WHERE id=$1`,
    [
      run.id,
      done ? 'complete' : 'running',
      done ? run.cursorScanId : last?.scanId ?? run.cursorScanId ?? null,
      done ? run.cursorRow : last?.sourceFileRowNumber ?? run.cursorRow ?? null,
      applied,
      done,
      drifted,
    ]
  );
  if (done)
    await q.query(`DELETE FROM directory_taxonomy_run_plan WHERE "runId"=$1`, [
      run.id,
    ]);
}

async function stepRollback(
  q: Q,
  run: any,
  options: TaxonomyPassOptions
): Promise<void> {
  const batch = options.batchSize ?? TAXONOMY_BATCH_SIZE;
  const rows = await q.query(
    `SELECT "scanId","sourceFileRowNumber","hadProjection",before FROM directory_taxonomy_run_before
     WHERE "runId"=$1 AND ($2='' OR ("scanId","sourceFileRowNumber")>($2,$3::bigint))
     ORDER BY "scanId","sourceFileRowNumber" LIMIT $4`,
    [run.id, run.cursorScanId ?? '', run.cursorRow ?? '0', batch]
  );
  let restored = 0;
  for (const r of rows) {
    // Only a row this run still owns is restored: a later run or an operator decision has moved on from it.
    const [cur] = await q.query(
      `SELECT "runId" FROM directory_listing_classification WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 FOR UPDATE`,
      [r.scanId, r.sourceFileRowNumber]
    );
    if (!cur || cur.runId !== run.id) continue;
    if (r.hadProjection && r.before) {
      const b = r.before as Record<string, any>;
      await q.query(UPSERT_PROJECTION, [
        r.scanId,
        r.sourceFileRowNumber,
        b['mappingVersion'],
        b['categoryId'] ?? null,
        b['placeTypeId'] ?? null,
        b['basis'],
        b['excluded'] === true,
        b['exclusionReason'] ?? null,
        null,
      ]);
    } else
      await q.query(
        `DELETE FROM directory_listing_classification WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
        [r.scanId, r.sourceFileRowNumber]
      );
    restored += 1;
  }
  const last = rows[rows.length - 1];
  const done = rows.length < batch;
  await options.beforeCommit?.();
  await q.query(
    `UPDATE directory_taxonomy_run SET status=$2,"cursorScanId"=$3,"cursorRow"=$4,"restoredRows"="restoredRows"+$5,attempts=0,"lastError"=NULL,
       "completedAt"=CASE WHEN $6 THEN clock_timestamp() ELSE NULL END,"updatedAt"=clock_timestamp() WHERE id=$1`,
    [
      run.id,
      done ? 'rolled_back' : 'rolling_back',
      done ? run.cursorScanId : last?.scanId ?? run.cursorScanId ?? null,
      done ? run.cursorRow : last?.sourceFileRowNumber ?? run.cursorRow ?? null,
      restored,
      done,
    ]
  );
}

/**
 * One batch of the oldest unfinished run. Returns false when there was nothing to do. The claim, the batch's
 * writes and the cursor commit together, so a crash re-runs the batch from the previous cursor; a failed batch
 * records its error outside that transaction and counts toward `TAXONOMY_MAX_ATTEMPTS`.
 */
export async function runTaxonomyBatch(
  db: Db,
  options: TaxonomyPassOptions = {}
): Promise<boolean> {
  let claimedId: string | null = null;
  // Paused: claim no run and take no batch; a run resumes where its cursor left it.
  if (await isPaused(db, 'taxonomy_worker')) return false;
  try {
    return await db.transaction(async (q) => {
      const [run] = await q.query(
        `SELECT ${RUN_COLUMNS} FROM directory_taxonomy_run WHERE status = ANY($1::text[])
         ORDER BY "createdAt",id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [ACTIVE]
      );
      if (!run) return false;
      claimedId = run.id;
      if (run.status === 'rolling_back') {
        await stepRollback(q, run, options);
        return true;
      }
      if (run.cancelRequested === true) {
        await q.query(
          `UPDATE directory_taxonomy_run SET status='canceled',"completedAt"=clock_timestamp(),"updatedAt"=clock_timestamp() WHERE id=$1`,
          [run.id]
        );
        return true;
      }
      const mapping = await loadMapping(q, run.mappingVersion);
      if (!mapping) throw Error('Mapping version is not installed');
      await step(q, run, mapping, options);
      return true;
    });
  } catch (error) {
    if (claimedId)
      await db.query(
        `UPDATE directory_taxonomy_run SET attempts=attempts+1,"lastError"=$2,
           status=CASE WHEN attempts+1>=$3 AND status<>'rolling_back' THEN 'failed' ELSE status END,
           "completedAt"=CASE WHEN attempts+1>=$3 AND status<>'rolling_back' THEN clock_timestamp() ELSE "completedAt" END,
           "updatedAt"=clock_timestamp() WHERE id=$1 AND status = ANY($4::text[])`,
        [
          claimedId,
          (error instanceof Error ? error.message : 'Run failed').slice(0, 500),
          TAXONOMY_MAX_ATTEMPTS,
          ACTIVE,
        ]
      );
    throw error;
  }
}

/** Runs batches until no run is unfinished (or `maxBatches` is reached). Returns the number of batches run. */
export async function runTaxonomyPass(
  db: Db,
  options: TaxonomyPassOptions = {}
): Promise<number> {
  const max = options.maxBatches ?? Number.MAX_SAFE_INTEGER;
  let batches = 0;
  while (batches < max && (await runTaxonomyBatch(db, options))) batches += 1;
  return batches;
}

/** In-process loop for the Directory runtime: resumes unfinished runs after a restart. */
export function startTaxonomyWorker(
  db: Db,
  options: TaxonomyPassOptions & {
    intervalMs?: number;
    onError?: (error: unknown) => void;
  } = {}
): () => void {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    let busy = false;
    try {
      busy = (await runTaxonomyPass(db, { ...options, maxBatches: 20 })) > 0;
    } catch (error) {
      options.onError?.(error);
    }
    if (!stopped)
      timer = setTimeout(tick, busy ? 500 : options.intervalMs ?? 5000);
  };
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
