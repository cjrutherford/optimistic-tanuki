const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyPair,
  weakerListing,
  CERTAIN_RADIUS_METERS,
} = require('../src/duplicate-review');

const at = (scanId, row, name, dLng = 0, extra = {}) => ({
  scanId,
  row: String(row),
  name,
  coordinates: [-83.5 + dLng, 31.25],
  ...extra,
});
// One thousandth of a degree of longitude at this latitude is about 95 m.
const M50 = 0.00053;
const M300 = 0.00317;
const M1000 = 0.0105;

test('the same name within 150 m is a certain match and is left to the acquisition dedupe', () => {
  const v = classifyPair(
    at('a', 1, "Joe's Diner"),
    at('b', 1, "JOE'S DINER", M50)
  );
  assert.equal(v.kind, 'certain_match');
  assert.ok(v.distanceMeters <= CERTAIN_RADIUS_METERS);
});

test('the same name 150 to 500 m apart is uncertain', () => {
  const v = classifyPair(
    at('a', 1, 'Corner Cafe'),
    at('b', 1, 'Corner Cafe', M300)
  );
  assert.equal(v.kind, 'uncertain');
  assert.equal(v.rule, 'same_name_near');
});

test('overlapping names within 150 m are uncertain', () => {
  const v = classifyPair(
    at('a', 1, "Joe's Diner"),
    at('b', 1, "Joe's Diner Downtown", M50)
  );
  assert.equal(v.kind, 'uncertain');
  assert.equal(v.rule, 'similar_name');
});

test('unrelated names, far pairs and one-token overlaps are certainly distinct', () => {
  assert.equal(
    classifyPair(at('a', 1, 'Alpha Hardware'), at('b', 1, 'Zeta Bakery', M50))
      .kind,
    'certain_distinct'
  );
  assert.equal(
    classifyPair(at('a', 1, 'Corner Cafe'), at('b', 1, 'Corner Cafe', M1000))
      .kind,
    'certain_distinct'
  );
  assert.equal(
    classifyPair(
      at('a', 1, 'Main Street Pizza'),
      at('b', 1, 'Main Street Bank', M50)
    ).kind,
    'certain_distinct'
  );
  assert.equal(
    classifyPair(at('a', 1, 'Pizza'), at('b', 1, 'Pizza Hut', M50)).kind,
    'certain_distinct'
  );
  assert.equal(
    classifyPair(
      at('a', 1, 'Corner Cafe'),
      at('b', 1, 'Corner Cafe Annex', M300)
    ).kind,
    'certain_distinct'
  );
});

test('weaker listing: sources, then confidence, then populated fields, then age, then order', () => {
  const src = (n) =>
    Array.from({ length: n }, (_, i) => ({ dataset: `d${i}` }));
  const a = at('a', 1, 'X', 0, { sources: src(2) });
  const b = at('b', 1, 'X', 0, { sources: src(1) });
  assert.deepEqual(
    [weakerListing(a, b).weaker.scanId, weakerListing(a, b).basis],
    ['b', 'sources']
  );
  assert.equal(weakerListing(b, a).weaker.scanId, 'b');

  const c = at('a', 1, 'X', 0, { confidence: 'confirmed' });
  const d = at('b', 1, 'X', 0, { confidence: 'origin' });
  assert.deepEqual(
    [weakerListing(c, d).weaker.scanId, weakerListing(c, d).basis],
    ['b', 'confidence']
  );

  const e = at('a', 1, 'X', 0, { addresses: ['1 Main'], phones: ['+1'] });
  const f = at('b', 1, 'X', 0, { addresses: ['1 Main'] });
  assert.deepEqual(
    [weakerListing(e, f).weaker.scanId, weakerListing(e, f).basis],
    ['b', 'fields']
  );

  const g = at('a', 1, 'X', 0, { updatedAt: 200 });
  const h = at('b', 1, 'X', 0, { updatedAt: 100 });
  assert.deepEqual(
    [weakerListing(g, h).weaker.scanId, weakerListing(g, h).basis],
    ['b', 'updated']
  );

  const i = at('a', 9, 'X');
  const j = at('a', 10, 'X');
  const w = weakerListing(i, j);
  assert.deepEqual([w.weaker.row, w.basis], ['9', 'order']);
  assert.equal(weakerListing(j, i).weaker.row, '9');
});
