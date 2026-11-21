const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyCohort,
  upstreamKeyHash,
  businessNameHash,
  businessIdentityKeyFromEnv,
} = require('../src/business-identity');

const KEY = 'test-business-identity-key-32-bytes!!';
const A = 'a'.repeat(64),
  B = 'b'.repeat(64),
  H1 = '1'.repeat(64),
  H2 = '2'.repeat(64),
  N1 = 'n'.repeat(64),
  N2 = 'm'.repeat(64);
const b1 = '00000000-0000-4000-8000-000000000001',
  b2 = '00000000-0000-4000-8000-000000000002';
const row = (scanId, n, hash, nameHash = N1) => ({
  scanId,
  sourceFileRowNumber: n,
  upstreamKeyHash: hash,
  nameHash,
});
const pred = (businessId, hash, state = 'active', nameHash = N1) => ({
  businessId,
  businessState: state,
  upstreamKeyHash: hash,
  nameHash,
});
const verdicts = (plan) => plan.rows.map((r) => r.verdict);

test('a key held by exactly one active business carries to the single new row', () => {
  const plan = classifyCohort([row(A, 1, H1)], [pred(b1, H1)]);
  assert.deepEqual(verdicts(plan), [
    { kind: 'carry', businessId: b1, nameChanged: false },
  ]);
});

test('two cohort rows with one hash are both unresolved, in the same or different scans', () => {
  for (const cohort of [
    [row(A, 1, H1), row(A, 2, H1)],
    [row(A, 1, H1), row(B, 1, H1)],
  ]) {
    assert.deepEqual(verdicts(classifyCohort(cohort, [pred(b1, H1)])), [
      { kind: 'unresolved', cause: 'duplicate' },
      { kind: 'unresolved', cause: 'duplicate' },
    ]);
  }
});

test('one hash on two non-retired businesses is a conflict and carries nothing', () => {
  assert.deepEqual(
    verdicts(classifyCohort([row(A, 1, H1)], [pred(b1, H1), pred(b2, H1)])),
    [{ kind: 'unresolved', cause: 'conflict' }]
  );
  assert.deepEqual(
    verdicts(
      classifyCohort([row(A, 1, H1)], [pred(b1, H1), pred(b2, H1, 'merged')])
    ),
    [{ kind: 'unresolved', cause: 'conflict' }]
  );
});

test('a retired, merged or split predecessor is never followed or carried', () => {
  for (const state of ['retired', 'merged', 'split']) {
    assert.deepEqual(
      verdicts(classifyCohort([row(A, 1, H1)], [pred(b1, H1, state)])),
      [{ kind: 'unresolved', cause: 'inactive_predecessor' }]
    );
  }
});

test('a changed name still carries, flagged, and a missing new name is also flagged', () => {
  assert.deepEqual(
    verdicts(classifyCohort([row(A, 1, H1, N2)], [pred(b1, H1)])),
    [{ kind: 'carry', businessId: b1, nameChanged: true }]
  );
  assert.deepEqual(
    verdicts(classifyCohort([row(A, 1, H1, null)], [pred(b1, H1)])),
    [{ kind: 'carry', businessId: b1, nameChanged: true }]
  );
});

test('no key, or no predecessor with the key, is new', () => {
  assert.deepEqual(
    verdicts(
      classifyCohort(
        [row(A, 1, null), row(A, 2, H2)],
        [pred(b1, H1), pred(b2, null)]
      )
    ),
    [{ kind: 'new' }, { kind: 'new' }]
  );
});

test('matching never uses row number, name or position', () => {
  // Same row numbers and names as the predecessor, different key: new, not carried.
  assert.deepEqual(
    verdicts(classifyCohort([row(A, 1, H2, N1)], [pred(b1, H1, 'active', N1)])),
    [{ kind: 'new' }]
  );
});

test('input order does not change the verdicts or the digest', () => {
  const cohort = [
    row(A, 2, H2),
    row(A, 10, H1),
    row(B, 1, null),
    row(A, 9, '3'.repeat(64)),
  ];
  const predecessors = [pred(b1, H1), pred(b2, H2)];
  const first = classifyCohort(cohort, predecessors);
  const second = classifyCohort(
    [...cohort].reverse(),
    [...predecessors].reverse()
  );
  assert.equal(first.digest, second.digest);
  assert.deepEqual(first.rows, second.rows);
  assert.deepEqual(
    first.rows.map((r) => `${r.scanId[0]}${r.sourceFileRowNumber}`),
    ['a2', 'a9', 'a10', 'b1']
  );
  assert.notEqual(classifyCohort(cohort, [pred(b1, H1)]).digest, first.digest);
});

test('the upstream key is keyed, stable, and refuses unusable ids', () => {
  const hash = upstreamKeyHash(KEY, 'gers-1');
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, upstreamKeyHash(KEY, 'gers-1'));
  assert.notEqual(
    hash,
    upstreamKeyHash('another-business-identity-key-32-bytes', 'gers-1')
  );
  assert.ok(!hash.includes('gers-1'));
  for (const bad of [undefined, null, '', '   ', 7, {}, 'x'.repeat(300)])
    assert.equal(upstreamKeyHash(KEY, bad), null);
  assert.throws(() => upstreamKeyHash('short', 'gers-1'));
  assert.equal(
    businessNameHash(KEY, ' Fixture  Bakery '),
    businessNameHash(KEY, 'fixture bakery')
  );
});

test('the environment key is optional but never silently short', () => {
  assert.equal(businessIdentityKeyFromEnv({}), null);
  assert.equal(
    businessIdentityKeyFromEnv({ DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY: KEY }),
    KEY
  );
  assert.throws(
    () =>
      businessIdentityKeyFromEnv({
        DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY: 'short',
      }),
    (e) => !e.message.includes('short')
  );
});
