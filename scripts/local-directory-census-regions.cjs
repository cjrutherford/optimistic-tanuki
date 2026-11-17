/** Prepare unverified, identity-bound Census regions for local evaluation. */
const fs=require('node:fs');const crypto=require('node:crypto');const {DataSource}=require('typeorm');
const {pendingRuntimeConfig}=require('../apps/directory/src/register-pending-runtime');
const {geographyHash}=require('../apps/directory/src/boundary-review');
const {RegisterDeliveryV2}=require('../apps/directory-worker/src/register-delivery');
const states={'01':'AL','09':'CT','10':'DE','11':'DC','12':'FL','13':'GA','24':'MD','25':'MA','34':'NJ','36':'NY','37':'NC','42':'PA','44':'RI','45':'SC','48':'TX','51':'VA','54':'WV'};
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
async function main(){
 if(process.env.DIRECTORY_LOCAL_EVALUATION!=='true'||process.argv.slice(2).join(' ')!=='--prepare-local')throw Error('Explicit local preparation required');
 const config=pendingRuntimeConfig(process.env),url=new URL(config.databaseUrl),socialUrl=new URL(process.env.LOCAL_SOCIAL_DATABASE_URL||'');
 if(url.hostname!=='127.0.0.1'||url.pathname!=='/ot_directory'||!url.port||config.host!=='127.0.0.1'||socialUrl.hostname!=='127.0.0.1'||socialUrl.pathname!=='/ot_social'||!socialUrl.port)throw Error('Refusing non-local services');
 const db=new DataSource({type:'postgres',url:url.href}),social=new DataSource({type:'postgres',url:socialUrl.href}),delivery=new RegisterDeliveryV2(config.host,config.port,config.secret);
 const {DuckDBInstance}=await import('@duckdb/node-api'),{readCensusBoundaryCandidate}=await import('./census-boundary-reader.mjs');let duck,connection;
 try{await db.initialize();await social.initialize();duck=await DuckDBInstance.create(':memory:');connection=await duck.connect();await connection.run('LOAD spatial');
  const poc=await social.query(`SELECT id FROM community WHERE lower(city) IN ('douglas','tifton','valdosta','waycross') AND "adminArea"='GA' AND "isPrivate"=false AND "appScope"='local-hub' AND "localityType" IN ('city','town')`);if(poc.length!==4)throw Error('POC town identity unavailable');const excluded=new Set(poc.map(x=>x.id));
  const candidates=await db.query('SELECT * FROM directory_boundary_candidate WHERE "sourceEpoch"=$1 AND "activationId"=$2 AND "socialGeneration"=$3 ORDER BY "communityId"',[config.identity.sourceEpoch,config.identity.activationId,config.identity.socialGeneration]);
  const regions=[];let stale=0,checked=0;
  for(const c of candidates){if(excluded.has(c.communityId))continue;const state=states[c.stateFips];if(!state || c.vintage!=='2026'||!['place','cousub'].includes(c.layer)){stale++;continue;}
   if(++checked%20===0)console.log(`Checked ${checked} Census candidates.`);
   const before=await delivery.geography(config.identity,c.communityId),g=before?.geography;
   if(before?.status!=='current'||before.changeToken!==c.changeToken||geographyHash(g,c.communityId)!==c.geographyHash){stale++;continue;}
   const path=state==='GA'?(c.layer==='place'?'/tmp/town-census-2026-ga.zip':'/tmp/town-census-2026-ga-cousub.zip'):`/tmp/town-census-2026-states/${state}-${c.layer}.zip`;
   const boundary=await readCensusBoundaryCandidate({connection,archivePath:path,archiveSha256:c.archiveSha256,archiveBytes:fs.statSync(path).size,vintage:c.vintage,stateFips:c.stateFips,layer:c.layer,geoid:c.geoid,referencePoint:g.referencePoint});
   const after=await delivery.geography(config.identity,c.communityId);
   if(after?.status!=='current'||after.changeToken!==c.changeToken||geographyHash(after.geography,c.communityId)!==c.geographyHash||boundary.name.trim().toLowerCase()!==g.city.trim().toLowerCase()){stale++;continue;}
   regions.push({id:c.communityId,geometry:boundary.geometry,assignmentChangeToken:c.changeToken});
  }
  if(!regions.length)throw Error('No current Census matches');
  const payload={version:1,sourceEpoch:config.identity.sourceEpoch,activationId:config.identity.activationId,socialGeneration:config.identity.socialGeneration,regions};
  const output={...payload,sha256:digest(JSON.stringify(payload))};fs.writeFileSync('.agent/local-census-regions.json',JSON.stringify(output),{mode:0o600});
  console.log(`Prepared ${regions.length} unverified local assignments; ${stale} stale or unsupported candidates remain pending.`);
 }finally{connection?.closeSync();duck?.closeSync();delivery.close();if(db.isInitialized)await db.destroy();if(social.isInitialized)await social.destroy();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
