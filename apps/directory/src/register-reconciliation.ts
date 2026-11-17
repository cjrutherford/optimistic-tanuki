import { DataSource } from 'typeorm';
import { readRecoveryEpochs } from './recovery-authority';
import { isEligibleCommunity, SocialCommunitySnapshot } from './social-eligibility';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export interface RegisterIdentity { sourceEpoch: string; recoveryEpoch: string; communityId: string; changeToken: string }
export type RegisterRead = { status: 'superseded' } | { status: 'current'; snapshot: SocialCommunitySnapshot | null };

/** The register stays dirty: no cross-database receipt or retirement is implied. */
export async function reconcileRegister(db: DataSource, identity: RegisterIdentity, read: (identity: RegisterIdentity) => Promise<RegisterRead>): Promise<'superseded' | 'applied'> {
  if (!identity || ![identity.sourceEpoch, identity.recoveryEpoch, identity.communityId, identity.changeToken].every(v => typeof v === 'string' && uuid.test(v))) throw new Error('Invalid register identity');
  return db.transaction(async manager => {
    await manager.query("SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))");
    const epochs = await readRecoveryEpochs(manager);
    if (epochs.sourceEpoch !== identity.sourceEpoch || epochs.recoveryEpoch !== identity.recoveryEpoch) throw new Error('Recovery epoch mismatch');
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [identity.communityId]);
    const result = await read(identity);
    if (!result || (result.status !== 'current' && result.status !== 'superseded')) throw new Error('Invalid register response');
    if (result.status === 'superseded') return 'superseded';
    const current = result.snapshot;
    if (current !== null && (!current || current.id !== identity.communityId || typeof current.name !== 'string' || (current.slug !== null && typeof current.slug !== 'string') || (current.adminArea !== null && typeof current.adminArea !== 'string') || !isEligibleCommunity(current))) throw new Error('Invalid register snapshot');
    await manager.query('UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1 AND "invalidatedAt" IS NULL AND ($2::uuid IS NULL OR "changeToken"<>$2)',[identity.communityId,current===null?null:identity.changeToken]);
    if (current===null) await manager.query('DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',[identity.communityId]);
    else await manager.query('DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1 AND "changeToken"<>$2',[identity.communityId,identity.changeToken]);
    if (current===null) await manager.query('DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',[identity.communityId]);
    else await manager.query('DELETE FROM directory_boundary_candidate WHERE "communityId"=$1 AND "changeToken"<>$2',[identity.communityId,identity.changeToken]);
    if (current) {
      await manager.query(`INSERT INTO directory_town ("communityId", name, slug, "administrativeArea", eligible, "geometryStatus") VALUES ($1,$2,$3,$4,true,'pending') ON CONFLICT ("communityId") DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, "administrativeArea"=EXCLUDED."administrativeArea", eligible=true, "geometryStatus"='pending'`, [identity.communityId, current.name, current.slug, current.adminArea]);
      await manager.query(`INSERT INTO directory_provider_work ("communityId", status) VALUES ($1,'blocked') ON CONFLICT ("communityId") DO UPDATE SET status='blocked', "updatedAt"=CURRENT_TIMESTAMP`, [identity.communityId]);
    } else {
      await manager.query(`UPDATE directory_town SET eligible=false, "geometryStatus"='pending' WHERE "communityId"=$1`, [identity.communityId]);
      await manager.query('DELETE FROM directory_provider_work WHERE "communityId"=$1', [identity.communityId]);
    }
    return 'applied';
  });
}
