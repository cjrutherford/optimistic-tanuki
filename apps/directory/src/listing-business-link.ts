import {isIP} from 'node:net';
import {assertDirectoryIdentitiesUnfenced} from './account-lifecycle-fence';

type LinkRequest={townId:string;listingId:string;businessCommunityId:string;ownerId:string;requestId:string};
type LinkDecision=LinkRequest & {reviewerId:string;decision:'approve'|'reject';evidenceUrl:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function evidence(value:unknown):value is string {
 try{if(typeof value!=='string'||value.length>2048)return false;const u=new URL(value),host=u.hostname.toLowerCase().replace(/\.$/,'');return u.protocol==='https:'&&!u.username&&!u.password&&host.includes('.')&&!isIP(host.replace(/^\[|\]$/g,''))&&!/(?:^|\.)(localhost|local|internal)$/.test(host);}catch{return false;}
}
/** These checks validate shape only. Callers must independently verify actor authority. */
export function validateLinkRequest(value:LinkRequest):LinkRequest {
 if(!value||![value.townId,value.listingId,value.businessCommunityId,value.ownerId,value.requestId].every(v=>typeof v==='string'&&uuid.test(v)))throw Error('Invalid business link request');
 return {townId:value.townId,listingId:value.listingId,businessCommunityId:value.businessCommunityId,ownerId:value.ownerId,requestId:value.requestId};
}
export function validateLinkDecision(value:LinkDecision):LinkDecision {
 const request=validateLinkRequest(value);
 if(typeof value.reviewerId!=='string'||!uuid.test(value.reviewerId)||!['approve','reject'].includes(value.decision)||!evidence(value.evidenceUrl))throw Error('Invalid business link decision');
 return {...request,reviewerId:value.reviewerId,decision:value.decision,evidenceUrl:value.evidenceUrl};
}

type Manager={query(sql:string,params?:unknown[]):Promise<any[]>};
type Store=Manager & {transaction<T>(fn:(manager:Manager)=>Promise<T>):Promise<T>};
const same=(row:any,v:LinkRequest)=>row && row.requestId===v.requestId && row.townId===v.townId && row.listingId===v.listingId && row.businessCommunityId===v.businessCommunityId && row.ownerId===v.ownerId;

/** The boundary must first verify the authenticated requester controls the page. */
export async function requestBusinessLink(db:Store,input:LinkRequest):Promise<void> {
 const v=validateLinkRequest(input);
 await db.transaction(async tx=>{
  await assertDirectoryIdentitiesUnfenced(tx,[v.ownerId]);
  const identities=await tx.query('SELECT id FROM directory_listing_identity WHERE id=$1 AND "communityId"=$2 FOR SHARE',[v.listingId,v.townId]);
  if(identities.length!==1)throw Error('Invalid business link listing');
  // The business is only the one the listing's own row currently asserts; nothing is inferred.
  const asserted=await tx.query(`SELECT a."businessId" FROM directory_listing_identity li JOIN directory_business_assertion a ON a."scanId"=li."scanId" AND a."sourceFileRowNumber"=li."sourceFileRowNumber" AND a."communityId"=$2 AND a.state='current' JOIN directory_business b ON b.id=a."businessId" AND b.state='active' WHERE li.id=$1`,[v.listingId,v.townId]);
  const created=await tx.query(`INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId","ownerId","businessId",status) VALUES ($1,$2,$3,$4,$5,$6,'pending') ON CONFLICT ("requestId") DO NOTHING RETURNING "requestId"`,[v.requestId,v.townId,v.listingId,v.businessCommunityId,v.ownerId,asserted.length===1?asserted[0].businessId:null]);
  if(!created.length){const rows=await tx.query('SELECT * FROM directory_business_link_request WHERE "requestId"=$1 FOR UPDATE',[v.requestId]);if(rows.length!==1||!same(rows[0],v)||!['pending','approved'].includes(rows[0].status))throw Error('Invalid business link request');return;}
  await tx.query(`INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") VALUES ($1,$2,'request','account')`,[v.requestId,v.ownerId]);
 });
}
/** The boundary must verify an authorized reviewer and independently verify the match. */
export async function reviewBusinessLink(db:Store,input:LinkDecision):Promise<void>{
 const v=validateLinkDecision(input);
 await db.transaction(async tx=>{
  await assertDirectoryIdentitiesUnfenced(tx,[v.ownerId,v.reviewerId]);
  const rows=await tx.query('SELECT * FROM directory_business_link_request WHERE "requestId"=$1 FOR UPDATE',[v.requestId]);
  if(rows.length!==1||!same(rows[0],v)||rows[0].status!=='pending')throw Error('Invalid business link decision');
  if(v.decision==='approve'){
   const active=await tx.query('INSERT INTO directory_business_link_active ("listingId","requestId") VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING "listingId"',[v.listingId,v.requestId]);
   if(active.length!==1)throw Error('Business link already active');
  }
  await tx.query('UPDATE directory_business_link_request SET status=$2 WHERE "requestId"=$1',[v.requestId,v.decision==='approve'?'approved':'rejected']);
  await tx.query('INSERT INTO directory_business_link_event ("requestId","actorId",action,"evidenceUrl","actorDomain") VALUES ($1,$2,$3,$4,\'profile\')',[v.requestId,v.reviewerId,v.decision,v.evidenceUrl]);
 });
}
export async function revokeBusinessLink(db:Store,input:{townId:string;listingId:string;requestId:string;actorId:string;actorRole:'owner'|'reviewer'}):Promise<void>{
 if(!input||![input.townId,input.listingId,input.requestId,input.actorId].every(x=>typeof x==='string'&&uuid.test(x))||!['owner','reviewer'].includes(input.actorRole))throw Error('Invalid business link revocation');
 await db.transaction(async tx=>{
  // Read the owner unlocked so fence locks are taken before the row lock; the locked row must still name that owner.
  const unlocked=await tx.query('SELECT "ownerId" FROM directory_business_link_request WHERE "requestId"=$1',[input.requestId]);
  const fencedOwner=unlocked.length===1?unlocked[0].ownerId:null;
  await assertDirectoryIdentitiesUnfenced(tx,[input.actorId,fencedOwner]);
  // Same town lock as a link carry restore, so a revoke and a restore of one link never interleave.
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text,0))',[`directory-business-identity:${input.townId}`]);
  const rows=await tx.query('SELECT * FROM directory_business_link_request WHERE "requestId"=$1 FOR UPDATE',[input.requestId]);const row=rows[0];
  // A carried link may now sit on a different listing identity than the one it was requested on; either names it.
  const placed=rows.length===1?await tx.query('SELECT "listingId" FROM directory_business_link_active WHERE "requestId"=$1',[input.requestId]):[];
  const names=rows.length===1&&(row.listingId===input.listingId||(placed.length===1&&placed[0].listingId===input.listingId));
  if(rows.length!==1||row.ownerId!==fencedOwner||row.townId!==input.townId||!names||!['pending','approved'].includes(row.status)||(input.actorRole==='owner'&&row.ownerId!==input.actorId))throw Error('Invalid business link revocation');
  await tx.query('DELETE FROM directory_business_link_active WHERE "requestId"=$1',[input.requestId]);
  await tx.query(`UPDATE directory_business_link_carry SET state='closed',"updatedAt"=now() WHERE "requestId"=$1 AND state='awaiting_confirmation'`,[input.requestId]);
  await tx.query(`UPDATE directory_business_link_request SET status='revoked' WHERE "requestId"=$1`,[input.requestId]);
  await tx.query(`INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") VALUES ($1,$2,'revoke',$3)`,[input.requestId,input.actorId,input.actorRole==='owner'?'account':'profile']);
 });
}
/**
 * Internal only: caller must recheck listing rights and current page ownership/privacy.
 * The id may be a listing identity or a business id. A link that a carry has proposed but nobody has confirmed
 * stays where it was, on a row whose assertion is already superseded, and is not readable until it is restored.
 */
