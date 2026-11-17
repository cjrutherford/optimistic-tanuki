const test = require('node:test');
const assert = require('node:assert/strict');
const { projectPrivateOverture, createPrivateOvertureProjector } = require('../src/overture-private-projection');
const { OVERTURE_RIGHTS_FIELDS } = require('../src/overture-rights');
const grants=Object.fromEntries(['ingest','retain','privateDisplay'].map(op=>[op,Object.keys(OVERTURE_RIGHTS_FIELDS)]));
const policy = { releaseId:'2026-10-21.0', operations:{ingest:true,retain:true,privateDisplay:true}, terms:[{dataset:'Example',license:'Example',attribution:'Example attribution',termsUrl:'https://example.test/terms',notice:'Example notice',permissions:grants}] };
const row = () => ({releaseId:policy.releaseId,sources:[{property:'',dataset:'Example',license:'Example'}],names:{primary:'Fixture Bakery'},basic_category:'bakery',geometry:{type:'Point',coordinates:[-83,31]},phones:['555'],email:'no@example.test',taxonomy:{primary:'bakery',hierarchy:['shop']}});
const classification = { residential:false, sensitive:false, adult:false };
test('projects a private minimal listing after all three rights decisions allow it', () => {
  const result = projectPrivateOverture(row(),classification,policy);
  assert.equal(result.status,'eligible');
  assert.equal(result.listing.name,'Fixture Bakery');
  assert.equal(result.listing.phone,undefined);
  assert.equal(result.listing.email,undefined);
  assert.deepEqual(result.listing.attribution,['Example attribution']);
  assert.deepEqual(result.listing.notices,['Example notice']);
  assert.deepEqual(result.listing.termsUrls,['https://example.test/terms']);
});
test('quarantines missing, unapproved, sensitive or ambiguous inputs', () => {
  for (const c of [undefined,{...classification,residential:true},{...classification,sensitive:true},{...classification,adult:true}, {...classification,adult:undefined}]) assert.equal(projectPrivateOverture(row(),c,policy).status,'quarantined');
  assert.equal(projectPrivateOverture(row(),classification,{...policy,operations:{ingest:true}}).status,'quarantined');
  const malformed=row(); malformed.geometry.coordinates=[181,31]; assert.equal(projectPrivateOverture(malformed,classification,policy).status,'quarantined');
  const sparse=row(); delete sparse.geometry.coordinates[0]; assert.equal(projectPrivateOverture(sparse,classification,policy).status,'quarantined');
  const unknown=row(); unknown.sources.push({property:'/geometry',dataset:'Unknown',license:'Unknown'}); assert.equal(projectPrivateOverture(unknown,classification,policy).status,'quarantined');
});
test('allows adult listing only after explicit opt-in', () => {
  assert.equal(projectPrivateOverture(row(),{...classification,adult:true,adultOptIn:true},policy).status,'eligible');
});
test('extractor adapter evaluates the exact selected release and classifier result', async () => {
  const project = createPrivateOvertureProjector(policy.releaseId, policy, async () => classification);
  assert.equal((await project({source:row(),regionId:'town'})).status,'eligible');
  assert.equal((await createPrivateOvertureProjector(policy.releaseId, policy, async () => undefined)({source:row(),regionId:'town'})).status,'quarantined');
  assert.throws(() => createPrivateOvertureProjector('other-release',policy,async () => classification));
});
test('captures rights policy before asynchronous classification', async () => {
  const mutable = structuredClone({...policy,operations:{ingest:false,retain:true,privateDisplay:true}});
  let unblock; const pending = new Promise(resolve => {unblock=resolve});
  const project = createPrivateOvertureProjector(policy.releaseId,mutable,async () => {await pending;return classification});
  const result = project({source:row(),regionId:'town'}); mutable.operations.ingest=true; unblock();
  assert.equal((await result).status,'quarantined');
});
test('classification cannot change the source fields selected for projection', async () => {
  const source=row();
  const project=createPrivateOvertureProjector(policy.releaseId,policy,async input => {input.names.primary='Modified'; return classification});
  const result=await project({source,regionId:'town'});
  assert.equal(result.listing.name,'Fixture Bakery'); assert.equal(source.names.primary,'Fixture Bakery');
});
test('requires own explicit classification and dense taxonomy', () => {
  for (const key of ['residential','sensitive','adult']) {
    const c={...classification}; delete c[key]; Object.setPrototypeOf(c,{[key]:false});
    assert.equal(projectPrivateOverture(row(),c,policy).status,'quarantined');
  }
  const c={...classification,adult:true}; Object.setPrototypeOf(c,{adultOptIn:true});
  assert.equal(projectPrivateOverture(row(),c,policy).status,'quarantined');
  const r=row(); r.taxonomy.hierarchy.length=2;
  assert.equal(projectPrivateOverture(r,classification,policy).status,'quarantined');
});
test('the upstream id travels beside the listing only when the policy approves ingest and retain of it', () => {
  const withId = {...row(),id:'gers-fixture-1'};
  const approved = projectPrivateOverture(withId,classification,policy);
  assert.equal(approved.upstreamId,'gers-fixture-1');
  assert.ok(!JSON.stringify(approved.listing).includes('gers-fixture-1'));
  const without = fields => ({...policy,terms:[{...policy.terms[0],permissions:Object.fromEntries(['ingest','retain','privateDisplay'].map(op=>[op,fields(op)]))}]});
  const noRetain = projectPrivateOverture(withId,classification,without(op=>Object.keys(OVERTURE_RIGHTS_FIELDS).filter(f=>f!=='id'||op!=='retain')));
  assert.equal(noRetain.status,'eligible');
  assert.equal(noRetain.upstreamId,undefined);
  const noIngest = projectPrivateOverture(withId,classification,without(op=>Object.keys(OVERTURE_RIGHTS_FIELDS).filter(f=>f!=='id'||op!=='ingest')));
  assert.equal(noIngest.upstreamId,undefined);
  assert.equal(projectPrivateOverture(row(),classification,policy).upstreamId,undefined);
  assert.equal(projectPrivateOverture({...row(),id:42},classification,policy).upstreamId,undefined);
});
