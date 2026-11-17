import { createHash } from 'node:crypto';
import {
  BUSINESS_IDENTITY_KEY_VERSION,
  businessNameHash,
  classifyCohort,
  type ClassifiedRow,
  type CohortRow,
  type PredecessorAssertion,
} from './business-identity';

/**
 * Carry-forward of business identity from one release cohort (policy) to the next
 * (S5-item1-business-identity-design.md, section 2). A row inherits a business only when its keyed
 * upstream id equals the key of exactly one live business in the same town and passes every rule of the
 * pure classifier. Nothing here merges, splits, un-retires, crosses towns, copies reviewed fields or
 * touches a binding, a candidate, a scan lock, a listing row or the spatial projection.
 *
 * Lock order inside every write transaction: town advisory lock -> target policy FOR SHARE ->
 * carry-state row -> business rows FOR UPDATE in id order -> assertion/event writes.
 */

type Q = { query(sql: string, params?: unknown[]): Promise<any> };
type Db = Q & { transaction<T>(work: (manager: Q) => Promise<T>): Promise<T> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEX64 = /^[a-f0-9]{64}$/;
export const CARRY_BATCH = 500;

export interface CarryOptions {
  readonly fromPolicyId: string;
  readonly toPolicyId: string;
  readonly key: string;
  readonly batchSize?: number;
}

export interface TownPlan {
  readonly town: string;
  readonly digest: string;
  readonly rows: readonly ClassifiedRow[];
  readonly counts: Readonly<Record<string, number>>;
}

export interface CarryPlan {
  readonly digest: string;
  readonly keyed: boolean;
  readonly towns: readonly TownPlan[];
  readonly counts: Readonly<Record<string, number>>;
}

function assertPolicy(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !HEX64.test(id))
    throw Error('Invalid policy id');
}

const releaseParts = (value: string): [string, number] => {
  const match = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(value);
  if (!match) throw Error('Invalid release id');
  return [match[1], Number(match[2])];
};
const releaseNewer = (a: string, b: string): boolean => {
  const [da, na] = releaseParts(a),
    [db, nb] = releaseParts(b);
  return da > db || (da === db && na > nb);
};

const townLock = (town: string) => `directory-business-identity:${town}`;

/** Towns that hold rows of the target cohort. */
async function cohortTowns(q: Q, toPolicyId: string): Promise<string[]> {
  const rows = await q.query(
    `SELECT DISTINCT r."regionId" AS town FROM directory_overture_private_row r
       JOIN directory_overture_private_membership m ON m."scanId"=r."scanId" AND m."policyId"=$1
      WHERE r."regionId" IS NOT NULL ORDER BY 1`,
    [toPolicyId]
  );
  return rows
    .map((row: { town: string }) => row.town)
    .filter((town: string) => UUID.test(town));
}

/** True when any row of the target cohort has a usable source key. */
async function cohortHasKeys(
  q: Q,
  toPolicyId: string,
  town?: string
): Promise<boolean> {
  const rows = await q.query(
    `SELECT 1 FROM directory_overture_source_key k
       JOIN directory_overture_private_membership m ON m."scanId"=k."scanId" AND m."policyId"=$1
       JOIN directory_overture_private_row r ON r."scanId"=k."scanId" AND r."sourceFileRowNumber"=k."sourceFileRowNumber"
      WHERE k."keyVersion"=$2 AND ($3::text IS NULL OR r."regionId"=$3) LIMIT 1`,
    [toPolicyId, BUSINESS_IDENTITY_KEY_VERSION, town ?? null]
  );
  return rows.length > 0;
}

/**
 * Section 2.2 step 1. Refuses a keyed target cohort that is missing, revoked, incomplete or without
 * upstream evidence, and a source cohort without evidence or not strictly older. A cohort without keys is
 * origin-only: nothing is carried and nothing is refused.
 */