export async function readBusinessLink(db:Manager,townId:string,listingId:string):Promise<{businessCommunityId:string;ownerId:string}|null>{
 if(!uuid.test(townId)||!uuid.test(listingId))throw Error('Invalid business link');
 const rows=await db.query(`WITH biz AS (
    SELECT b.id FROM directory_business b WHERE b.id=$2 AND b."communityId"=$1 AND b.state='active'
    UNION SELECT a."businessId" FROM directory_listing_identity li JOIN directory_business_assertion a ON a."scanId"=li."scanId" AND a."sourceFileRowNumber"=li."sourceFileRowNumber" AND a."communityId"=$1 JOIN directory_business b ON b.id=a."businessId" AND b.state='active' WHERE li.id=$2 AND li."communityId"=$1
  ), targets AS (
    SELECT $2::uuid AS id
    UNION SELECT li2.id FROM biz JOIN directory_business_assertion ca ON ca."businessId"=biz.id AND ca.state='current' JOIN directory_listing_identity li2 ON li2."scanId"=ca."scanId" AND li2."sourceFileRowNumber"=ca."sourceFileRowNumber" AND li2."communityId"=$1
  )
  SELECT r."businessCommunityId",r."ownerId" FROM directory_business_link_active a JOIN directory_business_link_request r ON r."requestId"=a."requestId"
   WHERE a."listingId" IN (SELECT id FROM targets) AND r."townId"=$1 AND r.status='approved'
     AND NOT EXISTS (SELECT 1 FROM directory_listing_identity li3 JOIN directory_business_assertion x ON x."scanId"=li3."scanId" AND x."sourceFileRowNumber"=li3."sourceFileRowNumber" WHERE li3.id=a."listingId" AND x.state<>'current')`,[townId,listingId]);
 if(rows.length>1)throw Error('Invalid business link');return rows[0]||null;
}

