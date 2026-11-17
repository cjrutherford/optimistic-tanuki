const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reconcileRegisterV2 } = require('../src/register-reconciliation-v2');
const sourceEpoch = '11111111-1111-4111-8111-111111111111',
  recoveryEpoch = '22222222-2222-4222-8222-222222222222',
  owner = '33333333-3333-4333-8333-333333333333',
  activationId = '44444444-4444-4444-8444-444444444444',
  communityId = '55555555-5555-4555-8555-555555555555',
  changeToken = '66666666-6666-4666-8666-666666666666';
const identity = {
  sourceEpoch,
  recoveryEpoch,
  owner,
  activationId,
  socialGeneration: '1',
  directoryGeneration: '1',
};
const authority = {
  ...identity,
  authorityEpoch: recoveryEpoch,
  protocol: 'register-pending-v1',
  phase: 'reg-source',
};
function fixture(row = authority) {
  const queries = [];
  return {
    queries,
    db: {
      transaction: (fn) =>
        fn({
          query: async (sql, args) => {
            queries.push([sql, args]);
            return sql.includes('FROM directory_census_progress') ? [row] : [];
          },
        }),
    },
  };
}
test('requires full current pending authority before an exact Social read', async () => {
  const f = fixture();
  let called = 0;
  const result = await reconcileRegisterV2(
    f.db,
    identity,
    communityId,
    changeToken,
    async () => {
      called++;
      return { status: 'superseded' };
    }
  );
  assert.equal(result, 'superseded');
  assert.equal(called, 1);
  assert.equal(f.queries.length, 5);
  for (const change of [
    { owner: communityId },
    { phase: 'blocked' },
    { authorityEpoch: communityId },
    { protocol: 'legacy' },
  ]) {
    const g = fixture({ ...authority, ...change });
    await assert.rejects(
      reconcileRegisterV2(
        g.db,
        identity,
        communityId,
        changeToken,
        async () => {
          throw Error('unexpected');
        }
      )
    );
  }
});
test('writes pending blocked work or scrubs an authoritative withdrawal', async () => {
  const f = fixture();
  await reconcileRegisterV2(
    f.db,
    identity,
    communityId,
    changeToken,
    async () => ({
      status: 'current',
      snapshot: {
        id: communityId,
        name: 'Town',
        slug: null,
        adminArea: null,
        appScope: 'local-hub',
        isPrivate: false,
        localityType: 'town',
      },
    })
  );
  assert.ok(
    f.queries.some(([q]) => q.includes('INSERT INTO directory_provider_work'))
  );
  const g = fixture();
  await reconcileRegisterV2(
    g.db,
    identity,
    communityId,
    changeToken,
    async () => ({ status: 'current', snapshot: null })
  );
  assert.ok(g.queries.some(([q]) => q.includes("name=''")));
  assert.ok(
    g.queries.some(([q]) => q.includes('DELETE FROM directory_provider_work'))
  );
});
