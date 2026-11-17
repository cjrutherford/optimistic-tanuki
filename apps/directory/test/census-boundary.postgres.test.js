const test = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {stat} = require('node:fs/promises');
const {DuckDBInstance} = require('@duckdb/node-api');
const {DataSource} = require('typeorm');
const {DirectoryTown,DirectoryTownGeometry} = require('../src/entity');
const {TownGeometryService} = require('../src/town-geometry');
const url=process.env.S2_BOUNDARY_TEST_DATABASE_URL, archive=process.env.S2_CENSUS_ARCHIVE;
if(url){const parsed=new URL(url);if(process.env.S2_BOUNDARY_DISPOSABLE!=='yes'||!['127.0.0.1','localhost','::1'].includes(parsed.hostname)||parsed.pathname!=='/boundary_test_s2')throw Error('Refusing non-disposable boundary test database');}

test('private Census candidate interoperates with Directory geometry on disposable PostGIS',{skip:!url||!archive},async()=>{
  const {readCensusBoundaryCandidate}=await import('../../../scripts/census-boundary-reader.mjs');
  const duck=await DuckDBInstance.create(':memory:'),connection=await duck.connect();
  const db=new DataSource({type:'postgres',url,entities:[DirectoryTown,DirectoryTownGeometry]});const id=randomUUID();
  try {
    await connection.run('LOAD spatial');await db.initialize();
    const candidate=await readCensusBoundaryCandidate({connection,archivePath:archive,archiveSha256:'1325e424664f8c0f517c0aa155e3806ca299785ccca4e1badc9fe4f3f4173e09',archiveBytes:(await stat(archive)).size,vintage:'2026',stateFips:'13',layer:'place',geoid:'1323872',referencePoint:[-82.8543346,31.5061136]});
    assert.equal(candidate.status,'candidate');
    const service=new TownGeometryService(db);
    await service.upsertTown({communityId:id,name:'Synthetic town',slug:null,administrativeArea:'GA',eligible:true});
    // Test-only manual installation: candidate status does not grant real-world identity approval.
    assert.equal(await service.setBoundary(id,{geometry:candidate.geometry,source:candidate.sourceReference,vintage:candidate.vintage,rights:'Census source; test only'}),'ready');
    assert.deepEqual(await service.validateTownPoint(id,-82.8543346,31.5061136),{status:'ready',covers:true});
    await service.withdrawTown(id);
    assert.deepEqual(await service.validateTownPoint(id,-82.8543346,31.5061136),{status:'ineligible'});
  } finally {
    if(db.isInitialized){await db.query('DELETE FROM directory_town_geometry WHERE "communityId"=$1',[id]);await db.query('DELETE FROM directory_town WHERE "communityId"=$1',[id]);await db.destroy();}
    connection.closeSync();duck.closeSync();
  }
});
