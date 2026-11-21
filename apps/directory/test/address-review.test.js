const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_ADDRESS_REVIEW_POLICY,
  decideAddressReview,
  haversineMeters,
} = require('../src/address-review');

const candidate = (overrides = {}) => ({
  sourceRow: 1,
  name: 'Fixture Bakery',
  category: 'bakery',
  point: { lat: 31, lng: -83 },
  addresses: ['10 Main St'],
  websites: ['https://fixture.example.test'],
  phones: ['+19125550100'],
  rights: 'eligible',
  residential: false,
  sensitive: false,
  adult: false,
  ...overrides,
});

const geocode = (overrides = {}) => ({
  status: 'match',
  normalizedAddress: '10 MAIN ST',
  coordinates: { lat: 31.0002, lng: -83.0002 },
  precision: 'rooftop',
  distanceMeters: 30,
  provider: 'census',
  checkedAt: '2026-11-10T00:00:00.000Z',
  ...overrides,
});

const official = (overrides = {}) => ({
  url: 'https://fixture.example.test/locations/main-st',
  status: 'fetched',
  nameMatch: true,
  addressMatch: true,
  phoneMatch: true,
  websiteMatch: true,
  fetchedAt: '2026-11-10T00:00:00.000Z',
  evidenceHash: 'a'.repeat(64),
  ...overrides,
});

const now = new Date('2026-11-10T12:00:00.000Z');

test('auto-approves only a complete high-confidence candidate', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode(),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'auto_approve');
  assert.deepEqual(result.reasons, []);
  assert.equal(result.checks.rights, 'pass');
  assert.equal(result.checks.officialEvidence, 'pass');
});

test('allows a range geocode within its own distance limit', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode({
      precision: 'range',
      distanceMeters: 700,
    }),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'auto_approve');
  assert.equal(result.thresholds.maxDistanceMeters, 1000);
});

test('sends multiple addresses to a human', () => {
  const result = decideAddressReview({
    candidate: candidate({ addresses: ['10 Main St', '12 Main St'] }),
    geocode: geocode(),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('multiple_addresses'));
});

test('sends missing official evidence to a human', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode(),
    official: null,
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('official_evidence_missing'));
});

test('sends blocked official evidence to a human', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode(),
    official: official({ status: 'blocked' }),
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('official_evidence_unavailable'));
});

test('sends ambiguous geocodes to a human', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode({ status: 'ambiguous', distanceMeters: null }),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('geocode_ambiguous'));
});

test('sends medium point distances to a human', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode({ precision: 'range', distanceMeters: 1200 }),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('point_distance_requires_review'));
});

test('rejects point distances beyond the hard limit', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode({ precision: 'range', distanceMeters: 2500 }),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'reject');
  assert.ok(result.reasons.includes('point_too_far'));
});

test('rejects a missing address', () => {
  const result = decideAddressReview({
    candidate: candidate({ addresses: [] }),
    geocode: geocode(),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'reject');
  assert.ok(result.reasons.includes('missing_address'));
});

test('rejects addresses with control characters', () => {
  const result = decideAddressReview({
    candidate: candidate({ addresses: ['10 Main St\u0000'] }),
    geocode: geocode(),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'reject');
  assert.ok(result.reasons.includes('invalid_address'));
});

test('rejects denied address rights', () => {
  const result = decideAddressReview({
    candidate: candidate({ rights: 'denied' }),
    geocode: geocode(),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'reject');
  assert.ok(result.reasons.includes('rights_denied'));
});

test('rejects adult, sensitive and residential locations', () => {
  for (const [field, reason] of [
    ['adult', 'adult_listing'],
    ['sensitive', 'sensitive_location'],
    ['residential', 'residential_location'],
  ]) {
    const result = decideAddressReview({
      candidate: candidate({ [field]: true }),
      geocode: geocode(),
      official: official(),
      now,
    });
    assert.equal(result.verdict, 'reject');
    assert.ok(result.reasons.includes(reason));
  }
});

test('sends unknown classifications to a human', () => {
  const result = decideAddressReview({
    candidate: candidate({
      residential: undefined,
      sensitive: undefined,
      adult: undefined,
    }),
    geocode: geocode(),
    official: official(),
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('residential_classification_unknown'));
  assert.ok(result.reasons.includes('sensitive_classification_unknown'));
  assert.ok(result.reasons.includes('adult_classification_unknown'));
});

test('sends stale evidence to a human', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode(),
    official: official({ fetchedAt: '2026-09-01T00:00:00.000Z' }),
    now,
  });

  assert.equal(result.verdict, 'needs_human');
  assert.ok(result.reasons.includes('official_evidence_stale'));
});

test('can run without an official-page requirement for a dry-run policy', () => {
  const result = decideAddressReview({
    candidate: candidate(),
    geocode: geocode(),
    official: null,
    now,
    policy: {
      ...DEFAULT_ADDRESS_REVIEW_POLICY,
      requireOfficialEvidence: false,
    },
  });

  assert.equal(result.verdict, 'auto_approve');
});

test('haversine distance is stable for a known separation', () => {
  const distance = haversineMeters(
    { lat: 31, lng: -83 },
    { lat: 31.01, lng: -83 }
  );
  assert.ok(distance > 1100 && distance < 1120);
});
