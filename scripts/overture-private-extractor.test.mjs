import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { extractPrivate } from './overture-private-extractor.mjs';
const require = createRequire(import.meta.url);
let DuckDBInstance;
try { ({ DuckDBInstance } = require('@duckdb/node-api')); } catch {}
const hash = x => createHash('sha256').update(x).digest('hex');
const square = (x1,y1,x2,y2) => ({type:'Polygon',coordinates:[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]]});
test('synthetic parquet: exact geometry, priority, checkpoint resume and authorization', async () => {
 assert.ok(DuckDBInstance, 'DuckDB Node API is required for this integration test');
 const dir = await mkdtemp(join(tmpdir(),'extract-test-')); const db = await DuckDBInstance.create(':memory:'); const c = await db.connect();
 try {
  await c.run('LOAD spatial');
  const path = join(dir,'source.parquet');
  await c.run(`COPY (SELECT *, {'primary':'Fixture Bakery'} AS names, 'bakery' AS basic_category, {'primary':'bakery','hierarchy':['shop']} AS taxonomy, [{'property':'','dataset':'Example','license':'Example'}] AS sources FROM (VALUES (0, ST_Point(20,20), {'xmin':20.,'xmax':20.,'ymin':20.,'ymax':20.}), (1, ST_Point(2,2), NULL), (2, ST_Point(4,4), {'xmin':4.,'xmax':4.,'ymin':4.,'ymax':4.}), (3, ST_Point(8,8), NULL), (4, ST_Point(8,0.5), NULL)) t(id,geometry,bbox)) TO '${path}' (FORMAT PARQUET)`);
  const items = [{id:'fixture',asset:'fixture.parquet',size:(await readFile(path)).length}]; const inventorySha256 = hash(JSON.stringify(items));
  const policy = {authorized:true, inventorySha256, itemId:'fixture', assetSha256:hash(await readFile(path)), approvalSha256:'1'.repeat(64), projectionSha256:'2'.repeat(64), classifierSha256:'3'.repeat(64), regions:[{id:'first',geometry:square(0,0,5,5)},{id:'second',geometry:square(1,1,9,9)}]};
  let checkpoint = null, rows = [], fail = true;
  let boundPolicy; const sink = {atomicCommit:true,async isComplete(){return false},async complete(){}, async load(scanId, policyId){boundPolicy=policyId;assert.match(scanId,/^[a-f0-9]{64}$/);return checkpoint}, async commit(batch, next){if(fail){fail=false; throw Error('commit failed')} rows.push(...batch); checkpoint=next}};
  const project = async row => ({status:'eligible',listing:{fixtureId:row.source.id}});
  const opts = {connection:c, sourcePath:path, inventory:{items,inventorySha256}, policy, sink, project};
  await assert.rejects(extractPrivate(opts), /commit failed/); assert.equal(boundPolicy, policy.approvalSha256); assert.equal(checkpoint,null); assert.equal(rows.length,0);
  await extractPrivate(opts); assert.deepEqual(rows.map(x=>[x.sourceFileRowNumber,x.regionId]),[[1,'first'],[2,'first'],[3,'second']]); assert.deepEqual(rows[0].outcome.listing, {fixtureId:1}); assert.equal(rows[0].source, undefined);
  const limits=await (await c.runAndReadAll("SELECT current_setting('max_temp_directory_size'), current_setting('threads')")).getRowsJS(); assert.equal(limits[0][0],'0 bytes'); assert.equal(Number(limits[0][1]),1);
  await extractPrivate(opts); assert.equal(rows.length,3);
  checkpoint = {...checkpoint, sourceFileRowNumber:1}; rows = rows.slice(0,1); await extractPrivate(opts); assert.deepEqual(rows.map(x=>x.sourceFileRowNumber),[1,2,3]);
  await assert.rejects(extractPrivate({...opts, policy:{...policy,assetSha256:'0'.repeat(64)}}), /digest|checkpoint/);
  const smallItems=[{...items[0],size:1}], smallHash=hash(JSON.stringify(smallItems));
  await assert.rejects(extractPrivate({...opts,inventory:{items:smallItems,inventorySha256:smallHash},policy:{...policy,inventorySha256:smallHash},sink:{...sink,load:async()=>null}}), /size|digest/i);
  await assert.rejects(extractPrivate({...opts, policy:{...policy,authorized:false}}), /authoriz/);
  await assert.rejects(extractPrivate({...opts, inventory:{...opts.inventory,items:[{...items[0],asset:'different'}]}}), /Inventory digest/);
  await assert.rejects(extractPrivate({...opts, sink:{...sink,atomicCommit:false}}), /atomic/i);
  await assert.rejects(extractPrivate({...opts, project:undefined}), /project/i);
  await assert.rejects(extractPrivate({...opts,policy:{...policy,maxMemoryBytes:3*1024*1024*1024}}),/memory/i);
  await assert.rejects(extractPrivate({...opts, policy:{...policy, regions:[...policy.regions].reverse()}}), /checkpoint/);
  for (const field of ['approvalSha256','projectionSha256','classifierSha256']) await assert.rejects(extractPrivate({...opts, policy:{...policy,[field]:'4'.repeat(64)}}), /checkpoint/);
  const {createPrivateOvertureProjector} = require('../apps/directory/src/overture-private-projection.ts');
  const fields=Object.keys(require('../apps/directory/src/overture-rights.ts').OVERTURE_RIGHTS_FIELDS), permissions=Object.fromEntries(['ingest','retain','privateDisplay'].map(op=>[op,fields]));
  const rights = {releaseId:'fixture-release', operations:{ingest:true,retain:true,privateDisplay:true}, terms:[{dataset:'Example',license:'Example',attribution:'Example attribution',termsUrl:'https://example.test/terms',permissions}]};
  const adapter = createPrivateOvertureProjector('fixture-release', rights, async () => ({residential:false,sensitive:false,adult:false}));
  let integratedCheckpoint=null; const integrated=[];
  await extractPrivate({...opts, project:adapter, sink:{atomicCommit:true,async isComplete(){return false},async complete(){},async load(){return integratedCheckpoint},async commit(batch,next){integrated.push(...batch);integratedCheckpoint=next}}});
  assert.equal(integrated.length,3); assert.equal(integrated[0].outcome.status,'eligible');
  assert.equal(integrated[0].outcome.listing.name,'Fixture Bakery'); assert.equal(integrated[0].source,undefined);
  const mutable = structuredClone(policy); let stableCheckpoint=null; const stableRows=[];
  const mutatingSink={atomicCommit:true,async isComplete(){return false},async complete(){},async load(){mutable.authorized=false; mutable.regions[0].geometry=square(50,50,60,60); return stableCheckpoint},async commit(batch,next){stableRows.push(...batch);stableCheckpoint=next}};
  await extractPrivate({...opts,policy:mutable,sink:mutatingSink});
  assert.deepEqual(stableRows.map(x=>[x.sourceFileRowNumber,x.regionId]),[[1,'first'],[2,'first'],[3,'second']]);
  const uniqueRows=[];let uniqueCheckpoint=null;
  await extractPrivate({...opts,policy:{...policy,singleMatch:true},sink:{atomicCommit:true,async isComplete(){return false},async complete(){},async load(){return uniqueCheckpoint},async commit(batch,next){uniqueRows.push(...batch);uniqueCheckpoint=next}}});
  assert.deepEqual(uniqueRows.map(x=>[x.sourceFileRowNumber,x.regionId]),[[3,'second']]);
 } finally { c.closeSync(); db.closeSync(); await rm(dir,{recursive:true,force:true}); }
});

