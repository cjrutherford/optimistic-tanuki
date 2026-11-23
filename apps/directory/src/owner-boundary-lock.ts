import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { canonicalJson } from './locked-boundary';
import {
  ensureOwnerLockBinding,
  OWNER_LOCK_REASON,
} from './locked-boundary-binding';
import { recordOperatorEvent } from './operator-audit';
import { ReviewConflictError } from './review-version';

/**
 * Owner-console boundary lock and unlock.
 *
 * The lock row is the single truth every other path reads ("is this town locked?"): the geometry sweep, the register
 * re-reconcile and the recovery resets all skip a town that has one, and recovery re-creates the owner-verified
 * decision and binding of every row that exists (`ensureAllOwnerLockBindings` iterates the lock table). So:
 *
 *  - Lock pins the boundary the town serves now. It needs a current, un-invalidated `verified` decision bound to the
 *    served geometry version (a reviewer's or an earlier lock's), copies that decision's Census identity into the lock
 *    row, and writes the same owner-lock decision and binding the manifest install writes. Recovery keeps the lock and
 *    re-creates its binding, so an owner lock survives recovery.
 *  - Unlock deletes the lock row, invalidates the owner-lock decision and binding, and returns the town to `pending`
 *    so it goes back through boundary review. Because the row is gone, recovery has nothing to re-create, so it does
 *    not re-create a lock the owner removed. A later manifest install is an explicit operator act and may lock again.
 *
 * Both run under the same advisory locks the manifest install takes (shared recovery authority, then the town) and
 * write their audit row in the same transaction.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface BoundaryLockState {
  locked: boolean;
  /** The town's name, so the console can ask for it as the typed confirmation. */
  townName: string | null;
  lock: {
    lockedAt: string;
    version: number;
    geoid: string;
    layer: string;
    vintage: string;
    /** `owner_console` when taken from the console, `manifest` when installed from a researched Census manifest. */
    source: 'owner_console' | 'manifest';
    lockedBy: string | null;
    reason: string | null;
  } | null;
}

interface Input {
  communityId: string;
  actorId: string;
  reason: string;
}

function check(input: Input, what: string): void {
  if (
    !input ||
    !UUID.test(input.communityId || '') ||
    !UUID.test(input.actorId || '') ||
    typeof input.reason !== 'string' ||
    !input.reason.trim() ||
    input.reason.length > 1024
  )
    throw Error(`Invalid boundary ${what}`);
}

async function begin(manager: any, communityId: string): Promise<any> {
  await manager.query(
    "SELECT pg_advisory_xact_lock_shared(hashtextextended('directory-recovery-authority-v1', 0))"
  );
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    communityId,
  ]);
  const [town] = await manager.query(
    'SELECT name,eligible,"geometryVersion","geometryStatus" FROM directory_town WHERE "communityId"=$1 FOR UPDATE',
    [communityId]
  );
  if (!town) throw Error('Town not found');
  return town;
}

export async function readBoundaryLock(
  db: Pick<DataSource, 'query'>,
  communityId: string
): Promise<BoundaryLockState> {
  if (!UUID.test(communityId || '')) throw Error('Invalid boundary lock');
  const [named] = await db.query(
    'SELECT name FROM directory_town WHERE "communityId"=$1',
    [communityId]
  );
  if (!named) throw Error('Town not found');
  const townName: string = named.name;
  const [row] = await db.query(
    `SELECT l."lockedAt",l.version,l.geoid,l.layer,l.vintage,l.evidence->>'source' AS source,
            e."actorId" AS "lockedBy",e.reason
       FROM directory_boundary_lock l
       LEFT JOIN LATERAL (SELECT "actorId",reason FROM directory_operator_event
                           WHERE kind='boundary_lock' AND "subjectId"=l."communityId"::text AND action='lock'
                           ORDER BY at DESC LIMIT 1) e ON true
      WHERE l."communityId"=$1`,
    [communityId]
  );
  if (!row) return { locked: false, townName, lock: null };
  return {
    locked: true,
    townName,
    lock: {
      lockedAt:
        row.lockedAt instanceof Date
          ? row.lockedAt.toISOString()
          : String(row.lockedAt),
      version: Number(row.version),
      geoid: row.geoid,
      layer: row.layer,
      vintage: row.vintage,
      source: row.source === 'owner_console' ? 'owner_console' : 'manifest',
      lockedBy: row.lockedBy ?? null,
      reason: row.reason ?? null,
    },
  };
}

