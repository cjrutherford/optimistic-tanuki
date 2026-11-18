const test = require('node:test'),
  assert = require('node:assert/strict');
const {
  classifyListing,
  loadedFromFile,
  mappingHash,
  validateMappingFile,
  effectiveClassification,
} = require('../src/taxonomy-mapping');
const {
  TAXONOMY_MAPPINGS,
  findTaxonomyMapping,
} = require('../src/taxonomy-mapping-data');
const { handleTaxonomyRoute } = require('../src/taxonomy-routes');

const file = TAXONOMY_MAPPINGS[0];
const mapping = loadedFromFile(file);

test('the shipped mapping file is valid, unique and hashes deterministically', () => {
  assert.deepEqual(validateMappingFile(file), []);
  assert.equal(findTaxonomyMapping(file.version), file);
  assert.equal(findTaxonomyMapping('nope'), undefined);
  assert.match(mappingHash(file), /^[0-9a-f]{64}$/);
  assert.equal(
    mappingHash(file),
    mappingHash({ ...file, entries: [...file.entries].reverse() })
  );
  const keys = file.entries.map((e) => `${e.kind}:${e.key}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('validation rejects duplicate keys and unknown categories', () => {
  const dup = { ...file, entries: [...file.entries, file.entries[0]] };
  assert.ok(validateMappingFile(dup).length > 0);
  const bad = {
    ...file,
    entries: [
      ...file.entries,
      { kind: 'basic_category', key: 'zzz', categoryId: 'not_a_category' },
    ],
  };
  assert.ok(validateMappingFile(bad).length > 0);
});

test('classification: mapped, place type, unmapped, adult, node precedence', () => {
  assert.deepEqual(pick(classifyListing(mapping, { category: 'restaurant' })), [
    'restaurants',
    null,
    'mapping',
    false,
  ]);
  assert.deepEqual(
    pick(classifyListing(mapping, { category: 'radio_station' })),
    ['services', 'radio_station', 'mapping', false]
  );
  assert.deepEqual(pick(classifyListing(mapping, { category: 'who_knows' })), [
    'who_knows',
    null,
    'legacy',
    false,
  ]);
  const adultPath = { category: 'restaurant', taxonomyPath: ['adult_store'] };
  const excluded = classifyListing(mapping, adultPath);
  assert.equal(excluded.excluded, true);
  assert.equal(excluded.exclusionReason, 'adult_restricted');
  assert.equal(
    classifyListing(mapping, { ...adultPath, adult: true }).categoryId,
    'adult'
  );
  assert.equal(
    classifyListing(mapping, { category: '' }).exclusionReason,
    'missing_basic_category'
  );
  assert.equal(
    classifyListing(
      { ...mapping, unmappedPolicy: 'exclude' },
      { category: 'who_knows' }
    ).exclusionReason,
    'unmapped_taxonomy'
  );
});

test('an override beats the mapping and an exclusion', () => {
  const eff = effectiveClassification(
    mapping,
    { categoryId: 'activities', placeTypeId: null },
    { category: 'restaurant', taxonomyPath: ['adult_store'] }
  );
  assert.equal(eff.categoryId, 'activities');
  assert.equal(eff.basis, 'override');
  assert.equal(eff.excluded, false);
  assert.equal(
    effectiveClassification(null, null, { category: 'bar' }).categoryId,
    'bar'
  );
});

const pick = (c) => [c.categoryId, c.placeTypeId, c.basis, c.excluded];

function harness(method, url, body, secret = 's'.repeat(40)) {
  const calls = [];
  const noop = async (...a) => (calls.push(a), { ok: true });
  const checks = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        async (...a) => (calls.push([name, ...a]), null),
    }
  );
  const res = {
    status: 0,
    headers: {},
    writeHead(s, h) {
      this.status = s;
      this.headers = h;
      return this;
    },
    end() {},
  };
  const req = (async function* () {
    if (body !== undefined) yield Buffer.from(JSON.stringify(body));
  })();
  req.method = method;
  req.url = url;
  req.headers = { authorization: `Bearer ${secret}` };
  return {
    calls,
    res,
    run: () => handleTaxonomyRoute(req, res, checks, 's'.repeat(40)),
    noop,
  };
}
const A = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';

test('routes: auth, strict bodies and no-store', async () => {
  let h = harness(
    'GET',
    '/internal/taxonomy/mappings',
    undefined,
    'x'.repeat(40)
  );
  assert.equal(await h.run(), true);
  assert.equal(h.res.status, 401);
  assert.equal(h.res.headers['cache-control'], 'no-store');

  h = harness('POST', '/internal/taxonomy/mappings/install', {
    actorId: A,
    version: 'v',
    activate: true,
    extra: 1,
  });
  await h.run();
  assert.equal(h.res.status, 400);
  assert.equal(h.calls.length, 0);

  h = harness('POST', '/internal/taxonomy/mappings/install', {
    actorId: A,
    version: 'v',
    activate: true,
  });
  await h.run();
  assert.equal(h.res.status, 200);

  h = harness('GET', '/internal/taxonomy/runs?bogus=1');
  await h.run();
  assert.equal(h.res.status, 400);

  h = harness('GET', `/internal/taxonomy/runs/${ID}`);
  await h.run();
  assert.equal(h.res.status, 404);

  h = harness('DELETE', '/internal/taxonomy/cases');
  await h.run();
  assert.equal(h.res.status, 405);

  h = harness('GET', '/internal/other');
  assert.equal(await h.run(), false);
});

test('case flags: unmapped category, ambiguous equal-depth nodes, adult wins, known is quiet', () => {
  const { taxonomyCaseFlag } = require('../src/taxonomy-mapping');
  assert.deepEqual(
    taxonomyCaseFlag(mapping, { category: 'weird_unknown_category' }),
    { reason: 'unmapped_taxonomy', observed: 'weird_unknown_category' }
  );
  assert.equal(taxonomyCaseFlag(mapping, { category: 'restaurant' }), null);
  assert.equal(taxonomyCaseFlag(mapping, { category: '' }), null);
  const nodes = file.entries.filter(
    (e) =>
      e.kind === 'taxonomy_node' && e.categoryId && e.categoryId !== 'adult'
  );
  const a = nodes[0];
  const b = nodes.find((n) => n.categoryId !== a.categoryId);
  const flagged = taxonomyCaseFlag(mapping, {
    category: 'restaurant',
    taxonomyPaths: [[a.key], [b.key]],
  });
  assert.equal(flagged.reason, 'ambiguous_taxonomy');
  assert.equal(flagged.observed, [a.key, b.key].sort().join(' | '));
  // Deeper node on one path is more specific, so there is nothing to decide.
  assert.equal(
    taxonomyCaseFlag(mapping, {
      category: 'restaurant',
      taxonomyPaths: [[a.key], ['unknown_root', b.key]],
    }),
    null
  );
  // Two paths that agree are not ambiguous.
  assert.equal(
    taxonomyCaseFlag(mapping, { taxonomyPaths: [[a.key], [a.key]] }),
    null
  );
  const adult = file.entries.find(
    (e) => e.kind === 'taxonomy_node' && e.categoryId === 'adult'
  );
  assert.equal(
    taxonomyCaseFlag(mapping, { taxonomyPaths: [[a.key], [adult.key]] }),
    null
  );
});

test('routes: dismiss takes a strict body and reaches the check', async () => {
  const D = '33333333-3333-4333-8333-333333333333';
  const good = {
    actorId: A,
    decisionId: D,
    reason: 'not a real problem',
    expectedVersionToken: 'a'.repeat(64),
  };
  let h = harness('POST', `/internal/taxonomy/cases/${ID}/dismiss`, good);
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.calls[0][0], 'taxonomyDismiss');
  for (const bad of [
    { ...good, reason: ' ' },
    { ...good, action: 'dismiss' },
    { ...good, expectedVersionToken: 'x' },
    { ...good, decisionId: 'nope' },
  ]) {
    h = harness('POST', `/internal/taxonomy/cases/${ID}/dismiss`, bad);
    await h.run();
    assert.equal(h.res.status, 400);
    assert.equal(h.calls.length, 0);
  }
});
