const test = require('node:test');
const assert = require('node:assert/strict');
const {
  derivePolicyVersion,
  currentPolicyVersion,
  POLICY_VERSION_PATTERN,
} = require('../src/policy-version');
const a = 'a'.repeat(64);
const b = 'b'.repeat(64);

test('policyVersion is short hex, stable and order independent', () => {
  const v = derivePolicyVersion([a, b], 'g1');
  assert.match(v, POLICY_VERSION_PATTERN);
  assert.equal(derivePolicyVersion([b, a, a], 'g1'), v);
});
test('policyVersion changes with the policy set or generation', () => {
  const v = derivePolicyVersion([a], 'g1');
  assert.notEqual(derivePolicyVersion([a, b], 'g1'), v);
  assert.notEqual(derivePolicyVersion([a], 'g2'), v);
  assert.notEqual(derivePolicyVersion([b], 'g1'), v);
});
test('policyVersion never contains a raw id and is absent without policies', () => {
  const v = derivePolicyVersion([a, b], 'g1');
  assert.equal(v.includes('aaaa'), false);
  assert.equal(v.includes('bbbb'), false);
  assert.equal(derivePolicyVersion([], 'g1'), undefined);
  assert.equal(derivePolicyVersion(['not-a-policy-id'], 'g1'), undefined);
});
test('currentPolicyVersion reads policy ids and tolerates odd rows', async () => {
  const db = { query: async () => [{ policyId: b }, { policyId: a }] };
  assert.equal(
    await currentPolicyVersion(db, 'g'),
    derivePolicyVersion([a, b], 'g')
  );
  assert.equal(
    await currentPolicyVersion({ query: async () => [{ x: 1 }] }),
    undefined
  );
  assert.equal(
    await currentPolicyVersion({ query: async () => 'no' }),
    undefined
  );
});
