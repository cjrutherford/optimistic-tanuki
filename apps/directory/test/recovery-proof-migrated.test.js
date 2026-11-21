const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { generateRecoveryProof } = require('../src/recovery-proof');
const {
  verifyRecoveryProof,
} = require('../../../libs/social/contracts/src/lib/directory-recovery-proof');
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const secret = 'disposable-proof-secret-at-least-thirty-two-bytes';
test(
  'issuance rejects each changed field against a migrated traversed checkpoint',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const id = {
      sourceEpoch: randomUUID(),
      recoveryEpoch: randomUUID(),
      owner: randomUUID(),
      activationId: randomUUID(),
      socialGeneration: '1',
      directoryGeneration: '1',
    };
    const changes = {
      sourceEpoch: randomUUID(),
      recoveryEpoch: randomUUID(),
      owner: randomUUID(),
      activationId: randomUUID(),
      socialGeneration: '2',
      directoryGeneration: '2',
    };
    try {
      await db.query(
        `INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority', $1)`,
        [id.recoveryEpoch]
      );
      await db.query(
        `INSERT INTO directory_census_progress (id, phase, cursor, "sourceEpoch", "recoveryEpoch", owner, "activationId", "socialGeneration", "directoryGeneration") VALUES ('recovery', 'traversed', NULL, $1, $2, $3, $4, $5, $6)`,
        Object.values(id)
      );
      const proof = await generateRecoveryProof(db, id, secret);
      verifyRecoveryProof(id, proof, secret);
      for (const [field, value] of Object.entries(changes)) {
        await assert.rejects(
          generateRecoveryProof(db, { ...id, [field]: value }, secret),
          /authority/,
          field
        );
      }
      assert.deepEqual(await generateRecoveryProof(db, id, secret), proof);
    } finally {
      await db.destroy();
    }
  }
);
