const test = require('node:test');
const assert = require('node:assert/strict');
const {
  autoResolveRule,
  AUTO_RULE_EXACT,
  AUTO_RULE_VARIANT,
} = require('../src/duplicate-auto');

// One thousandth of a degree of longitude at this latitude is about 95 m, so 0.00005 is about 5 m.
const at = (name, dataset, dLng = 0) => ({
  scanId: 's',
  row: '1',
  name,
  coordinates: [-83.5 + dLng, 31.25],
  sources: [{ dataset }],
});
const M5 = 0.00005;
const M20 = 0.0002;
const M50 = 0.0005;

test('the same name apart from apostrophes, punctuation and filler, within 25 m, is the same place', () => {
  assert.equal(
    autoResolveRule(
      at("Papa John's", 'meta'),
      at('Papa Johns', 'AllThePlaces', M20)
    ),
    AUTO_RULE_EXACT
  );
  assert.equal(
    autoResolveRule(
      at('Bubba Gump Shrimp Co.', 'meta'),
      at('Bubba Gump Shrimp Company', 'meta', M5)
    ),
    AUTO_RULE_EXACT
  );
});

test('a brand and its longer listing form, within 10 m, from different sources, is the same place', () => {
  assert.equal(
    autoResolveRule(
      at("Domino's", 'meta'),
      at("Domino's Pizza", 'AllThePlaces', M5)
    ),
    AUTO_RULE_VARIANT
  );
  assert.equal(
    autoResolveRule(
      at("Domino's Pizza", 'AllThePlaces', M5),
      at("Domino's", 'meta')
    ),
    AUTO_RULE_VARIANT
  );
});

test('nothing outside the thresholds resolves automatically', () => {
  // Too far for the variant rule.
  assert.equal(
    autoResolveRule(
      at("Domino's", 'meta'),
      at("Domino's Pizza", 'AllThePlaces', M20)
    ),
    null
  );
  // Too far for any rule.
  assert.equal(
    autoResolveRule(at('Corner Cafe', 'meta'), at('Corner Cafe', 'meta', M50)),
    null
  );
  // Same sources: two listings of one provider are not corroborated by a second one.
  assert.equal(
    autoResolveRule(at("Domino's", 'meta'), at("Domino's Pizza", 'meta', M5)),
    null
  );
  // A different part of the same site.
  assert.equal(
    autoResolveRule(
      at('Walmart', 'meta'),
      at('Walmart Pharmacy', 'AllThePlaces', M5)
    ),
    null
  );
  // Too many extra words.
  assert.equal(
    autoResolveRule(
      at('Food Lion', 'meta'),
      at('Food Lion One Two Three Four', 'AllThePlaces', M5)
    ),
    null
  );
  // A generic single word says nothing.
  assert.equal(
    autoResolveRule(at('Cafe', 'meta'), at('Cafe Roma', 'AllThePlaces', M5)),
    null
  );
  // Names that only partly overlap.
  assert.equal(
    autoResolveRule(
      at('Maple Grill', 'meta'),
      at('Maple Dental', 'AllThePlaces', M5)
    ),
    null
  );
});

test('the routes accept the status filter, the swap action and the kept listing the reviewer saw', () => {
  const {
    parseListQuery,
    parseDecideBody,
  } = require('../src/duplicate-routes');
  assert.deepEqual(parseListQuery('status=auto_resolved&limit=10'), {
    status: 'auto_resolved',
    limit: 10,
  });
  assert.equal(parseListQuery('status=bogus'), null);
  assert.equal(parseListQuery('state=stale')?.state, 'stale');
  const actorId = '11111111-1111-4111-8111-111111111111';
  const body = {
    action: 'swap_kept',
    reason: 'better source',
    actorId,
    expectedState: 'merged',
    expectedKept: { scanId: 'abc', sourceFileRowNumber: '12' },
  };
  assert.deepEqual(parseDecideBody(body), body);
  assert.equal(
    parseDecideBody({ ...body, expectedKept: { scanId: 'abc' } }),
    null
  );
  assert.equal(
    parseDecideBody({
      ...body,
      expectedKept: { scanId: 'abc', sourceFileRowNumber: '1x' },
    }),
    null
  );
});
