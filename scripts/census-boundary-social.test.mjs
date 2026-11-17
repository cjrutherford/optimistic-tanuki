import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {DuckDBInstance} from '@duckdb/node-api';
import {BlobWriter,Uint8ArrayReader,ZipWriter} from '@zip.js/zip.js';
const prj='GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';
const id='11111111-1111-4111-8111-111111111111',token='22222222-2222-4222-8222-222222222222';
const identity={sourceEpoch:'33333333-3333-4333-8333-333333333333',activationId:'44444444-4444-4444-8444-444444444444',socialGeneration:'1'};
const current={status:'current',changeToken:token,geography:{communityId:id,name:'Springfield Community',city:'Springfield',adminArea:'GA',countryCode:'US',localityType:'city',referencePoint:[1,1]}};
let discover;try{({discoverPrivateTownBoundary:discover}=await import('./census-boundary-social.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
async function zipFiles(path, files){const writer=new ZipWriter(new BlobWriter());for(const [name,bytes] of files)await writer.add(name,new Uint8ArrayReader(bytes));const blob=await writer.close();await writeFile(path,new Uint8Array(await blob.arrayBuffer()));}

test('private discovery binds both archive results to current Social geography and rejects changed state',async()=>{
  assert.ok(discover,'Private Social boundary discovery must be implemented');
  const dir=await mkdtemp(join(tmpdir(),'census-social-test-')),db=await DuckDBInstance.create(':memory:'),connection=await db.connect();
  try {
    await connection.run('LOAD spatial');const archives=[];
    for(const [layer,geoid,name] of [['place','1300001','Springfield'],['cousub','1300100001','Other']]){
      const stem=join(dir,`tl_2026_13_${layer}`);
      await connection.run(`COPY (SELECT '${geoid}' AS GEOID, '13' AS STATEFP, '${name}' AS NAME, '25' AS LSAD, ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))') AS geom) TO '${stem}.shp' WITH (FORMAT GDAL, DRIVER 'ESRI Shapefile')`);
      await writeFile(stem+'.prj',prj);const archive=join(dir,`${layer}.zip`);
      await zipFiles(archive,await Promise.all(['shp','shx','dbf','prj'].map(async x=>[`tl_2026_13_${layer}.${x}`,await readFile(stem+'.'+x)])));
      const bytes=await readFile(archive);archives.push({layer,archivePath:archive,archiveSha256:createHash('sha256').update(bytes).digest('hex'),archiveBytes:bytes.length});
    }
    let calls=0;const delivery={geography:async(receivedIdentity,receivedId)=>{assert.deepEqual(receivedIdentity,identity);assert.equal(receivedId,id);calls++;return structuredClone(current);}};
    const args={connection,delivery,identity,communityId:id,archives,vintage:'2026'};
    const result=await discover(args);assert.equal(calls,2);assert.equal(result.status,'candidate');assert.equal(result.changeToken,token);assert.equal(result.candidates[0].geoid,'1300001');assert.equal(result.communityIdentityVerified,false);assert.equal(result.sourceAuthorityVerified,false);
    assert.deepEqual(result.approximateLocation,{coordinates:[1,1],label:'Approximate town location; verified boundary unavailable.'});
    assert.equal(result.boundarySearchStatus,'pending');
    assert.deepEqual(result.reviewContext,{communityId:id,name:'Springfield Community',city:'Springfield',adminArea:'GA',countryCode:'US',localityType:'city'});
    let n=0;const changing={geography:async()=>++n===1?structuredClone(current):{...structuredClone(current),changeToken:'55555555-5555-4555-8555-555555555555'}};
    assert.equal((await discover({...args,delivery:changing})).status,'superseded');
    n=0;const directChange={geography:async()=>{const r=structuredClone(current);if(++n===2)r.geography.referencePoint=[1.5,1.5];return r;}};
    assert.equal((await discover({...args,delivery:directChange})).status,'superseded');
    n=0;const withdrawn={geography:async()=>++n===1?structuredClone(current):{status:'current',changeToken:token,geography:null}};
    assert.deepEqual(await discover({...args,delivery:withdrawn}),{status:'superseded'});
    const wrongId=structuredClone(current);wrongId.geography.communityId='66666666-6666-4666-8666-666666666666';
    await assert.rejects(discover({...args,delivery:{geography:async()=>wrongId}}),/geography/i);
    await assert.rejects(discover({...args,identity:{...identity,socialGeneration:'9'.repeat(100)}}),/identity/i);

    assert.deepEqual(await discover({...args,delivery:{geography:async()=>({status:'current',changeToken:token,geography:null})}}),{status:'unavailable'});
    const missing=structuredClone(current);missing.geography.referencePoint=null;
    const pending=await discover({...args,delivery:{geography:async()=>missing}});assert.equal(pending.status,'pending');assert.equal(pending.reason,'missing_or_invalid_reference_point');assert.match(pending.fallbackLabel,/unavailable|approximate/i);
    assert.equal(pending.approximateLocation,null);assert.equal(pending.boundarySearchStatus,'pending');
    const unnamed=structuredClone(current);unnamed.geography.city=null;
    const fallback=await discover({...args,delivery:{geography:async()=>structuredClone(unnamed)}});
    assert.equal(fallback.reason,'missing_or_invalid_city');assert.deepEqual(fallback.approximateLocation,{coordinates:[1,1],label:'Approximate town location; verified boundary unavailable.'});
    assert.equal(fallback.reviewContext.communityId,id);
    n=0;const withdrawnFallback={geography:async()=>++n===1?structuredClone(unnamed):{status:'current',changeToken:token,geography:null}};
    assert.deepEqual(await discover({...args,delivery:withdrawnFallback}),{status:'superseded'});
  } finally {connection.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true});}
});
