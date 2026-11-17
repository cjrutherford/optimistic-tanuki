import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';
import { DuckDBInstance } from '@duckdb/node-api';

const prj='GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",SPHEROID["GRS_1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function zipFiles(path, files) { const writer=new ZipWriter(new BlobWriter()); for(const [name,bytes] of files) await writer.add(name,new Uint8ArrayReader(bytes)); const blob=await writer.close();await writeFile(path,new Uint8Array(await blob.arrayBuffer())); }
async function shapeZip(path,stem) { const extensions=['shp','shx','dbf','prj'];await zipFiles(path,await Promise.all(extensions.map(async x=>[`tl_2026_13_place.${x}`,await readFile(stem+'.'+x)]))); }

let readCandidate, findCandidates, findAcross;
try { ({readCensusBoundaryCandidate:readCandidate,findCensusBoundaryCandidates:findCandidates,findCensusBoundaryCandidatesAcross:findAcross}=await import('./census-boundary-reader.mjs')); } catch (error) { if(error.code!=='ERR_MODULE_NOT_FOUND') throw error; }

test('a pinned Census geometry is only a corroborated candidate, never an automatic approval',async()=>{
  assert.ok(readCandidate,'Census boundary reader must be implemented');
  const dir=await mkdtemp(join(tmpdir(),'census-reader-test-'));const db=await DuckDBInstance.create(':memory:');const c=await db.connect();
  try {
    await c.run('LOAD spatial');
    const stem=join(dir,'tl_2026_13_place');
    await c.run(`COPY (SELECT '1323872' AS GEOID, '13' AS STATEFP, 'Douglas' AS NAME, '25' AS LSAD, ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))') AS geom) TO '${stem}.shp' WITH (FORMAT GDAL, DRIVER 'ESRI Shapefile')`);
    await writeFile(stem+'.prj',prj);
    const zip=join(dir,'source.zip');await shapeZip(zip,stem);
    const bytes=await readFile(zip);const args={connection:c,archivePath:zip,archiveSha256:sha(bytes),archiveBytes:bytes.length,vintage:'2026',stateFips:'13',layer:'place',geoid:'1323872',referencePoint:[1,1]};
    const result=await readCandidate(args);
    assert.equal(result.status,'candidate'); assert.equal(result.geoid,'1323872'); assert.equal(result.sourceSha256,sha(bytes));
    assert.equal(result.sourceAuthorityVerified,false); assert.equal(result.communityIdentityVerified,false);
    assert.ok(['Polygon','MultiPolygon'].includes(result.geometry.type)); assert.match(result.warning,/not.*verif/i);
    await assert.rejects(readCandidate({...args,archiveSha256:'0'.repeat(64)}),/digest/i);
    await assert.rejects(readCandidate({...args,geoid:'1329999'}),/not found/i);
    await assert.rejects(readCandidate({...args,referencePoint:[10,10]}),/outside/i);
    await assert.rejects(readCandidate({...args,stateFips:'12'}),/state/i);
    await assert.rejects(readCandidate({...args,archiveBytes:bytes.length+1}),/size/i);
    await writeFile(stem+'.prj','GEOGCS["wrong"]'); const badCrs=join(dir,'bad-crs.zip'); await shapeZip(badCrs,stem);
    const badBytes=await readFile(badCrs); await assert.rejects(readCandidate({...args,archivePath:badCrs,archiveSha256:sha(badBytes),archiveBytes:badBytes.length}),/coordinate reference/i);
    const nested=join(dir,'nested.zip'); await zipFiles(nested,[['../evil.shp',new Uint8Array([1])]]);
    const nestedBytes=await readFile(nested); await assert.rejects(readCandidate({...args,archivePath:nested,archiveSha256:sha(nestedBytes),archiveBytes:nestedBytes.length}),/unsafe/i);
    const oversized=join(dir,'oversized.zip'); await zipFiles(oversized,[['payload.bin',new Uint8Array([1])]]);
    const oversizedBytes=await readFile(oversized), central=oversizedBytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    assert.ok(central>=0);oversizedBytes.writeUInt32LE(64*1024*1024+1,central+24);await writeFile(oversized,oversizedBytes);
    await assert.rejects(readCandidate({...args,archivePath:oversized,archiveSha256:sha(oversizedBytes),archiveBytes:oversizedBytes.length}),/member exceeds/i);

    const dupDir=join(dir,'duplicate');await mkdir(dupDir);const duplicateStem=join(dupDir,'tl_2026_13_place');
    await c.run(`COPY (SELECT '1323872' AS GEOID, '13' AS STATEFP, 'Douglas' AS NAME, '25' AS LSAD, ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))') AS geom FROM (VALUES (1),(2)) t(n)) TO '${duplicateStem}.shp' WITH (FORMAT GDAL, DRIVER 'ESRI Shapefile')`);
    await writeFile(duplicateStem+'.prj',prj);const duplicate=join(dir,'duplicate.zip');await shapeZip(duplicate,duplicateStem);
    const duplicateBytes=await readFile(duplicate);await assert.rejects(readCandidate({...args,archivePath:duplicate,archiveSha256:sha(duplicateBytes),archiveBytes:duplicateBytes.length}),/ambiguous/i);

  } finally {c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true});}
});