export async function carryPreconditions(
  q: Q,
  opts: Pick<CarryOptions, 'fromPolicyId' | 'toPolicyId'>
): Promise<{ keyed: boolean }> {
  assertPolicy(opts.fromPolicyId);
  assertPolicy(opts.toPolicyId);
  if (opts.fromPolicyId === opts.toPolicyId)
    throw Error('Source and target policy must differ');
  const policy = await q.query(
    'SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1',
    [opts.toPolicyId]
  );
  if (policy.length !== 1 || policy[0].revoked)
    throw Error('Target policy unavailable or revoked');
  const scans = await q.query(
    `SELECT m."scanId", (c."scanId" IS NOT NULL) AS done, e."releaseId" AS release
       FROM directory_overture_private_membership m
       LEFT JOIN directory_overture_private_completion c ON c."scanId"=m."scanId"
       LEFT JOIN directory_overture_source_evidence e ON e."scanId"=m."scanId"
      WHERE m."policyId"=$1`,
    [opts.toPolicyId]
  );
  if (!scans.length || scans.some((s: { done: boolean }) => !s.done))
    throw Error('Target cohort is incomplete');
  const keyed = await cohortHasKeys(q, opts.toPolicyId);
  if (!keyed) return { keyed };
  if (scans.some((s: { release: string | null }) => !s.release))
    throw Error('Target cohort has no source evidence');
  const hasPredecessors =
    (
      await q.query(
        'SELECT 1 FROM directory_business_assertion WHERE "policyId"=$1 LIMIT 1',
        [opts.fromPolicyId]
      )
    ).length > 0;
  if (hasPredecessors) {
    const source = await q.query(
      `SELECT e."releaseId" AS release FROM directory_overture_private_membership m
         LEFT JOIN directory_overture_source_evidence e ON e."scanId"=m."scanId" WHERE m."policyId"=$1`,
      [opts.fromPolicyId]
    );
    if (
      !source.length ||
      source.some((s: { release: string | null }) => !s.release)
    )
      throw Error('Source cohort has no source evidence');
    const newestSource = source
      .map((s: { release: string }) => s.release)
      .reduce((a: string, b: string) => (releaseNewer(a, b) ? a : b));
    const oldestTarget = scans
      .map((s: { release: string }) => s.release)
      .reduce((a: string, b: string) => (releaseNewer(a, b) ? b : a));
    if (!releaseNewer(oldestTarget, newestSource))
      throw Error('Target cohort is not strictly newer than the source cohort');
  }
  return { keyed };
}

async function loadTown(
  q: Q,
  town: string,
  opts: CarryOptions
): Promise<{
  cohort: CohortRow[];
  predecessors: PredecessorAssertion[];
  predecessorByBusiness: Map<string, string>;
  businessByHash: Map<string, Set<string>>;
}> {
  const rows = await q.query(
    `SELECT r."scanId", r."sourceFileRowNumber", k."upstreamKeyHash", k."keyVersion", r.listing->>'name' AS name
       FROM directory_overture_private_row r
       JOIN directory_overture_private_membership m ON m."scanId"=r."scanId" AND m."policyId"=$1
       LEFT JOIN directory_overture_source_key k ON k."scanId"=r."scanId" AND k."sourceFileRowNumber"=r."sourceFileRowNumber"
      WHERE r."regionId"=$2 ORDER BY r."scanId", r."sourceFileRowNumber"`,
    [opts.toPolicyId, town]
  );
  const cohort: CohortRow[] = rows.map((row: any) => ({
    scanId: row.scanId,
    sourceFileRowNumber: String(row.sourceFileRowNumber),
    upstreamKeyHash:
      row.keyVersion === BUSINESS_IDENTITY_KEY_VERSION &&
      typeof row.upstreamKeyHash === 'string'
        ? row.upstreamKeyHash
        : null,
    nameHash: businessNameHash(opts.key, row.name),
  }));
  const preds = await q.query(
    `SELECT a.id, a."businessId", b.state AS "businessState", a."upstreamKeyHash", a."nameHash", a."policyId", a.state AS "assertionState"
       FROM directory_business_assertion a JOIN directory_business b ON b.id=a."businessId"
      WHERE a."communityId"=$1 AND a."policyId"<>$2 AND a.state<>'withdrawn' AND a."upstreamKeyHash" IS NOT NULL
        AND (a.state='current' OR b.state<>'active'
             OR EXISTS (SELECT 1 FROM directory_business_assertion n WHERE n."predecessorAssertionId"=a.id AND n."policyId"=$2))`,
    [town, opts.toPolicyId]
  );
  const predecessors: PredecessorAssertion[] = [];
  const predecessorByBusiness = new Map<string, string>();
  const businessByHash = new Map<string, Set<string>>();
  for (const p of preds) {
    // A business that is current only in an older cohort was absent from the source cohort: a returning key
    // is a question for a reviewer, never an automatic carry (decision 7, conservative reading).
    const older = p.policyId !== opts.fromPolicyId;
    predecessors.push({
      businessId: p.businessId,
      businessState: older ? 'retired' : p.businessState,
      upstreamKeyHash: p.upstreamKeyHash,
      nameHash: p.nameHash,
    });
    if (!older && p.assertionState === 'current')
      predecessorByBusiness.set(p.businessId, p.id);
    const set = businessByHash.get(p.upstreamKeyHash) ?? new Set<string>();
    set.add(p.businessId);
    businessByHash.set(p.upstreamKeyHash, set);
  }
  return { cohort, predecessors, predecessorByBusiness, businessByHash };
}

