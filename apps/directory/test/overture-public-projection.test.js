const test = require('node:test');
const assert = require('node:assert/strict');
const { projectPublicOverture } = require('../src/overture-public-projection');
const { OVERTURE_RIGHTS_FIELDS } = require('../src/overture-rights');
const fields = Object.keys(OVERTURE_RIGHTS_FIELDS),
  operations = { ingest: true, retain: true, publicDisplay: true };
const policy = {
  releaseId: 'r1',
  operations,
  terms: [
    {
      dataset: 'fixture',
      license: 'fixture',
      attribution: 'Fixture credit',
      termsUrl: 'https://example.test/terms',
      notice: 'Fixture notice',
      permissions: { ingest: fields, retain: fields, publicDisplay: fields },
    },
  ],
};
const row = () => ({
  releaseId: 'r1',
  sources: [{ property: '', dataset: 'fixture', license: 'fixture' }],
  names: { primary: 'Fixture Bakery' },
  basic_category: 'bakery',
  taxonomy: { primary: 'bakery', hierarchy: ['food'] },
  geometry: { type: 'Point', coordinates: [-83, 31] },
});
const classification = { residential: false, sensitive: false, adult: false };
test('public projection requires public rights and returns notices', () => {
  const result = projectPublicOverture(row(), classification, policy, false);
  assert.equal(result.status, 'eligible');
  assert.equal(result.listing.name, 'Fixture Bakery');
  assert.deepEqual(result.listing.notices, ['Fixture notice']);
  assert.equal(
    projectPublicOverture(
      row(),
      classification,
      { ...policy, operations: { ...operations, publicDisplay: false } },
      false
    ).status,
    'quarantined'
  );
  const x = row();
  x.sources.push({
    property: '/properties/names/primary',
    dataset: 'unknown',
    license: 'unknown',
  });
  assert.equal(
    projectPublicOverture(x, classification, policy, false).status,
    'quarantined'
  );
});
test('public projection does not need alternate taxonomy permission', () => {
  const withoutAlternate = {
    ...policy,
    terms: policy.terms.map((term) => ({
      ...term,
      permissions: {
        ...term.permissions,
        publicDisplay: fields.filter((field) => field !== 'alternate'),
      },
    })),
  };
  const result = projectPublicOverture(
    row(),
    classification,
    withoutAlternate,
    false
  );
  assert.equal(result.status, 'eligible');
  assert.equal(result.listing.alternate, undefined);
  assert.equal(result.listing.primary, undefined);
  assert.equal(result.listing.hierarchy, undefined);
});
test('local public-display policies omit alternate taxonomy and still project a permitted listing', () => {
  for (const date of ['2026-09-23', '2026-10-21']) {
    const localPolicy = require(`../../../docs/plans/town-square-directory/policies/overture-public-display-${date}.json`);
    assert.ok(
      localPolicy.terms.every(
        (term) => !term.permissions.publicDisplay.includes('alternate')
      )
    );
    const fixture = row();
    fixture.releaseId = localPolicy.releaseId;
    fixture.sources = [
      {
        property: '',
        dataset: localPolicy.terms[0].dataset,
        license: localPolicy.terms[0].license,
      },
    ];
    assert.equal(
      projectPublicOverture(fixture, classification, localPolicy, false).status,
      'eligible'
    );
  }
});
test('adult entries need visitor opt-in and uncertain or sensitive classifications stay hidden', () => {
  assert.equal(
    projectPublicOverture(
      row(),
      { ...classification, adult: true },
      policy,
      false
    ).status,
    'quarantined'
  );
  assert.equal(
    projectPublicOverture(
      row(),
      { ...classification, adult: true },
      policy,
      true
    ).status,
    'eligible'
  );
  for (const c of [
    { ...classification, sensitive: true },
    { ...classification, residential: true },
    { ...classification, adult: undefined },
    undefined,
  ])
    assert.equal(
      projectPublicOverture(row(), c, policy, true).status,
      'quarantined'
    );
});
test('contact fields require both field rights and an independent business verification', () => {
  const r = {
    ...row(),
    websites: ['https://shop.example.test'],
    phones: ['+19125550100'],
    addresses: [{ freeform: '10 Main Street' }],
  };
  const verified = {
    ...classification,
    websiteVerified: true,
    phoneVerified: true,
    addressVerified: true,
  };
  const ok = projectPublicOverture(r, verified, policy, false);
  assert.equal(ok.listing.website, 'https://shop.example.test/');
  assert.equal(ok.listing.phone, '+19125550100');
  assert.equal(ok.listing.address, '10 Main Street');
  const partial = projectPublicOverture(r, classification, policy, false);
  assert.equal(partial.listing.website, undefined);
  assert.equal(partial.listing.phone, undefined);
  assert.equal(partial.listing.address, undefined);
  const noWebsite = {
    ...policy,
    terms: policy.terms.map((t) => ({
      ...t,
      permissions: {
        ...t.permissions,
        publicDisplay: fields.filter((x) => x !== 'website'),
      },
    })),
  };
  assert.equal(
    projectPublicOverture(r, verified, noWebsite, false).listing.website,
    undefined
  );
  const bad = { ...r, websites: ['http://127.0.0.1/'] };
  assert.equal(
    projectPublicOverture(bad, verified, policy, false).listing.website,
    undefined
  );
});
