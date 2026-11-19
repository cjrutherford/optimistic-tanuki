const test = require('node:test'),
  assert = require('node:assert/strict');
const n = require('../src/normalize');
const atp = require('../src/alltheplaces');
const { sanitizeStored } = require('../src/normalize');

test('names: display case, spacing and legal suffix tidy; match key drops "the" and suffixes', () => {
  assert.equal(
    n.normalizeNameDisplay("  JOE'S  PIZZA  INC. "),
    "Joe's Pizza Inc."
  );
  assert.equal(n.nameMatchKey("The Joe's Pizza, LLC"), 'joe s pizza');
  assert.equal(
    n.nameMatchKey("Joe's Pizza"),
    n.nameMatchKey("THE JOE'S PIZZA INC")
  );
});

test('addresses: USPS abbreviations, unit and ZIP5 are split out; the key is the street only', () => {
  const a = n.normalizeAddress({
    freeform: '123 North Main Street Suite 4',
    locality: 'Springfield',
    region: 'il',
    postcode: '62704-1234',
  });
  assert.equal(a.state, 'valid');
  assert.equal(a.key, '123 N MAIN ST');
  assert.equal(a.unit, 'STE 4');
  assert.equal(a.zip5, '62704');
  assert.equal(n.normalizeAddress(undefined).state, 'absent');
});

test('phones: US numbers become E.164; short numbers are invalid, missing are absent', () => {
  assert.deepEqual(n.normalizePhone('(217) 555-0100'), {
    state: 'valid',
    e164: '+12175550100',
  });
  assert.equal(n.normalizePhone('12').state, 'invalid');
  assert.equal(n.normalizePhone(undefined).state, 'absent');
});

test('websites: lowercase host, tracking parameters stripped, non-http rejected', () => {
  const w = n.normalizeWebsite('HTTPS://Example.com/a?utm_source=x&id=2');
  assert.equal(w.url, 'https://example.com/a?id=2');
  assert.equal(w.host, 'example.com');
  assert.equal(n.normalizeWebsite('javascript:alert(1)').state, 'invalid');
});

test('hours and categories', () => {
  assert.equal(n.normalizeHours('Mo-Fr 09:00-17:00').state, 'valid');
  assert.equal(n.normalizeHours('garbage').state, 'invalid');
  assert.equal(n.directoryCategory('restaurant'), 'restaurants');
  assert.equal(n.directoryCategory('not_a_category'), null);
});

test('deterministic and versioned', () => {
  const src = { names: { primary: 'ACME HARDWARE' }, phones: ['2175550100'] };
  const a = n.toStored(n.normalizeRecord('overture', src));
  const b = n.toStored(
    n.normalizeRecord('overture', JSON.parse(JSON.stringify(src)))
  );
  assert.deepEqual(a, b);
  assert.equal(a.v, n.NORMALIZER_VERSION);
});

test('before/after, Overture: raw stays, stored block holds states and keys only without contact retention', () => {
  const stored = n.toStored(
    n.normalizeRecord('overture', {
      names: { primary: 'ACME HARDWARE' },
      phones: ['2175550100'],
      websites: ['http://acme.example'],
    })
  );
  assert.equal(stored.nameDisplay, 'Acme Hardware');
  assert.equal(stored.phone, 'valid');
  assert.equal(stored.website, 'valid');
  const bare = sanitizeStored(stored, false);
  assert.equal(JSON.stringify(bare).includes('2175550100'), false);
  const kept = sanitizeStored(stored, true);
  assert.equal(kept.contact.phone, '+12175550100');
});

test('before/after, AllThePlaces: the cleaned address and name keys', () => {
  const stored = n.toStored(
    n.normalizeRecord('alltheplaces', {
      names: { primary: 'SUBWAY' },
      address: '1 Main Street, Town, IL 62704',
    })
  );
  assert.equal(stored.nameKey, 'subway');
  assert.equal(stored.address, 'valid');
  assert.equal(stored.phone, 'absent');
  assert.equal(
    atp.normalizeName('  The  Café  '),
    n.baseNameKey('  The  Café  ')
  );
});

test('before/after, Geoapify: details are cleaned beside the raw values', () => {
  const g = n.normalizeGeoapifyDetails({
    phone: '+1 217 555 0100',
    website: 'https://x.example',
    openingHours: 'Mo-Fr 09:00-17:00',
  });
  assert.equal(g.phone.e164, '+12175550100');
  assert.equal(g.website.host, 'x.example');
  assert.equal(g.hours.state, 'valid');
  assert.equal(g.v, n.NORMALIZER_VERSION);
});