/** Internal reviewer-only view; callers must enforce reviewer authorization. */
export async function listBusinessLinkRequests(db:Manager,townId:string,listingId:string):Promise<Array<{requestId:string;businessCommunityId:string;ownerId:string}>>{
 if(!uuid.test(townId)||!uuid.test(listingId))throw Error('Invalid business link');
 const rows=await db.query(`SELECT "requestId","businessCommunityId","ownerId" FROM directory_business_link_request WHERE "townId"=$1 AND "listingId"=$2 AND status='pending' ORDER BY "createdAt","requestId" LIMIT 101`,[townId,listingId]);
 if(rows.length>100||rows.some(r=>![r.requestId,r.businessCommunityId,r.ownerId].every(x=>typeof x==='string'&&uuid.test(x))))throw Error('Invalid business link requests');return rows;
}

/** Internal town-scoped keyset queue; new requests before the cursor appear on refresh. */
export async function listTownBusinessLinkRequests(db:Manager,townId:string,cursor?:string):Promise<{requests:Array<{listingId:string;requestId:string;businessCommunityId:string;ownerId:string}>;nextCursor:string|null}>{
 if(!uuid.test(townId)||(cursor!==undefined&&!uuid.test(cursor)))throw Error('Invalid business link');
 const rows=await db.query(`SELECT "listingId","requestId","businessCommunityId","ownerId" FROM directory_business_link_request WHERE "townId"=$1 AND status='pending' AND ($2::uuid IS NULL OR "requestId">$2::uuid) ORDER BY "requestId" LIMIT 101`,[townId,cursor || null]);
 if(rows.length>101||rows.some(r=>![r.listingId,r.requestId,r.businessCommunityId,r.ownerId].every(x=>typeof x==='string'&&uuid.test(x))))throw Error('Invalid business link requests');
 const requests=rows.slice(0,100);return {requests,nextCursor:rows.length>100?requests[99].requestId:null};
}

/** Internal owner-scoped view; authenticate the owner at the gateway. */
export async function listOwnerBusinessLinks(db:Manager,townId:string,listingId:string,ownerId:string):Promise<Array<{requestId:string;businessCommunityId:string;status:'pending'|'approved'}>>{
 if(![townId,listingId,ownerId].every(x=>typeof x==='string'&&uuid.test(x)))throw Error('Invalid business link');
 const rows=await db.query(`SELECT "requestId","businessCommunityId",status FROM directory_business_link_request WHERE "townId"=$1 AND ("listingId"=$2 OR "requestId" IN (SELECT "requestId" FROM directory_business_link_active WHERE "listingId"=$2)) AND "ownerId"=$3 AND status IN ('pending','approved') ORDER BY "createdAt","requestId" LIMIT 101`,[townId,listingId,ownerId]);
 if(rows.length>100||rows.some(r=>![r.requestId,r.businessCommunityId].every(x=>typeof x==='string'&&uuid.test(x))||!['pending','approved'].includes(r.status)))throw Error('Invalid business link requests');return rows;
}
