const test = require('node:test'),
  assert = require('node:assert/strict');
const {
  applyFieldExclusions,
  exportKeysForRightsField,
} = require('../src/export-job');
const { evaluateOvertureFieldRights } = require('../src/overture-rights');
const { buildPublicExport } = require('../src/public-export');

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
const POINTERS = [
  '/properties/names/primary',
  '/basic_category',
  '/taxonomy/primary',
  '/taxonomy/hierarchy',
  '/geometry',
  '/properties/addresses',
  '/properties/phones',
  '/properties/websites',
];
const sources = (license = 'CC0-1.0') =>
  POINTERS.map((property) => ({ property, dataset: 'osm', license }));
const policy = (over = {}) => ({
  releaseId: 'rel-1',
  operations: { publicExport: true, ...over.operations },
  terms: [
    {
      dataset: 'osm',
      license: 'CC0-1.0',
      attribution: 'Data from OpenStreetMap contributors',
      termsUrl: 'https://example.org/terms',
      permissions: { publicExport: over.fields ?? ALL },
    },
  ],
});
const listing = (name, over = {}) => ({
  name,
  category: 'cafe',
  location: { type: 'Point', coordinates: [-83.5, 31.25] },
  address: '1 Main St',
  phone: '+15555550100',
  website: 'https://example.org',
  sources: sources(),
  ...over,
});
const fakeDb = (rows, evidence = [{ releaseId: 'rel-1' }]) => ({
  calls: [],
  async query(sql, params) {
    this.calls.push(sql);
    if (/FROM directory_town_scan_target/.test(sql)) return [{ scanId: 's1' }];
    if (/directory_overture_source_evidence/.test(sql)) return evidence;
    if (/FROM directory_rights_case/.test(sql)) return [];
    if (
      /directory_overture_private_row r|SERVED|FROM directory_overture/.test(
        sql
      )
    )
      return params[1] === '-1'
        ? rows.map((listing, i) => ({ n: String(i + 1), listing }))
        : [];
    throw Error(`unexpected sql ${sql.slice(0, 60)}`);
  },
});
const base = (p) => ({
  town: '00000000-0000-4000-8000-000000000001',
  format: 'jsonl',
  changeToken: 't',
  policyFor: (r) => (r === 'rel-1' ? p : undefined),
});

test('exportKeysForRightsField maps rights fields to export keys', () => {
  assert.deepEqual(exportKeysForRightsField('phone'), ['phone']);
  assert.deepEqual(exportKeysForRightsField('primary'), ['category']);
  assert.deepEqual(exportKeysForRightsField('alternate'), []);
});

test('applyFieldExclusions denies only the excluded field from the excluded source', () => {
  const ev = evaluateOvertureFieldRights(
    { releaseId: 'rel-1', sources: sources() },
    'publicExport',
    policy()
  );
  assert.equal(ev.fields.phone.status, 'eligible');
  const out = applyFieldExclusions(ev, [
    { field: 'phone', dataset: 'osm', license: 'CC0-1.0' },
    { field: 'website', dataset: 'other', license: 'CC0-1.0' },
  ]);
  assert.equal(out.fields.phone.status, 'omitted');
  assert.equal(out.fields.website.status, 'eligible');
  assert.equal(applyFieldExclusions(ev, []), ev);
});

test('public export is default off and needs the publicExport operation and field grants', async () => {
  const db = fakeDb([listing('A')]);
  assert.deepEqual(
    await buildPublicExport(
      db,
      base(policy({ operations: { publicExport: false } }))
    ),
    { ok: false, code: 'no_public_export' }
  );
  assert.deepEqual(await buildPublicExport(db, base(undefined)), {
    ok: false,
    code: 'no_public_export',
  });
  assert.deepEqual(await buildPublicExport(db, base(policy({ fields: [] }))), {
    ok: false,
    code: 'no_public_export',
  });
  // An operator `export` grant alone never enables it.
  const operatorOnly = {
    ...policy(),
    operations: { export: true },
    terms: [{ ...policy().terms[0], permissions: { export: ALL } }],
  };
  assert.equal((await buildPublicExport(db, base(operatorOnly))).ok, false);
});

test('public export JSONL and CSV carry attribution, drop adult rows and Geoapify values, and neutralise formulas', async () => {
  const geo = listing('Geo', {
    sources: sources().concat({
      property: '/properties/phones',
      dataset: 'osm',
      license: 'CC0-1.0',
      provider: 'Geoapify',
    }),
  });
  const db = fakeDb([
    listing('=SUM(1)', { phone: '+15555550101' }),
    listing('Adult', { adult: true }),
    geo,
    listing('Third'),
  ]);
  const json = await buildPublicExport(db, base(policy()));
  assert.equal(json.ok, true);
  const lines = json.body.trimEnd().split('\n').map(JSON.parse);
  assert.equal(lines[0].schema, 'town-square-public-export/v1');
  assert.deepEqual(lines[0].attributions, [
    'Data from OpenStreetMap contributors',
  ]);
  assert.deepEqual(lines[0].sources, [{ dataset: 'osm', license: 'CC0-1.0' }]);
  const rows = lines.filter((l) => l.type === 'row');
  assert.deepEqual(
    rows.map((r) => r.name),
    ['=SUM(1)', 'Geo', 'Third']
  );
  assert.ok(!('phone' in rows[1]));
  assert.ok(!json.body.includes('Adult'));

  const csv = await buildPublicExport(db, { ...base(policy()), format: 'csv' });
  const text = csv.body.split('\r\n');
  assert.ok(
    text.includes('# Attribution: Data from OpenStreetMap contributors')
  );
  assert.ok(text.includes('# Source: osm, licence CC0-1.0'));
  assert.ok(text.some((l) => l.startsWith("'=SUM(1),cafe,31.25,-83.5,")));

  const capped = await buildPublicExport(db, { ...base(policy()), rowCap: 1 });
  assert.equal(capped.rowCount, 1);
  assert.equal(capped.truncated, true);
});