test('remote range extraction pins identity, resumes, and rejects replacement', async () => {
 assert.ok(DuckDBInstance);
 const dir=await mkdtemp(join(tmpdir(),'extract-remote-')); const db=await DuckDBInstance.create(':memory:'); const c=await db.connect();
 try {
  await c.run('LOAD spatial'); await c.run('LOAD httpfs');
  const path=join(dir,'fixture.parquet');
  await c.run(`COPY (SELECT * FROM (VALUES (1, ST_Point(2,2), {'xmin':2.,'xmax':2.,'ymin':2.,'ymax':2.}), (2, ST_Point(3,3), NULL), (3, ST_Point(20,20), {'xmin':20.,'xmax':20.,'ymin':20.,'ymax':20.})) t(id,geometry,bbox)) TO '${path}' (FORMAT PARQUET)`);
  const bytes=await readFile(path), release='2026-01-01.0', etag='fixture-etag';
  const asset=`https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/${release}/theme=places/type=place/fixture.parquet`;
  const items=[{id:'fixture',asset,size:bytes.length,etag,rows:3,rowGroups:1,bbox:[0,0,30,30],lastModified:'fixture'}]; const inventorySha256=hash(JSON.stringify(items));
  const inventory={items,inventorySha256,release,envelope:[0,0,5,5]};
  const policy={authorized:true,inventorySha256,itemId:'fixture',approvalSha256:'1'.repeat(64),projectionSha256:'2'.repeat(64),classifierSha256:'3'.repeat(64),localSnapshot:true,maxTransferBytes:64*1024*1024,regions:[{id:'area',geometry:square(0,0,5,5)}]};
  let current=etag, checkpoint=null; const rows=[], requests=[];
  const upstream=async (_url,init)=>{ requests.push(init); if(init.headers['If-Match']!==`"${current}"`) return new Response(null,{status:412}); const headers={etag:`"${current}"`,'accept-ranges':'bytes'}; if(init.method==='HEAD') return new Response(null,{status:200,headers:{...headers,'content-length':String(bytes.length)}}); const match=/^bytes=(\d+)-(\d*)$/.exec(init.headers.Range); assert.ok(match); const start=Number(match[1]), end=Math.min(match[2]?Number(match[2]):bytes.length-1,bytes.length-1); return new Response(bytes.subarray(start,end+1),{status:206,headers:{...headers,'content-length':String(end-start+1),'content-range':`bytes ${start}-${end}/${bytes.length}`}}); };
  const sink={atomicCommit:true,async isComplete(){return false},async complete(){},async load(){return checkpoint},async commit(batch,next){rows.push(...batch);checkpoint=next}};
  const opts={connection:c,sourceMode:'remote',inventory,policy,sink,project:async row=>({status:'eligible',listing:{id:row.source.id}}),upstream,reserveAttempt:async attempt=>({state:'reserved',attemptId:attempt.attemptId,period:new Date().toISOString().slice(0,7)})};
  await assert.rejects(extractPrivate({...opts,policy:{...policy,maxTransferBytes:undefined}}),/budget/i);
  await extractPrivate(opts); assert.deepEqual(rows.map(r=>r.outcome.listing.id),[1,2]); assert.equal(requests.filter(r=>r.method==='GET').length,1); assert.ok(requests.every(r=>r.headers['If-Match']===`"${etag}"`));
  await extractPrivate(opts); assert.equal(rows.length,2);
  await assert.rejects(extractPrivate({...opts,inventory:{...inventory,envelope:[0,0,6,6]}}),/checkpoint/);
  await assert.rejects(extractPrivate({...opts,inventory:{...inventory,envelope:[0,0,1,1]}}),/envelope/);
  for (const field of ['approvalSha256','projectionSha256','classifierSha256']) await assert.rejects(extractPrivate({...opts,policy:{...policy,[field]:'4'.repeat(64)}}),/checkpoint/);
  const changedItems=[{...items[0],etag:'different'}], changedHash=hash(JSON.stringify(changedItems));
  await assert.rejects(extractPrivate({...opts,inventory:{...inventory,items:changedItems,inventorySha256:changedHash},policy:{...policy,inventorySha256:changedHash}}),/checkpoint/);
  await assert.rejects(extractPrivate({...opts,sourceMode:'local',sourcePath:path,policy:{...policy,assetSha256:hash(bytes)}}),/checkpoint/);
  let gets=0; const replacementDuringRead=async (url,init)=>{if(init.method==='GET'){gets++; return new Response(null,{status:412})} return upstream(url,init)};
  await assert.rejects(extractPrivate({...opts,upstream:replacementDuringRead}),/HTTP|412|error/i); assert.ok(gets); assert.equal(rows.length,2);
  current='replacement'; await assert.rejects(extractPrivate(opts),/source|412|HTTP/i); assert.equal(rows.length,2);
 } finally {c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true})}
});

