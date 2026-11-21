const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  sealListingReference,
  openListingReference,
} = require('../src/local-listing-reference');
const secret = 'fixture-secret-with-at-least-32-characters',
  context = {
    town: '00000000-0000-4000-8000-000000000001',
    changeToken: '00000000-0000-4000-8000-000000000002',
    adult: false,
  },
  position = { scanId: 'a'.repeat(64), row: '123' };
test('listing reference hides row identity and binds town, source version and adult choice', () => {
  const reference = sealListingReference(secret, context, position, 1000);
  assert.ok(!reference.includes(position.scanId));
  assert.deepEqual(
    openListingReference(secret, context, reference, 1001),
    position
  );
  for (const changed of [
    { ...context, town: '00000000-0000-4000-8000-000000000003' },
    { ...context, changeToken: '00000000-0000-4000-8000-000000000004' },
    { ...context, adult: true },
  ])
    assert.throws(() => openListingReference(secret, changed, reference, 1001));
});
test('listing reference rejects tampering, expiry and invalid secrets', () => {
  const reference = sealListingReference(secret, context, position, 1000),
    chars = reference.split(''),
    i = Math.floor(chars.length / 2);
  chars[i] = chars[i] === 'A' ? 'B' : 'A';
  assert.throws(() =>
    openListingReference(secret, context, chars.join(''), 1001)
  );
  assert.throws(() => openListingReference(secret, context, reference, 901001));
  assert.throws(() => sealListingReference('short', context, position, 1000));
});
test('listing reference binds the serving generation and an absent generation does not open a bound one', () => {
  const bound = { ...context, generation: 'e'.repeat(64) },
    reference = sealListingReference(secret, bound, position, 1000);
  assert.deepEqual(
    openListingReference(secret, bound, reference, 1001),
    position
  );
  for (const changed of [context, { ...context, generation: 'f'.repeat(64) }])
    assert.throws(() => openListingReference(secret, changed, reference, 1001));
  assert.throws(() =>
    sealListingReference(
      secret,
      { ...context, generation: 'short' },
      position,
      1000
    )
  );
});
