const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAcknowledgedReceipt } = require('../src/social-delivery');

test('accepts deletion and idempotent retries, and rejects ambiguous acknowledgements', () => {
  for (const result of ['deleted', 'already-absent'])
    assert.doesNotThrow(() =>
      requireAcknowledgedReceipt({ acknowledged: true, result })
    );
  for (const ack of [
    null,
    {},
    { acknowledged: true },
    { acknowledged: false, result: 'deleted' },
    { acknowledged: true, result: 'unknown' },
  ]) {
    assert.throws(() => requireAcknowledgedReceipt(ack));
  }
});
