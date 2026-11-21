import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRecord,
  readProjection,
  withdraw,
} from './s4a2-private-pilot.mjs';

const source = 'Fixture|CC0-1.0';
const fields = {
  name: 'Fixture Bakery',
  businessLocation: 'Synthetic Main St',
  category: 'Bakery',
  provenance: 'Synthetic fixture',
  freshness: '2026-01-01',
  phone: '555-0100',
  email: 'person@example.invalid',
  personalDetails: 'synthetic adult',
  residentialDetails: 'synthetic home',
  enrichment: 'synthetic enrichment',
  sourceId: 'fixture-id',
};
const record = (overrides) => ({
  fields: structuredClone(fields),
  lineage: Object.fromEntries(
    ['name', 'businessLocation', 'category', 'provenance', 'freshness'].map(
      (k) => [k, [{ dataset: 'Fixture', license: 'CC0-1.0' }]]
    )
  ),
  sensitiveLocation: false,
  adultClassification: 'non-adult',
  adultOptIn: true,
  residential: false,
  ...overrides,
});
const policy = (overrides) => ({
  requiredFields: ['name', 'businessLocation', 'category'],
  sources: {
    [source]: {
      requiredNotices: ['Synthetic fixture attribution'],
      store: 'allow',
      privateDisplay: 'allow',
      publicDisplay: 'allow',
    },
  },
  operations: {
    store: 'allow',
    privateDisplay: 'allow',
    publicDisplay: 'deny',
    search: 'deny',
    map: 'deny',
    cache: 'deny',
    export: 'deny',
  },
  attribution: ['Synthetic fixture attribution'],
  ...overrides,
});

test('projects only the minimal candidate allowlist and denies unapproved read surfaces', () => {
  const result = evaluateRecord(record(), policy());
  assert.equal(result.allowed, true);
  assert.deepEqual(
    Object.keys(result.projection).sort(),
    ['businessLocation', 'category', 'name', 'provenance', 'freshness'].sort()
  );
  assert.equal(result.projection.phone, undefined);
  assert.equal(result.attribution[0], 'Synthetic fixture attribution');
  assert.deepEqual(result.withdrawal.invalidates, [
    'projection',
    'search',
    'map',
    'cache',
    'export',
  ]);
  assert.equal(result.withdrawal.scope, 'this in-memory evaluation only');
  for (const surface of ['publicDisplay', 'search', 'map', 'cache', 'export'])
    assert.equal(readProjection(result, surface), null);
  const privateRead = readProjection(result, 'privateDisplay');
  assert.equal(privateRead.projection.name, 'Fixture Bakery');
  assert.deepEqual(privateRead.attribution, ['Synthetic fixture attribution']);
  assert.equal(privateRead.proofScope, 'in-memory evaluation only');
  withdraw(result);
  for (const surface of [
    'privateDisplay',
    'publicDisplay',
    'search',
    'map',
    'cache',
    'export',
  ])
    assert.equal(readProjection(result, surface), null);
  assert.equal(result.projection, null);
});

test('quarantines missing lineage, unknown or conflicting rights, and incomplete required data', () => {
  const missing = record();
  delete missing.lineage.name;
  assert.equal(evaluateRecord(missing, policy()).allowed, false);
  assert.equal(
    evaluateRecord(
      record({
        lineage: {
          ...record().lineage,
          name: [{ dataset: 'Unknown', license: 'Unknown' }],
        },
      }),
      policy()
    ).allowed,
    false
  );
  assert.equal(
    evaluateRecord(record({ fields: { ...fields, name: null } }), policy())
      .allowed,
    false
  );
  const mixed = record({
    lineage: {
      ...record().lineage,
      name: [
        { dataset: 'Fixture', license: 'CC0-1.0' },
        { dataset: 'Unknown', license: 'Unknown' },
      ],
    },
  });
  assert.equal(evaluateRecord(mixed, policy()).allowed, false);
  assert.equal(
    evaluateRecord(
      record(),
      policy({ operations: { store: 'deny', privateDisplay: 'allow' } })
    ).allowed,
    false
  );
  assert.equal(
    evaluateRecord(
      record(),
      policy({ operations: { store: 'allow', privateDisplay: 'deny' } })
    ).allowed,
    false
  );
});