test('remote extraction retains inverted row bounding boxes even when aggregate statistics look outside', async () => {
 const dir=await mkdtemp(join(tmpdir(),'extract-bounds-')); const db=await DuckDBInstance.create(':memory:'); const c=await db.connect();
 try {
  await c.run('LOAD spatial'); await c.run('LOAD httpfs'); const path=join(dir,'source.parquet');
  await c.run(`COPY (SELECT * FROM (VALUES (1,ST_Point(2,2),{'xmin':30.,'xmax':20.,'ymin':20.,'ymax':20.}),(2,ST_Point(20,20),{'xmin':20.,'xmax':20.,'ymin':20.,'ymax':20.}),(3,ST_Point(2,2),{'xmin':200.,'xmax':201.,'ymin':2.,'ymax':2.}),(4,ST_Point(2,2),{'xmin':20.,'xmax':20.,'ymin':20.,'ymax':20.})) t(id,geometry,bbox)) TO '${path}' (FORMAT PARQUET)`);
  const bytes=await readFile(path), release='2026-01-01.0', etag='fixture-etag';
  const items=[{id:'fixture',asset:`https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/${release}/theme=places/type=place/fixture.parquet`,size:bytes.length,etag,rows:4,rowGroups:1,bbox:[0,0,30,30],lastModified:'fixture'}]; const inventorySha256=hash(JSON.stringify(items));
  const inventory={items,inventorySha256,release,envelope:[0,0,5,5]};
  const policy={authorized:true,inventorySha256,itemId:'fixture',approvalSha256:'1'.repeat(64),projectionSha256:'2'.repeat(64),classifierSha256:'3'.repeat(64),maxTransferBytes:64*1024*1024,regions:[{id:'area',geometry:square(0,0,5,5)}]};
  const upstream=async (_url,init)=>{const headers={etag:`"${etag}"`,'accept-ranges':'bytes'}; if(init.method==='HEAD') return new Response(null,{status:200,headers:{...headers,'content-length':String(bytes.length)}});const m=/^bytes=(\d+)-(\d*)$/.exec(init.headers.Range);const start=Number(m[1]),end=Math.min(m[2]?Number(m[2]):bytes.length-1,bytes.length-1);return new Response(bytes.subarray(start,end+1),{status:206,headers:{...headers,'content-length':String(end-start+1),'content-range':`bytes ${start}-${end}/${bytes.length}`}})};
  let checkpoint=null;const rows=[];const sink={atomicCommit:true,async isComplete(){return false},async complete(){},async load(){return checkpoint},async commit(batch,next){rows.push(...batch);checkpoint=next}};
  await extractPrivate({connection:c,sourceMode:'remote',inventory,policy,sink,project:async row=>({status:'eligible',listing:{id:row.source.id}}),upstream,reserveAttempt:async attempt=>({state:'reserved',attemptId:attempt.attemptId,period:new Date().toISOString().slice(0,7)})});
  assert.deepEqual(rows.map(row=>row.outcome.listing.id),[1,3,4]);
 } finally {c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true})}
});

