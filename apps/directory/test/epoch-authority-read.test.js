const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readRecoveryEpochs } = require('../src/recovery-authority');
const sourceEpoch = '11111111-1111-4111-8111-111111111111';
const recoveryEpoch = '22222222-2222-4222-8222-222222222222';
const owner = '33333333-3333-4333-8333-333333333333';
test('only a consistent blocked durable authority supplies epochs', async () => {
  const row = { sourceEpoch, recoveryEpoch, authorityEpoch: recoveryEpoch, owner, activationId: '44444444-4444-4444-8444-444444444444', socialGeneration: '1', directoryGeneration: '1', protocol: 'legacy', phase: 'blocked', cursor: null };
  const db = { query: async () => [row] };
  assert.deepEqual(await readRecoveryEpochs(db), { sourceEpoch, recoveryEpoch });
  for (const patch of [{ authorityEpoch: sourceEpoch }, { protocol: 'register-pending-v1' }, { sourceEpoch: null }, { phase: 'complete' }, { cursor: sourceEpoch }, { owner: null }, { activationId: null }, { socialGeneration: null }, { directoryGeneration: '0' }]) {
    await assert.rejects(readRecoveryEpochs({ query: async () => [{ ...row, ...patch }] }));
  }
  await assert.rejects(readRecoveryEpochs({ query: async () => [] }));
});
