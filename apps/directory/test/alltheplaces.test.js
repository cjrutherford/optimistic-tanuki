const test = require('node:test'),
  assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const atp = require('../src/alltheplaces');
const auth = require('../src/acquisition-authorization');
const geo = require('../src/geoapify-enrichment');
const { projectStagedRow } = require('../src/overture-stage-core');

const policies = JSON.parse(
  readFileSync(join(__dirname, '../rights-policies/policies.json'), 'utf8')
);
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures/alltheplaces-synthetic.geojson'),
    'utf8'
  )
);
const policy = atp.selectAtpPolicy(policies);

test('the pinned archive is the official run output on the official host', () => {
  assert.ok(policy);
  assert.equal(policy.archive.runId, '2026-11-07-13-32-32');
  assert.match(policy.archive.sha256, /^[0-9a-f]{64}$/);
  const pin = policy.archive;
  assert.equal(atp.validAtpArchive(pin), true);
  for (const bad of [
    { ...pin, url: pin.url.replace('openaddresses.io', 'example.com') },
    { ...pin, url: pin.url + '?x=1' },
    { ...pin, url: pin.url.replace('output.zip', 'other.zip') },
    { ...pin, url: pin.url.replace('https', 'http') },
    { ...pin, sha256: 'abc' },
    { ...pin, sizeBytes: 0 },
    { ...pin, runId: '2026-11-08-00-00-00' },
  ])
    assert.equal(atp.validAtpArchive(bad), false);
  assert.equal(atp.selectAtpPolicy([policies[0]]), null);
});

test('authorization: overture and alltheplaces acquire; geoapify is private enrichment only', () => {
  const table = Object.fromEntries(
    auth.providerAuthorizationTable().map((r) => [r.provider, r])
  );
  assert.equal(table.overture.acquisition, true);
  assert.equal(table.alltheplaces.acquisition, true);
  assert.equal(table.geoapify.acquisition, false);
  assert.equal(table.geoapify.privateEnrichment, true);
  assert.equal(table.geoapify.scope, 'private-enrichment-only');
  for (const r of Object.values(table))
    assert.equal(r.publicDisplayAndExport, false);
  assert.equal(auth.isAcquisitionAuthorized('geoapify'), false);
});

test('features map to low-risk rows; spider id and ref only form the keyed id', () => {
  const rows = fixture.features.map((f) =>
    atp.atpFeatureToRow(f, 'syn_spider')
  );
  assert.equal(rows[0].names.primary, 'Synthetic Diner');
  assert.equal(rows[0].basic_category, 'restaurant');
  assert.equal(rows[0].id, 'syn_spider:1001');
  assert.equal(rows[1].names.primary, 'Synthetic Hardware');
  assert.equal(rows[2], null, 'a clinic is not a low-risk category');
  assert.equal(rows[3], null, 'a line is not a place');
});

test('public listing shows the CC0 attribution and no spider id or ref', () => {
  const row = atp.atpFeatureToRow(fixture.features[0], 'syn_spider');
  const out = projectStagedRow({
    source: {
      names: row.names,
      basic_category: row.basic_category,
      taxonomy: row.taxonomy,
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
      sources: atp.ATP_SOURCES,
    },
    releaseId: policy.releaseId,
    rights: policy,
  });
  assert.equal(out.status, 'eligible');
  assert.deepEqual(out.listing.attribution, ['AllThePlaces contributors, CC0']);
  // Stored provenance lets the field-rights evaluator, and so the public export, include the row.
  assert.deepEqual(out.listing.sources, atp.ATP_SOURCES);
  const text = JSON.stringify(out.listing);
  assert.doesNotMatch(text, /syn_spider|1001/);
  const {
    projectPublicOverture,
  } = require('../src/overture-public-projection');
  const pub = projectPublicOverture(
    {
      releaseId: policy.releaseId,
      sources: atp.ATP_SOURCES,
      names: row.names,
      basic_category: row.basic_category,
      taxonomy: row.taxonomy,
      geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
    },
    { residential: false, sensitive: false, adult: false },
    policy,
    false
  );
  assert.equal(pub.status, 'eligible');
  assert.deepEqual(pub.listing.attribution, ['AllThePlaces contributors, CC0']);
  assert.deepEqual(pub.listing.notices, ['CC0 1.0']);
  assert.doesNotMatch(JSON.stringify(pub.listing), /syn_spider|1001/);
});