const tally = (rows: readonly ClassifiedRow[]): Record<string, number> => {
  const counts: Record<string, number> = {
    carry: 0,
    new: 0,
    unresolved: 0,
    nameChanged: 0,
  };
  for (const row of rows) {
    counts[row.verdict.kind] += 1;
    if (row.verdict.kind === 'carry' && row.verdict.nameChanged)
      counts['nameChanged'] += 1;
  }
  return counts;
};

async function planTown(q: Q, town: string, opts: CarryOptions) {
  const loaded = await loadTown(q, town, opts);
  const plan = classifyCohort(loaded.cohort, loaded.predecessors);
  return { ...loaded, plan, town };
}

/** Read-only plan for every town of the target cohort. */
export async function planCarry(q: Q, opts: CarryOptions): Promise<CarryPlan> {
  const { keyed } = await carryPreconditions(q, opts);
  const towns: TownPlan[] = [];
  for (const town of await cohortTowns(q, opts.toPolicyId)) {
    const planned = await planTown(q, town, opts);
    towns.push({
      town,
      digest: planned.plan.digest,
      rows: planned.plan.rows,
      counts: tally(planned.plan.rows),
    });
  }
  const digest = createHash('sha256');
  for (const t of towns) digest.update(`${t.town}\t${t.digest}\n`);
  const counts: Record<string, number> = {
    carry: 0,
    new: 0,
    unresolved: 0,
    nameChanged: 0,
  };
  for (const t of towns)
    for (const [k, v] of Object.entries(t.counts)) counts[k] += v;
  return { digest: digest.digest('hex'), keyed, towns, counts };
}

export interface CarryHooks {
  afterBatch?(info: { town: string; processed: number }): Promise<void> | void;
}

export interface CarryResult {
  readonly planDigest: string;
  readonly applied: Readonly<Record<string, number>>;
  readonly complete: boolean;
}

const rowCmp = (
  a: { scanId: string; sourceFileRowNumber: string },
  b: { scanId: string; sourceFileRowNumber: string }
) =>
  a.scanId < b.scanId
    ? -1
    : a.scanId > b.scanId
    ? 1
    : BigInt(a.sourceFileRowNumber) < BigInt(b.sourceFileRowNumber)
    ? -1
    : BigInt(a.sourceFileRowNumber) > BigInt(b.sourceFileRowNumber)
    ? 1
    : 0;

/**
 * Applies a plan, town by town, in transactions of CARRY_BATCH rows. Every transaction recomputes the town's
 * plan under the town lock and aborts when its digest differs from the plan that was approved. Safe to
 * repeat and to resume; two concurrent runs serialise on the town lock and converge on one result.
 */
