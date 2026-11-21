const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CONTACT_LISTING_SQL,
  buildUniqueContactListingMap,
  buildUniqueContactStageMap,
  contactListingKey,
  contactMatchesCandidate,
  readContactListingRows,
} = require('../../../scripts/local-directory-contact-listings.cjs');

const townA = '00000000-0000-4000-8000-000000000001';
const townB = '00000000-0000-4000-8000-000000000002';

test('contact-stage identity and published fields must match the reviewed candidate', () => {
  const candidate = {
    name: 'Fixture Bakery',
    category: 'bakery',
    point: { lng: -83, lat: 31 },
    addresses: ['10 Main St'],
    websites: ['https://shop.example'],
    phones: ['+19125550100'],
    officialEvidence: { websiteMatch: true, phoneMatch: true },
  };
  const listing = {
    name: 'Fixture Bakery',
    category: 'bakery',
    location: { type: 'Point', coordinates: [-83, 31] },
    addresses: ['10 Main St'],
    websites: ['https://shop.example'],
    phones: ['+19125550100'],
  };
  assert.equal(contactMatchesCandidate(candidate, listing), true);
  for (const changed of [
    { ...listing, name: 'Other Bakery' },
    { ...listing, location: { type: 'Point', coordinates: [-82, 31] } },
    { ...listing, addresses: ['99 Other St'] },
    { ...listing, websites: ['https://other.example'] },
    { ...listing, phones: ['+19125550101'] },
  ]) {
    assert.equal(contactMatchesCandidate(candidate, changed), false);
  }
  assert.equal(
    contactMatchesCandidate(
      { ...candidate, phones: [] },
      { ...listing, phones: [] }
    ),
    true
  );
});
const eligible = (regionId, sourceFileRowNumber, listing) => ({
  regionId,
  sourceFileRowNumber,
  listing,
  policyRevoked: false,
  scanRevoked: false,
  rowRevoked: false,
});

test('contact listings retain unique eligible source keys', () => {
  const listingA = { address: '1 Main St' };
  const listingB = { address: '2 Main St' };
  const map = buildUniqueContactListingMap([
    eligible(townA, 1, listingA),
    eligible(townB, 1, listingB),
  ]);

  assert.equal(map.size, 2);
  assert.equal(map.get(contactListingKey(townA, '1')), listingA);
  assert.equal(map.get(contactListingKey(townB, '1')), listingB);
});

test('a duplicate key stays unavailable even when one physical row is revoked', () => {
  const duplicate = [
    eligible(townA, 7, { address: 'Revoked scan row' }),
    eligible(townA, 7, { address: 'Active scan row' }),
  ];
  duplicate[0].scanRevoked = true;

  for (const rows of [duplicate, [...duplicate].reverse()]) {
    const map = buildUniqueContactListingMap(rows);
    assert.equal(map.has(contactListingKey(townA, 7)), false);
  }
});

test('a unique row is unavailable when its policy, scan or row is revoked', () => {
  for (const field of ['policyRevoked', 'scanRevoked', 'rowRevoked']) {
    const row = eligible(townA, 9, { address: `Revoked by ${field}` });
    row[field] = true;
    assert.equal(
      buildUniqueContactListingMap([row]).has(contactListingKey(townA, 9)),
      false
    );
  }
});

test('contact query returns physical duplicates with revocation eligibility fields', async () => {
  assert.match(CONTACT_LISTING_SQL, /p\.revoked AS "policyRevoked"/);
  assert.match(CONTACT_LISTING_SQL, /r\."scanId" AS "stageScanId"/);
  assert.match(CONTACT_LISTING_SQL, /m\."policyId" AS "stagePolicyId"/);
  assert.match(CONTACT_LISTING_SQL, /directory_overture_private_revocation/);
  assert.match(
    CONTACT_LISTING_SQL,
    /directory_overture_private_row_revocation/
  );
  assert.doesNotMatch(
    CONTACT_LISTING_SQL,
    /WHERE m\."policyId"=\$1 AND p\.revoked=false/
  );

  let actual;
  const rows = [{ regionId: townA, sourceFileRowNumber: '1', listing: {} }];
  const result = await readContactListingRows(
    {
      query: async (sql, params) => {
        actual = { sql, params };
        return rows;
      },
    },
    'f'.repeat(64),
    [{ communityId: townA, sourceFileRowNumber: 1 }]
  );
  assert.equal(result, rows);
  assert.match(actual.sql, /AS "scanRevoked"/);
  assert.match(actual.sql, /AS "rowRevoked"/);
  assert.deepEqual(actual.params, ['f'.repeat(64), [townA], ['1']]);
});

test('stage map keeps the stage row identity and applies the same exclusions', () => {
  const a = {
    ...eligible(townA, '4', { name: 'A' }),
    stageScanId: 's'.repeat(64),
    stagePolicyId: 'p'.repeat(64),
  };
  const dup1 = {
    ...eligible(townA, '5', { name: 'D1' }),
    stageScanId: '1'.repeat(64),
    stagePolicyId: 'p'.repeat(64),
  };
  const dup2 = {
    ...eligible(townA, '5', { name: 'D2' }),
    stageScanId: '2'.repeat(64),
    stagePolicyId: 'p'.repeat(64),
  };
  const revoked = {
    ...eligible(townA, '6', { name: 'R' }),
    stageScanId: '3'.repeat(64),
    stagePolicyId: 'p'.repeat(64),
    scanRevoked: true,
  };
  const map = buildUniqueContactStageMap([a, dup1, dup2, revoked]);
  assert.deepEqual([...map.keys()], [contactListingKey(townA, 4)]);
  assert.deepEqual(map.get(contactListingKey(townA, 4)), {
    listing: { name: 'A' },
    scanId: 's'.repeat(64),
    sourceFileRowNumber: '4',
    policyId: 'p'.repeat(64),
  });
});
