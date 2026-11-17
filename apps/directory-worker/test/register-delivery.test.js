const test = require('node:test');
const assert = require('node:assert/strict');
const { registerPage, RegisterDeliveryV2 } = require('../src/register-delivery');
const { of } = require('rxjs');
const uuid = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
test('bounded page advances only after all identities apply', async () => {
  const rows = [1,2].map(n => ({communityId:uuid(n),changeToken:uuid(n+10),operation:'changed'}));
  const seen = [];
  assert.equal(await registerPage({scan:async () => rows},uuid(9),null,2,async r => seen.push(r.communityId)),uuid(2));
  assert.deepEqual(seen,[uuid(1),uuid(2)]);
  await assert.rejects(registerPage({scan:async () => rows},uuid(9),null,2,async () => {throw Error('retry');}),/retry/);
});
test('invalid ordering is rejected before applying any row', async () => {
  let applied = false;
  const row = {communityId:uuid(1),changeToken:uuid(2),operation:'deleted'};
  await assert.rejects(registerPage({scan:async () => [row,row]},uuid(9),null,2,async () => {applied = true;}),/Invalid register page/);
  assert.equal(applied,false);
});
test('census and repair use distinct credentials and source incarnation', async () => {
  const readSecret='r'.repeat(32), repairSecret='p'.repeat(32);
  assert.throws(()=>new RegisterDeliveryV2('127.0.0.1',3003,readSecret,readSecret),/repair/);
  const client=new RegisterDeliveryV2('127.0.0.1',3003,readSecret,repairSecret);
  const calls=[];
  client.client={send:(pattern,data)=>{calls.push({pattern,data}); return of(pattern.cmd==='DIRECTORY_SOURCE_CENSUS_V2' ? [] : {status:'repaired'});},close:()=>{}};
  const identity={sourceEpoch:uuid(1),activationId:uuid(2),socialGeneration:'1'};
  assert.deepEqual(await client.census(identity,null,10),[]);
  assert.deepEqual(await client.repair(identity,uuid(3)),{status:'repaired'});
  assert.deepEqual(calls.map(call=>call.pattern.cmd),['DIRECTORY_SOURCE_CENSUS_V2','DIRECTORY_SOURCE_REPAIR_V2']);
  assert.deepEqual(calls.map(call=>call.data.secret),[readSecret,repairSecret]);
  assert.deepEqual(calls.map(call=>call.data.identity),[identity,identity]);
  client.close();
});
