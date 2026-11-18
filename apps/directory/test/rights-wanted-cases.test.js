const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { wantedCases } = require('../src/rights-case');

const RELEASE = '2026-10-21.0';
const [POLICY] = JSON.parse(
  readFileSync(join(__dirname, '../rights-policies/policies.json'), 'utf8')
);
const whole = (dataset, license) => ({
  dataset,
  license,
  property: null,
  rows: 10,
});
const keys = (w) => w.map((c) => c.subjectKey).sort();

test('without a policy every whole-record source and the release need review', () => {
  const w = wantedCases(
    RELEASE,
    [whole('meta', 'CDLA-Permissive-2.0')],
    'publicDisplay'
  );
  assert.deepEqual(keys(w), [
    `release|${RELEASE}|publicDisplay`,
    `source|${RELEASE}|meta|CDLA-Permissive-2.0|*`,
  ]);
});

test('the release policy covers its mapped whole-record sources; an optional unpermitted field is not a gap', () => {
  const lineages = [
    whole('meta', 'CDLA-Permissive-2.0'),
    whole('Microsoft', 'CDLA-Permissive-2.0'),
    whole('BrightQuery', 'CDLA-Permissive-2.0'),
    whole('DAC', 'CDLA-Permissive-2.0'),
    whole('AllThePlaces', 'CC0-1.0'),
  ];
  for (const op of ['publicDisplay', 'export', 'publicExport'])
    assert.deepEqual(wantedCases(RELEASE, lineages, op, POLICY), [], op);
});

test('an unmapped source still needs review under the policy', () => {
  const w = wantedCases(
    RELEASE,
    [whole('Geoapify', 'ODbL-1.0'), whole('meta', 'CDLA-Permissive-2.0')],
    'publicDisplay',
    POLICY
  );
  assert.deepEqual(keys(w), [`source|${RELEASE}|Geoapify|ODbL-1.0|*`]);
});

test('a term missing a required field keeps the source in review', () => {
  const narrowed = {
    ...POLICY,
    terms: POLICY.terms.map((t) =>
      t.dataset === 'meta'
        ? {
            ...t,
            permissions: {
              ...t.permissions,
              publicDisplay: t.permissions.publicDisplay.filter(
                (f) => f !== 'geometry'
              ),
            },
          }
        : t
    ),
  };
  const w = wantedCases(
    RELEASE,
    [whole('meta', 'CDLA-Permissive-2.0')],
    'publicDisplay',
    narrowed
  );
  assert.deepEqual(keys(w), [`source|${RELEASE}|meta|CDLA-Permissive-2.0|*`]);
});
