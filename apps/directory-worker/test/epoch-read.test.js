const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SocialDelivery } = require('../src/social-delivery');
const epoch = '11111111-1111-4111-8111-111111111111';
test('epoch-bound reads send the expected durable source epoch', async () => {
  const client = Object.create(SocialDelivery.prototype);
  const calls = [];
  client.request = async (cmd, data) => { calls.push(data); return null; };
  await client.snapshot('id', epoch);
  await client.membership('1', 'id', epoch, epoch);
  await client.census(undefined, epoch);
  assert.deepEqual(calls.map(x => x.expectedSourceEpoch), [epoch, epoch, epoch]);
  assert.equal(calls[1].expectedEventNonce, epoch);
  await assert.rejects(client.snapshot('id', ''), /epoch/i);
  assert.equal(calls.length, 3);
});
