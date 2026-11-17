const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertRestoreProtocolAvailable } = require('../src/restore-fence');

test('legacy protocol cannot start Directory or its worker', () => {
  assert.throws(() => assertRestoreProtocolAvailable(), /restore fencing is not implemented/);
});
