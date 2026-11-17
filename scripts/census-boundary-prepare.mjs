import { createRequire } from 'node:module';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { discoverPrivateTownBoundary } from './census-boundary-social.mjs';

const require=createRequire(import.meta.url);
const { DataSource }=require('typeorm');
const { pendingRuntimeConfig }=require('../apps/directory/src/register-pending-runtime.ts');
const { RegisterDeliveryV2 }=require('../apps/directory-worker/src/register-delivery.ts');
const { storeDiscoveredBoundaryCandidate }=require('../apps/directory-worker/src/boundary-review.ts');
const need=key=>{const value=process.env[key];if(!value)throw Error(`Missing ${key}`);return value;};

async function main() {
  const communityId=process.argv[2];
  if(process.argv.length!==3 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(communityId || '')) throw Error('Supply one canonical community UUID');
  const config=pendingRuntimeConfig(process.env), vintage=need('DIRECTORY_CENSUS_VINTAGE');
  if(!/^\d{4}$/.test(vintage))throw Error('Invalid Census vintage');
  const archives=await Promise.all(['place','cousub'].map(async layer=>{
    const prefix=`DIRECTORY_CENSUS_${layer.toUpperCase()}`, archivePath=resolve(need(`${prefix}_PATH`)), archiveSha256=need(`${prefix}_SHA256`);
    if(!/^[a-f0-9]{64}$/.test(archiveSha256))throw Error('Invalid archive fingerprint');
    return {layer,archivePath,archiveSha256,archiveBytes:(await stat(archivePath)).size};
  }));
  const db=new DataSource({type:'postgres',url:config.databaseUrl,extra:{connectionTimeoutMillis:2000,statement_timeout:10000}});
  const delivery=new RegisterDeliveryV2(config.host,config.port,config.secret);
  let duck,connection;
  try {
    await db.initialize();duck=await DuckDBInstance.create(':memory:');connection=await duck.connect();
    await connection.run('SET autoinstall_known_extensions=false');await connection.run('SET autoload_known_extensions=false');await connection.run('LOAD spatial');
    const result=await discoverPrivateTownBoundary({delivery,identity:config.identity,communityId,archives,vintage,connection});
    if(result.status!=='candidate') {console.log(`No single candidate: ${result.status}. Boundary remains pending.`);return;}
    await storeDiscoveredBoundaryCandidate(db,config.identity,result,delivery);
    console.log('Candidate stored for private review. No boundary was verified or published.');
  } finally {connection?.closeSync();duck?.closeSync();delivery.close();if(db.isInitialized)await db.destroy();}
}
main().catch(()=>{console.error('Boundary preparation failed. Check the configured authority, staged archives and Social availability.');process.exitCode=1;});