test('omits optional fields whose display lineage is unknown and excludes restricted fields', () => {
  const r = record({
    fields: { ...fields, freshness: 'synthetic' },
    lineage: {
      ...record().lineage,
      freshness: [{ dataset: 'Unreviewed', license: 'Unknown' }],
    },
  });
  const result = evaluateRecord(r, policy());
  assert.equal(result.allowed, true);
  assert.equal(result.projection.freshness, undefined);
  const deniedStore = record({
    lineage: {
      ...record().lineage,
      freshness: [{ dataset: 'Fixture', license: 'CC0-1.0' }],
    },
  });
  const noStore = policy({
    sources: {
      [source]: {
        requiredNotices: ['Synthetic fixture attribution'],
        store: 'deny',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
      },
    },
  });
  assert.equal(
    evaluateRecord(deniedStore, noStore).projection?.freshness,
    undefined
  );
  for (const field of [
    'phone',
    'email',
    'personalDetails',
    'residentialDetails',
    'enrichment',
    'sourceId',
  ])
    assert.equal(result.projection[field], undefined);
});

test('blocks sensitive, adult-ineligible and residential records and requires attribution', () => {
  for (const overrides of [
    { sensitiveLocation: true },
    { sensitiveLocation: undefined },
    { adultClassification: 'unknown' },
    { residential: true },
    { residential: undefined },
  ])
    assert.equal(evaluateRecord(record(overrides), policy()).allowed, false);
  assert.equal(
    evaluateRecord(
      record({ adultClassification: 'non-adult', adultOptIn: undefined }),
      policy()
    ).allowed,
    true
  );
  assert.equal(
    evaluateRecord(record(), policy({ attribution: [] })).allowed,
    false
  );
});

test('operation rights are independently gated and export always returns no data', () => {
  const p = policy({
    operations: {
      store: 'allow',
      privateDisplay: 'allow',
      publicDisplay: 'allow',
      search: 'allow',
      map: 'allow',
      cache: 'allow',
      export: 'allow',
    },
    sources: {
      [source]: {
        requiredNotices: ['Synthetic fixture attribution'],
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
        search: 'allow',
        map: 'allow',
        cache: 'allow',
        export: 'allow',
      },
    },
  });
  const result = evaluateRecord(record(), p);
  for (const surface of ['publicDisplay', 'search', 'map', 'cache']) {
    const read = readProjection(result, surface);
    assert.equal(read.projection.name, 'Fixture Bakery');
    assert.deepEqual(read.attribution, ['Synthetic fixture attribution']);
    assert.equal(read.proofScope, 'in-memory evaluation only');
  }
  assert.equal(readProjection(result, 'export'), null);
  const mixedPolicy = policy({
    operations: {
      store: 'allow',
      privateDisplay: 'allow',
      publicDisplay: 'allow',
      search: 'allow',
      map: 'allow',
      cache: 'allow',
      export: 'deny',
    },
    sources: {
      [source]: {
        requiredNotices: ['Synthetic fixture attribution'],
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
      },
    },
  });
  const mixed = evaluateRecord(record(), mixedPolicy);
  assert.equal(mixed.allowed, true);
  assert.equal(
    readProjection(mixed, 'publicDisplay').projection.name,
    'Fixture Bakery'
  );
  assert.equal(readProjection(mixed, 'search'), null);
});

test('rejects nested restricted payloads in candidate output', () => {
  const r = record({
    fields: {
      ...fields,
      businessLocation: {
        label: 'Fixture street',
        contact: 'nested leak',
        homeAddress: 'nested leak',
      },
    },
  });
  assert.equal(evaluateRecord(r, policy()).allowed, false);
  assert.equal(
    evaluateRecord(record(), policy({ sources: { [source]: true } })).allowed,
    false
  );
});

