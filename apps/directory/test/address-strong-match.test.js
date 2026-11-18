const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const {
  applyStrongMatchPolicy,
  D11_POLICY,
} = require('../src/address-strong-match');

const geometry = Buffer.from('0102', 'hex');
const boundary = (over = {}) => ({
  geometry: geometry.toString('hex'),
  geometryHash: createHash('sha256').update(geometry).digest('hex'),
  changeToken: 'token',
  geocode_inside: true,
  source_inside: true,
  ...over,
});
// A named interface, not an index signature, so property access compiles under noPropertyAccessFromIndexSignature.
const queryOf = (rows) => {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => (calls.push({ sql, params }), rows),
  };
};
const checks = () =>
  Object.fromEntries(
    [
      'singleAddress',
      'geocode',
      'geocodePrecision',
      'geocodeDistance',
      'officialEvidence',
      'officialName',
      'officialAddress',
      'officialPhone',
      'officialWebsite',
      'evidenceAge',
    ].map((k) => [k, 'pass'])
  );
const input = (over = {}) => ({
  communityId: '00000000-0000-4000-8000-000000000001',
  point: { lat: 31, lng: -83 },
  geocode: {
    status: 'match',
    coordinates: { lat: 31.0001, lng: -83.0001 },
    precision: 'rooftop',
  },
  decision: {
    verdict: 'auto_approve',
    reasons: [],
    checks: checks(),
    policyVersion: 'address-review-v1',
    thresholds: {},
  },
  ...over,
});

test('D11 names the policy the audit event records', () => {
  assert.equal(D11_POLICY, 'D11 strong match (owner 2026-11-18)');
});

test('a strong match inside the verified boundary is released', async () => {
  const q = queryOf([boundary()]);
  const out = await applyStrongMatchPolicy(q, input());
  assert.equal(out.released, true);
  assert.equal(out.decision.verdict, 'auto_approve');
  assert.ok(out.decision.reasons.includes('d11_strong_match'));
  assert.equal(out.decision.checks.d11StrongMatch, 'pass');
});

test('one point outside the boundary is held', async () => {
  for (const over of [{ geocode_inside: false }, { source_inside: false }]) {
    const out = await applyStrongMatchPolicy(
      queryOf([boundary(over)]),
      input()
    );
    assert.equal(out.released, false);
    assert.equal(out.decision.verdict, 'needs_human');
    assert.ok(out.decision.reasons.includes('point_outside_town'));
    assert.ok(out.decision.reasons.includes('auto_approval_paused'));
  }
});

test('no verified boundary, or a boundary whose hash no longer matches, is held', async () => {
  for (const rows of [[], [boundary({ geometryHash: 'f'.repeat(64) })]]) {
    const out = await applyStrongMatchPolicy(queryOf(rows), input());
    assert.equal(out.released, false);
    assert.ok(out.decision.reasons.includes('town_boundary_unverified'));
  }
});

test('sources that disagree are held without a boundary lookup', async () => {
  const bad = input();
  bad.decision.checks.officialAddress = 'unknown';
  const q = queryOf([boundary()]);
  const out = await applyStrongMatchPolicy(q, bad);
  assert.equal(out.released, false);
  assert.ok(out.decision.reasons.includes('sources_disagree'));
  assert.equal(q.calls.length, 0);
});

test('a missing source point or geocode point is held', async () => {
  for (const over of [
    { point: null },
    { geocode: { status: 'match', precision: 'rooftop' } },
    { geocode: null },
  ]) {
    const out = await applyStrongMatchPolicy(
      queryOf([boundary()]),
      input(over)
    );
    assert.equal(out.released, false);
    assert.equal(out.decision.verdict, 'needs_human');
  }
});

test('a decision the classifier did not approve is returned unchanged', async () => {
  for (const verdict of ['needs_human', 'reject']) {
    const base = input();
    base.decision.verdict = verdict;
    const q = queryOf([boundary()]);
    const out = await applyStrongMatchPolicy(q, base);
    assert.equal(out.decision, base.decision);
    assert.equal(out.released, false);
    assert.equal(q.calls.length, 0);
  }
});
