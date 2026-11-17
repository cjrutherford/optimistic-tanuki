const test = require('node:test');
const assert = require('node:assert/strict');
const { projectPublicOverture } = require('../src/overture-public-projection');
const { OVERTURE_RIGHTS_FIELDS } = require('../src/overture-rights');
const fields = Object.keys(OVERTURE_RIGHTS_FIELDS);
const policy = (operations, permissions) => ({
  releaseId: 'r1',
  operations: {
    ingest: true,
    retain: true,
    publicDisplay: true,
    ...operations,
  },
  terms: [
    {
      dataset: 'fixture',
      license: 'fixture',
      attribution: 'Fixture credit',
      termsUrl: 'https://example.test/terms',
      permissions: {
        ingest: fields,
        retain: fields,
        publicDisplay: fields,
        ...permissions,
      },
    },
  ],
});
const row = () => ({
  releaseId: 'r1',
  sources: [{ property: '', dataset: 'fixture', license: 'fixture' }],
  names: { primary: 'Fixture Bakery' },
  basic_category: 'bakery',
  taxonomy: { primary: 'bakery', hierarchy: ['food'] },
  geometry: { type: 'Point', coordinates: [-83, 31] },
});
const cls = { residential: false, sensitive: false, adult: false };
const project = (p) => projectPublicOverture(row(), cls, p, false);

test('display allowed and export denied: displayable, not exportable', () => {
  const r = project(policy({}, {}));
  assert.equal(r.status, 'eligible');
  assert.equal(r.exportEligible, false);
});
test('display and export both allowed: exportable', () => {
  const r = project(policy({ export: true }, { export: fields }));
  assert.equal(r.status, 'eligible');
  assert.equal(r.exportEligible, true);
});
test('missing term, operation flag or one missing field denies export', () => {
  assert.equal(project(policy({ export: true }, {})).exportEligible, false);
  assert.equal(project(policy({}, { export: fields })).exportEligible, false);
  assert.equal(
    project(policy({ export: true }, { export: fields.slice(1) }))
      .exportEligible,
    false
  );
  assert.equal(
    project(policy({ export: false }, { export: fields })).exportEligible,
    false
  );
});
test('export is independent of display and never enters the public listing', () => {
  const denied = project(
    policy({ publicDisplay: false, export: true }, { export: fields })
  );
  assert.equal(denied.status, 'quarantined');
  assert.equal(denied.exportEligible, false);
  const ok = project(policy({ export: true }, { export: fields }));
  assert.equal('exportEligible' in ok.listing, false);
  assert.equal(JSON.stringify(ok.listing).includes('export'), false);
});