test('name discovery keeps multiple candidate identifiers ambiguous and labels missing matches',async()=>{
  assert.ok(findCandidates,'Census candidate discovery must be implemented');
  const dir=await mkdtemp(join(tmpdir(),'census-discover-test-'));const db=await DuckDBInstance.create(':memory:');const c=await db.connect();
  try {
    await c.run('LOAD spatial');const stem=join(dir,'tl_2026_13_place');
    await c.run(`COPY (SELECT geoid AS GEOID, '13' AS STATEFP, name AS NAME, '25' AS LSAD, ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))') AS geom FROM (VALUES ('1300001','Springfield'),('1300002','Springfield'),('1300003','Solo')) t(geoid,name)) TO '${stem}.shp' WITH (FORMAT GDAL, DRIVER 'ESRI Shapefile')`);
    await writeFile(stem+'.prj',prj);const zip=join(dir,'source.zip');await shapeZip(zip,stem);const bytes=await readFile(zip);
    const args={connection:c,archivePath:zip,archiveSha256:sha(bytes),archiveBytes:bytes.length,vintage:'2026',stateFips:'13',layer:'place',referencePoint:[1,1],localityType:'city'};
    const multiple=await findCandidates({...args,townName:'Springfield'});assert.equal(multiple.status,'ambiguous');assert.deepEqual(multiple.candidateGeoids,['1300001','1300002']);
    assert.equal(multiple.sourceAuthorityVerified,false);assert.equal(multiple.communityIdentityVerified,false);assert.equal(multiple.crossLayerSearchRequired,true);
    assert.equal(multiple.stateFips,'13');assert.equal(multiple.vintage,'2026');assert.equal(multiple.layer,'place');assert.equal(multiple.sourceSha256,sha(bytes));assert.equal(multiple.sourceBytes,bytes.length);
    const one=await findCandidates({...args,townName:' solo '});assert.equal(one.status,'candidate');assert.deepEqual(one.candidateGeoids,['1300003']);
    const none=await findCandidates({...args,townName:'Missing'});assert.equal(none.status,'pending');assert.deepEqual(none.candidateGeoids,[]);assert.match(none.fallbackLabel,/approximate|unavailable/i);
    assert.equal((await findCandidates({...args,townName:'Solo',localityType:'town'})).status,'pending');
  } finally {c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true});}
});


test('cross-layer discovery requires both archives and never selects an ambiguous or unverified match',async()=>{
  assert.ok(findAcross,'Cross-layer candidate discovery must be implemented');
  const dir=await mkdtemp(join(tmpdir(),'census-across-test-'));const db=await DuckDBInstance.create(':memory:');const c=await db.connect();
  try {
    await c.run('LOAD spatial');
    const archives=[];
    for(const [layer,geoid] of [['place','1300001'],['cousub','1300100001']]) {
      const stem=join(dir,`tl_2026_13_${layer}`);
      const input=layer==='place' ? "(VALUES ('1300001','Springfield'),('1300002','Solo'))" : `(VALUES ('${geoid}','Springfield'))`;
      await c.run(`COPY (SELECT geoid AS GEOID, '13' AS STATEFP, name AS NAME, '25' AS LSAD, ST_GeomFromText('POLYGON((0 0,2 0,2 2,0 2,0 0))') AS geom FROM ${input} t(geoid,name)) TO '${stem}.shp' WITH (FORMAT GDAL, DRIVER 'ESRI Shapefile')`);
      await writeFile(stem+'.prj',prj);const archive=join(dir,`${layer}.zip`);
      await zipFiles(archive,await Promise.all(['shp','shx','dbf','prj'].map(async x=>[`tl_2026_13_${layer}.${x}`,await readFile(stem+'.'+x)])));
      const bytes=await readFile(archive);archives.push({layer,archivePath:archive,archiveSha256:sha(bytes),archiveBytes:bytes.length});
    }
    const args={connection:c,archives,vintage:'2026',stateFips:'13',referencePoint:[1,1],localityType:'city',townName:'Springfield'};
    const result=await findAcross(args);assert.equal(result.status,'ambiguous');assert.equal(result.candidates.length,2);assert.deepEqual(result.candidates.map(x=>x.layer),['place','cousub']);
    assert.equal(result.communityIdentityVerified,false);assert.equal(result.sourceAuthorityVerified,false);assert.deepEqual(result.searchedLayers,['place','cousub']);assert.equal(result.otherLayersMayBeNeeded,true);
    const one=await findAcross({...args,townName:'Solo'});assert.equal(one.status,'candidate');assert.equal(one.communityIdentityVerified,false);assert.equal(one.otherLayersMayBeNeeded,true);
    const none=await findAcross({...args,townName:'Missing'});assert.equal(none.status,'pending');assert.match(none.fallbackLabel,/approximate|unavailable/i);
    const injected=await findAcross({...args,archives:[{...archives[0],townName:'Missing'},archives[1]]});assert.equal(injected.status,'ambiguous');
    await assert.rejects(findAcross({...args,archives:[archives[0]]}),/both|layers/i);
    await assert.rejects(findAcross({...args,archives:[archives[0],archives[0]]}),/both|layers/i);
  } finally {c.closeSync();db.closeSync();await rm(dir,{recursive:true,force:true});}
});
