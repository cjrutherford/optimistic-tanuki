const test=require('node:test');const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');const {DataSource}=require('typeorm');
const {of,throwError}=require('rxjs');
const {createReadinessServer}=require('../src/server');
const {createDirectoryLifecycleHandler}=require('../src/account-lifecycle-runtime');
const {databaseLoggingStatus}=require('../../../libs/logger/src/lib/database-logging-status');
const url=process.env.S5_LIFECYCLE_TEST_DATABASE_URL;
if(url){const u=new URL(url);if(!['localhost','127.0.0.1','::1'].includes(u.hostname)||!/^\/s5_identity_[0-9]+$/.test(u.pathname)||process.env.S5_LIFECYCLE_DISPOSABLE!=='yes')throw Error('Disposable test database required');}
const SECRET='s'.repeat(40);

// Drives the real mounted handler over HTTP. Authentication and Profile are in-process fakes
// answering the same TCP commands; Directory's database is the disposable one.
test('mounted Directory lifecycle routes: fence, erase, readback, blocked, auth, and export',{skip:!url},async()=>{
 const db=new DataSource({type:'postgres',url});await db.initialize();
 // The environment and runtime routes must answer 200 exactly when the database has the payload-free logging policy.
 const expectedEnv=(await databaseLoggingStatus(db)).active?200:503;
 const ids=Object.fromEntries(['town','l1','l2','page','a','pa','b','pb','legacy','rA','rB','bMine','bOther','bAmb','cMine','cOther','blocked','rBlocked','op1','op2','op3','job','lease','profileHandle','profileCapture'].map(k=>[k,randomUUID()]));
 // Profile ids are compared as text, so keep them ordered for the identity page check.
 const scopes=new Map();const invalidGrants=new Set();let authCalls=0;
 const reply=cmd=>{
  if(cmd==='ValidateAccountDeletionGrant')return grant=>{authCalls++;
   if(invalidGrants.has(grant.operationId))return throwError(()=>new Error('invalid'));
   return of({valid:true,accountId:grant.accountId,scope:scopes.get(grant.accountId)??null});};
  if(cmd==='ValidateAccountExportLease')return()=>of({valid:true});
  if(cmd==='Read:AccountExportCaptureIdentities')return request=>of({handleId:request.handleId,captureId:ids.profileCapture,accountId:request.accountId,snapshotAt:'2026-11-15T00:00:00.000Z',total:1,profileIds:[ids.pa],nextOffset:null});
  return()=>throwError(()=>new Error('unexpected'));};
 const fake=()=>({send:(pattern,payload)=>reply(pattern.cmd)(payload)});
 const handler=createDirectoryLifecycleHandler(db,{secret:SECRET,authenticationHost:'x',authenticationPort:1,profileHost:'x',profilePort:2},{auth:fake(),profile:fake()});
 const server=createReadinessServer(async()=>true,undefined,handler);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(path,body,secret=SECRET)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',...(secret?{authorization:`Bearer ${secret}`}:{})},body:JSON.stringify(body)});const text=await r.text();return{status:r.status,text,body:text?JSON.parse(text):undefined};};
 const grant=(action,operationId,accountId)=>({contractVersion:1,operationId,accountId,appId:'local-hub',owner:'directory',action,attempt:1,leaseOwner:randomUUID(),expiresAt:'2026-11-16T00:00:00.000Z',signature:'a'.repeat(64)});
 const one=async(sql,params)=>(await db.query(sql,params))[0];
 const boundary=(requestId,reviewerId)=>db.query(`INSERT INTO directory_boundary_decision ("requestId","communityId","reviewerId",decision,"sourceUrl","sourceEpoch","activationId","socialGeneration","recoveryEpoch","directoryGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,'approve','https://example.org/boundary',$4,$4,1,$4,1,$4,'1304000','place','2024','13',$5,$5)`,[requestId,ids.town,reviewerId,randomUUID(),'b'.repeat(64)]);
 const decision=(candidateId,actorId)=>db.query(`INSERT INTO directory_address_review_decision ("candidateId","actorKind","actorId",decision,"evidenceUrl","evidenceHash",reason,checks,"policyVersion") VALUES ($1,'human',$2,'approve','https://example.org/evidence',$3,'note','{}','test-v1')`,[candidateId,actorId,'c'.repeat(64)]);
 const link=(requestId,listingId,ownerId)=>db.query(`INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId","ownerId",status) VALUES ($1,$2,$3,$4,$5,'pending')`,[requestId,ids.town,listingId,ids.page,ownerId]);
 const event=(requestId,action,actorId,actorDomain)=>db.query(`INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") VALUES ($1,$2,$3,$4)`,[requestId,actorId,action,actorDomain]);
 try{
  for(const l of [ids.l1,ids.l2])await db.query('INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',[l,ids.town,randomUUID().replace(/-/g,'').repeat(2)]);
  await link(ids.rA,ids.l1,ids.a);await link(ids.rB,ids.l2,ids.b);
  await event(ids.rA,'request',ids.a,'account');
  await event(ids.rB,'request',ids.b,'account');
  await event(ids.rB,'approve',ids.pa,'profile');
  await event(ids.rB,'reject',ids.a,null);
  await boundary(ids.bMine,ids.pa);await boundary(ids.bOther,ids.pb);await boundary(ids.bAmb,ids.a);
  await decision(ids.cMine,ids.pa);await decision(ids.cOther,ids.pb);
  scopes.set(ids.a,{currentProfileIds:[ids.pa],legacyProfileIds:[]});
  scopes.set(ids.blocked,{currentProfileIds:[],legacyProfileIds:[]});

  // Caller authentication: no secret, a wrong secret and a short secret are all 401 and reach no authority.
  const probe=grant('fence',ids.op1,ids.a);
  const before=authCalls;
  assert.equal((await post('/internal/account-deletion/fence',probe,null)).status,401);
  assert.equal((await post('/internal/account-deletion/fence',probe,'w'.repeat(40))).status,401);
  assert.equal(authCalls,before);
  assert.equal((await fetch(base+'/internal/account-deletion/fence',{headers:{authorization:`Bearer ${SECRET}`}})).status,405);

  // A grant the authority refuses is refused and changes nothing.
  invalidGrants.add(ids.op3);
  const bad=await post('/internal/account-deletion/fence',grant('fence',ids.op3,ids.a));
  assert.ok([403,503].includes(bad.status),String(bad.status));assert.ok(!bad.text.includes(ids.a));
  assert.equal((await post('/internal/account-deletion/fence',{...probe,owner:'profile'})).status,403);
  assert.equal((await one('SELECT count(*)::int AS n FROM account_deletion_write_fence WHERE "operationId"=$1',[ids.op3])).n,0);

  // Environment, snapshot purge and runtime readback answer with counts and statuses only.
  const env=await post('/internal/account-deletion/environment',grant('fence',ids.op1,ids.a));
  assert.equal(env.status,expectedEnv);
  if(env.status===200){assert.equal(env.body.owner,'directory');assert.equal(env.body.logging.active,true);}
  assert.ok(!env.text.includes(ids.a));

  // Fence, erase, readback.
  const fenced=await post('/internal/account-deletion/fence',grant('fence',ids.op1,ids.a));
  assert.equal(fenced.status,200,fenced.text);
  // The fence counts what erase will handle, including the two rows whose identity domain is unproven.
  assert.deepEqual(fenced.body,{owner:'directory',verified:true,remaining:5,blocked:2});

  // Export while the data still exists: owner-domain rows only, ambiguity withheld and counted.
  const exportGrant={accountId:ids.a,appId:'local-hub',token:'lease-token',jobId:ids.job,attempt:1,leaseOwner:ids.lease};
  const profileSnapshot={participantId:'profile',accountId:ids.a,handleId:ids.profileHandle,captureId:ids.profileCapture,snapshotAt:'2026-11-15T00:00:00.000Z',identityCount:1,sources:['ProfileRow'],sourceRowCounts:{ProfileRow:1},sourceDispositions:{ProfileRow:'exported'},sizeBytes:10,rowCount:1,sha256:'d'.repeat(64),expiresAt:new Date(Date.now()+600000).toISOString()};
  assert.equal((await post('/internal/account-export/open',{...exportGrant,profileSnapshot},null)).status,401);
  const opened=await post('/internal/account-export/open',{...exportGrant,profileSnapshot});
  assert.equal(opened.status,200,opened.text);
  const handle=opened.body;
  assert.equal(handle.participantId,'directory');
  const bytes=[];let offset=0;
  for(;;){const page=await post('/internal/account-export/read',{...exportGrant,handleId:handle.handleId,offset,length:65536});assert.equal(page.status,200,page.text);const part=Buffer.from(page.body.bytesBase64,'base64');bytes.push(part);offset+=part.length;if(page.body.eof)break;}
  const raw=Buffer.concat(bytes);assert.equal(raw.length,handle.sizeBytes);
  const chunks=raw.toString('utf8').split('\n').filter(Boolean).map(l=>JSON.parse(l));
  const rows={};for(const c of chunks)for(const r of c.records??[])(rows[r.source]??=[]).push(r.data);
  assert.deepEqual((rows.DirectoryBusinessLinkRequest??[]).map(r=>r.id),[ids.rA]);
  assert.deepEqual((rows.DirectoryBusinessLinkEvent??[]).map(r=>r.actorDomain).sort(),['account','profile']);
  assert.deepEqual((rows.DirectoryBusinessLinkEvent??[]).map(r=>r.requestId).sort(),[ids.rA,null].sort());
  assert.equal((rows.DirectoryBoundaryDecision??[]).length,1);assert.equal(rows.DirectoryBoundaryDecision[0].id,ids.bMine);
  assert.deepEqual((rows.DirectoryAddressReviewDecision??[]).map(r=>r.candidateId),[ids.cMine]);
  assert.deepEqual(rows.DirectoryExportCoverage,[{id:'coverage',withheldAmbiguousRows:2,complete:false}]);
  // No other account's request, no identifier column and no other reviewer's decision leaves Directory.
  const text=raw.toString('utf8');
  for(const needle of [ids.rB,ids.bOther,ids.cOther,ids.bAmb,ids.b,ids.pb,'"actorId"','"ownerId"','"reviewerId"'])assert.ok(!text.includes(needle),needle);
  assert.equal((await post('/internal/account-export/release',{...exportGrant,handleId:handle.handleId})).status,200);
  assert.equal((await post('/internal/account-export/read',{...exportGrant,handleId:handle.handleId,offset:0,length:1})).status,503);

  // The purge fence is irreversible for the account: later opens are refused.
  const purged=await post('/internal/account-deletion/purge-snapshots',grant('fence',ids.op1,ids.a));
  assert.deepEqual(purged.body,{purged:true,remaining:0});
  assert.equal((await post('/internal/account-export/open',{...exportGrant,profileSnapshot})).status,503);

  // Erase and readback. The ambiguous event and boundary row belong to the account id but are not domain-proven.
  const blockedErase=await post('/internal/account-deletion/erase',grant('erase',ids.op1,ids.a));
  assert.equal(blockedErase.status,409);
  assert.deepEqual(Object.keys(blockedErase.body).sort(),['blocked','owner','remaining','status','verified']);
  assert.equal(blockedErase.body.status,'blocked');assert.equal(blockedErase.body.verified,false);assert.ok(blockedErase.body.blocked>=2);
  assert.ok(!blockedErase.text.includes(ids.a));
  const stuck=await post('/internal/account-deletion/readback',grant('readback',ids.op1,ids.a));
  assert.equal(stuck.status,200);assert.equal(stuck.body.verified,false);
  // The owner clears the ambiguity out of band; the same operation then completes.
  await db.query(`UPDATE directory_business_link_event SET "actorDomain"='account' WHERE "requestId"=$1 AND action='reject'`,[ids.rB]);
  await db.query('UPDATE directory_boundary_decision SET "reviewerId"=NULL WHERE "requestId"=$1',[ids.bAmb]);
  const erased=await post('/internal/account-deletion/erase',grant('erase',ids.op1,ids.a));
  assert.deepEqual(erased.body,{owner:'directory',verified:true,remaining:0,blocked:0});
  const read=await post('/internal/account-deletion/readback',grant('readback',ids.op1,ids.a));
  assert.deepEqual(read.body,{owner:'directory',verified:true,remaining:0,blocked:0});
  assert.deepEqual(await one('SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=$1',[ids.rA]),{ownerId:null,status:'revoked'});
  assert.deepEqual(await one('SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=$1',[ids.rB]),{ownerId:ids.b,status:'pending'});
  assert.equal((await one('SELECT "reviewerId" FROM directory_boundary_decision WHERE "requestId"=$1',[ids.bOther])).reviewerId,ids.pb);
  const rt=await post('/internal/account-deletion/runtime-readback',grant('readback',ids.op1,ids.a));
  assert.equal(rt.status,200);assert.equal(rt.body.databaseLogging.active,expectedEnv===200);assert.ok(!rt.text.includes(ids.a));
  // A pending-fence retry from another operation cannot take over.
  assert.notEqual((await post('/internal/account-deletion/fence',grant('fence',ids.op2,ids.a))).status,200);
 }finally{
  await new Promise(r=>server.close(r));
  await db.query('DELETE FROM directory_business_link_active WHERE "requestId" IN (SELECT "requestId" FROM directory_business_link_request WHERE "townId"=$1)',[ids.town]);
  await db.query('DELETE FROM directory_business_link_event WHERE "requestId" IN (SELECT "requestId" FROM directory_business_link_request WHERE "townId"=$1)',[ids.town]);
  await db.query('DELETE FROM directory_business_link_request WHERE "townId"=$1',[ids.town]);
  await db.query('DELETE FROM directory_boundary_decision WHERE "communityId"=$1',[ids.town]);
  await db.query('DELETE FROM directory_address_review_decision WHERE "candidateId"=ANY($1::uuid[])',[[ids.cMine,ids.cOther]]);
  await db.query('DELETE FROM directory_listing_identity WHERE "communityId"=$1',[ids.town]);
  await db.query('DELETE FROM account_deletion_write_fence WHERE "operationId"=ANY($1::uuid[])',[[ids.op1,ids.op2,ids.op3]]);
  await db.destroy();
 }
});
