import { assertDirectoryIdentitiesUnfenced } from './account-lifecycle-fence';
import { DataSource } from 'typeorm';
import { BoundaryCandidate, geographyHash, SourceRead } from './boundary-review';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';
import { lockAuthority } from './register-reconciliation-v2';

export type BoundaryDecision = { requestId:string; reviewerId:string; decision:'verified'; attested:true; sourceUrl:string; candidate:BoundaryCandidate & {geographyHash:string} };
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const candidateFields=['communityId','changeToken','geoid','layer','vintage','stateFips','archiveSha256','geographyHash'] as const;

/** Persist review evidence only. It is not permission to install or serve a boundary. */
export async function recordBoundaryDecision(db:DataSource, identity:DirectoryRecoveryIdentity, input:BoundaryDecision, read:SourceRead):Promise<void> {
  if (!input || !uuid.test(input.requestId || '') || !uuid.test(input.reviewerId || '') || input.decision!=='verified' || input.attested!==true || typeof read!=='function') throw Error('Invalid boundary decision');
  let source:URL;
  try { source=new URL(input.sourceUrl); } catch { throw Error('Invalid official source'); }
  if (typeof input.sourceUrl!=='string' || input.sourceUrl.length>2048 || source.protocol!=='https:' || !source.hostname.endsWith('.gov') || source.username || source.password || source.port || source.search || source.hash) throw Error('Invalid official source');
  const candidate=input.candidate;
  if (!candidate || !uuid.test(candidate.communityId || '') || !uuid.test(candidate.changeToken || '')) throw Error('Invalid candidate');
  const value={...input,candidate:{...candidate}}, authority={...identity};
  await db.transaction(async manager=>{
    await assertDirectoryIdentitiesUnfenced(manager,[value.reviewerId]);
    await lockAuthority(manager,authority);
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[value.candidate.communityId]);
    const rows=await manager.query('SELECT c.*,t.eligible FROM directory_boundary_candidate c JOIN directory_town t ON t."communityId"=c."communityId" WHERE c."communityId"=$1 FOR UPDATE OF c,t',[value.candidate.communityId]);
    const row=rows[0];
    if (!row || row.eligible!==true || candidateFields.some(k=>row[k]!==value.candidate[k]) || row.sourceEpoch!==authority.sourceEpoch || row.activationId!==authority.activationId || row.socialGeneration!==authority.socialGeneration) throw Error('Candidate is unavailable or changed');
    const current=await read(), hash=geographyHash(current?.geography,value.candidate.communityId);
    if (current?.status!=='current' || current.changeToken!==row.changeToken || !hash || hash!==row.geographyHash) throw Error('Stale candidate');
    const existing=await manager.query('SELECT * FROM directory_boundary_decision WHERE "requestId"=$1',[value.requestId]);
    if (existing.length) {
      const prior=existing[0];
      if (prior.invalidatedAt!==null || prior.reviewerId!==value.reviewerId || prior.decision!==value.decision || prior.sourceUrl!==value.sourceUrl || prior.sourceEpoch!==authority.sourceEpoch || prior.activationId!==authority.activationId || prior.socialGeneration!==authority.socialGeneration || prior.recoveryEpoch!==authority.recoveryEpoch || prior.directoryGeneration!==authority.directoryGeneration || prior.geographyHash!==hash || candidateFields.some(k=>prior[k]!==value.candidate[k])) throw Error('Request ID already used');
      return;
    }
    await manager.query(`INSERT INTO directory_boundary_decision ("requestId","communityId","reviewerId",decision,"sourceUrl","sourceEpoch","activationId","socialGeneration","recoveryEpoch","directoryGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,[value.requestId,value.candidate.communityId,value.reviewerId,value.decision,value.sourceUrl,authority.sourceEpoch,authority.activationId,authority.socialGeneration,authority.recoveryEpoch,authority.directoryGeneration,value.candidate.changeToken,value.candidate.geoid,value.candidate.layer,value.candidate.vintage,value.candidate.stateFips,value.candidate.archiveSha256,hash]);
  });
}
