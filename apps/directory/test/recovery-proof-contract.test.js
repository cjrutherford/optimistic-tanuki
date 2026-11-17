const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const {
  signRecoveryProof,
  verifyRecoveryProof,
} = require('../../../libs/social/contracts/src/lib/directory-recovery-proof');
const secret = 'test-only-recovery-proof-secret-1234567890';
test('proof authenticates every field and rejects legacy and forged proofs', () => {
  const id = {
    sourceEpoch: randomUUID(),
    recoveryEpoch: randomUUID(),
    owner: randomUUID(),
    activationId: randomUUID(),
    socialGeneration: '1',
    directoryGeneration: '2',
  };
  const proof = signRecoveryProof(id, secret);
  verifyRecoveryProof(id, proof, secret);
  for (const [field, value] of Object.entries({
    sourceEpoch: randomUUID(),
    recoveryEpoch: randomUUID(),
    owner: randomUUID(),
    activationId: randomUUID(),
    socialGeneration: '2',
    directoryGeneration: '1',
  })) {
    assert.throws(() =>
      verifyRecoveryProof({ ...id, [field]: value }, proof, secret)
    );
    assert.throws(() =>
      verifyRecoveryProof(id, { ...proof, [field]: value }, secret)
    );
  }
  assert.throws(() =>
    verifyRecoveryProof(
      id,
      { ...proof, traversal: 'social-then-directory-v1' },
      secret
    )
  );
  assert.throws(() =>
    verifyRecoveryProof(id, { ...proof, signature: '0'.repeat(64) }, secret)
  );
  assert.throws(() => verifyRecoveryProof(id, undefined, secret));
  assert.throws(() =>
    signRecoveryProof({ ...id, directoryGeneration: '01' }, secret)
  );
});
test('issuance requires a locked traversed checkpoint matching all six fields', async () => {
  const { generateRecoveryProof } = require('../src/recovery-proof');
  const id = {
    sourceEpoch: randomUUID(),
    recoveryEpoch: randomUUID(),
    owner: randomUUID(),
    activationId: randomUUID(),
    socialGeneration: '1',
    directoryGeneration: '2',
  };
  let checkpoint = {
    ...id,
    authority: id.recoveryEpoch,
    phase: 'traversed',
    protocol: 'legacy',
    cursor: null,
  };
  const queries = [];
  const db = {
    transaction: async (fn) =>
      fn({
        query: async (sql) => {
          queries.push(sql);
          return sql.includes('SELECT p.*') ? [checkpoint] : [];
        },
      }),
  };
  const proof = await generateRecoveryProof(db, id, secret);
  verifyRecoveryProof(id, proof, secret);
  assert.match(queries[0], /pg_advisory_xact_lock/);
  assert.match(queries[1], /FOR UPDATE OF p, i/);
  for (const [field, value] of Object.entries({
    sourceEpoch: randomUUID(),
    recoveryEpoch: randomUUID(),
    owner: randomUUID(),
    activationId: randomUUID(),
    socialGeneration: '2',
    directoryGeneration: '1',
    authority: randomUUID(),
    phase: 'social',
    cursor: randomUUID(),
  })) {
    checkpoint = {
      ...id,
      authority: id.recoveryEpoch,
      phase: 'traversed',
      protocol: 'legacy',
      cursor: null,
      [field]: value,
    };
    await assert.rejects(generateRecoveryProof(db, id, secret));
  }
});
