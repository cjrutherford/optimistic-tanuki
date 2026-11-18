const test = require('node:test'),
  assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { projectExportRow } = require('../src/export-job');
const { evaluateOvertureFieldRights } = require('../src/overture-rights');
const { validateLine } = require('./export-schema-validate');

const ALL = [
  'name',
  'basic_category',
  'primary',
  'hierarchy',
  'geometry',
  'address',
  'phone',
  'website',
];
const term = (dataset, perms = ALL) => ({
  dataset,
  license: 'CDLA-Permissive-2.0',
  attribution: `${dataset} attribution`,
  termsUrl: `https://example.org/${dataset}`,
  notice: `${dataset} notice`,
  permissions: { export: perms },
});
const policy = (terms, exportOn = true) => ({
  releaseId: 'rel-1',
  operations: { export: exportOn },
  terms,
});
const src = (property, dataset, extra = {}) => ({
  property,
  dataset,
  license: 'CDLA-Permissive-2.0',
  ...extra,
});
const FULL_SOURCES = (dataset = 'meta') => [
  src('/properties/names/primary', dataset),
  src('/basic_category', dataset),
  src('/taxonomy/primary', dataset),
  src('/taxonomy/hierarchy', dataset),
  src('/geometry', dataset),
  src('/properties/addresses', dataset),
  src('/properties/phones', dataset),
  src('/properties/websites', dataset),
];
const listing = (over = {}) => ({
  name: 'Cafe',
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83, 31] },
  address: { line1: '1 Main' },
  phone: '555',
  website: 'https://cafe.example',
  attribution: ['x'],
  assignmentChangeToken: 'secret-token',
  sources: FULL_SOURCES(),
  ...over,
});
const evaluator = (p) => (l) =>
  evaluateOvertureFieldRights(
    { releaseId: 'rel-1', sources: l.sources },
    'export',
    p
  );

test('projects only allowlisted keys with per-field provenance and no leaks', () => {
  const r = projectExportRow(listing(), evaluator(policy([term('meta')])));
  assert.equal(r.included, true);
  assert.deepEqual(Object.keys(r.fields), [
    'name',
    'category',
    'location',
    'address',
    'phone',
    'website',
  ]);
  const text = JSON.stringify(r);
  assert.ok(!text.includes('assignmentChangeToken'));
  assert.ok(!text.includes('secret-token'));
  assert.ok(!('sources' in r.fields) && !('attribution' in r.fields));
  assert.deepEqual(r.provenance['name'], {
    datasets: [{ dataset: 'meta', license: 'CDLA-Permissive-2.0' }],
    attributions: ['meta attribution'],
    termsUrls: ['https://example.org/meta'],
    notices: ['meta notice'],
  });
  const line = {
    type: 'row',
    key: 'a'.repeat(32),
    ...r.fields,
    provenance: r.provenance,
  };
  assert.deepEqual(validateLine(line), []);
});

test('an optional field without a grant is omitted; the row stays', () => {
  const p = policy([
    term('meta', [
      'name',
      'basic_category',
      'primary',
      'hierarchy',
      'geometry',
    ]),
  ]);
  const r = projectExportRow(listing(), evaluator(p));
  assert.equal(r.included, true);
  assert.deepEqual(Object.keys(r.fields), ['name', 'category', 'location']);
  assert.deepEqual(Object.keys(r.provenance), ['name', 'category', 'location']);
});

test('a non-exportable provider denies a merged field although other sources are granted', () => {
  const sources = FULL_SOURCES()
    .map((s) =>
      s.property === '/properties/phones'
        ? [s, src('/properties/phones', 'meta', { provider: 'Geoapify' })]
        : [s]
    )
    .flat();
  const r = projectExportRow(
    listing({ sources }),
    evaluator(policy([term('meta')]))
  );
  assert.equal(r.included, true);
  assert.ok(!('phone' in r.fields));
  assert.ok('website' in r.fields);
  // Matched by dataset name too, case-insensitively.
  const byDataset = FULL_SOURCES().concat(
    src('/properties/websites', 'geoapify-places')
  );
  const r2 = projectExportRow(
    listing({ sources: byDataset }),
    evaluator(policy([term('meta'), term('geoapify-places')]))
  );
  assert.ok(!('website' in r2.fields));
});

test('a non-exportable provider on a required field excludes the row', () => {
  const sources = FULL_SOURCES().concat(
    src('/properties/names/primary', 'meta', { provider: 'geoapify' })
  );
  assert.deepEqual(
    projectExportRow(listing({ sources }), evaluator(policy([term('meta')]))),
    { included: false, reason: 'required_fields' }
  );
});

test('required fields not eligible exclude the row', () => {
  const noGeometry = policy([
    term(
      'meta',
      ALL.filter((f) => f !== 'geometry')
    ),
  ]);
  assert.deepEqual(projectExportRow(listing(), evaluator(noGeometry)), {
    included: false,
    reason: 'required_fields',
  });
  assert.equal(
    projectExportRow(listing(), evaluator(policy([term('meta')], false)))
      .included,
    false
  );
  assert.equal(
    projectExportRow(
      listing({ sources: [] }),
      evaluator(policy([term('meta')]))
    ).included,
    false
  );
  assert.equal(
    projectExportRow(
      listing({ category: undefined }),
      evaluator(policy([term('meta')]))
    ).included,
    false
  );
});

test('adult rows are excluded', () => {
  assert.deepEqual(
    projectExportRow(
      listing({ adult: true }),
      evaluator(policy([term('meta')]))
    ),
    { included: false, reason: 'adult' }
  );
});

test('the schema rejects unknown row keys and bad lines', () => {
  assert.ok(
    validateLine({
      type: 'row',
      key: 'a'.repeat(32),
      assignmentChangeToken: 'x',
    }).length
  );
  assert.ok(
    validateLine({ type: 'trailer', rowCount: -1, excludedRows: 0 }).length
  );
  assert.deepEqual(
    validateLine({ type: 'trailer', rowCount: 2, excludedRows: 1 }),
    []
  );
  assert.ok(
    readFileSync(join(__dirname, '../src/export-schema.json'), 'utf8').includes(
      'draft-07'
    )
  );
});
