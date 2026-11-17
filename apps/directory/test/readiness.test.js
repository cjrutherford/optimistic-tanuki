const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkReadiness } = require('../src/readiness');

test('readiness requires postgres, postgis and redis', async () => {
  assert.equal(await checkReadiness(async () => true, async () => true, async () => true), true);
  for (let failed = 0; failed < 3; failed++) {
    const checks = [0, 1, 2].map((i) => async () => i !== failed);
    assert.equal(await checkReadiness(...checks), false);
  }
  assert.equal(await checkReadiness(async () => { throw Error('offline'); }, async () => true, async () => true), false);
});
