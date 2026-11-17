const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalJson, keyedHash, documentHash, stageContentHash, stageContentSubset, reviewedHash, fieldHashes,
} = require('../src/reviewed-binding');

const key = 'k'.repeat(40);
const listing = {
  name: 'Fixture Bakery', category: 'bakery', location: { type: 'Point', coordinates: [-83, 31] },
  addresses: ['10 Main St'], websites: ['https://fixture.example.test'], phones: ['+19125550100'],
  sources: [{ dataset: 'Fixture' }],
};

test('key order and insignificant whitespace do not change a hash', () => {
  const reordered = {
    sources: [{ dataset: 'Fixture' }], phones: ['+19125550100'], websites: ['https://fixture.example.test'],
    addresses: ['10 Main St'], location: { coordinates: [-83, 31], type: 'Point' }, category: 'bakery', name: 'Fixture Bakery',
  };
  assert.equal(stageContentHash(key, listing), stageContentHash(key, reordered));
  assert.equal(stageContentHash(key, listing), stageContentHash(key, { ...listing, name: '  Fixture Bakery ', addresses: [' 10 Main St '] }));
  assert.equal(canonicalJson({ b: 1, a: ' x ' }), '{"a":"x","b":1}');
});

test('any single stage field change changes the hash', () => {
  const base = stageContentHash(key, listing);
  const variants = {
    name: { ...listing, name: 'Other' }, category: { ...listing, category: 'cafe' },
    location: { ...listing, location: { type: 'Point', coordinates: [-83, 31.0001] } },
    addresses: { ...listing, addresses: ['11 Main St'] }, websites: { ...listing, websites: ['https://other.example.test'] },
    phones: { ...listing, phones: ['+19125550101'] }, sources: { ...listing, sources: [{ dataset: 'Other' }] },
  };
  for (const [field, changed] of Object.entries(variants)) assert.notEqual(stageContentHash(key, changed), base, field);
  assert.equal(stageContentHash(key, { ...listing, unrelated: 'ignored' }), base);
  assert.deepEqual(Object.keys(stageContentSubset(listing)).sort(), ['addresses', 'category', 'location', 'name', 'phones', 'sources', 'websites']);
});

test('absent optional fields hash alike and differ from an empty string', () => {
  const reviewed = { attribution: ['A'], notices: ['N'], termsUrls: ['https://t.test'], evidenceUrl: 'https://e.test/' };
  const none = fieldHashes(key, {});
  const nulls = fieldHashes(key, { phone: null, website: undefined });
  assert.equal(none.phone.hash, nulls.phone.hash);
  assert.equal(none.phone.hash, none.website.hash);
  assert.notEqual(fieldHashes(key, { phone: '' }).phone.hash, none.phone.hash);
  assert.notEqual(reviewedHash(key, reviewed), reviewedHash(key, { ...reviewed, phone: '' }));
  assert.equal(reviewedHash(key, { ...reviewed, phone: undefined }), reviewedHash(key, reviewed));
});

test('field hashes carry origins and change per field', () => {
  const values = { name: 'N', category: 'c', point: { type: 'Point', coordinates: [1, 2] }, address: { freeform: 'a' }, website: 'w', phone: 'p', attribution: ['x'], notices: ['y'], termsUrls: ['z'] };
  const base = fieldHashes(key, values);
  assert.equal(base.name.origin, 'live_row');
  assert.equal(base.phone.origin, 'candidate');
  assert.equal(base.attribution.origin, 'stage');
  for (const field of Object.keys(values)) {
    const changed = fieldHashes(key, { ...values, [field]: field === 'point' ? { type: 'Point', coordinates: [1, 3] } : 'changed' });
    assert.notEqual(changed[field].hash, base[field].hash, field);
    for (const other of Object.keys(values).filter((v) => v !== field)) assert.equal(changed[other].hash, base[other].hash, other);
  }
});

test('hashes are keyed; the key is required and long enough', () => {
  assert.notEqual(keyedHash(key, listing), keyedHash('j'.repeat(40), listing));
  assert.notEqual(keyedHash(key, listing), documentHash(listing));
  assert.match(keyedHash(key, listing), /^[0-9a-f]{64}$/);
  assert.throws(() => keyedHash('short', listing), /hash key/);
  assert.throws(() => reviewedHash(key, null), /Reviewed object/);
  assert.throws(() => canonicalJson({ a: NaN }), /non-finite/);
});
