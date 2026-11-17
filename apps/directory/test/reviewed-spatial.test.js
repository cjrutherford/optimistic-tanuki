const test = require('node:test');
const assert = require('node:assert/strict');
const { mappableReviewed, reviewedFields, validBaseListing, validUrl, REVIEWED_SPATIAL_VALIDATOR_VERSION } = require('../src/reviewed-spatial');

const reviewed = (over = {}) => ({
  address: '1 Main St', website: 'https://place.example.test/', phone: '+19125550100',
  attribution: ['Fixture'], notices: [], termsUrls: ['https://example.test/terms'], evidenceUrl: 'https://example.test/evidence', ...over,
});
const listing = (over = {}) => ({
  name: 'Place', category: 'restaurant', location: { type: 'Point', coordinates: [-83, 31] },
  attribution: ['Overture'], notices: [], termsUrls: ['https://example.test/terms'], reviewed: reviewed(), ...over,
});

test('version is a positive integer', () => {
  assert.ok(Number.isInteger(REVIEWED_SPATIAL_VALIDATOR_VERSION) && REVIEWED_SPATIAL_VALIDATOR_VERSION > 0);
});

test('mappableReviewed accepts a well-formed reviewed address', () => {
  assert.deepEqual(mappableReviewed(listing()), { coordinates: [-83, 31] });
  assert.deepEqual(mappableReviewed(listing({ location: { type: 'Point', coordinates: [180, -90] } })), { coordinates: [180, -90] });
});

test('mappableReviewed rejects what must never be mapped', () => {
  const rejected = {
    'no reviewed object': listing({ reviewed: undefined }),
    'reviewed not an object': listing({ reviewed: 'x' }),
    'reviewed is an array': listing({ reviewed: [] }),
    'website only': listing({ reviewed: reviewed({ address: undefined }) }),
    'phone only': listing({ reviewed: reviewed({ address: undefined, website: undefined }) }),
    'blank address': listing({ reviewed: reviewed({ address: '   ' }) }),
    'address too long': listing({ reviewed: reviewed({ address: 'a'.repeat(301) }) }),
    'address control character': listing({ reviewed: reviewed({ address: 'a\nb' }) }),
    'evidence url missing': listing({ reviewed: reviewed({ evidenceUrl: undefined }) }),
    'evidence url local': listing({ reviewed: reviewed({ evidenceUrl: 'https://printer.local/x' }) }),
    'evidence url ip': listing({ reviewed: reviewed({ evidenceUrl: 'http://127.0.0.1/x' }) }),
    'evidence url credentials': listing({ reviewed: reviewed({ evidenceUrl: 'https://u:p@example.test/' }) }),
    'reviewed attribution empty': listing({ reviewed: reviewed({ attribution: [] }) }),
    'reviewed notices not array': listing({ reviewed: reviewed({ notices: 'x' }) }),
    'reviewed terms invalid entry': listing({ reviewed: reviewed({ termsUrls: [''] }) }),
    'name blank': listing({ name: ' ' }),
    'category missing': listing({ category: undefined }),
    'location not a point': listing({ location: { type: 'Polygon', coordinates: [-83, 31] } }),
    'longitude out of range': listing({ location: { type: 'Point', coordinates: [181, 31] } }),
    'latitude out of range': listing({ location: { type: 'Point', coordinates: [-83, 91] } }),
    'coordinate not finite': listing({ location: { type: 'Point', coordinates: [NaN, 31] } }),
    'three coordinates': listing({ location: { type: 'Point', coordinates: [-83, 31, 0] } }),
    'base attribution empty': listing({ attribution: [] }),
    'base termsUrls missing': listing({ termsUrls: undefined }),
    'null listing': null,
  };
  for (const [name, value] of Object.entries(rejected)) assert.equal(mappableReviewed(value), null, name);
});

test('reviewedFields keeps only valid optional fields', () => {
  const fields = reviewedFields(reviewed({ website: 'ftp://x.test/', phone: '555' }));
  assert.equal(fields.website, undefined);
  assert.equal(fields.phone, undefined);
  assert.equal(fields.address, '1 Main St');
  assert.equal(reviewedFields(null), null);
});

test('validBaseListing and validUrl edges', () => {
  assert.equal(validBaseListing(listing()), true);
  assert.equal(validUrl('http://example.test/'), true);
  assert.equal(validUrl('http://example.test/', true), false);
  assert.equal(validUrl('https://localhost/'), false);
  assert.equal(validUrl('https://nodot/'), false);
  assert.equal(validUrl(5), false);
});
