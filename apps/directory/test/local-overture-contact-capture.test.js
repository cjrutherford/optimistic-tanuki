const test = require('node:test');
const assert = require('node:assert/strict');
const { composeAddress } = require('../../../scripts/local-directory-overture-contact-capture.cjs');

test('composed address does not duplicate locality already at end of freeform', () => {
  assert.equal(
    composeAddress({
      freeform: '123 Main St, Dripping Springs',
      locality: 'Dripping Springs',
      region: 'TX',
    }),
    '123 Main St, Dripping Springs, TX',
  );
  assert.equal(
    composeAddress({
      freeform: '123 Main St',
      locality: 'Dripping Springs',
      region: 'TX',
    }),
    '123 Main St, Dripping Springs, TX',
  );
});
