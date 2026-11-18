const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chooseTigerMatch } = require('../src/auto-boundary');
const {
  censusArchiveUrl,
  CENSUS_TIGER_PINS,
} = require('../src/census-tiger-pins');

const c = (layer, geoid) => ({
  geoid,
  layer,
  vintage: '2026',
  stateFips: '13',
  sourceSha256: 'a'.repeat(64),
});

test('place is preferred, ambiguity is queued, nothing is missing', () => {
  assert.equal(chooseTigerMatch([]).kind, 'missing');
  const place = chooseTigerMatch([
    c('cousub', '1306791234'),
    c('place', '1323872'),
  ]);
  assert.equal(place.kind, 'single');
  assert.equal(place.candidate.layer, 'place');
  const cousub = chooseTigerMatch([c('cousub', '1306791234')]);
  assert.equal(cousub.kind, 'single');
  assert.equal(cousub.candidate.layer, 'cousub');
  const two = chooseTigerMatch([
    c('place', '1311111'),
    c('place', '1322222'),
    c('cousub', '1306791234'),
  ]);
  assert.equal(two.kind, 'ambiguous');
  assert.equal(two.reason, 'multiple_place_matches');
  const subs = chooseTigerMatch([
    c('cousub', '1306791234'),
    c('cousub', '1306795678'),
  ]);
  assert.equal(subs.reason, 'multiple_cousub_matches');
});

test('archive urls are fixed https census paths and every pin is a sha-256', () => {
  assert.equal(
    censusArchiveUrl('13', 'cousub'),
    'https://www2.census.gov/geo/tiger/TIGER2026/COUSUB/tl_2026_13_cousub.zip'
  );
  assert.ok(Object.keys(CENSUS_TIGER_PINS).length >= 17);
  for (const pins of Object.values(CENSUS_TIGER_PINS))
    for (const sha of [pins.place, pins.cousub])
      assert.match(sha, /^[0-9a-f]{64}$/);
});
