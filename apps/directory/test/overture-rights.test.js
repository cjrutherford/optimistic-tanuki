const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateOvertureFieldRights, OVERTURE_RIGHTS_FIELDS, OVERTURE_RIGHTS_FIELDS_LEGACY_V1 } = require('../src/overture-rights');
const releaseId = '2026-10-21.0';
const source = (property, dataset = 'example') => ({ property, dataset, license: 'test' });
const policy = { releaseId, operations: { ingest: true }, terms: [{ dataset: 'example', license: 'test', attribution: 'Example', termsUrl: 'https://example.test/terms', notice: 'Notice', permissions:{ingest:Object.keys(OVERTURE_RIGHTS_FIELDS)} }] };
const run = (sources, operation = 'ingest', p = policy) => evaluateOvertureFieldRights({ releaseId, sources }, operation, p);
test('denies unapproved operations, releases and default policy', () => {
  assert.equal(run([source('')], 'publicDisplay').eligible, false);
  assert.equal(run([source('')], 'ingest', { ...policy, releaseId: '2026-09-23.0' }).eligible, false);
  assert.equal(evaluateOvertureFieldRights({ releaseId, sources: [source('')] }, 'ingest').eligible, false);
  assert.equal(run([source('')], 'ingest', { ...policy, terms: [{ ...policy.terms[0], termsUrl: 'http://example.test/terms' }] }).eligible, false);
});
test('requires a field-specific grant for each source and operation', () => {
  const restricted={...policy,terms:[{...policy.terms[0],permissions:{ingest:['name']}}]};
  const result=run([source('')],'ingest',restricted);
  assert.equal(result.fields.name.status,'eligible');
  assert.equal(result.fields.geometry.status,'review');
  assert.equal(result.eligible,false);
  const conflict={...policy,terms:[policy.terms[0],{...policy.terms[0],permissions:{ingest:[]}}]};
  assert.equal(run([source('')],'ingest',conflict).eligible,false);
});
test('aggregates attribution and all overlapping lineage without prefix collisions', () => {
  const result = run([source(''), source('/properties/names/primary/0'), source('/properties/names/primaryExtra', 'unknown')]);
  assert.equal(result.eligible, true);
  assert.deepEqual(result.fields.name.attributions, ['Example']);
  assert.deepEqual(result.fields.name.notices, ['Notice']);
  assert.equal(result.fields.name.sources.length, 2);
  assert.equal(run([source(''), source('/properties/names/primary/0', 'unknown')]).eligible, false);
});
test('omits optional unknown lineage but quarantines required unknown lineage', () => {
  const optional = run([source(''), source('/properties/phones', 'unknown')]);
  assert.equal(optional.eligible, true);
  assert.equal(optional.fields.phone.impact, 'omit_field');
  assert.equal(optional.reviewRequired, true);
  const required = run([source(''), source('/geometry', 'unknown')]);
  assert.equal(required.eligible, false);
  assert.equal(required.fields.geometry.impact, 'quarantine_record');
});
test('malformed lineage fails closed without throwing', () => {
  for (const bad of [null, 3, { property: '/bad~2path', dataset: 'example', license: 'test' }, { property: null, dataset: 'example', license: 'test' }]) {
    const result = run([source(''), bad]);
    assert.equal(result.eligible, false);
    assert.equal(result.fields.name.reasons.includes('ambiguous_source_pointer'), true);
  }
  assert.equal(run('invalid').eligible, false);
  const sparse=[source('')]; sparse.length=2; assert.equal(run(sparse).eligible,false);
});
test('inherited policy approvals are not explicit grants', () => {
  const inheritedOps={...policy,operations:Object.create(policy.operations)};
  assert.equal(run([source('')],'ingest',inheritedOps).eligible,false);
  const inheritedFields={...policy,terms:[{...policy.terms[0],permissions:Object.create(policy.terms[0].permissions)}]};
  assert.equal(run([source('')],'ingest',inheritedFields).eligible,false);
});
test('rejects sparse or inherited field permission elements', () => {
  const fields=Object.keys(OVERTURE_RIGHTS_FIELDS);
  const inherited=fields.slice(); delete inherited[0];
  const proto=Object.create(Array.prototype); proto[0]=fields[0]; Object.setPrototypeOf(inherited,proto);
  for (const grant of [inherited, [...fields, ,]]) {
    const p={...policy,terms:[{...policy.terms[0],permissions:{ingest:grant}}]};
    assert.equal(run([source('')],'ingest',p).eligible,false);
  }
});

// Existing approved policies were derived from the rights map before `id` existed. The derivation scripts
// use the frozen legacy list, so the live October policy and its September predecessor keep their ids.
test('the frozen legacy field list derives the existing October and September policy ids', () => {
  const crypto = require('node:crypto');
  const fs = require('node:fs');
  const hash = (x) => crypto.createHash('sha256').update(x).digest('hex');
  assert.deepEqual([...OVERTURE_RIGHTS_FIELDS_LEGACY_V1], Object.keys(OVERTURE_RIGHTS_FIELDS).filter((name) => name !== 'id'));
  assert.ok(Object.keys(OVERTURE_RIGHTS_FIELDS).includes('id'));
  assert.ok(Object.isFrozen(OVERTURE_RIGHTS_FIELDS_LEGACY_V1));
  const inventory = JSON.parse(fs.readFileSync('docs/plans/town-square-directory/S4a1-overture-2026-10-21-metadata.json', 'utf8'));
  const derive = (fields) => {
    const permissions = Object.fromEntries(['ingest', 'retain', 'privateDisplay'].map((op) => [op, fields]));
    const terms = (month) => ['meta', 'Microsoft', 'BrightQuery', 'DAC'].map((dataset) => ({ dataset, license: 'CDLA-Permissive-2.0', attribution: `${dataset}; Overture Maps Foundation (${month} 2026)`, termsUrl: 'https://cdla.dev/permissive-2.0/', notice: 'CDLA Permissive 2.0', permissions }));
    const october = { releaseId: inventory.release, operations: { ingest: true, retain: true, privateDisplay: true }, terms: terms('October') };
    const september = { releaseId: '2026-09-23.0', operations: { ingest: true, retain: true, privateDisplay: true }, terms: [...terms('September'), { dataset: 'AllThePlaces', license: 'CC0-1.0', attribution: 'AllThePlaces; Overture Maps Foundation (September 2026)', termsUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', notice: 'CC0 1.0', permissions }] };
    return {
      october: hash(JSON.stringify({ rights: october, inventory: inventory.inventorySha256, scope: 'local-evaluation-october-v1' })),
      september: hash(JSON.stringify({ policy: september, classification: 'local-low-risk-v4', artifactSha256: '72355d674966b9f84d4293be9420f6ced0d454247d005e739bac014de728237c' })),
    };
  };
  const legacy = derive([...OVERTURE_RIGHTS_FIELDS_LEGACY_V1]);
  assert.equal(legacy.october, '198734c171e63737da0238057000b733cfd23e781e0a5b60a0fc7e36973dd47f');
  assert.equal(legacy.september, '7be2956e12b3130ec074f0da0dc513f8e42d7332e1112ccc43fb137e255e10d4');
  // The full list is a different, new policy.
  const full = derive(Object.keys(OVERTURE_RIGHTS_FIELDS));
  assert.notEqual(full.october, legacy.october);
  assert.notEqual(full.september, legacy.september);
});
