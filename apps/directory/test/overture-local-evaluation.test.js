const test = require('node:test');
const assert = require('node:assert/strict');
const { projectLocalEvaluation } = require('../src/overture-local-evaluation');
const { OVERTURE_RIGHTS_FIELDS } = require('../src/overture-rights');
const fields = Object.keys(OVERTURE_RIGHTS_FIELDS),
  permissions = Object.fromEntries(
    ['ingest', 'retain', 'privateDisplay'].map((x) => [x, fields])
  );
const policy = {
  releaseId: 'r1',
  operations: { ingest: true, retain: true, privateDisplay: true },
  terms: [
    {
      dataset: 'fixture',
      license: 'fixture',
      attribution: 'Fixture credit',
      termsUrl: 'https://example.test/terms',
      permissions,
    },
  ],
};
const row = () => ({
  releaseId: 'r1',
  sources: [{ property: '', dataset: 'fixture', license: 'fixture' }],
  names: { primary: 'Fixture Cafe' },
  basic_category: 'restaurant',
  taxonomy: { primary: 'restaurant', hierarchy: ['restaurant'] },
  geometry: { type: 'Point', coordinates: [-83, 31] },
  assignedCategoryIds: ['restaurants'],
  addresses: [{ freeform: '10 Main Street' }],
  phones: ['+19125550100'],
});
test('local evaluation excludes contact fields and requires an allowed category with verified rights', () => {
  const r = projectLocalEvaluation(row(), policy);
  assert.equal(r.status, 'eligible');
  assert.equal(r.listing.name, 'Fixture Cafe');
  assert.equal(r.listing.address, undefined);
  assert.equal(r.listing.phone, undefined);
  assert.equal(
    projectLocalEvaluation({ ...row(), basic_category: 'health_care' }, policy)
      .status,
    'quarantined'
  );
  assert.equal(
    projectLocalEvaluation(
      {
        ...row(),
        sources: [{ property: '', dataset: 'unknown', license: 'unknown' }],
      },
      policy
    ).status,
    'quarantined'
  );
  const cc0 = {
    ...policy,
    terms: [
      {
        dataset: 'AllThePlaces',
        license: 'CC0-1.0',
        attribution: 'AllThePlaces',
        termsUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        permissions,
      },
    ],
  };
  assert.equal(
    projectLocalEvaluation(
      {
        ...row(),
        sources: [
          { property: '', dataset: 'AllThePlaces', license: 'CC0-1.0' },
        ],
      },
      cc0
    ).status,
    'eligible'
  );
});
test('local evaluation hides potential sensitive or adult locations and unknown classifications', () => {
  for (const changes of [
    { names: { primary: 'Domestic Violence Shelter Cafe' } },
    { assignedCategoryIds: ['adult'] },
    { taxonomy: { primary: 'shelter', hierarchy: ['restaurant'] } },
    { assignedCategoryIds: [] },
    { addresses: [{ freeform: '1 Prison Road' }] },
  ])
    assert.equal(
      projectLocalEvaluation({ ...row(), ...changes }, policy).status,
      'quarantined'
    );
});
test('adult evaluation requires the adult classification, known rights and no sensitive-location indicators', () => {
  const { projectLocalAdult } = require('../src/overture-local-adult');
  const adult = {
    ...row(),
    basic_category: 'adult_entertainment_venue',
    taxonomy: {
      primary: 'adult_entertainment_venue',
      hierarchy: ['arts_and_entertainment', 'adult_entertainment_venue'],
    },
    assignedCategoryIds: ['adult'],
  };
  const result = projectLocalAdult(adult, policy);
  assert.equal(result.status, 'eligible');
  assert.equal(result.listing.adult, true);
  assert.equal(result.listing.address, undefined);
  assert.equal(
    projectLocalAdult({ ...adult, assignedCategoryIds: [] }, policy).status,
    'quarantined'
  );
  assert.equal(
    projectLocalAdult(
      { ...adult, names: { primary: 'Domestic Violence Shelter' } },
      policy
    ).status,
    'quarantined'
  );
  assert.equal(
    projectLocalAdult(
      {
        ...adult,
        sources: [{ property: '', dataset: 'unknown', license: 'unknown' }],
      },
      policy
    ).status,
    'quarantined'
  );
});
