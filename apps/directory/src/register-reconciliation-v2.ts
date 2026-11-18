import { DataSource, EntityManager } from 'typeorm';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';
import {
  SocialCommunitySnapshot,
  isEligibleCommunity,
} from './social-eligibility';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const generation = (x: unknown): x is string =>
  typeof x === 'string' &&
  /^[1-9][0-9]*$/.test(x) &&
  BigInt(x) <= 9223372036854775807n;
const fields: Array<keyof DirectoryRecoveryIdentity> = [
  'sourceEpoch',
  'recoveryEpoch',
  'owner',
  'activationId',
  'socialGeneration',
  'directoryGeneration',
];
export type ExactSourceRead =
  | { status: 'superseded' }
  | { status: 'current'; snapshot: SocialCommunitySnapshot | null };
export type CurrentSourceRead =
  | { status: 'absent' }
  | {
      status: 'current';
      changeToken: string;
      snapshot: SocialCommunitySnapshot | null;
    };
function validIdentity(id: DirectoryRecoveryIdentity): boolean {
  return (
    !!id &&
    [id.sourceEpoch, id.recoveryEpoch, id.owner, id.activationId].every(
      (x) => typeof x === 'string' && uuid.test(x)
    ) &&
    generation(id.socialGeneration) &&
    generation(id.directoryGeneration)
  );
}
export async function lockAuthority(
  manager: EntityManager,
  identity: DirectoryRecoveryIdentity
): Promise<void> {
  await manager.query("SET LOCAL lock_timeout = '2s'");
  await manager.query("SET LOCAL statement_timeout = '10s'");
  await manager.query(
    "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
  );
  const rows = await manager.query(
    `SELECT p.*, i."recoveryEpoch" AS "authorityEpoch" FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery' FOR SHARE OF p,i`
  );
  const row = rows[0];
  if (
    rows.length !== 1 ||
    row.protocol !== 'register-pending-v1' ||
    !['reg-source', 'reg-directory', 'reg-running'].includes(row.phase) ||
    row.authorityEpoch !== identity.recoveryEpoch ||
    fields.some((field) => row[field] !== identity[field])
  )
    throw new Error('Directory register authority unavailable');
}
async function apply(
  manager: EntityManager,
  id: string,
  snapshot: SocialCommunitySnapshot | null,
  token: string | null
): Promise<void> {
  if (
    snapshot !== null &&
    (!snapshot ||
      snapshot.id !== id ||
      typeof snapshot.name !== 'string' ||
      !(snapshot.slug === null || typeof snapshot.slug === 'string') ||
      !(
        snapshot.adminArea === null || typeof snapshot.adminArea === 'string'
      ) ||
      !isEligibleCommunity(snapshot))
  )
    throw new Error('Invalid register snapshot');
  await manager.query(
    'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL AND ($2::uuid IS NULL OR "changeToken"<>$2)',
    [id, snapshot === null ? null : token]
  );
  if (snapshot === null || token === null)
    await manager.query(
      'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
      [id]
    );
  else
    await manager.query(
      'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1 AND "changeToken"<>$2',
      [id, token]
    );
  if (snapshot === null || token === null)
    await manager.query(
      'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',
      [id]
    );
  else
    await manager.query(
      'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1 AND "changeToken"<>$2',
      [id, token]
    );
  if (snapshot) {
    await manager.query(
      `INSERT INTO directory_town ("communityId",name,slug,"administrativeArea",eligible,"geometryStatus") VALUES ($1,$2,$3,$4,true,'pending') ON CONFLICT ("communityId") DO UPDATE SET name=EXCLUDED.name,slug=EXCLUDED.slug,"administrativeArea"=EXCLUDED."administrativeArea",eligible=true, "geometryStatus"=CASE WHEN directory_town.eligible OR EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=directory_town."communityId") THEN directory_town."geometryStatus" ELSE 'pending' END`,
      [id, snapshot.name, snapshot.slug, snapshot.adminArea]
    );
    await manager.query(
      `INSERT INTO directory_provider_work ("communityId",status) VALUES ($1,'blocked') ON CONFLICT ("communityId") DO UPDATE SET status='blocked',"updatedAt"=CURRENT_TIMESTAMP`,
      [id]
    );
  } else {
    await manager.query(
      `UPDATE directory_town SET name='',slug=NULL,"administrativeArea"=NULL,eligible=false,"geometryStatus"=CASE WHEN EXISTS (SELECT 1 FROM directory_boundary_lock l WHERE l."communityId"=directory_town."communityId") THEN "geometryStatus" ELSE 'pending' END WHERE "communityId"=$1`,
      [id]
    );
    await manager.query(
      'DELETE FROM directory_provider_work WHERE "communityId"=$1',
      [id]
    );
  }
}
/** No ACK: all Social register entries remain dirty and are retried in later passes. */
export async function reconcileRegisterV2(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  communityId: string,
  token: string,
  read: () => Promise<ExactSourceRead>
): Promise<'applied' | 'superseded'> {
  if (!validIdentity(identity) || !uuid.test(communityId) || !uuid.test(token))
    throw new Error('Invalid register identity');
  return db.transaction(async (manager) => {
    await lockAuthority(manager, identity);
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [communityId]
    );
    const current = await read();
    if (!current || !['current', 'superseded'].includes(current.status))
      throw new Error('Invalid register response');
    if (current.status === 'superseded') return 'superseded';
    await apply(manager, communityId, current.snapshot, token);
    return 'applied';
  });
}
/** Current-by-ID repair distinguishes authoritative absence from a stale token. */
export async function repairRegisterV2(
  db: DataSource,
  identity: DirectoryRecoveryIdentity,
  communityId: string,
  read: () => Promise<CurrentSourceRead>
): Promise<void> {
  if (!validIdentity(identity) || !uuid.test(communityId))
    throw new Error('Invalid register identity');
  await db.transaction(async (manager) => {
    await lockAuthority(manager, identity);
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [communityId]
    );
    const current = await read();
    if (
      !current ||
      !['current', 'absent'].includes(current.status) ||
      (current.status === 'current' && !uuid.test(current.changeToken))
    )
      throw new Error('Invalid current register response');
    await apply(
      manager,
      communityId,
      current.status === 'absent' ? null : current.snapshot,
      current.status === 'absent' ? null : current.changeToken
    );
  });
}
