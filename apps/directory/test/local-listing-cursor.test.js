const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  sealListingCursor,
  openListingCursor,
} = require('../src/local-listing-cursor');
const key = 'fixture-secret-with-at-least-32-characters',
  query = {
    town: '00000000-0000-4000-8000-000000000001',
    search: 'coffee',
    category: 'restaurant',
    adult: false,
    changeToken: '00000000-0000-4000-8000-000000000003',
  };
const position = { reviewed: true, scanId: 'a'.repeat(64), row: '123' };
test('cursor binds position to town and filters and hides internal identifiers', () => {
  const token = sealListingCursor(
    key,
    { ...query, bounds: '-84,30,-83,31' },
    position,
    1000
  );
  assert.ok(!token.includes(position.scanId));
  assert.deepEqual(
    openListingCursor(key, { ...query, bounds: '-84,30,-83,31' }, token, 1001),
    position
  );
  for (const changed of [
    {
      ...query,
      town: '00000000-0000-4000-8000-000000000002',
      bounds: '-84,30,-83,31',
    },
    {
      ...query,
      changeToken: '00000000-0000-4000-8000-000000000004',
      bounds: '-84,30,-83,31',
    },
    { ...query, search: 'tea', bounds: '-84,30,-83,31' },
    { ...query, adult: true, bounds: '-84,30,-83,31' },
    { ...query, category: 'coffee', bounds: '-84,30,-83,31' },
    { ...query, bounds: '-83,30,-82,31' },
    { ...query, bounds: undefined },
  ])
    assert.throws(() => openListingCursor(key, changed, token, 1001));
});
test('cursor rejects alteration, expiry and invalid secrets', () => {
  const token = sealListingCursor(key, query, position, 1000),
    bits = token.split('');
  bits[Math.floor(bits.length / 2)] =
    bits[Math.floor(bits.length / 2)] === 'A' ? 'B' : 'A';
  assert.throws(() => openListingCursor(key, query, bits.join(''), 1001));
  assert.throws(() => openListingCursor(key, query, token, 901001));
  assert.throws(() => sealListingCursor('short', query, position, 1000));
});
test('cursor binds the serving generation', () => {
  const bound = { ...query, generation: 'e'.repeat(64) },
    token = sealListingCursor(key, bound, position, 1000);
  assert.deepEqual(openListingCursor(key, bound, token, 1001), position);
  for (const changed of [query, { ...query, generation: 'f'.repeat(64) }])
    assert.throws(() => openListingCursor(key, changed, token, 1001));
  assert.throws(() =>
    sealListingCursor(key, { ...query, generation: 'short' }, position, 1000)
  );
});

test('long legacy categories remain cursor-bound within the token limit', () => {
  const legacy = { ...query, category: 'é'.repeat(1500) };
  const token = sealListingCursor(key, legacy, position, 1000);
  assert.ok(token.length <= 2048);
  assert.deepEqual(openListingCursor(key, legacy, token, 1001), position);
  assert.throws(() =>
    openListingCursor(
      key,
      { ...legacy, category: legacy.category + 'x' },
      token,
      1001
    )
  );
});
