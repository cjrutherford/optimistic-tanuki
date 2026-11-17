/** Local-only October cutover; invoked explicitly after every pinned asset completes. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const {DataSource}=require('typeorm');
const {OVERTURE_RIGHTS_FIELDS_LEGACY_V1}=require('../apps/directory/src/overture-rights');
const {copySourceEvidence}=require('../apps/directory/src/source-evidence-store');
const {carryAllowsRevoke}=require('../apps/directory/src/business-identity-carry');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const geometryHash=geometry=>`sha256:${hash(JSON.stringify(geometry))}`;
const geometries={douglas:'sha256:eff0af2eb6ce36fa389842de6d5d679c0253d073a5af44c02d6402ee6d600c99',tifton:'sha256:ed9c1b4f11db4d9d8c65d36a785dbeb1d161f82208660e771283c6918513aa6d',valdosta:'sha256:3dc105a4006ad14b146db2122d65fe8e464388b07850be586a2f24a6708fa88e',waycross:'sha256:21646e863343da4c07f6d8e372bb7f85f88b866a359a07fd6b7e3bf71c74e588'};
const duplicateKey=(town,listing)=>JSON.stringify([town,listing.name.trim().toLowerCase(),listing.location.coordinates]);

async function main(){
 const mode=process.argv.slice(2).join(' ');
 if(process.env.DIRECTORY_LOCAL_EVALUATION!=='true'||!['--apply-local','--inspect-local'].includes(mode))throw Error('Explicit local cutover required');
 const socialUrl=new URL(process.env.LOCAL_SOCIAL_DATABASE_URL||''),liveUrl=new URL(process.env.LOCAL_DIRECTORY_DATABASE_URL||''),stageUrl=new URL(process.env.LOCAL_STAGE_DATABASE_URL||'');
 if([socialUrl,liveUrl,stageUrl].some(u=>u.hostname!=='127.0.0.1'||!u.port)||socialUrl.pathname!=='/ot_social'||liveUrl.pathname!=='/ot_directory'||stageUrl.pathname!=='/ot_directory_october_stage'||liveUrl.port!==stageUrl.port)throw Error('Refusing non-local databases');
 const inventory=JSON.parse(fs.readFileSync('docs/plans/town-square-directory/S4a1-overture-2026-10-21-metadata.json','utf8'));
 if(inventory.release!=='2026-10-21.0'||inventory.items.length!==16||hash(JSON.stringify(inventory.items))!==inventory.inventorySha256)throw Error('Release inventory changed');
 const geo=JSON.parse(fs.readFileSync('/home/cjrutherford/workspace/business-directory-poc/data/generated/service-regions.geojson','utf8'));
 if(geo.type!=='FeatureCollection'||geo.features?.length!==4)throw Error('POC regions unavailable');
 const social=new DataSource({type:'postgres',url:socialUrl.href}),live=new DataSource({type:'postgres',url:liveUrl.href}),stage=new DataSource({type:'postgres',url:stageUrl.href});
 await social.initialize();await live.initialize();await stage.initialize();
 const sr=stage.createQueryRunner(),lr=live.createQueryRunner();
 try {
  const regions=[];for(const name of Object.keys(geometries)){const features=geo.features.filter(f=>f?.properties?.id===name);if(features.length!==1||geometryHash(features[0].geometry)!==geometries[name])throw Error('POC region checksum mismatch');const towns=await social.query(`SELECT id FROM community WHERE lower(city)=$1 AND "adminArea"='GA' AND "isPrivate"=false AND "appScope"='local-hub' AND "localityType" IN ('city','town')`,[name]);if(towns.length!==1)throw Error('Town unavailable or ambiguous');regions.push({id:towns[0].id,geometry:features[0].geometry});}
  const fields=[...OVERTURE_RIGHTS_FIELDS_LEGACY_V1],permissions=Object.fromEntries(['ingest','retain','privateDisplay'].map(op=>[op,fields]));
  const rights={releaseId:inventory.release,operations:{ingest:true,retain:true,privateDisplay:true},terms:['meta','Microsoft','BrightQuery','DAC'].map(dataset=>({dataset,license:'CDLA-Permissive-2.0',attribution:`${dataset}; Overture Maps Foundation (October 2026)`,termsUrl:'https://cdla.dev/permissive-2.0/',notice:'CDLA Permissive 2.0',permissions}))};
  const projection=hash(fs.readFileSync('apps/directory/src/overture-local-evaluation.ts'));
  const policyId=hash(JSON.stringify({rights,inventory:inventory.inventorySha256,scope:'local-evaluation-october-v1'}));
  const scans=inventory.items.map(item=>hash(JSON.stringify({version:5,mode:'remote',inventory:inventory.inventorySha256,item:item.id,asset:{release:inventory.release,object:item.asset,etag:item.etag,envelope:inventory.envelope,maxTransferBytes:1024*1024*1024},approval:policyId,projection,classifier:projection,regions})));
  if(new Set(scans).size!==16)throw Error('Scan identities are not unique');
  if(mode==='--inspect-local'){console.log(JSON.stringify({policyId,scans}));return;}
  const oldRights={releaseId:'2026-09-23.0',operations:{ingest:true,retain:true,privateDisplay:true},terms:['meta','Microsoft','BrightQuery','DAC'].map(dataset=>({dataset,license:'CDLA-Permissive-2.0',attribution:`${dataset}; Overture Maps Foundation (September 2026)`,termsUrl:'https://cdla.dev/permissive-2.0/',notice:'CDLA Permissive 2.0',permissions}))};
  const oldPolicy={...oldRights,terms:[...oldRights.terms,{dataset:'AllThePlaces',license:'CC0-1.0',attribution:'AllThePlaces; Overture Maps Foundation (September 2026)',termsUrl:'https://creativecommons.org/publicdomain/zero/1.0/',notice:'CC0 1.0',permissions}]};
  const previous=hash(JSON.stringify({policy:oldPolicy,classification:'local-low-risk-v4',artifactSha256:'72355d674966b9f84d4293be9420f6ced0d454247d005e739bac014de728237c'}));
  await sr.connect();await sr.startTransaction();
  const policies=await sr.query('SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR SHARE',[policyId]);
  if(policies.length!==1||policies[0].revoked)throw Error('October policy unavailable or revoked');
  const locks=await sr.query('SELECT "scanId" FROM directory_overture_private_scan_lock WHERE "scanId"=ANY($1::text[]) ORDER BY "scanId" FOR SHARE',[scans]);
  if(locks.length!==16)throw Error('October staging is incomplete');
  const completed=await sr.query('SELECT m."scanId" FROM directory_overture_private_membership m JOIN directory_overture_private_completion c USING ("scanId") WHERE m."policyId"=$1 AND m."scanId"=ANY($2::text[]) AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=m."scanId")',[policyId,scans]);
  if(completed.length!==16)throw Error('October staging is incomplete or revoked');
  const rows=await sr.query('SELECT r."scanId",r."sourceFileRowNumber",r."regionId",r.listing FROM directory_overture_private_row r WHERE r."scanId"=ANY($1::text[]) AND r."regionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber") ORDER BY r."scanId",r."sourceFileRowNumber"',[scans]);
  if(!rows.length)throw Error('October staging has no eligible listings');
  await lr.connect();await lr.startTransaction();
  const old=await lr.query('SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',[previous]);
  if(old.length!==1)throw Error('Existing local cohort unavailable');
  // Two phases, one command: the first run imports the cohort (rows, source keys, evidence) and revokes the previous
  // policy only if business identity carry is already complete (or the cohort has no keys). The run after the
  // carry finds the cohort imported and performs only the revoke. Nothing is revoked while a carry is pending.
  const already=(await lr.query('SELECT 1 FROM directory_overture_private_membership WHERE "scanId"=ANY($1::text[]) LIMIT 1',[scans])).length>0;
  let imported=0,omitted=0;
  if(!already){
  if(old[0].revoked)throw Error('Existing local cohort unavailable');
  const existing=await lr.query('SELECT r."regionId",r.listing FROM directory_overture_private_row r JOIN directory_overture_private_membership m USING ("scanId") JOIN directory_overture_private_policy p USING ("policyId") JOIN directory_overture_private_completion c USING ("scanId") WHERE m."policyId"<>$1 AND NOT p.revoked AND r."regionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId") AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")',[previous]);
  const seen=new Set(existing.map(r=>duplicateKey(r.regionId,r.listing))),selected=[];
  for(const row of rows){if(!regions.some(r=>r.id===row.regionId)||typeof row.listing?.name!=='string'||!Array.isArray(row.listing?.location?.coordinates))throw Error('Invalid staged listing');const key=duplicateKey(row.regionId,row.listing);if(!seen.has(key)){seen.add(key);selected.push(row)}}
  if(!selected.length)throw Error('No distinct October listings');
  if(regions.some(region=>!selected.some(row=>row.regionId===region.id)&&!existing.some(row=>row.regionId===region.id)))throw Error('October cutover would leave a town empty');
  await lr.query('INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1) ON CONFLICT DO NOTHING',[policyId]);
  const target=await lr.query('SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1 FOR UPDATE',[policyId]);if(target.length!==1||target[0].revoked)throw Error('October target policy revoked');
  for(const scan of scans){await lr.query('INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',[scan]);await lr.query('INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',[scan,policyId]);}
  for(let i=0;i<selected.length;i+=250)await lr.query(`INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) SELECT x."scanId",x."sourceFileRowNumber",x."regionId",x.listing FROM jsonb_to_recordset($1::jsonb) AS x("scanId" text,"sourceFileRowNumber" bigint,"regionId" text,listing jsonb)`,[JSON.stringify(selected.slice(i,i+250))]);
  for(const scan of scans)await lr.query('INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',[scan]);
  const evidence=await copySourceEvidence(sr,lr,scans);
  console.log(`Source evidence: ${evidence.copied.length} copied, ${evidence.rejected.length} failed verification (left unknown), ${evidence.absent.length} absent (unknown).`);
  const keyTable=async db=>(await db.query("SELECT to_regclass('directory_overture_source_key') AS t"))[0].t;
  if(await keyTable(sr)&&await keyTable(lr)){
   const kept=new Set(selected.map(r=>`${r.scanId}:${r.sourceFileRowNumber}`));
   const keys=(await sr.query('SELECT "scanId","sourceFileRowNumber","upstreamKeyHash","keyVersion" FROM directory_overture_source_key WHERE "scanId"=ANY($1::text[])',[scans])).filter(k=>kept.has(`${k.scanId}:${k.sourceFileRowNumber}`));
   for(let i=0;i<keys.length;i+=1000)await lr.query('INSERT INTO directory_overture_source_key ("scanId","sourceFileRowNumber","upstreamKeyHash","keyVersion") SELECT x."scanId",x."sourceFileRowNumber",x."upstreamKeyHash",x."keyVersion" FROM jsonb_to_recordset($1::jsonb) AS x("scanId" text,"sourceFileRowNumber" bigint,"upstreamKeyHash" text,"keyVersion" int)',[JSON.stringify(keys.slice(i,i+1000))]);
   console.log(`Source keys: ${keys.length} copied (keyed cohort rows only; keyless rows stay origin-only).`);
  }
  imported=selected.length;omitted=rows.length-selected.length;
  }
  if(!old[0].revoked){
   const gate=await carryAllowsRevoke(lr,previous,policyId);
   if(gate.ok){await lr.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',[previous]);console.log('Previous policy revoked.');}
   else if(!already)console.log(`Previous policy NOT revoked: ${gate.reason}. Run the carry (--check, then --apply), then run this command again to revoke.`);
   else throw Error(gate.reason);
  } else console.log('Previous policy was already revoked.');
  await lr.commitTransaction();await sr.commitTransaction();
  console.log(`October local cutover step completed: ${imported} listings imported; ${omitted} exact duplicates omitted.`);
 }finally{if(lr.isTransactionActive)await lr.rollbackTransaction();if(sr.isTransactionActive)await sr.rollbackTransaction();await lr.release();await sr.release();await stage.destroy();await live.destroy();await social.destroy();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
