import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';

/**
 * An owner lock is an owner-verified border. The lock row proves it; this file turns it into the same two records the
 * reviewed-boundary consumers read (a `verified` boundary decision and the reviewed-geometry binding) so the D11 strong
 * match, the publish containment check and the register-pending recovery runtime accept a locked town without a Social
 * candidate (several locked towns have a mis-placed Social point, which is why they are locked).
 *
 * The decision is recognisable by its reason, has no reviewer and is not `automatic`, so the automatic matcher's
 * undo/retry logic never touches it. The change token is derived from the lock evidence hash and the geometry version,
 * so it is stable across recovery resets. The request id also carries the recovery authority, because each reset
 * invalidates its decisions and the decision table keeps them as history.
 */
export const OWNER_LOCK_REASON = 'owner_lock';

/** SQL fragments for the sites that invalidate or delete reviewed boundaries on a candidate/eligibility change. */
export const KEEP_OWNER_LOCK_DECISIONS = `AND "reason" IS DISTINCT FROM '${OWNER_LOCK_REASON}'`;
export const KEEP_OWNER_LOCK_GEOMETRY = `AND NOT EXISTS (SELECT 1 FROM directory_boundary_decision od WHERE od."requestId"=directory_reviewed_geometry."requestId" AND od."reason"='${OWNER_LOCK_REASON}')`;

const NIL = '00000000-0000-0000-0000-000000000000';

function uuidFrom(seed: string): string {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(
    17,
    20
  )}-${h.slice(20, 32)}`;
}

/** Stable for a given lock evidence and geometry version. */
export function ownerLockChangeToken(
  evidenceHash: string,
  version: number
): string {
  return uuidFrom(`owner-lock-token:${evidenceHash}:${version}`);
}
export function ownerLockRequestId(
  evidenceHash: string,
  version: number,
  recoveryEpoch: string,
  directoryGeneration: string
): string {
  return uuidFrom(
    `owner-lock-request:${evidenceHash}:${version}:${recoveryEpoch}:${directoryGeneration}`
  );
}

export interface RecoveryAuthorityStamp {
  recoveryEpoch: string;
  directoryGeneration: string;
}
export type OwnerLockBindingOutcome =
  | 'present'
  | 'written'
  | 'would-write'
  | 'skipped';

/**
 * Ensures the lock's decision and reviewed-geometry binding exist for the current recovery authority. Call inside the
 * transaction that holds the community advisory lock. `skipped`: the town has no lock, the lock describes a geometry the
 * town no longer serves (a reviewer replaced it), or no recovery authority exists yet (the recovery begin writes it).
 */
export async function ensureOwnerLockBinding(
  manager: EntityManager,
  communityId: string,
  options: { authority?: RecoveryAuthorityStamp; dryRun?: boolean } = {}
): Promise<OwnerLockBindingOutcome> {
  const [lock] = await manager.query(
    `SELECT l.*,t."geometryVersion" AS "townVersion",t.eligible,encode(ST_AsEWKB(g.boundary,'XDR'),'hex') AS binary
       FROM directory_boundary_lock l
       JOIN directory_town t ON t."communityId"=l."communityId"
       LEFT JOIN directory_town_geometry g ON g."communityId"=l."communityId" AND g.version=l.version
      WHERE l."communityId"=$1`,
    [communityId]
  );
  if (
    !lock ||
    Number(lock.townVersion) !== Number(lock.version) ||
    typeof lock.binary !== 'string' ||
    createHash('sha256')
      .update(Buffer.from(lock.binary, 'hex'))
      .digest('hex') !== lock.geometryHash
  )
    return 'skipped';
  let authority = options.authority;
  if (!authority) {
    const [row] = await manager.query(
      `SELECT "recoveryEpoch","directoryGeneration" FROM directory_census_progress WHERE id='recovery'`
    );
    if (!row?.recoveryEpoch) return 'skipped';
    authority = {
      recoveryEpoch: row.recoveryEpoch,
      directoryGeneration: String(row.directoryGeneration),
    };
  }
  const version = Number(lock.version);
  const requestId = ownerLockRequestId(
    lock.evidenceHash,
    version,
    authority.recoveryEpoch,
    authority.directoryGeneration
  );
  const changeToken = ownerLockChangeToken(lock.evidenceHash, version);
  const present = await manager.query(
    `SELECT 1 FROM directory_reviewed_geometry b
       JOIN directory_boundary_decision d ON d."requestId"=b."requestId" AND d."communityId"=b."communityId"
      WHERE b."communityId"=$1 AND b."requestId"=$2 AND b.version=$3 AND b."geometryHash"=$4 AND b."changeToken"=$5
        AND b."recoveryEpoch"=$6 AND b."directoryGeneration"=$7 AND d."invalidatedAt" IS NULL AND d.decision='verified'
        AND d."reason"=$8`,
    [
      communityId,
      requestId,
      version,
      lock.geometryHash,
      changeToken,
      authority.recoveryEpoch,
      authority.directoryGeneration,
      OWNER_LOCK_REASON,
    ]
  );
  if (present.length) return 'present';
  if (options.dryRun) return 'would-write';
  await manager.query(
    'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL AND "requestId"<>$2',
    [communityId, requestId]
  );
  await manager.query(
    'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
    [communityId]
  );
  await manager.query(
    `INSERT INTO directory_boundary_decision ("requestId","communityId","reviewerId",decision,"sourceUrl","sourceEpoch","activationId","socialGeneration","recoveryEpoch","directoryGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash",automatic,reason)
     VALUES ($1,$2,NULL,'verified',$3,$4,$4,0,$5,$6,$7,$8,$9,$10,$11,$12,$13,false,$14)
     ON CONFLICT ("requestId") DO UPDATE SET "invalidatedAt"=NULL`,
    [
      requestId,
      communityId,
      lock.sourceUrl,
      NIL,
      authority.recoveryEpoch,
      authority.directoryGeneration,
      changeToken,
      lock.geoid,
      lock.layer,
      lock.vintage,
      lock.stateFips,
      lock.archiveSha256,
      lock.geometryHash,
      OWNER_LOCK_REASON,
    ]
  );
  await manager.query(
    `INSERT INTO directory_reviewed_geometry ("communityId","requestId",version,"changeToken","geographyHash","geometryHash","recoveryEpoch","directoryGeneration")
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7)`,
    [
      communityId,
      requestId,
      version,
      changeToken,
      lock.geometryHash,
      authority.recoveryEpoch,
      authority.directoryGeneration,
    ]
  );
  return 'written';
}

/** Re-creates every owner-lock binding for a new recovery authority (the recovery reset deletes them all). */
export async function ensureAllOwnerLockBindings(
  manager: EntityManager,
  authority: RecoveryAuthorityStamp
): Promise<number> {
  const rows = await manager.query(
    'SELECT "communityId" FROM directory_boundary_lock'
  );
  let written = 0;
  for (const { communityId } of rows)
    if (
      (await ensureOwnerLockBinding(manager, communityId, { authority })) ===
      'written'
    )
      written++;
  return written;
}
