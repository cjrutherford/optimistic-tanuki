const { test } = require('node:test');
const assert = require('node:assert/strict');
const { signReceiptV2 } = require('../src/receipt-v2-identity');
const identity = {
  revision: '12',
  communityId: '11111111-1111-4111-8111-111111111111',
  eventNonce: '22222222-2222-4222-8222-222222222222',
  sourceEpoch: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  recoveryEpoch: '44444444-4444-4444-8444-444444444444',
};
test('v2 attestation binds every canonical identity field and rejects legacy identities', () => {
  const secret = 's'.repeat(32);
  const signature = signReceiptV2(secret, identity);
  assert.equal(
    signature,
    '2e38bdeedc17038ca47d0623892b87abdece5921f398e9111ffd5e40e56d9017'
  );
  assert.match(signature, /^[0-9a-f]{64}$/);
  for (const [key, value] of Object.entries({
    revision: '13',
    communityId: identity.eventNonce,
    eventNonce: identity.communityId,
    sourceEpoch: identity.recoveryEpoch,
    recoveryEpoch: identity.sourceEpoch,
  }))
    assert.notEqual(
      signReceiptV2(secret, { ...identity, [key]: value }),
      signature
    );
  for (const bad of [
    { ...identity, eventNonce: undefined },
    { ...identity, revision: '012' },
    { ...identity, sourceEpoch: identity.sourceEpoch.toUpperCase() },
  ])
    assert.throws(() => signReceiptV2(secret, bad));
  assert.throws(() => signReceiptV2('short', identity));
});
