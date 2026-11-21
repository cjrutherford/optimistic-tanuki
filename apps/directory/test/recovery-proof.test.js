const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { generateRecoveryProof } = require('../src/recovery-proof');
const { recoveryPage } = require('../src/recovery-traversal');
const {
  bindDirectoryEpochPair,
} = require('../../social/src/app/services/community-directory-epoch');
const secret = 'test-only-recovery-proof-secret-1234567890';
const url = process.env.DIRECTORY_PROOF_TEST_DATABASE_URL;
test(
  'proof requires both completed passes, exact authority and a fenced Social binding',
  { skip: !url },
  async () => {
    if (
      new URL(url).pathname !== '/proof_test' ||
      new URL(url).hostname !== '127.0.0.1'
    )
      throw Error('Dedicated disposable proof_test database required');
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
    try {
      await db.query(
        `CREATE TABLE directory_town ("communityId" uuid primary key); CREATE TABLE directory_installation (id text primary key, "recoveryEpoch" uuid); CREATE TABLE directory_census_progress (id text primary key, "sourceEpoch" uuid, "recoveryEpoch" uuid, owner uuid, "activationId" uuid, "socialGeneration" bigint, "directoryGeneration" bigint, phase text, cursor uuid, "updatedAt" timestamptz default now()); CREATE TABLE community_directory_epoch (id integer primary key, "sourceEpoch" uuid, "directoryRecoveryEpoch" uuid, fenced boolean, "updatedAt" timestamptz)`
      );
      await db.query(
        `INSERT INTO directory_installation VALUES ('recovery-authority',$1)`,
        [id.recoveryEpoch]
      );
      await db.query(
        `INSERT INTO directory_census_progress (id,"sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration",phase,cursor) VALUES ('recovery',$1,$2,$3,$4,$5,$6,'blocked',NULL)`,
        [
          id.sourceEpoch,
          id.recoveryEpoch,
          id.owner,
          id.activationId,
          id.socialGeneration,
          id.directoryGeneration,
        ]
      );
      await db.query(
        `INSERT INTO community_directory_epoch VALUES (1,$1,NULL,true,now())`,
        [id.sourceEpoch]
      );
      await assert.rejects(generateRecoveryProof(db, id, secret), /checkpoint/);
      const source = {
        census: async () => ({ communities: [], nextCursor: null }),
        snapshot: async () => null,
      };
      assert.equal(await recoveryPage(db, source, id), 'more');
      await assert.rejects(generateRecoveryProof(db, id, secret), /checkpoint/);
      assert.equal(await recoveryPage(db, source, id), 'traversed');
      await assert.rejects(
        generateRecoveryProof(db, { ...id, owner: randomUUID() }, secret),
        /authority/
      );
      const holder = db.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      await holder.query(
        `SELECT * FROM directory_census_progress WHERE id='recovery' FOR UPDATE`
      );
      let generated = false;
      const waitingProof = generateRecoveryProof(db, id, secret).finally(() => {
        generated = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(generated, false);
      await holder.query(
        `UPDATE directory_census_progress SET owner=$1 WHERE id='recovery'`,
        [randomUUID()]
      );
      await holder.commitTransaction();
      await holder.release();
      await assert.rejects(waitingProof, /authority/);
      await db.query(
        `UPDATE directory_census_progress SET owner=$1 WHERE id='recovery'`,
        [id.owner]
      );
      const proof = await generateRecoveryProof(db, id, secret);
      assert.deepEqual(await generateRecoveryProof(db, id, secret), proof);
      await assert.rejects(
        bindDirectoryEpochPair(
          db,
          id,
          { ...proof, signature: '0'.repeat(64) },
          secret
        ),
        /proof/
      );
      await assert.rejects(
        bindDirectoryEpochPair(
          db,
          { ...id, recoveryEpoch: randomUUID() },
          proof,
          secret
        ),
        /proof/
      );
      await assert.rejects(
        bindDirectoryEpochPair(
          db,
          { ...id, sourceEpoch: randomUUID() },
          proof,
          secret
        ),
        /proof/
      );
      await assert.rejects(
        bindDirectoryEpochPair(
          db,
          { ...id, owner: randomUUID() },
          proof,
          secret
        ),
        /proof/
      );
      await assert.rejects(generateRecoveryProof(db, id, 'short'), /secret/);
      process.env.DIRECTORY_SOCIAL_SECRET = secret;
      try {
        await assert.rejects(generateRecoveryProof(db, id, secret), /reused/);
      } finally {
        delete process.env.DIRECTORY_SOCIAL_SECRET;
      }
      const socialLock = db.createQueryRunner();
      await socialLock.connect();
      await socialLock.startTransaction();
      await socialLock.query(
        'SELECT * FROM community_directory_epoch WHERE id=1 FOR UPDATE'
      );
      let bound = false;
      const waitingBind = bindDirectoryEpochPair(db, id, proof, secret).finally(
        () => {
          bound = true;
        }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(bound, false);
      await socialLock.query(
        'UPDATE community_directory_epoch SET fenced=false WHERE id=1'
      );
      await socialLock.commitTransaction();
      await socialLock.release();
      await assert.rejects(waitingBind, /fenced/);
      await db.query(
        'UPDATE community_directory_epoch SET fenced=true WHERE id=1'
      );
      const crashingDb = {
        transaction: (fn) =>
          db.transaction(async (manager) => {
            await fn(manager);
            throw Error('simulated crash');
          }),
      };
      await assert.rejects(
        bindDirectoryEpochPair(crashingDb, id, proof, secret),
        /simulated crash/
      );
      assert.equal(
        (
          await db.query(
            'SELECT "directoryRecoveryEpoch" FROM community_directory_epoch WHERE id=1'
          )
        )[0].directoryRecoveryEpoch,
        null
      );
      await bindDirectoryEpochPair(db, id, proof, secret);
      await bindDirectoryEpochPair(db, id, proof, secret);
      const [row] = await db.query(
        'SELECT * FROM community_directory_epoch WHERE id=1'
      );
      assert.equal(row.directoryRecoveryEpoch, id.recoveryEpoch);
      assert.equal(row.fenced, true);
      await db.query(
        'UPDATE community_directory_epoch SET "sourceEpoch"=$1, "directoryRecoveryEpoch"=NULL',
        [randomUUID()]
      );
      await assert.rejects(
        bindDirectoryEpochPair(db, id, proof, secret),
        /epoch/
      );
    } finally {
      await db.query(
        'DROP TABLE IF EXISTS directory_town, directory_installation, directory_census_progress, community_directory_epoch'
      );
      await db.destroy();
    }
  }
);

test('worker configuration does not receive the proof secret', () => {
  const { readFileSync, readdirSync } = require('node:fs');
  for (const file of readdirSync('apps/directory-worker/src').filter((f) =>
    f.endsWith('.ts')
  ))
    assert.doesNotMatch(
      readFileSync(`apps/directory-worker/src/${file}`, 'utf8'),
      /DIRECTORY_RECOVERY_PROOF_SECRET/
    );
  for (const file of [
    'apps/directory/compose.yaml',
    'docker-compose.yaml',
    'docker-compose.local-hub-e2e.yaml',
  ])
    assert.doesNotMatch(
      readFileSync(file, 'utf8'),
      /DIRECTORY_RECOVERY_PROOF_SECRET/
    );
});
test('proof canonical v2 encoding has a fixed vector', () => {
  const {
    signRecoveryProof,
  } = require('../../../libs/social/contracts/src/lib/directory-recovery-proof');
  const identity = {
    sourceEpoch: '11111111-1111-4111-8111-111111111111',
    recoveryEpoch: '22222222-2222-4222-8222-222222222222',
    owner: '33333333-3333-4333-8333-333333333333',
    activationId: '44444444-4444-4444-8444-444444444444',
    socialGeneration: '1',
    directoryGeneration: '2',
  };
  assert.equal(
    signRecoveryProof(identity, secret).signature,
    '093fd2bb004cc7406e2566bf035a6875b3e893797ead3df10eed355f988e86df'
  );
});
