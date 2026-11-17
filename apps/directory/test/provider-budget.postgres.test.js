const test=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID,generateKeyPairSync,createHash,sign}=require('node:crypto');
const {DataSource}=require('typeorm');
const {reserveProviderBudget,createBudgetedProviderAttempts}=require('../src/provider-budget');
const url=process.env.S4_BUDGET_DATABASE_URL;
if(url){const u=new URL(url);if(u.hostname!=='127.0.0.1'||u.pathname!=='/directory_budget'||process.env.S4_BUDGET_DISPOSABLE!=='yes')throw Error('Disposable budget database required');}
test('one durable monthly allowance serializes providers and distinguishes replay from a billable retry',{skip:!url},async()=>{
 const db=new DataSource({type:'postgres',url});await db.initialize();
 try {
  await db.query('TRUNCATE directory_provider_budget_attempt');
  const one={attemptId:randomUUID(),provider:'overture',operation:'download',maxCostCents:1500};
  const two={attemptId:randomUUID(),provider:'other',operation:'lookup',maxCostCents:1500};
  const results=await Promise.allSettled([reserveProviderBudget(db,one),reserveProviderBudget(db,two)]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
  const winner=results[0].status==='fulfilled'?one:two;
  assert.equal((await reserveProviderBudget(db,winner)).state,'replay','a replay must not authorize a second dispatch');
  await assert.rejects(reserveProviderBudget(db,{...winner,maxCostCents:1499}),/attempt/i);
  await assert.rejects(reserveProviderBudget(db,{...winner,attemptId:randomUUID(),maxCostCents:1001}),/budget/i);
  const last=await reserveProviderBudget(db,{...winner,attemptId:randomUUID(),maxCostCents:1000});assert.equal(last.remainingCents,0);
  await assert.rejects(reserveProviderBudget(db,{...winner,attemptId:randomUUID(),maxCostCents:1}),/budget/i);
  await assert.rejects(reserveProviderBudget(db,{...winner,attemptId:randomUUID(),maxCostCents:0}),/cost/i);
  await assert.rejects(db.query('INSERT INTO directory_provider_budget_attempt ("attemptId",period,provider,operation,"reservedCents") VALUES ($1,$2,$3,$4,$5)',[randomUUID(),'2026-11','fixture','lookup',-1]));
  const [totals]=await db.query('SELECT count(*)::int n,sum("reservedCents")::int total FROM directory_provider_budget_attempt');assert.deepEqual(totals,{n:2,total:2500});
 } finally {await db.destroy();}
});


test('every proxied attempt reserves budget, including failed upstream responses',{skip:!url},async()=>{
 const db=new DataSource({type:'postgres',url});await db.initialize();let proxy;
 try {
  await db.query('TRUNCATE directory_provider_budget_attempt');
  const {openPinnedRangeProxy}=await import('../../../scripts/overture-range-proxy.mjs');
  let calls=0;
  const asset='https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
  const policyId='a'.repeat(64), keys=generateKeyPairSync('ed25519'), now=Date.now();
  const claims={version:'s4-private-source-v1',policyId,subject:randomUUID(),assetSha256:createHash('sha256').update(asset).digest('hex'),etag:'abc',methods:['GET','HEAD'],maxCostCents:1,issuedAt:now-1000,expiresAt:now+60000};
  const payload=Buffer.from(JSON.stringify(claims)).toString('base64url'), token={payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64url')};
  await db.query('INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO UPDATE SET revoked=false',[policyId]);
  const reserve=createBudgetedProviderAttempts(db,keys.publicKey,token,policyId);
  assert.throws(()=>reserve({attemptId:randomUUID(),asset:asset+'x',etag:'abc',method:'HEAD'}),/source/i);
  proxy=await openPinnedRangeProxy({asset,etag:'abc',reserveAttempt:reserve,upstream:async()=>{calls++;return calls===1?new Response(null,{status:200,headers:{etag:'"abc"','content-length':'4'}}):new Response(null,{status:500});}});
  assert.equal((await fetch(proxy.url,{method:'HEAD'})).status,200);
  assert.equal((await fetch(proxy.url,{method:'HEAD'})).status,502);
  const [row]=await db.query('SELECT count(*)::int n,sum("reservedCents")::int total FROM directory_provider_budget_attempt');
  assert.deepEqual(row,{n:2,total:2});assert.equal(calls,2);
  await db.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',[policyId]);
  assert.equal((await fetch(proxy.url,{method:'HEAD'})).status,502);assert.equal(calls,2);
 } finally {if(proxy)await proxy.close();await db.destroy();}
});

test('anonymous pinned Overture requests have durable free receipts and cannot replay',{skip:!url},async()=>{
 const {authorizeAnonymousOvertureAttempt}=require('../src/provider-budget');
 const db=new DataSource({type:'postgres',url});await db.initialize();const oldLocal=process.env.DIRECTORY_LOCAL_EVALUATION;process.env.DIRECTORY_LOCAL_EVALUATION='true';try{
  await db.query('TRUNCATE directory_provider_budget_attempt, directory_anonymous_overture_attempt');
  const asset='https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet',policyId='b'.repeat(64),keys=generateKeyPairSync('ed25519'),now=Date.now();
  const claims={version:'s4-private-source-v1',policyId,subject:randomUUID(),assetSha256:createHash('sha256').update(asset).digest('hex'),etag:'abc',methods:['GET','HEAD'],maxCostCents:1,issuedAt:now-1000,expiresAt:now+60000},payload=Buffer.from(JSON.stringify(claims)).toString('base64url'),token={payload,signature:sign(null,Buffer.from(payload),keys.privateKey).toString('base64url')};
  await db.query('INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO UPDATE SET revoked=false',[policyId]);
  const attempt={attemptId:randomUUID(),asset,etag:'abc',method:'GET'},result=await authorizeAnonymousOvertureAttempt(db,keys.publicKey,token,attempt);
  assert.equal(result.state,'authorized-free');await assert.rejects(authorizeAnonymousOvertureAttempt(db,keys.publicKey,token,attempt),/replay/i);
  await assert.rejects(reserveProviderBudget(db,{attemptId:attempt.attemptId,provider:'overture',operation:'range.get',maxCostCents:1}),/used/i);
  assert.equal((await db.query('SELECT count(*)::int n FROM directory_provider_budget_attempt'))[0].n,0);
  await db.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',[policyId]);
  await assert.rejects(authorizeAnonymousOvertureAttempt(db,keys.publicKey,token,{...attempt,attemptId:randomUUID()}),/revoked/i);
 }finally{if(oldLocal===undefined)delete process.env.DIRECTORY_LOCAL_EVALUATION;else process.env.DIRECTORY_LOCAL_EVALUATION=oldLocal;await db.destroy();}
});
