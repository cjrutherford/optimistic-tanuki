/** Publish completed Census-match staging to the local evaluation database. */
const fs=require('node:fs'),crypto=require('node:crypto');const {DataSource}=require('typeorm');
const {OVERTURE_RIGHTS_FIELDS_LEGACY_V1}=require('../apps/directory/src/overture-rights');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
async function main(){
 const mode=process.argv.slice(2).join(' ');if(process.env.DIRECTORY_LOCAL_EVALUATION!=='true'||!['--apply-local','--inspect-local'].includes(mode))throw Error('Explicit local append required');
 const liveUrl=new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL||''),stageUrl=new URL(process.env.LOCAL_STAGE_DATABASE_URL||'');
 if([liveUrl,stageUrl].some(u=>u.hostname!=='127.0.0.1'||!u.port)||liveUrl.port!==stageUrl.port||liveUrl.pathname!=='/ot_directory'||stageUrl.pathname!=='/ot_directory_census_stage')throw Error('Refusing non-local databases');
 const inventory=JSON.parse(fs.readFileSync('docs/plans/town-square-directory/S4a1-overture-2026-10-21-metadata.json','utf8'));
 if(inventory.release!=='2026-10-21.0'||inventory.items.length!==16||hash(JSON.stringify(inventory.items))!==inventory.inventorySha256)throw Error('Release inventory changed');inventory.envelope=[-180,-90,180,90];
 const raw=JSON.parse(fs.readFileSync('.agent/local-census-regions.json','utf8')),{sha256,...manifest}=raw;
 if(manifest.version!==1||hash(JSON.stringify(manifest))!==sha256||!Array.isArray(manifest.regions)||!manifest.regions.length||new Set(manifest.regions.map(r=>r.id)).size!==manifest.regions.length)throw Error('Assignment manifest changed');
 const fields=[...OVERTURE_RIGHTS_FIELDS_LEGACY_V1],permissions=Object.fromEntries(['ingest','retain','privateDisplay'].map(op=>[op,fields]));
 const rights={releaseId:inventory.release,operations:{ingest:true,retain:true,privateDisplay:true},terms:['meta','Microsoft','BrightQuery','DAC'].map(dataset=>({dataset,license:'CDLA-Permissive-2.0',attribution:`${dataset}; Overture Maps Foundation (October 2026)`,termsUrl:'https://cdla.dev/permissive-2.0/',notice:'CDLA Permissive 2.0',permissions}))};
 rights.terms.push({dataset:'AllThePlaces',license:'CC0-1.0',attribution:'AllThePlaces; Overture Maps Foundation (October 2026)',termsUrl:'https://creativecommons.org/publicdomain/zero/1.0/',notice:'CC0 1.0',permissions});
 const classifier=hash(fs.readFileSync('apps/directory/src/overture-local-evaluation.ts')),projection=hash(Buffer.concat([fs.readFileSync('apps/directory/src/overture-local-evaluation.ts'),fs.readFileSync('scripts/local-directory-overture-census-stage.cjs')]));
 const policyId=hash(JSON.stringify({rights,inventory:inventory.inventorySha256,assignments:sha256,scope:'local-evaluation-census-october-v1'}));
 const scans=inventory.items.map(item=>hash(JSON.stringify({version:6,mode:'remote',inventory:inventory.inventorySha256,item:item.id,asset:{release:inventory.release,object:item.asset,etag:item.etag,envelope:inventory.envelope,maxTransferBytes:1024*1024*1024},approval:policyId,projection,classifier,regions:manifest.regions})));
 if(new Set(scans).size!==16)throw Error('Scan identities are not unique');
 if(mode==='--inspect-local'){console.log(JSON.stringify({policyId,scans}));return;}
 const live=new DataSource({type:'postgres',url:liveUrl.href}),stage=new DataSource({type:'postgres',url:stageUrl.href});await live.initialize();await stage.initialize();const lr=live.createQueryRunner(),sr=stage.createQueryRunner();
 try{
  await sr.connect();await sr.startTransaction();const p=await sr.query('SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR SHARE',[policyId]);if(p.length!==1||p[0].revoked)throw Error('Staging policy unavailable');
  const locks=await sr.query('SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=ANY($1::text[]) ORDER BY "scanId" FOR SHARE',[scans]);if(locks.length!==16)throw Error('Additional-town staging is incomplete');
  const completed=await sr.query('SELECT m."scanId" FROM directory_overture_private_membership m JOIN directory_overture_private_completion c USING ("scanId") WHERE m."policyId"=$1 AND m."scanId"=ANY($2::text[]) AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=m."scanId")',[policyId,scans]);if(completed.length!==16)throw Error('Additional-town staging is incomplete or revoked');
  await lr.connect();await lr.startTransaction();
  const candidates=await lr.query('SELECT "communityId","changeToken" FROM directory_boundary_candidate WHERE "sourceEpoch"=$1 AND "activationId"=$2 AND "socialGeneration"=$3 FOR SHARE',[manifest.sourceEpoch,manifest.activationId,manifest.socialGeneration]);const candidateTokens=new Map(candidates.map(c=>[c.communityId,c.changeToken]));
  if(manifest.regions.some(r=>candidateTokens.get(r.id)!==r.assignmentChangeToken))throw Error('A town assignment changed; prepare the import again');
  if((await lr.query('SELECT 1 FROM directory_overture_private_membership WHERE "scanId"=ANY($1::text[]) LIMIT 1',[scans])).length)throw Error('Additional-town cohort already exists');
  await lr.query('INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',[policyId]);const target=await lr.query('SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',[policyId]);if(target.length!==1||target[0].revoked)throw Error('Target policy unavailable');
  for(const scan of scans){await lr.query('INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',[scan]);await lr.query('INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',[scan,policyId]);}
  const tokens=new Map(manifest.regions.map(r=>[r.id,r.assignmentChangeToken])),seen=new Set();let inserted=0,duplicates=0;
  for(const scan of scans){let last='-1';while(true){const rows=await sr.query('SELECT r."scanId",r."sourceFileRowNumber",r."regionId",r.listing FROM directory_overture_private_row r WHERE r."scanId"=$1 AND r."sourceFileRowNumber">$2 AND r."regionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber") ORDER BY r."sourceFileRowNumber" LIMIT 2000',[scan,last]);if(!rows.length)break;last=rows.at(-1).sourceFileRowNumber;const selected=[];
    for(const row of rows){const l=row.listing;if(tokens.get(row.regionId)!==l?.assignmentChangeToken||typeof l.name!=='string'||!Array.isArray(l.location?.coordinates))throw Error('Invalid staged assignment');const key=JSON.stringify([row.regionId,l.name.trim().toLowerCase(),l.location.coordinates]);if(seen.has(key)){duplicates++;continue}seen.add(key);selected.push(row)}
    if(selected.length){await lr.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) SELECT x."scanId",x."sourceFileRowNumber",x."regionId",x.listing FROM jsonb_to_recordset($1::jsonb) AS x("scanId" text,"sourceFileRowNumber" bigint,"regionId" text,listing jsonb)',[JSON.stringify(selected)]);inserted+=selected.length;}
   }await lr.query('INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',[scan]);console.log('Prepared one completed source file for local display.');}
  if(!inserted)throw Error('No additional listings');await lr.commitTransaction();await sr.commitTransaction();console.log(`Additional-town local import completed: ${inserted} listings; ${duplicates} exact duplicates omitted.`);
 }finally{if(lr.isTransactionActive)await lr.rollbackTransaction();if(sr.isTransactionActive)await sr.rollbackTransaction();await lr.release();await sr.release();await stage.destroy();await live.destroy()}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
