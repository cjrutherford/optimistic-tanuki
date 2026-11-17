const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileRegister } = require('../src/register-reconciliation');
const id = { sourceEpoch:'00000000-0000-0000-0000-000000000001', recoveryEpoch:'00000000-0000-0000-0000-000000000002', communityId:'00000000-0000-0000-0000-000000000003', changeToken:'00000000-0000-0000-0000-000000000004' };
function database() {
  const calls = [];
  return { calls, transaction: fn => fn({ query: async (sql, args) => {
    calls.push([sql,args]);
    if (sql.includes('FROM directory_census_progress')) return [{ ...id, owner:id.communityId, activationId:id.changeToken, phase:'blocked', cursor:null, socialGeneration:'1', directoryGeneration:'1', authorityEpoch:id.recoveryEpoch }];
    return [];
  } }) };
}
test('exact-token read follows both locks and writes only blocked work', async () => {
  const db = database();
  const result = await reconcileRegister(db, id, async got => {
    assert.deepEqual(got,id);
    assert.equal(db.calls.length,3);
    return { status:'current', snapshot:{ id:id.communityId, name:'Town', slug:null, adminArea:null, appScope:'local-hub', isPrivate:false, localityType:'town' } };
  });
  assert.equal(result,'applied');
  assert.match(db.calls[4][0], /'blocked'/);
});
test('superseded does not write; null cancels work', async () => {
  const db = database();
  assert.equal(await reconcileRegister(db,id,async () => ({status:'superseded'})), 'superseded');
  assert.equal(db.calls.length,3);
  await reconcileRegister(db,id,async () => ({status:'current',snapshot:null}));
  assert.match(db.calls.at(-1)[0], /DELETE FROM directory_provider_work/);
});
test('malformed or ineligible snapshot fails closed', async () => {
  const db = database();
  await assert.rejects(reconcileRegister(db,id,async () => ({status:'current',snapshot:{id:id.communityId,name:'x',slug:null,adminArea:null,appScope:'local-hub',isPrivate:true,localityType:'town'}})), /Invalid register snapshot/);
  assert.equal(db.calls.length,3);
});