export async function lockBoundary(
  db: Pick<DataSource, 'transaction'>,
  input: Input
): Promise<BoundaryLockState> {
  check(input, 'lock');
  const communityId = input.communityId;
  await db.transaction(async (manager) => {
    const town = await begin(manager, communityId);
    if (town.eligible !== true)
      throw Error('Invalid boundary lock: ineligible');
    const [existing] = await manager.query(
      'SELECT 1 FROM directory_boundary_lock WHERE "communityId"=$1 FOR UPDATE',
      [communityId]
    );
    if (existing)
      throw new ReviewConflictError(
        'invalid_state',
        undefined,
        'already_locked'
      );
    const [verified] = await manager.query(
      `SELECT d."requestId",d.geoid,d.layer,d.vintage,d."stateFips",d."archiveSha256",d."sourceUrl",g."geometryHash"
         FROM directory_reviewed_geometry g
         JOIN directory_boundary_decision d ON d."requestId"=g."requestId" AND d."communityId"=g."communityId"
        WHERE g."communityId"=$1 AND g.version=$2 AND d."invalidatedAt" IS NULL AND d.decision='verified'
          AND d.geoid IS NOT NULL AND d.layer IS NOT NULL AND d.vintage IS NOT NULL AND d."stateFips" IS NOT NULL
          AND d."archiveSha256" IS NOT NULL AND d."sourceUrl" IS NOT NULL
        ORDER BY d."createdAt" DESC LIMIT 1`,
      [communityId, town.geometryVersion]
    );
    if (!verified)
      throw new ReviewConflictError(
        'invalid_state',
        undefined,
        'no_verified_boundary'
      );
    const evidence = {
      source: 'owner_console',
      actorId: input.actorId,
      decisionRequestId: verified.requestId,
    };
    const evidenceHash = createHash('sha256')
      .update(
        canonicalJson({
          communityId,
          geoid: verified.geoid,
          layer: verified.layer,
          vintage: verified.vintage,
          stateFips: verified.stateFips,
          archiveSha256: verified.archiveSha256,
          sourceUrl: verified.sourceUrl,
          geometryHash: verified.geometryHash,
          evidence,
        })
      )
      .digest('hex');
    await manager.query(
      `INSERT INTO directory_boundary_lock ("communityId",version,geoid,layer,vintage,"stateFips","archiveSha256","geometryHash","evidenceHash","sourceUrl",evidence,"lockedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,CURRENT_TIMESTAMP)`,
      [
        communityId,
        town.geometryVersion,
        verified.geoid,
        verified.layer,
        verified.vintage,
        verified.stateFips,
        verified.archiveSha256,
        verified.geometryHash,
        evidenceHash,
        verified.sourceUrl,
        JSON.stringify(evidence),
      ]
    );
    const written = await ensureOwnerLockBinding(manager, communityId);
    if (written !== 'written' && written !== 'present')
      throw new ReviewConflictError(
        'invalid_state',
        undefined,
        'no_verified_boundary'
      );
    await recordOperatorEvent(manager, {
      kind: 'boundary_lock',
      subjectId: communityId,
      action: 'lock',
      actorId: input.actorId,
      reason: input.reason.trim(),
      detail: { version: Number(town.geometryVersion), evidenceHash },
    });
  });
  return readBoundaryLock(
    db as unknown as Pick<DataSource, 'query'>,
    communityId
  );
}

export async function unlockBoundary(
  db: Pick<DataSource, 'transaction'>,
  input: Input
): Promise<BoundaryLockState> {
  check(input, 'unlock');
  const communityId = input.communityId;
  await db.transaction(async (manager) => {
    const town = await begin(manager, communityId);
    const [lock] = await manager.query(
      'SELECT version,"evidenceHash" FROM directory_boundary_lock WHERE "communityId"=$1 FOR UPDATE',
      [communityId]
    );
    if (!lock)
      throw new ReviewConflictError('invalid_state', undefined, 'not_locked');
    await manager.query(
      `DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1 AND "requestId" IN
         (SELECT "requestId" FROM directory_boundary_decision WHERE "communityId"=$1 AND reason=$2)`,
      [communityId, OWNER_LOCK_REASON]
    );
    await manager.query(
      `UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP
        WHERE "communityId"=$1 AND "invalidatedAt" IS NULL AND reason=$2`,
      [communityId, OWNER_LOCK_REASON]
    );
    await manager.query(
      'DELETE FROM directory_boundary_lock WHERE "communityId"=$1',
      [communityId]
    );
    await manager.query(
      `UPDATE directory_town SET "geometryStatus"='pending' WHERE "communityId"=$1 AND "geometryStatus"<>'pending'`,
      [communityId]
    );
    await recordOperatorEvent(manager, {
      kind: 'boundary_lock',
      subjectId: communityId,
      action: 'unlock',
      actorId: input.actorId,
      reason: input.reason.trim(),
      detail: {
        version: Number(lock.version),
        evidenceHash: lock.evidenceHash,
        previousStatus: town.geometryStatus,
      },
    });
  });
  return readBoundaryLock(
    db as unknown as Pick<DataSource, 'query'>,
    communityId
  );
}
