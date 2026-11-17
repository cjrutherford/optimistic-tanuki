const test = require('node:test');
const assert = require('node:assert/strict');
const { signReceiptV2 } = require('../src/receipt-v2-identity');
const { createReceiptServer } = require('../src/receipt-server');
const service = 's'.repeat(32), signing = 'r'.repeat(32), social = 'c'.repeat(32);
const id = '00000000-0000-4000-8000-000000000001';
const epoch = '11111111-1111-4111-8111-111111111111', nonce = '22222222-2222-4222-8222-222222222222', recovery = '33333333-3333-4333-8333-333333333333';
const identity = { revision: '1', communityId: id, eventNonce: nonce, sourceEpoch: epoch, recoveryEpoch: recovery };
const send = (port, secret = service) => fetch(`http://127.0.0.1:${port}/internal/receipts`, { method: 'POST', headers: { authorization: `Bearer ${secret}` }, body: JSON.stringify(identity) });
test('requires distinct configured secrets', () => {
  assert.throws(() => createReceiptServer({}, {}, service, '', social));
  assert.throws(() => createReceiptServer({}, {}, service, social, social));
});
test('authenticates and issues only after committed receipt is visible', async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const commit = new Promise(resolve => { release = resolve; });
  let applied = 0, committed = false;
  const query = async sql => sql.includes('directory_census_progress') ? [{ sourceEpoch: epoch, recoveryEpoch: recovery, authorityEpoch: recovery, owner: nonce, activationId: id, socialGeneration: '1', directoryGeneration: '1', phase: 'blocked', cursor: null }] : committed ? [{}] : [];
  const server = createReceiptServer({ query, transaction: async fn => fn({ query }) }, { apply: async () => { applied++; entered(); await commit; committed = true; } }, service, signing, social);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal((await send(port, 'forged')).status, 403);
    assert.equal(applied, 0);
    let finished = false;
    const pending = send(port).then(r => { finished = true; return r; });
    await started;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(finished, false);
    release();
    const response = await pending;
    assert.equal(response.status, 200);
    const receipt = await response.json();
    assert.equal(receipt.attestation, signReceiptV2(signing, identity));
  } finally { server.close(); }
});
test('fails closed on missing committed receipt or database error', async () => {
  for (const query of [async () => [], async () => { throw Error('outage'); }]) {
    const server = createReceiptServer({ query }, { apply: async () => {} }, service, signing, social);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try { assert.equal((await send(server.address().port)).status, 503); } finally { server.close(); }
  }
});