test('streams multiple Parquet row groups in source order without a global sort',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'extract-stream-')),db=await DuckDBInstance.create(':memory:'),c=await db.connect();
 try {
  await c.run('LOAD spatial');const path=join(dir,'source.parquet');
  await c.run(`COPY (SELECT i AS id,ST_Point(CASE WHEN i%3=0 THEN 2 ELSE 20 END,2) AS geometry FROM range(12000) t(i)) TO '${path}' (FORMAT PARQUET, ROW_GROUP_SIZE 2048)`);
  const bytes=await readFile(path),items=[{id:'fixture',asset:'fixture.parquet',size:bytes.length}],inventorySha256=hash(JSON.stringify(items));
  const policy={authorized:true,inventorySha256,itemId:'fixture',assetSha256:hash(bytes),approvalSha256:'1'.repeat(64),projectionSha256:'2'.repeat(64),classifierSha256:'3'.repeat(64),regions:[{id:'first',geometry:square(0,0,5,5)},{id:'second',geometry:square(1,1,6,6)}]};
  const received=[];let checkpoint=null;
  const sink={atomicCommit:true,async load(){return checkpoint},async isComplete(){return false},async complete(){},async commit(batch,next){received.push(...batch);checkpoint=next}};
  const wrapped={run:(...args)=>c.run(...args),runAndReadAll:(...args)=>c.runAndReadAll(...args),async stream(sql){const plan=await (await c.runAndReadAll(`EXPLAIN ${sql}`)).getRowsJS();const text=JSON.stringify(plan);assert.doesNotMatch(text,/ORDER_BY|NESTED_LOOP_JOIN|HASH_JOIN/);return c.stream(sql)}};
  await extractPrivate({connection:wrapped,sourcePath:path,inventory:{items,inventorySha256},policy,sink,project:async row=>({status:'eligible',listing:{id:row.source.id}})});
  assert.equal(received.length,4000);assert.ok(received.every((r,i)=>r.sourceFileRowNumber===i*3 && r.regionId==='first'));
  const unique=[];let uniqueCheckpoint=null;const uniqueSink={atomicCommit:true,async load(){return uniqueCheckpoint},async isComplete(){return false},async complete(){},async commit(batch,next){unique.push(...batch);uniqueCheckpoint=next}};
  await extractPrivate({connection:wrapped,sourcePath:path,inventory:{items,inventorySha256},policy:{...policy,singleMatch:true,regions:[policy.regions[0],{id:'second',geometry:square(3,3,6,6)}]},sink:uniqueSink,project:async row=>({status:'eligible',listing:{id:row.source.id}})});
  assert.equal(unique.length,4000);assert.ok(unique.every((r,i)=>r.sourceFileRowNumber===i*3 && r.regionId==='first'));
 }finally{c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true})}
});

