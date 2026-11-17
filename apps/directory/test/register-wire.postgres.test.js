const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, cpSync, readFileSync, writeFileSync, symlinkSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const net = require('node:net');
const { DataSource } = require('typeorm');
const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { firstValueFrom, timeout:rxjsTimeout } = require('rxjs');
const { beginRecovery, enableRegisterCapture } = require('../../social/src/app/services/community-directory-epoch');
const { initializeDirectoryRegister } = require('../../social/src/app/services/community-directory-register-initialize');
const { beginRegisterRecovery } = require('../src/register-recovery-authority');
const { RegisterDeliveryV2 } = require('../../directory-worker/src/register-delivery');

const enabled = process.env.S3_REGISTER_PAIR_TEST === 'disposable';
const directoryUrl = process.env.S3_REGISTER_DIRECTORY_URL, socialUrl = process.env.S3_REGISTER_SOCIAL_URL;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function guard(value,name) { const u = new URL(value || ''); assert.equal(u.protocol,'postgres:'); assert.equal(u.hostname,'127.0.0.1'); assert.equal(u.pathname,`/${name}`); return u; }
async function freePort() { return new Promise((resolve,reject)=>{ const server=net.createServer(); server.once('error',reject); server.listen(0,'127.0.0.1',()=>{ const port=server.address().port; server.close(error=>error?reject(error):resolve(port)); }); }); }