test('dedupe against Overture: same name within 150 m, and the ATP-source case is reported separately', () => {
  const index = new atp.OvertureDedupeIndex([
    {
      name: 'Synthetic Diner',
      coordinates: [-87.5, 31.5],
      carriesAtpSource: true,
    },
    {
      name: "Bob's  Hardware",
      coordinates: [-87.6, 31.6],
      carriesAtpSource: false,
    },
  ]);
  assert.equal(
    index.match('synthetic diner', [-87.5005, 31.5]),
    'overture_atp_source_same_place'
  );
  assert.equal(
    index.match("BOB'S HARDWARE", [-87.6, 31.6005]),
    'overture_same_place'
  );
  assert.equal(index.match('Synthetic Diner', [-87.52, 31.5]), null, 'too far');
  assert.equal(index.match('Other Name', [-87.5, 31.5]), null);
});

test('geoapify policy is private-only with a retention period; details drop email and unknown fields', () => {
  const p = geo.selectGeoapifyPolicy(policies);
  assert.ok(p && p.retentionDays >= 1);
  assert.equal(
    geo.selectGeoapifyPolicy([
      {
        releaseId: 'x',
        provider: 'geoapify',
        operations: { publicDisplay: true },
        retentionDays: 5,
      },
    ]),
    null
  );
  const d = geo.extractPrivateDetails({
    features: [
      {
        properties: {
          opening_hours: 'Mo-Fr 09:00-17:00',
          website: 'https://example.invalid',
          contact: { phone: '+1 555 0100', email: 'a@b.invalid' },
          rating: 5,
        },
      },
    ],
  });
  assert.deepEqual(d, {
    openingHours: 'Mo-Fr 09:00-17:00',
    phone: '+1 555 0100',
    website: 'https://example.invalid',
  });
  assert.deepEqual(geo.extractPrivateDetails(null), {});
});

test('the public projection and public export never read Geoapify-derived data', () => {
  for (const f of [
    'overture-public-projection.ts',
    'public-export.ts',
    'export-job.ts',
    'local-listings.ts',
  ]) {
    let src;
    try {
      src = readFileSync(join(__dirname, '../src', f), 'utf8');
    } catch {
      continue;
    }
    assert.doesNotMatch(src, /directory_geoapify_enrichment/, f);
    assert.doesNotMatch(src, /geoapify-enrichment/, f);
    assert.doesNotMatch(src, /DirectoryGeoapifyEnrichment/, f);
  }
  // The only readers of the table are the enrichment module itself and the data-source/lifecycle registrations.
  const { execSync } = require('node:child_process');
  const hits = execSync(
    `grep -rl "directory_geoapify_enrichment\\|DirectoryGeoapifyEnrichment" ${join(
      __dirname,
      '../src'
    )} || true`
  )
    .toString()
    .trim()
    .split('\n')
    .map((p) => p.split('/').pop())
    .sort();
  assert.deepEqual(hits, [
    'account-lifecycle-dispositions.ts',
    'data-source.ts',
    'entity.ts',
    'geoapify-enrichment.ts',
  ]);
});

test('staged listings keep only source records the private sink accepts', () => {
  const { privateSources } = require('../src/overture-stage-core');
  const ok = {
    property: '/properties/names',
    dataset: 'meta',
    license: 'CDLA',
  };
  const long = 'x'.repeat(201);
  assert.deepEqual(
    privateSources([
      { ...ok, record_id: 'secret', update_time: 'now' },
      { dataset: 'd' },
      { dataset: '', license: 'l' },
      { dataset: long, license: 'l' },
      { ...ok, property: 'no-slash' },
      { dataset: 'd', license: 'l', property: '' },
      null,
      'x',
    ]),
    [ok, { dataset: 'd', license: 'l', property: '' }]
  );
  assert.equal(privateSources(Array(30).fill(ok)).length, 20);
  assert.deepEqual(privateSources(undefined), []);
  assert.deepEqual(privateSources({ dataset: 'd', license: 'l' }), []);
});

test('Geoapify: redaction and the provider limit', () => {
  const { providerLimitCents } = require('../src/provider-budget');
  assert.equal(
    geo.redactSecrets('GET https://x/v2?lat=1&apiKey=abc123&lon=2', 'abc123'),
    'GET https://x/v2?lat=1&apiKey=[redacted]&lon=2'
  );
  assert.equal(
    geo.redactSecrets('plain secret-key here', 'secret-key'),
    'plain [redacted] here'
  );
  const limit = (v) =>
    providerLimitCents(
      'geoapify',
      v === undefined ? {} : { DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS: v }
    );
  assert.equal(limit(undefined), 2500);
  assert.equal(limit('1000'), 1000);
  assert.equal(limit('9999'), 2500, 'never above the $25 ceiling');
  assert.equal(limit('abc'), 0, 'unusable means nothing may be spent');
  assert.equal(limit('-5'), 0);
  assert.equal(
    providerLimitCents('overture', {
      DIRECTORY_GEOAPIFY_MONTHLY_LIMIT_CENTS: '1',
    }),
    2500
  );
});