test('remote extraction hands the proxy-verified evidence to the sink and never invents it', async () => {
 const dir=await mkdtemp(join(tmpdir(),'extract-evidence-')); const db=await DuckDBInstance.create(':memory:'); const c=await db.connect();
 try {
  await c.run('LOAD spatial'); await c.run('LOAD httpfs');
  const path=join(dir,'fixture.parquet');
  await c.run(`COPY (SELECT * FROM (VALUES (1, ST_Point(2,2), {'xmin':2.,'xmax':2.,'ymin':2.,'ymax':2.})) t(id,geometry,bbox)) TO '${path}' (FORMAT PARQUET)`);
  const bytes=await readFile(path), release='2026-10-21.0', etag='fixture-etag';
  const asset=`https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/${release}/theme=places/type=place/fixture.parquet`;
  const items=[{id:'fixture',asset,size:bytes.length,etag,rows:1,rowGroups:1,bbox:[0,0,30,30],lastModified:'inventory-copy'}]; const inventorySha256=hash(JSON.stringify(items));
  const inventory={items,inventorySha256,release,envelope:[0,0,5,5]};
  const policy={authorized:true,inventorySha256,itemId:'fixture',approvalSha256:'1'.repeat(64),projectionSha256:'2'.repeat(64),classifierSha256:'3'.repeat(64),localSnapshot:true,maxTransferBytes:64*1024*1024,regions:[{id:'area',geometry:square(0,0,5,5)}]};
  const upstreamWith=lastModified=>async (_url,init)=>{const headers={etag:`"${etag}"`,'accept-ranges':'bytes',...(lastModified?{'last-modified':lastModified}:{})}; if(init.method==='HEAD') return new Response(null,{status:200,headers:{...headers,'content-length':String(bytes.length)}}); const m=/^bytes=(\d+)-(\d*)$/.exec(init.headers.Range); const start=Number(m[1]), end=Math.min(m[2]?Number(m[2]):bytes.length-1,bytes.length-1); return new Response(bytes.subarray(start,end+1),{status:206,headers:{...headers,'content-length':String(end-start+1),'content-range':`bytes ${start}-${end}/${bytes.length}`}})};
  const run=async lastModified=>{let evidence='unset',checkpoint=null;const sink={atomicCommit:true,async isComplete(){return false},async complete(e){evidence=e},async load(){return checkpoint},async commit(_b,next){checkpoint=next}};
   await extractPrivate({connection:c,sourceMode:'remote',inventory,policy,sink,project:async row=>({status:'eligible',listing:{id:row.source.id}}),upstream:upstreamWith(lastModified),reserveAttempt:async a=>({state:'reserved',attemptId:a.attemptId,period:new Date().toISOString().slice(0,7)})});return evidence};
  const withDate=await run('Tue, 21 Oct 2026 12:00:00 GMT');
  assert.equal(withDate.kind,'captured');assert.equal(withDate.releaseId,release);assert.equal(withDate.artifactUrl,asset);assert.equal(withDate.artifactEtag,etag);assert.equal(withDate.artifactBytes,bytes.length);
  assert.equal(withDate.upstreamLastModified.toISOString(),'2026-10-21T12:00:00.000Z');assert.ok(withDate.observedAt instanceof Date);assert.match(withDate.recorder,/^extractor:overture-private-extractor\.mjs@[a-f0-9]{12}$/);assert.equal(withDate.inventorySha256,inventorySha256);
  assert.notEqual(withDate.upstreamLastModified.toISOString(),'inventory-copy');
  assert.equal((await run(null)).upstreamLastModified,null);
  assert.equal((await run('not a date')).upstreamLastModified,null);
 } finally {c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true})}
});