export async function applyCarry(
  db: Db,
  opts: CarryOptions & { planDigest: string },
  hooks: CarryHooks = {}
): Promise<CarryResult> {
  if (!HEX64.test(opts.planDigest)) throw Error('A plan digest is required');
  const plan = await planCarry(db, opts);
  if (plan.digest !== opts.planDigest)
    throw Error(
      'Plan digest does not match the current plan; run --check again'
    );
  const applied: Record<string, number> = { carry: 0, new: 0, unresolved: 0 };
  const batchSize = Math.max(
    1,
    Math.min(opts.batchSize ?? CARRY_BATCH, CARRY_BATCH)
  );

  for (const townPlan of plan.towns) {
    const town = townPlan.town;
    await db.transaction(async (m) => {
      await m.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
        [townLock(town)]
      );
      await m.query(
        `INSERT INTO directory_business_carry_state ("communityId","fromPolicyId","toPolicyId","planDigest","state")
         VALUES ($1,$2,$3,$4,'planned') ON CONFLICT DO NOTHING`,
        [town, opts.fromPolicyId, opts.toPolicyId, townPlan.digest]
      );
      const [state] = await m.query(
        'SELECT "planDigest", state FROM directory_business_carry_state WHERE "communityId"=$1 AND "fromPolicyId"=$2 AND "toPolicyId"=$3 FOR UPDATE',
        [town, opts.fromPolicyId, opts.toPolicyId]
      );
      if (state.state === 'planned' && state.planDigest !== townPlan.digest) {
        await m.query(
          'UPDATE directory_business_carry_state SET "planDigest"=$4,"updatedAt"=now() WHERE "communityId"=$1 AND "fromPolicyId"=$2 AND "toPolicyId"=$3',
          [town, opts.fromPolicyId, opts.toPolicyId, townPlan.digest]
        );
      } else if (state.planDigest !== townPlan.digest) {
        throw Error(
          'The plan changed after carry started; refusing to continue'
        );
      }
    });

    for (;;) {
      const finished = await db.transaction(async (m) => {
        await m.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',
          [townLock(town)]
        );
        const policy = await m.query(
          'SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR SHARE',
          [opts.toPolicyId]
        );
        if (policy.length !== 1 || policy[0].revoked)
          throw Error('Target policy unavailable or revoked');
        const [state] = await m.query(
          'SELECT state, "cursorScanId", "cursorRow", "planDigest" FROM directory_business_carry_state WHERE "communityId"=$1 AND "fromPolicyId"=$2 AND "toPolicyId"=$3 FOR UPDATE',
          [town, opts.fromPolicyId, opts.toPolicyId]
        );
        if (state.state === 'complete') return true;
        const current = await planTown(m, town, opts);
        if (current.plan.digest !== townPlan.digest)
          throw Error('The plan changed during carry; refusing to continue');
        const cursor = state.cursorScanId
          ? {
              scanId: state.cursorScanId as string,
              sourceFileRowNumber: String(state.cursorRow),
            }
          : null;
        const remaining = current.plan.rows.filter(
          (row) => !cursor || rowCmp(row, cursor) > 0
        );
        const batch = remaining.slice(0, batchSize);

        const carryBusinesses = [
          ...new Set(
            batch.flatMap((row) =>
              row.verdict.kind === 'carry' ? [row.verdict.businessId] : []
            )
          ),
        ].sort();
        if (carryBusinesses.length)
          await m.query(
            'SELECT id FROM directory_business WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE',
            [carryBusinesses]
          );

        const names = new Map(
          current.cohort.map((c) => [
            `${c.scanId}:${c.sourceFileRowNumber}`,
            c.nameHash,
          ])
        );
        for (const row of batch) {
          const existing = await m.query(
            'SELECT "businessId" FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
            [row.scanId, row.sourceFileRowNumber]
          );
          const verdict = row.verdict;
          if (existing.length) {
            if (
              verdict.kind === 'carry' &&
              existing[0].businessId !== verdict.businessId
            )
              throw Error('An existing assertion disagrees with the plan');
            continue;
          }
          const nameHash =
            names.get(`${row.scanId}:${row.sourceFileRowNumber}`) ?? null;
          if (verdict.kind === 'carry') {
            const predecessor =
              current.predecessorByBusiness.get(verdict.businessId) ?? null;
            const inserted = await m.query(
              `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,"upstreamKeyHash","nameHash",state,"predecessorAssertionId")
               VALUES ($1,$2,$3,$4,$5,'upstream_id','carried',$6,$7,'current',$8) ON CONFLICT DO NOTHING RETURNING id`,
              [
                verdict.businessId,
                town,
                row.scanId,
                row.sourceFileRowNumber,
                opts.toPolicyId,
                row.upstreamKeyHash,
                nameHash,
                predecessor,
              ]
            );
            if (!inserted.length)
              throw Error('Carry assertion conflicts with an existing one');
            if (predecessor)
              await m.query(
                `UPDATE directory_business_assertion SET state='superseded' WHERE id=$1 AND state='current'`,
                [predecessor]
              );
            await m.query(
              `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber") VALUES ($1,'carried',$2,$3,$4) ON CONFLICT DO NOTHING`,
              [
                verdict.businessId,
                verdict.nameChanged
                  ? 'upstream_key_name_changed'
                  : 'upstream_key',
                row.scanId,
                row.sourceFileRowNumber,
              ]
            );
            applied['carry'] += 1;
          } else if (verdict.kind === 'new') {
            // A keyless row never gets a business here: it can never be carried, so it stays row-scoped.
            if (!row.upstreamKeyHash) continue;
            const [business] = await m.query(
              'INSERT INTO directory_business ("communityId") VALUES ($1) RETURNING id',
              [town]
            );
            await m.query(
              `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,"upstreamKeyHash","nameHash",state)
               VALUES ($1,$2,$3,$4,$5,'upstream_id','origin',$6,$7,'current')`,
              [
                business.id,
                town,
                row.scanId,
                row.sourceFileRowNumber,
                opts.toPolicyId,
                row.upstreamKeyHash,
                nameHash,
              ]
            );
            await m.query(
              `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber") VALUES ($1,'created','first_sighting',$2,$3) ON CONFLICT DO NOTHING`,
              [business.id, row.scanId, row.sourceFileRowNumber]
            );
            applied['new'] += 1;
          } else {
            // The event needs a business; a duplicate with no existing business has nothing to attach to.
            const owners = row.upstreamKeyHash
              ? current.businessByHash.get(row.upstreamKeyHash)
              : undefined;
            if (owners && owners.size === 1) {
              await m.query(
                `INSERT INTO directory_business_event ("businessId",kind,cause,"scanId","sourceFileRowNumber") VALUES ($1,'unresolved',$2,$3,$4) ON CONFLICT DO NOTHING`,
                [
                  [...owners][0],
                  verdict.cause,
                  row.scanId,
                  row.sourceFileRowNumber,
                ]
              );
            }
            applied['unresolved'] += 1;
          }
        }
        const last = batch[batch.length - 1];
        const done = remaining.length <= batchSize;
        await m.query(
          `UPDATE directory_business_carry_state SET "cursorScanId"=COALESCE($4,"cursorScanId"),"cursorRow"=COALESCE($5::bigint,"cursorRow"),state=$6,"updatedAt"=now()
            WHERE "communityId"=$1 AND "fromPolicyId"=$2 AND "toPolicyId"=$3`,
          [
            town,
            opts.fromPolicyId,
            opts.toPolicyId,
            last?.scanId ?? null,
            last?.sourceFileRowNumber ?? null,
            done ? 'complete' : 'running',
          ]
        );
        return done;
      });
      if (hooks.afterBatch) await hooks.afterBatch({ town, processed: 1 });
      if (finished) break;
    }
  }
  return { planDigest: plan.digest, applied, complete: true };
}

/**
 * Cutover precondition: the old policy may be revoked only when every town of the new cohort has a complete
 * carry state, or the cohort has no source keys at all (origin-only, nothing to carry).
 */
export async function carryAllowsRevoke(
  q: Q,
  fromPolicyId: string,
  toPolicyId: string
): Promise<{ ok: boolean; reason?: string }> {
  assertPolicy(fromPolicyId);
  assertPolicy(toPolicyId);
  if (!(await cohortHasKeys(q, toPolicyId))) return { ok: true };
  for (const town of await cohortTowns(q, toPolicyId)) {
    if (!(await cohortHasKeys(q, toPolicyId, town))) continue;
    const state = await q.query(
      'SELECT state FROM directory_business_carry_state WHERE "communityId"=$1 AND "fromPolicyId"=$2 AND "toPolicyId"=$3',
      [town, fromPolicyId, toPolicyId]
    );
    if (state.length !== 1 || state[0].state !== 'complete')
      return {
        ok: false,
        reason:
          'Business identity carry is not complete for every town of the new cohort',
      };
  }
  return { ok: true };
}
