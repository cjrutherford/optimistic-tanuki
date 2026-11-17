import { createHash } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { geographyHash, SourceRead } from './boundary-review';
import { DirectoryRecoveryIdentity } from './register-recovery-authority';
import { lockAuthority } from './register-reconciliation-v2';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const candidateFields=['communityId','changeToken','geoid','layer','vintage','stateFips','archiveSha256','geographyHash'] as const;
type SourceGeometry={status:string;geoid:string;stateFips:string;layer:string;vintage:string;sourceSha256:string;geometry:unknown};
type SourceLoader=(decision:Record<string,unknown>, geography:unknown)=>Promise<SourceGeometry>;

/** Private installation primitive. Only a trusted caller that derives geometry from the pinned archive may provide load. */
export async function installReviewedBoundary(db:DataSource, identity:DirectoryRecoveryIdentity, input:{communityId:string;requestId:string}, read:SourceRead, load:SourceLoader):Promise<number> {
  if (!input || !uuid.test(input.communityId || '') || !uuid.test(input.requestId || '') || typeof read!=='function' || typeof load!=='function') throw Error('Invalid installation request');
  const authority={...identity}, request={...input};
  async function inspect(manager:EntityManager) {
    await lockAuthority(manager,authority);
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',[request.communityId]);
    const decisions=await manager.query('SELECT * FROM directory_boundary_decision WHERE "requestId"=$1 AND "communityId"=$2',[request.requestId,request.communityId]);
    const d=decisions[0];
    if (!d || d.invalidatedAt!==null || d.decision!=='verified' || d.sourceEpoch!==authority.sourceEpoch || d.activationId!==authority.activationId || d.socialGeneration!==authority.socialGeneration || d.recoveryEpoch!==authority.recoveryEpoch || d.directoryGeneration!==authority.directoryGeneration) throw Error('Decision unavailable or stale');
    const rows=await manager.query('SELECT c.*,t.eligible,t."geometryVersion" FROM directory_boundary_candidate c JOIN directory_town t ON t."communityId"=c."communityId" WHERE c."communityId"=$1 FOR UPDATE OF c,t',[request.communityId]);
    const c=rows[0];
    if (!c || c.eligible!==true || c.sourceEpoch!==authority.sourceEpoch || c.activationId!==authority.activationId || c.socialGeneration!==authority.socialGeneration || candidateFields.some(k=>c[k]!==d[k])) throw Error('Candidate unavailable or changed');
    const current=await read(), hash=geographyHash(current?.geography,request.communityId);
    if (current?.status!=='current' || current.changeToken!==d.changeToken || !hash || hash!==d.geographyHash) throw Error('Stale Social geography');
    return {decision:d,candidate:c,geography:current.geography};
  }
  const initial=await db.transaction(inspect);
  const extracted=await load(structuredClone(initial.decision),structuredClone(initial.geography));
  const d=initial.decision;
  if (!extracted || extracted.status!=='candidate' || extracted.geoid!==d.geoid || extracted.stateFips!==d.stateFips || extracted.layer!==d.layer || extracted.vintage!==d.vintage || extracted.sourceSha256!==d.archiveSha256) throw Error('Source geometry identity mismatch');
  const geometry=structuredClone(extracted.geometry) as {type?:string;coordinates?:unknown};
  const position=(p:unknown):boolean=>Array.isArray(p) && p.length===2 && p.every(n=>typeof n==='number' && Number.isFinite(n)) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90;
  const ring=(r:unknown):boolean=>Array.isArray(r) && r.length>=4 && r.every(position);
  const polygon=(p:unknown):boolean=>Array.isArray(p) && p.length>0 && p.every(ring);
  if (!geometry || !(geometry.type==='Polygon'?polygon(geometry.coordinates):geometry.type==='MultiPolygon' && Array.isArray(geometry.coordinates) && geometry.coordinates.length>0 && geometry.coordinates.every(polygon))) throw Error('Invalid source geometry');
  const json=JSON.stringify(geometry);
  if (Buffer.byteLength(json)>8*1024*1024) throw Error('Source geometry too large');
  return db.transaction(async manager=>{
    const current=await inspect(manager);
    if (candidateFields.some(k=>current.decision[k]!==d[k])) throw Error('Decision changed');
    const checked=await manager.query(`SELECT ST_IsValid(g) AND NOT ST_IsEmpty(g) AND ST_SRID(g)=4326 AND GeometryType(g) IN ('POLYGON','MULTIPOLYGON') AS valid, encode(ST_AsEWKB(g,'XDR'),'hex') AS binary FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) g) x`,[json]);
    if (checked[0]?.valid!==true || typeof checked[0].binary!=='string') throw Error('Invalid source geometry');
    const geometryHash=createHash('sha256').update(Buffer.from(checked[0].binary,'hex')).digest('hex');
    const matches=await manager.query('SELECT * FROM directory_reviewed_geometry WHERE "communityId"=$1 FOR UPDATE',[request.communityId]);
    if (matches.length && matches[0].requestId===request.requestId) {
      if (matches[0].geometryHash!==geometryHash || matches[0].geographyHash!==d.geographyHash || matches[0].recoveryEpoch!==authority.recoveryEpoch || matches[0].directoryGeneration!==authority.directoryGeneration) throw Error('Installed geometry mismatch');
      return matches[0].version as number;
    }
    const version=Number(current.candidate.geometryVersion)+1;
    if (!Number.isSafeInteger(version) || version<1 || version>2147483647) throw Error('Geometry version exhausted');
    await manager.query('INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,$2,ST_SetSRID(ST_GeomFromGeoJSON($3),4326),$4,$5,$6)',[request.communityId,version,json,d.sourceUrl,d.vintage,'Census source; reviewed private installation']);
    await manager.query('UPDATE directory_town SET "geometryVersion"=$2,"geometryStatus"=\'pending\' WHERE "communityId"=$1',[request.communityId,version]);
    await manager.query(`INSERT INTO directory_reviewed_geometry ("communityId","requestId",version,"changeToken","geographyHash","geometryHash","recoveryEpoch","directoryGeneration") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("communityId") DO UPDATE SET "requestId"=EXCLUDED."requestId",version=EXCLUDED.version,"changeToken"=EXCLUDED."changeToken","geographyHash"=EXCLUDED."geographyHash","geometryHash"=EXCLUDED."geometryHash","recoveryEpoch"=EXCLUDED."recoveryEpoch","directoryGeneration"=EXCLUDED."directoryGeneration"`,[request.communityId,request.requestId,version,d.changeToken,d.geographyHash,geometryHash,authority.recoveryEpoch,authority.directoryGeneration]);
    return version;
  });
}