test('visitor opt-in controls adult display and cannot authorize a shared cache', () => {
  const p = policy({
    operations: {
      store: 'allow',
      privateDisplay: 'allow',
      publicDisplay: 'allow',
      search: 'allow',
      map: 'allow',
      cache: 'allow',
    },
    sources: {
      [source]: {
        requiredNotices: ['Synthetic fixture attribution'],
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
        search: 'allow',
        map: 'allow',
        cache: 'allow',
      },
    },
  });
  const result = evaluateRecord(
    record({ adultClassification: 'adult', adultOptIn: undefined }),
    p
  );
  assert.equal(result.allowed, true);
  for (const surface of [
    'privateDisplay',
    'publicDisplay',
    'search',
    'map',
    'cache',
  ])
    assert.equal(readProjection(result, surface), null);
  for (const surface of ['privateDisplay', 'publicDisplay', 'search', 'map'])
    assert.ok(readProjection(result, surface, { adultOptIn: true }));
  assert.equal(readProjection(result, 'cache', { adultOptIn: true }), null);
});

test('optional business contact fields require independent verification and rights', () => {
  const lineage = {
    ...record().lineage,
    website: [{ dataset: 'Fixture', license: 'CC0-1.0' }],
    phone: [{ dataset: 'Fixture', license: 'CC0-1.0' }],
    streetAddress: [{ dataset: 'Fixture', license: 'CC0-1.0' }],
  };
  const r = record({
    adultClassification: 'non-adult',
    fields: {
      ...fields,
      website: 'https://bakery.example.com/',
      streetAddress: '123 Market Street',
    },
    lineage,
    verifiedBusinessFields: { website: true, phone: true, streetAddress: true },
  });
  const result = evaluateRecord(r, policy());
  assert.equal(result.projection.website, 'https://bakery.example.com/');
  assert.equal(result.projection.phone, '555-0100');
  assert.equal(result.projection.streetAddress, '123 Market Street');
  const unverified = evaluateRecord(
    { ...r, verifiedBusinessFields: {} },
    policy()
  );
  assert.equal(unverified.projection.website, undefined);
  assert.equal(unverified.projection.phone, undefined);
  assert.equal(unverified.projection.streetAddress, undefined);
  const unsafe = evaluateRecord(
    { ...r, fields: { ...r.fields, website: 'http://127.0.0.1/admin' } },
    policy()
  );
  assert.equal(unsafe.projection.website, undefined);
});

test('source notice requirements must be explicit and included in displayed attribution', () => {
  const missing = policy({
    sources: {
      [source]: {
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
      },
    },
  });
  assert.equal(evaluateRecord(record(), missing).allowed, false);
  const omitted = policy({
    sources: {
      [source]: {
        requiredNotices: ['Required source notice'],
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
      },
    },
  });
  assert.equal(evaluateRecord(record(), omitted).allowed, false);
  const provided = policy({
    sources: {
      [source]: {
        requiredNotices: ['Required source notice'],
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
      },
    },
    attribution: ['Required source notice'],
  });
  assert.equal(evaluateRecord(record(), provided).allowed, true);
});

test('inherited rights and visitor flags cannot grant public access', () => {
  const inheritedOperations = Object.create({
    store: 'allow',
    privateDisplay: 'allow',
  });
  assert.equal(
    evaluateRecord(record(), policy({ operations: inheritedOperations }))
      .allowed,
    false
  );
  const inheritedSource = Object.create({
    [source]: {
      requiredNotices: ['Synthetic fixture attribution'],
      store: 'allow',
      privateDisplay: 'allow',
      publicDisplay: 'allow',
    },
  });
  assert.equal(
    evaluateRecord(record(), policy({ sources: inheritedSource })).allowed,
    false
  );
  const adultPolicy = policy({
    operations: {
      store: 'allow',
      privateDisplay: 'allow',
      publicDisplay: 'allow',
    },
    sources: {
      [source]: {
        requiredNotices: ['Synthetic fixture attribution'],
        store: 'allow',
        privateDisplay: 'allow',
        publicDisplay: 'allow',
      },
    },
  });
  const adult = evaluateRecord(
    record({ adultClassification: 'adult' }),
    adultPolicy
  );
  assert.equal(
    readProjection(adult, 'publicDisplay', Object.create({ adultOptIn: true })),
    null
  );
});
