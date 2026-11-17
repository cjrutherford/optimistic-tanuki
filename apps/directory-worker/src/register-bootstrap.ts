import { DataSource } from 'typeorm';
import { DirectoryRecoveryIdentity, advanceRegisterRecovery } from '../../directory/src/register-recovery-authority';
import { CurrentSourceRead, ExactSourceRead, reconcileRegisterV2, repairRegisterV2 } from '../../directory/src/register-reconciliation-v2';
import { RegisterToken } from './register-delivery';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fields: Array<keyof DirectoryRecoveryIdentity>=['sourceEpoch','recoveryEpoch','owner','activationId','socialGeneration','directoryGeneration'];
type Phase='blocked'|'reg-source'|'reg-directory'|'reg-running';
type Checkpoint={phase:Phase;cursor:string|null};
type Source={
  scan(identity:DirectoryRecoveryIdentity,cursor:string|null,limit:number):Promise<RegisterToken[]>;
  read(identity:DirectoryRecoveryIdentity,id:string,token:string):Promise<ExactSourceRead>;
  current(identity:DirectoryRecoveryIdentity,id:string):Promise<CurrentSourceRead>;
};
async function checkpoint(db:DataSource,identity:DirectoryRecoveryIdentity):Promise<Checkpoint> {
  return db.transaction(async manager=>{
    await manager.query("SET LOCAL lock_timeout = '2s'");
    const rows=await manager.query(`SELECT p.*,i."recoveryEpoch" AS "authorityEpoch" FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery' FOR SHARE OF p,i`);
    const p=rows[0];
    if(rows.length!==1 || p.protocol!=='register-pending-v1' || p.authorityEpoch!==identity.recoveryEpoch || fields.some(k=>p[k]!==identity[k]) || !['blocked','reg-source','reg-directory','reg-running'].includes(p.phase) || !(p.cursor===null || (typeof p.cursor==='string' && uuid.test(p.cursor)))) throw new Error('Directory register authority unavailable');
    return {phase:p.phase,cursor:p.cursor};
  });
}
/** One bounded page. Caller must restart failed pages; no Social register entry is retired. */
export async function registerBootstrapPage(db:DataSource,identity:DirectoryRecoveryIdentity,source:Source,limit=100):Promise<'more'|'complete'> {
  if (!Number.isSafeInteger(limit) || limit<1 || limit>200) throw new Error('Invalid register page limit');
  let state=await checkpoint(db,identity);
  if(state.phase==='reg-running') return 'complete';
  if(state.phase==='blocked') { await advanceRegisterRecovery(db,identity,state,{phase:'reg-source',cursor:null}); return 'more'; }
  if(state.phase==='reg-source') {
    const entries=await source.scan(identity,state.cursor,limit);
    if(!Array.isArray(entries) || entries.length>limit) throw new Error('Invalid register page');
    let previous=state.cursor;
    for(const entry of entries) {
      if(!entry || !uuid.test(entry.communityId) || !uuid.test(entry.changeToken) || !['changed','deleted'].includes(entry.operation) || (previous!==null && entry.communityId<=previous)) throw new Error('Invalid register page');
      previous=entry.communityId;
    }
    for(const entry of entries) {
      await reconcileRegisterV2(db,identity,entry.communityId,entry.changeToken,()=>source.read(identity,entry.communityId,entry.changeToken));
      const next:Checkpoint={phase:'reg-source',cursor:entry.communityId};
      await advanceRegisterRecovery(db,identity,state,next); state=next;
    }
    if(entries.length===limit) return 'more';
    await advanceRegisterRecovery(db,identity,state,{phase:'reg-directory',cursor:null}); return 'more';
  }
  const towns=await db.query('SELECT "communityId" AS id FROM directory_town WHERE ($1::uuid IS NULL OR "communityId">$1::uuid) ORDER BY "communityId" LIMIT $2',[state.cursor,limit]);
  for(const {id} of towns) {
    if(typeof id!=='string' || !uuid.test(id) || (state.cursor!==null && id<=state.cursor)) throw new Error('Invalid Directory page');
    await repairRegisterV2(db,identity,id,()=>source.current(identity,id));
    const next:Checkpoint={phase:'reg-directory',cursor:id};
    await advanceRegisterRecovery(db,identity,state,next); state=next;
  }
  if(towns.length===limit) return 'more';
  await advanceRegisterRecovery(db,identity,state,{phase:'reg-running',cursor:null}); return 'complete';
}
