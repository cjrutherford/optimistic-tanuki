import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

const script=join(dirname(fileURLToPath(import.meta.url)),'overture-rights-inventory.mjs');
function fixture(bytes){const dir=mkdtempSync(join(tmpdir(),'overture-inventory-'));const path=join(dir,'fixture.jsonl');writeFileSync(path,bytes);return {dir,path};}

test('inventories actual sources metadata and hashes exact bytes without leaking records',()=>{
  const secret='PRIVATE BUSINESS NAME', unknown='unknown-private-dataset';
  const row={id:'sensitive-id',sourceFileRowNumber:1,assignedSeatId:'fixture-seat',names:{primary:secret},phones:['private phone'],websites:['https://private.example'],addresses:['private address'],basic_category:'retail',taxonomy:{primary:'shop',hierarchy:[],alternates:[]},geometry:{type:'Point'},assignedCategoryIds:[],assignedPlaceTypeId:'value',sources:[
    {property:'',dataset:'Foursquare',license:'Apache-2.0'},
    {property:'/properties/confidence',dataset:'Overture',license:'CDLA-Permissive-2.0'},
    {property:'/properties/operating_status',dataset:'Overture-signals',license:'CDLA-Permissive-2.0'},
    {property:'/other',dataset:unknown,license:'unknown-private-license'},null,
  ]};
  const input=Buffer.from(`${JSON.stringify(row)}\n${JSON.stringify({id:'other-private-id'})}\n`),{dir,path}=fixture(input);
  try {
    const stdout=execFileSync('node',[script,path],{encoding:'utf8'}),result=JSON.parse(stdout);
    assert.equal(result.sha256,createHash('sha256').update(input).digest('hex'));assert.equal(result.rowCount,2);
    assert.equal(result.rootPairOccurrences['Foursquare|Apache-2.0'],1);assert.equal(result.sourcePairOccurrences.other,2);
    assert.deepEqual(result.sourcePointerOccurrences,{root:1,confidence:1,operatingStatus:1,otherOrMalformed:2});
    assert.equal(result.recordsMissingSources,1);assert.equal(result.entriesMissingDatasetOrLicense,1);
    assert.equal(result.nonNullFieldPresence.id,2);
    for(const field of ['sourceFileRowNumber','assignedSeatId','names.primary','basic_category','taxonomy.primary','taxonomy.hierarchy','taxonomy.alternates','geometry','addresses','phones','websites','assignedCategoryIds','assignedPlaceTypeId']) assert.equal(result.nonNullFieldPresence[field],1);
    for(const value of [secret,'private phone','https://private.example','sensitive-id',unknown,'unknown-private-license','private address']) assert.equal(stdout.includes(value),false);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('rejects malformed JSON without echoing private input and rejects invalid arguments',()=>{
  const {dir,path}=fixture(Buffer.from('{"private":"SECRET_VALUE" broken}\n'));
  try {
    assert.throws(()=>execFileSync('node',[script,path],{encoding:'utf8',stdio:'pipe'}),error=>{assert.match(error.stderr.toString(),/Malformed JSONL at row 1/);assert.equal(error.stderr.toString().includes('SECRET_VALUE'),false);return true;});
    assert.throws(()=>execFileSync('node',[script],{encoding:'utf8',stdio:'pipe'}),error=>{assert.match(error.stderr.toString(),/Usage:/);return true;});
    assert.throws(()=>execFileSync('node',[script,path,path],{encoding:'utf8',stdio:'pipe'}),error=>{assert.match(error.stderr.toString(),/Usage:/);return true;});
  } finally {rmSync(dir,{recursive:true,force:true});}
});

test('rejects blank or oversized records rather than reporting partial coverage',()=>{
  for (const bytes of [Buffer.from('{}\n\n{}\n'),Buffer.alloc(4*1024*1024+1,0x20)]) {
    const {dir,path}=fixture(bytes);
    try { assert.throws(()=>execFileSync('node',[script,path],{encoding:'utf8',stdio:'pipe'})); }
    finally {rmSync(dir,{recursive:true,force:true});}
  }
});

test('draft policy cannot claim target or public authorization',()=>{
  const path=join(dirname(script),'..','docs','plans','town-square-directory','S4a1-overture-policy.draft.json');
  const policy=JSON.parse(readFileSync(path,'utf8'));
  assert.equal(policy.status,'draft-unapproved');assert.equal(policy.runtimeEnabled,false);
  assert.equal(policy.authority.reviewer.designation,'user');assert.equal(policy.authority.reviewer.decision,'pending');assert.equal(policy.authority.decisionDate,null);
  assert.equal(policy.defaultDecision,'unknown');assert.equal(policy.unknownEnforcement,'deny');
  assert.ok(Object.values(policy.currentTargetOperations).every(value=>value==='unknown'));
  assert.equal(policy.scope.newTargetImportAuthorized,false);assert.equal(policy.scope.publicReleaseAuthorized,false);
  assert.equal(policy.historicalPocPolicy.exportDecision,'deny');
  assert.equal(policy.artifacts.find(artifact=>artifact.id==='waycross-sample').decision,'unknown');
  assert.equal(policy.derivedLineage.find(field=>field.field==='assignedSeatId').decision,'unknown');
  assert.equal(policy.derivedLineage.find(field=>field.field==='assignedSeatId').historicalTransformIdentity,'unresolved');
  assert.deepEqual(policy.observedContributors.filter(source=>source.historicalPocMapping==='unmapped').map(source=>source.dataset).sort(),['PinMeTo','RenderSEO']);
  assert.equal(policy.observedContributors.reduce((total,source)=>total+(source.rootOccurrences || 0),0),20811);
});