test('pending bootstrap and repair use authenticated Social TCP', {skip:!enabled,timeout:90000}, async t=>{
  guard(directoryUrl,'directorybootstrap'); const socialConfig=guard(socialUrl,'s3social');
  const directory = new DataSource({type:'postgres',url:directoryUrl});
  const social = new DataSource({type:'postgres',url:socialUrl});
  const id=randomUUID(), secondId=randomUUID(), developmentFixtureId=randomUUID(), readSecret='s3-wire-read-secret-12345678901234567890', repairSecret='s3-wire-repair-secret-12345678901234567890', reviewSecret='s2-boundary-review-secret-12345678901234567890', pendingSecret='s2-pending-gateway-secret-12345678901234567890', decisionSecret='s2-decision-write-secret-12345678901234567890', containmentSecret='s2-containment-read-secret-12345678901234567890';
  const seededIds=process.env.S3_SOURCE_IDS_FILE ? JSON.parse(readFileSync(process.env.S3_SOURCE_IDS_FILE,'utf8')) : Array.from({length:24},()=>randomUUID());
  assert.ok(Array.isArray(seededIds) && seededIds.length > 0 && seededIds.length <= 1000 && seededIds.every(id=>typeof id==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) && new Set(seededIds).size === seededIds.length, 'Invalid source census IDs');
  const privateIds=Array.from({length:3},()=>randomUUID());
  let owned=false, temp, child, worker, secondWorker, directoryProcess, client, createdId, candidateDiscovery, childOutput='';
  async function stopProcess(processChild) { if (processChild && processChild.exitCode===null && processChild.signalCode===null) { processChild.kill('SIGTERM'); await Promise.race([new Promise(resolve=>processChild.once('exit',resolve)),pause(3000)]); if (processChild.exitCode===null && processChild.signalCode===null) processChild.kill('SIGKILL'); } }
  async function stopWorker() { await stopProcess(worker); worker=undefined; }
  try {
    await directory.initialize(); await social.initialize();
    for (const table of ['community','community_directory_epoch','community_directory_register','community_directory_change']) assert.equal((await social.query(`SELECT 1 FROM "${table}" LIMIT 1`)).length,0);
    for (const table of ['directory_installation','directory_census_progress','directory_town','directory_provider_work']) assert.equal((await directory.query(`SELECT 1 FROM "${table}" LIMIT 1`)).length,0);
    owned=true;
    for (const seed of seededIds) await social.query(`INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,$2,'owner','owner','local-hub','town',false)`,[seed,`Seed ${seed}`]);
    for (const seed of privateIds) await social.query(`INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,$2,'owner','owner','local-hub','town',true)`,[seed,`Private ${seed}`]);
    await social.query(`INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate","adminArea") VALUES ($1,'Explicit development fixture','owner','owner','local-hub','town',false,'Development fixture')`,[developmentFixtureId]);
    await social.query(`UPDATE community SET city='Example', "adminArea"='GA', "countryCode"='US', lat=31.5, lng=-82.5 WHERE id=$1`,[seededIds[0]]);
    await beginRecovery(social); await initializeDirectoryRegister(social,true); await enableRegisterCapture(social,true);
    const [identity]=await social.query('SELECT "sourceEpoch","activationId","socialGeneration" FROM community_directory_epoch WHERE id=1');
    const authority=await beginRegisterRecovery(directory,{...identity,owner:randomUUID(),expectedPrevious:null,externalFence:true});
    temp=mkdtempSync(join(tmpdir(),'t3-s3-wire-'));
    cpSync(resolve('dist/apps/social/main.js'),join(temp,'main.js'));
    cpSync(resolve('dist/apps/social/assets'),join(temp,'assets'),{recursive:true});
    symlinkSync(resolve('node_modules'),join(temp,'node_modules'),'dir');
    const port=await freePort(), config=join(temp,'assets','config.yaml');
    const yaml=readFileSync(config,'utf8'); assert.match(yaml,/^listenPort:[ \t]*3003[ \t]*$/m);
    writeFileSync(config,yaml.replace(/^listenPort:[ \t]*3003[ \t]*$/m,`listenPort: ${port}`));
    const startSocial=()=>{const processChild=spawn(process.execPath,[join(temp,'main.js')],{stdio:['ignore','pipe','pipe'],env:{...process.env,DATABASE_HOST:'127.0.0.1',DATABASE_PORT:socialConfig.port,DATABASE_USER:decodeURIComponent(socialConfig.username),DATABASE_PASSWORD:decodeURIComponent(socialConfig.password),DATABASE_NAME:'s3social',POSTGRES_HOST:'127.0.0.1',POSTGRES_PORT:socialConfig.port,POSTGRES_USER:decodeURIComponent(socialConfig.username),POSTGRES_PASSWORD:decodeURIComponent(socialConfig.password),POSTGRES_DB:'s3social',SOCIAL_DIRECTORY_MODE:'register-only',DIRECTORY_REGISTER_READ_SECRET:readSecret,DIRECTORY_REGISTER_REPAIR_SECRET:repairSecret}});for(const stream of [processChild.stdout,processChild.stderr])stream.on('data',chunk=>{childOutput=(childOutput+chunk.toString()).slice(-2500);});return processChild;};
    child=startSocial();
    client=new RegisterDeliveryV2('127.0.0.1',port,readSecret,repairSecret);
    let ready=false, lastError;
    for (let n=0;n<30 && !ready;n++) { if (child.exitCode !== null) throw Error(`Social fixture process exited: ${childOutput.replaceAll(readSecret,'[redacted]').replaceAll(repairSecret,'[redacted]').replaceAll(decodeURIComponent(socialConfig.password),'[redacted]')}`); try { await client.census(identity,null,1); ready=true; } catch (error) { lastError=String(error); await pause(200); } }
    assert.equal(ready,true,`Social TCP fixture did not become ready: ${lastError}; ${childOutput.replaceAll(readSecret,'[redacted]').replaceAll(repairSecret,'[redacted]').replaceAll(decodeURIComponent(socialConfig.password),'[redacted]')}`);
    const wrong=new RegisterDeliveryV2('127.0.0.1',port,repairSecret,readSecret);
    try { await assert.rejects(wrong.census(identity,null,1)); await assert.rejects(wrong.geography(identity,seededIds[0])); await assert.rejects(wrong.repair(identity,id)); } finally { wrong.close(); }
    const geography=await client.geography(identity,seededIds[0]);
    assert.equal(geography.status,'current');assert.deepEqual(geography.geography,{communityId:seededIds[0],name:`Seed ${seededIds[0]}`,city:'Example',adminArea:'GA',countryCode:'US',localityType:'town',referencePoint:[-82.5,31.5]});
    assert.equal((await client.geography(identity,privateIds[0])).geography,null);
    assert.equal((await client.geography(identity,developmentFixtureId)).geography,null);
    if (process.env.S2_CENSUS_GA_PLACE && process.env.S2_CENSUS_GA_COUSUB) {
      const { DuckDBInstance } = await import('@duckdb/node-api');
      const { discoverPrivateTownBoundary } = await import('../../../scripts/census-boundary-social.mjs');
      const { statSync } = require('node:fs');
      const db=await DuckDBInstance.create(':memory:'), connection=await db.connect();
      try {
        await connection.run('LOAD spatial');
        await social.query(`UPDATE community SET city='Douglas', "localityType"='city', lat=31.506114, lng=-82.854335 WHERE id=$1`,[seededIds[0]]);
        const archives=[
          {layer:'place',archivePath:process.env.S2_CENSUS_GA_PLACE,archiveSha256:'1325e424664f8c0f517c0aa155e3806ca299785ccca4e1badc9fe4f3f4173e09'},
          {layer:'cousub',archivePath:process.env.S2_CENSUS_GA_COUSUB,archiveSha256:'69fd8066866bda0bc720a03743f6110ad9a75fb53dacc0d38066ac587676f3a4'},
        ].map(archive=>({...archive,archiveBytes:statSync(archive.archivePath).size}));
        const args={delivery:client,identity,communityId:seededIds[0],archives,vintage:'2026',connection};
        const candidate=await discoverPrivateTownBoundary(args);
        candidateDiscovery=candidate;
        assert.ok(candidate.candidates.some(item=>item.layer==='place' && item.geoid==='1323872'));
        assert.equal(candidate.sourceAuthorityVerified,false); assert.equal(candidate.communityIdentityVerified,false);
        assert.equal((await discoverPrivateTownBoundary({...args,communityId:privateIds[0]})).status,'unavailable');
        let calls=0;
        const changing={geography:async (...params)=>{if(++calls===2)await social.query('UPDATE community SET "isPrivate"=true WHERE id=$1',[seededIds[0]]);return client.geography(...params);}};
        assert.equal((await discoverPrivateTownBoundary({...args,delivery:changing})).status,'superseded');
        await social.query('UPDATE community SET "isPrivate"=false WHERE id=$1',[seededIds[0]]);
      } finally { connection.closeSync(); db.closeSync(); }
    }
    await social.query(`INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,'Wire town','owner','owner','local-hub','town',false)`,[id]);
    const workerPort=await freePort(), secondWorkerPort=await freePort(), directoryPort=await freePort();
    const runtimeIdentity=Object.fromEntries(['sourceEpoch','activationId','socialGeneration','recoveryEpoch','owner','directoryGeneration'].map(key=>[key,authority[key]]));
    directoryProcess=spawn(process.execPath,[resolve('dist/apps/directory/main.js')],{stdio:'ignore',env:{...process.env,DIRECTORY_MODE:'register-pending-v1',DIRECTORY_EXTERNAL_FENCE_ASSERTION:'fenced',DIRECTORY_REGISTER_RUNTIME_IDENTITY:JSON.stringify(runtimeIdentity),DIRECTORY_PORT:String(directoryPort),DIRECTORY_DATABASE_URL:directoryUrl,SOCIAL_HOST:'127.0.0.1',SOCIAL_PORT:String(port),DIRECTORY_REGISTER_READ_SECRET:readSecret,DIRECTORY_BOUNDARY_REVIEW_SECRET:reviewSecret,DIRECTORY_BOUNDARY_DECISION_SECRET:decisionSecret,DIRECTORY_PENDING_READ_SECRET:pendingSecret,DIRECTORY_CONTAINMENT_READ_SECRET:containmentSecret}});
    const startWorker=(healthPort=workerPort)=>spawn(process.execPath,[resolve('dist/apps/directory-worker/main.js')],{stdio:'ignore',env:{...process.env,DIRECTORY_WORKER_MODE:'register-pending-v1',DIRECTORY_EXTERNAL_FENCE_ASSERTION:'fenced',DIRECTORY_REGISTER_RUNTIME_IDENTITY:JSON.stringify(runtimeIdentity),DIRECTORY_REGISTER_SWEEP_INTERVAL_MS:'100',DIRECTORY_WORKER_PORT:String(healthPort),DIRECTORY_DATABASE_URL:directoryUrl,SOCIAL_HOST:'127.0.0.1',SOCIAL_PORT:String(port),DIRECTORY_REGISTER_READ_SECRET:readSecret,DIRECTORY_REGISTER_REPAIR_SECRET:repairSecret}});
    worker=startWorker();
    secondWorker=startWorker(secondWorkerPort);
    let secondLive=false;
    for(let i=0;i<100&&!secondLive;i++){if(secondWorker.exitCode!==null)throw Error('Second worker fixture exited');try{secondLive=(await fetch(`http://127.0.0.1:${secondWorkerPort}/health/live`,{signal:AbortSignal.timeout(500)})).ok;}catch{}if(!secondLive)await pause(100);}
    assert.equal(secondLive,true,'Second worker did not start');
    let rows=[];
    for (let i=0;i<200;i++) { if (worker.exitCode!==null) throw Error('Worker fixture exited'); rows=await directory.query('SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',[id]); if (rows[0]?.eligible) break; await pause(50); }
    assert.deepEqual(await directory.query('SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',[id]),[{eligible:true,geometryStatus:'pending'}]);
    assert.deepEqual(await directory.query('SELECT status FROM directory_provider_work WHERE "communityId"=$1',[id]),[{status:'blocked'}]);
    let projected=[];
    for(let i=0;i<800;i++){projected=await directory.query('SELECT "communityId" AS id FROM directory_town WHERE eligible IS TRUE ORDER BY id');if(projected.length===seededIds.length+1)break;await pause(50);}
    const eligible=await social.query(`SELECT id FROM community WHERE "appScope"='local-hub' AND "localityType" IN ('city','town') AND "isPrivate" IS FALSE AND "adminArea" IS DISTINCT FROM 'Development fixture' ORDER BY id`);
    assert.deepEqual(projected,eligible);
    assert.equal((await directory.query('SELECT 1 FROM directory_town WHERE "communityId"=$1 AND eligible IS TRUE',[developmentFixtureId])).length,0);
    assert.equal((await directory.query('SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',[developmentFixtureId])).length,0);
    assert.equal((await directory.query("SELECT count(*)::int AS n FROM directory_provider_work WHERE status='blocked'"))[0].n,eligible.length);
    if (candidateDiscovery) {
      const {storeDiscoveredBoundaryCandidate}=require('../../directory-worker/src/boundary-review');
      const command=spawn(process.execPath,['-r','ts-node/register/transpile-only',resolve('scripts/census-boundary-prepare.mjs'),seededIds[0]],{stdio:['ignore','pipe','pipe'],env:{...process.env,TS_NODE_PROJECT:'apps/directory-worker/tsconfig.json',DIRECTORY_EXTERNAL_FENCE_ASSERTION:'fenced',DIRECTORY_REGISTER_RUNTIME_IDENTITY:JSON.stringify(runtimeIdentity),DIRECTORY_DATABASE_URL:directoryUrl,SOCIAL_HOST:'127.0.0.1',SOCIAL_PORT:String(port),DIRECTORY_REGISTER_READ_SECRET:readSecret,DIRECTORY_CENSUS_VINTAGE:'2026',DIRECTORY_CENSUS_PLACE_PATH:process.env.S2_CENSUS_GA_PLACE,DIRECTORY_CENSUS_PLACE_SHA256:'1325e424664f8c0f517c0aa155e3806ca299785ccca4e1badc9fe4f3f4173e09',DIRECTORY_CENSUS_COUSUB_PATH:process.env.S2_CENSUS_GA_COUSUB,DIRECTORY_CENSUS_COUSUB_SHA256:'69fd8066866bda0bc720a03743f6110ad9a75fb53dacc0d38066ac587676f3a4'}});
      let commandOutput='';for(const stream of [command.stdout,command.stderr])stream.on('data',chunk=>{commandOutput=(commandOutput+chunk.toString()).slice(-2000);});
      const commandTimer=setTimeout(()=>command.kill('SIGKILL'),30000);
      const commandResult=await new Promise(resolve=>command.once('exit',(code,signal)=>resolve({code,signal})));clearTimeout(commandTimer);
      assert.deepEqual(commandResult,{code:0,signal:null},`Boundary preparation failed: ${commandOutput.replaceAll(readSecret,'[redacted]')}`);
      assert.match(commandOutput,/candidate stored/i);
      await pause(300);
      const stored=await directory.query('SELECT geoid,"changeToken" FROM directory_boundary_candidate WHERE "communityId"=$1',[seededIds[0]]);
      assert.deepEqual(stored,[{geoid:'1323872',changeToken:candidateDiscovery.changeToken}]);
      const reviewUrl=`http://127.0.0.1:${directoryPort}/internal/towns/${seededIds[0]}/boundary-candidate`;
      assert.equal((await fetch(reviewUrl)).status,401);
      assert.equal((await fetch(reviewUrl,{headers:{authorization:`Bearer ${readSecret}`}})).status,401);
      let approvedRead;
      for(let i=0;i<100;i++){approvedRead=await fetch(reviewUrl,{headers:{authorization:`Bearer ${reviewSecret}`}});if(approvedRead.status===200)break;await pause(100);}
      assert.equal(approvedRead.status,200);const body=await approvedRead.json();assert.equal(body.candidate.geoid,'1323872');assert.equal(body.candidate.reviewContext.name,`Seed ${seededIds[0]}`);
      const decisionId=randomUUID(), reviewerId=randomUUID(), candidate=body.candidate;
      const {reviewContext,...candidateBinding}=candidate;
      const decisionBody={requestId:decisionId,reviewerId,decision:'verified',attested:true,sourceUrl:'https://www.census.gov/geographies/reference-files.html',candidate:candidateBinding};
      const decisionUrl=`http://127.0.0.1:${directoryPort}/internal/towns/${seededIds[0]}/boundary-decisions`;
      const postDecision=secret=>fetch(decisionUrl,{method:'POST',headers:{authorization:`Bearer ${secret}`,'content-type':'application/json'},body:JSON.stringify(decisionBody)});
      assert.equal((await postDecision(reviewSecret)).status,401);
      assert.equal((await postDecision(decisionSecret)).status,204);
      const install=spawnSync(process.execPath,['-r','ts-node/register/transpile-only','-r','tsconfig-paths/register','scripts/census-boundary-install.mjs',seededIds[0],decisionId],{cwd:resolve('.'),encoding:'utf8',timeout:30000,env:{...process.env,TS_NODE_PROJECT:'apps/directory/tsconfig.json',DIRECTORY_EXTERNAL_FENCE_ASSERTION:'fenced',DIRECTORY_REGISTER_RUNTIME_IDENTITY:JSON.stringify(runtimeIdentity),DIRECTORY_DATABASE_URL:directoryUrl,SOCIAL_HOST:'127.0.0.1',SOCIAL_PORT:String(port),DIRECTORY_REGISTER_READ_SECRET:readSecret,DIRECTORY_CENSUS_ARCHIVE_PATH:process.env.S2_CENSUS_GA_PLACE}});
      assert.equal(install.status,0,`Private install command failed: ${(install.stderr || '').slice(-500)}`);
      assert.equal((await directory.query('SELECT count(*)::int n FROM directory_reviewed_geometry WHERE "communityId"=$1',[seededIds[0]]))[0].n,1);
      const containmentUrl=`http://127.0.0.1:${directoryPort}/internal/towns/${seededIds[0]}/containment?longitude=-82.854335&latitude=31.506114`;
      assert.equal((await fetch(containmentUrl,{headers:{authorization:`Bearer ${reviewSecret}`}})).status,401);
      const contained=await fetch(containmentUrl,{headers:{authorization:`Bearer ${containmentSecret}`}});
      assert.equal(contained.status,200);assert.deepEqual(await contained.json(),{status:'ready',covers:true});
      const boundaryUrl=`http://127.0.0.1:${directoryPort}/internal/towns/${seededIds[0]}/boundary`;
      const renderedBoundary=await fetch(boundaryUrl,{headers:{authorization:`Bearer ${containmentSecret}`}});
      assert.equal(renderedBoundary.status,200);const boundaryBody=await renderedBoundary.json();assert.equal(boundaryBody.status,'ready');assert.ok(['Polygon','MultiPolygon'].includes(boundaryBody.geometry.type));
      require('tsconfig-paths/register');
      const Gateway=require('../../gateway/src/controllers/directory/directory.controller').DirectoryController;
      const oldUrl=process.env.DIRECTORY_INTERNAL_URL, oldContainment=process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
      process.env.DIRECTORY_INTERNAL_URL=`http://127.0.0.1:${directoryPort}`;process.env.DIRECTORY_CONTAINMENT_READ_SECRET=containmentSecret;
      try {const throughGateway=await new Gateway({send:()=>{throw Error('Unexpected Social legacy path');}}).boundary(seededIds[0]);assert.equal(throughGateway.status,'ready');assert.equal(throughGateway.geometry.type,boundaryBody.geometry.type);}
      finally {if(oldUrl===undefined)delete process.env.DIRECTORY_INTERNAL_URL;else process.env.DIRECTORY_INTERNAL_URL=oldUrl;if(oldContainment===undefined)delete process.env.DIRECTORY_CONTAINMENT_READ_SECRET;else process.env.DIRECTORY_CONTAINMENT_READ_SECRET=oldContainment;}
      const {readCurrentBoundaryCandidate}=require('../src/boundary-review');
      const readCurrent=()=>client.geography(identity,seededIds[0]);
      assert.equal((await readCurrentBoundaryCandidate(directory,runtimeIdentity,seededIds[0],readCurrent)).geoid,'1323872');
      await social.query("UPDATE community SET city='Other' WHERE id=$1",[seededIds[0]]);
      assert.equal(await readCurrentBoundaryCandidate(directory,runtimeIdentity,seededIds[0],readCurrent),null,'Direct geography changes must invalidate the candidate');
      assert.equal((await directory.query('SELECT count(*)::int n FROM directory_reviewed_geometry WHERE "communityId"=$1',[seededIds[0]]))[0].n,0);
      assert.notEqual((await directory.query('SELECT "invalidatedAt" FROM directory_boundary_decision WHERE "requestId"=$1',[decisionId]))[0].invalidatedAt,null);
      await social.query("UPDATE community SET city='Douglas' WHERE id=$1",[seededIds[0]]);
      await storeDiscoveredBoundaryCandidate(directory,runtimeIdentity,candidateDiscovery,client);
      require('tsconfig-paths/register');
      const {DirectoryController}=require('../../gateway/src/controllers/directory/directory.controller');
      const originalPending=process.env.DIRECTORY_PENDING_READ_SECRET, originalUrl=process.env.DIRECTORY_INTERNAL_URL;
      process.env.DIRECTORY_PENDING_READ_SECRET=pendingSecret;process.env.DIRECTORY_INTERNAL_URL=`http://127.0.0.1:${directoryPort}`;
      const gateway=new DirectoryController({send:()=>{throw Error('Legacy Social path must not be called');}});
      const publicStatus=await gateway.status(seededIds[0]);
      assert.deepEqual(publicStatus,{town:{id:seededIds[0]},status:'pending',approximateLocation:{coordinates:[-82.854335,31.506114],label:'Approximate town location; verified boundary unavailable.'}});
      await social.query('UPDATE community SET "isPrivate"=true WHERE id=$1',[seededIds[0]]);
      await assert.rejects(gateway.status(seededIds[0]),error=>error.status===404);
      const privateContainment=await fetch(containmentUrl,{headers:{authorization:`Bearer ${containmentSecret}`}});assert.ok([404,503].includes(privateContainment.status));
      let withdrawn=false;
      for(let i=0;i<150&&!withdrawn;i++){const rows=await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[seededIds[0]]);const candidates=await directory.query('SELECT 1 FROM directory_boundary_candidate WHERE "communityId"=$1',[seededIds[0]]);withdrawn=rows[0]?.eligible===false && candidates.length===0;if(!withdrawn)await pause(100);}
      assert.equal(withdrawn,true,'Worker did not withdraw the private candidate');
      await social.query('UPDATE community SET "isPrivate"=false WHERE id=$1',[seededIds[0]]);
      let restored=false;
      for(let i=0;i<150&&!restored;i++){const rows=await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[seededIds[0]]);restored=rows[0]?.eligible===true;if(!restored)await pause(100);}
      assert.equal(restored,true,'Worker did not restore the pending town');
      assert.equal((await directory.query('SELECT 1 FROM directory_boundary_candidate WHERE "communityId"=$1',[seededIds[0]])).length,0,'Restoring eligibility must not restore the candidate');
      await social.query('UPDATE community SET lat=NULL WHERE id=$1',[seededIds[0]]);
      assert.equal((await gateway.status(seededIds[0])).approximateLocation,null,'Missing coordinates must not become a guessed point');
      await social.query('UPDATE community SET lat=31.506114 WHERE id=$1',[seededIds[0]]);
      if(originalPending===undefined)delete process.env.DIRECTORY_PENDING_READ_SECRET;else process.env.DIRECTORY_PENDING_READ_SECRET=originalPending;
      if(originalUrl===undefined)delete process.env.DIRECTORY_INTERNAL_URL;else process.env.DIRECTORY_INTERNAL_URL=originalUrl;
    }
    t.diagnostic(`isolated before/after eligible coverage: ${projected.length}/${eligible.length}; private fixtures: ${privateIds.length}`);
    await stopProcess(secondWorker); secondWorker=undefined;
    await stopWorker();
    await social.query(`INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,'Restart town','owner','owner','local-hub','town',false)`,[secondId]);
    await social.query('DELETE FROM community WHERE id=$1',[id]);
    worker=startWorker();
    for (let i=0;i<200;i++) { if (worker.exitCode!==null) throw Error('Restarted worker fixture exited'); rows=await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[id]); const added=await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[secondId]); if (rows[0]?.eligible===false && added[0]?.eligible===true) break; await pause(50); }
    assert.deepEqual(rows,[{eligible:false}]);
    assert.deepEqual(await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[secondId]),[{eligible:true}]);
    assert.equal((await directory.query('SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',[id])).length,0);
    const workerReady=async()=>{try{return (await fetch(`http://127.0.0.1:${workerPort}/health/ready`,{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}};
    let healthy=false;
    for(let i=0;i<100&&!healthy;i++){healthy=await workerReady();if(!healthy)await pause(100);}
    assert.equal(healthy,true,'Worker did not report a completed sweep');
    const directoryRequest=async path=>{try{return await fetch(`http://127.0.0.1:${directoryPort}${path}`,{signal:AbortSignal.timeout(3000)});}catch{return null;}};
    let response;
    for(let i=0;i<100;i++){response=await directoryRequest(`/internal/towns/${secondId}/status`);if(response?.ok)break;await pause(100);}
    assert.equal(response?.status,200); assert.deepEqual(await response.json(),{status:'pending'});
    // Exercise the actual owning Social API and measure this isolated observation.
    const socialClient=ClientProxyFactory.create({transport:Transport.TCP,options:{host:'127.0.0.1',port}});
    const started=Date.now();
    try {
      const created=await firstValueFrom(socialClient.send({cmd:'CREATE_COMMUNITY'},{dto:{name:`Wire-created ${randomUUID()}`,localityType:'town',isPrivate:false},userId:randomUUID(),profileId:randomUUID(),appScope:'local-hub'}).pipe(rxjsTimeout(5000)));
      createdId=created.id; assert.match(createdId,/^[0-9a-f-]{36}$/);
    } finally { socialClient.close(); }
    for(let i=0;i<100;i++){response=await directoryRequest(`/internal/towns/${createdId}/status`);if(response?.ok)break;await pause(100);}
    assert.equal(response?.status,200);
    assert.deepEqual(await directory.query('SELECT status FROM directory_provider_work WHERE "communityId"=$1',[createdId]),[{status:'blocked'}]);
    const elapsedMs=Date.now()-started; t.diagnostic(`isolated owning API to pending and blocked intent: ${elapsedMs} ms`);
    assert.ok(elapsedMs<15*60*1000,'isolated onboarding exceeded 15-minute target');
    // Direct SQL can bypass Social capture; the sweep must still apply the current fixture state.
    await social.query('UPDATE community SET "adminArea"=$2 WHERE id=$1',[secondId,'Development fixture']);
    for(let i=0;i<200;i++) { const state=await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[secondId]); if(state[0]?.eligible===false) break; await pause(50); }
    assert.deepEqual(await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[secondId]),[{eligible:false}]);
    assert.equal((await directory.query('SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',[secondId])).length,0);
    await social.query('UPDATE community SET "adminArea"=NULL WHERE id=$1',[secondId]);
    for(let i=0;i<200;i++) { const state=await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[secondId]); if(state[0]?.eligible===true) break; await pause(50); }
    assert.deepEqual(await directory.query('SELECT eligible FROM directory_town WHERE "communityId"=$1',[secondId]),[{eligible:true}]);
    await social.query('UPDATE community SET "isPrivate"=true WHERE id=$1',[secondId]);
    response=await directoryRequest(`/internal/towns/${secondId}/status`);
    assert.equal(response?.status,503);
    child.kill('SIGTERM'); await new Promise(resolve=>child.once('exit',resolve)); child=undefined;
    for(let i=0;i<150&&healthy;i++){await pause(100);healthy=await workerReady();}
    assert.equal(healthy,false,'Worker readiness must fail during Social outage');
    response=await directoryRequest('/health/ready'); assert.equal(response?.status,503);
    child=startSocial();
    for(let i=0;i<200&&!healthy;i++){await pause(100);healthy=await workerReady();}
    assert.equal(healthy,true,'Worker did not recover after Social restarted');
    // A table lock must not make graceful worker shutdown wait indefinitely.
    const blocker=directory.createQueryRunner(); await blocker.connect(); await blocker.startTransaction();
    try {
      await blocker.query('LOCK TABLE directory_town IN ACCESS EXCLUSIVE MODE');
      let blocked=false;
      for(let i=0;i<100&&!blocked;i++){
        const waiting=await directory.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%directory_town%'`);
        blocked=waiting.length>0; if(!blocked)await pause(100);
      }
      assert.equal(blocked,true,'Worker did not reach the locked page query');
      const exited=new Promise(resolve=>worker.once('exit',(code,signal)=>resolve({code,signal})));
      worker.kill('SIGTERM');
      const outcome=await Promise.race([exited,pause(15000).then(()=>null)]);
      assert.deepEqual(outcome,{code:0,signal:null},'Worker did not shut down cleanly after bounded query timeout');
      worker=undefined;
    } finally { await blocker.rollbackTransaction(); await blocker.release(); }
  } finally {
    await stopProcess(secondWorker);
    await stopWorker();
    if (directoryProcess && directoryProcess.exitCode===null) { directoryProcess.kill('SIGTERM'); await Promise.race([new Promise(resolve=>directoryProcess.once('exit',resolve)),pause(3000)]); if(directoryProcess.exitCode===null)directoryProcess.kill('SIGKILL'); }
    client?.close();
    if (child && child.exitCode===null) { child.kill('SIGTERM'); await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(3000)]); if (child.exitCode===null) child.kill('SIGKILL'); }
    if (temp) rmSync(temp,{recursive:true,force:true});
    try { if (owned) {
      const ids=[id,secondId,developmentFixtureId,...seededIds,...privateIds,...(createdId?[createdId]:[])];
      for(const table of ['directory_reviewed_geometry','directory_boundary_decision','directory_town_geometry']) await directory.query(`DELETE FROM ${table} WHERE "communityId"=ANY($1::uuid[])`,[ids]);
      await directory.query('DELETE FROM directory_boundary_candidate WHERE "communityId"=ANY($1::uuid[])',[ids]); await directory.query('DELETE FROM directory_provider_work WHERE "communityId"=ANY($1::uuid[])',[ids]); await directory.query('DELETE FROM directory_town WHERE "communityId"=ANY($1::uuid[])',[ids]);
      await directory.query("DELETE FROM directory_census_progress WHERE id='recovery'"); await directory.query("DELETE FROM directory_installation WHERE id='recovery-authority'");
      await social.query('DELETE FROM community_directory_register WHERE "communityId"=ANY($1::uuid[])',[ids]); await social.query('DELETE FROM community WHERE id=ANY($1::uuid[])',[ids]); await social.query('DELETE FROM community_directory_epoch WHERE id=1');
    } } finally { try { if(directory.isInitialized) await directory.destroy(); } finally { if(social.isInitialized) await social.destroy(); } }
  }
});
