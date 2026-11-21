const test = require('node:test');
const assert = require('node:assert/strict');
const { enableDirectory } = require('../src/directory-enabled');

test('enabling requires an explicit external fence before database access', async () => {
  let contacted = false;
  const db = {
    createQueryRunner() {
      contacted = true;
      throw Error('unexpected');
    },
  };
  await assert.rejects(
    enableDirectory(db, db, {}, {}, {}, false),
    /external fence/i
  );
  assert.equal(contacted, false);
});

const { DataSource } = require('typeorm');
const { randomUUID, generateKeyPairSync } = require('node:crypto');
const {
  prepareSocialAuthority,
} = require('../../social/src/app/services/community-directory-epoch');
const {
  signRecoveryProof,
} = require('../../../libs/social/contracts/src/lib/directory-recovery-proof');
const {
  signOperatorAttestation,
  verifyOperatorAttestation,
} = require('../../../libs/social/contracts/src/lib/directory-operator-attestation');

test(
  'two migrated stores bind prepared proof, serialize retirement and retain later receipts',
  {
    skip: !process.env.S3_SOCIAL_TEST_URL || !process.env.S3_DIRECTORY_TEST_URL,
  },
  async () => {
    const social = new DataSource({
      type: 'postgres',
      url: process.env.S3_SOCIAL_TEST_URL,
    });
    const directory = new DataSource({
      type: 'postgres',
      url: process.env.S3_DIRECTORY_TEST_URL,
    });
    await social.initialize();
    await directory.initialize();
    try {
      const id = {
        sourceEpoch: randomUUID(),
        recoveryEpoch: randomUUID(),
        owner: randomUUID(),
        activationId: randomUUID(),
        socialGeneration: '1',
        directoryGeneration: '1',
      };
      const community = randomUUID(),
        nonce = randomUUID();
      await social.query(
        `INSERT INTO community_directory_epoch (id,"sourceEpoch","directoryRecoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration",phase,fenced,"initializedAt","updatedAt") VALUES (1,$1,$2,$3,$4,$5,$6,'fenced',true,now(),now())`,
        Object.values(id)
      );
      await directory.query(
        `INSERT INTO directory_installation (id,"recoveryEpoch") VALUES ('recovery-authority',$1)`,
        [id.recoveryEpoch]
      );
      await directory.query(
        `INSERT INTO directory_census_progress (id,phase,"sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration") VALUES ('recovery','traversed',$1,$2,$3,$4,$5,$6)`,
        Object.values(id)
      );
      await directory.query(
        'INSERT INTO directory_receipt_slot (id) SELECT generate_series(1,20) ON CONFLICT DO NOTHING'
      );
      await directory.query(
        `INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'preserved',true)`,
        [community]
      );
      await directory.query(
        `INSERT INTO directory_reconciliation_receipt ("eventId","communityId","slotId","eventNonce","sourceEpoch","recoveryEpoch") VALUES (1,$1,1,$2,$3,$4)`,
        [community, nonce, id.sourceEpoch, id.recoveryEpoch]
      );
      const secret = 'test-only-recovery-secret-at-least-32-bytes';
      const prepared = await prepareSocialAuthority(
        social,
        id,
        signRecoveryProof(id, secret),
        secret
      );
      assert.deepEqual(
        await prepareSocialAuthority(
          social,
          id,
          signRecoveryProof(id, secret),
          secret
        ),
        prepared
      );
      const sk = generateKeyPairSync('ed25519'),
        dk = generateKeyPairSync('ed25519');
      const keys = {
        socialPublicKey: sk.publicKey,
        directoryPublicKey: dk.publicKey,
        socialKeyId: 'social',
        directoryKeyId: 'directory',
      };
      const proof = signOperatorAttestation(
        'social-prepared',
        id,
        { version: prepared.version, digest: prepared.digest },
        sk.privateKey,
        keys
      );
      const holder = directory.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        await holder.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('directory-recovery-authority-v1', 0))"
        );
        const started = Date.now();
        await assert.rejects(
          enableDirectory(social, directory, id, proof, keys, true),
          /lock timeout/i
        );
        assert.ok(
          Date.now() - started < 6000,
          'authority wait exceeded deadline'
        );
        assert.equal(
          (
            await directory.query(
              `SELECT phase FROM directory_census_progress WHERE id='recovery'`
            )
          )[0].phase,
          'traversed'
        );
        assert.equal(
          (
            await directory.query(
              'SELECT count(*)::int AS n FROM directory_reconciliation_receipt'
            )
          )[0].n,
          1
        );
      } finally {
        await holder.rollbackTransaction();
        await holder.release();
      }
      // Hold a real apply at its membership boundary, with Directory recovery held.
      // Enable must wait there, leaving Social available to the membership read.
      await directory.query(
        `UPDATE directory_census_progress SET phase='blocked' WHERE id='recovery'`
      );
      let reached, proceed;
      const atMembership = new Promise((resolve) => {
        reached = resolve;
      });
      const gate = new Promise((resolve) => {
        proceed = resolve;
      });
      const { DirectoryReconciler } = require('../src/reconciliation');
      require('tsconfig-paths/register');
      const {
        CommunityService,
      } = require('../../social/src/app/services/community.service');
      const membership = new CommunityService(
        { manager: social.manager },
        null,
        null,
        null,
        null,
        null,
        null
      );
      const reconciler = new DirectoryReconciler(
        directory,
        async () => null,
        async (...args) => {
          reached();
          await gate;
          return membership.directoryMembership(...args);
        }
      );
      const apply = reconciler.apply({
        revision: '99',
        communityId: community,
        eventNonce: randomUUID(),
        sourceEpoch: id.sourceEpoch,
        recoveryEpoch: id.recoveryEpoch,
      });
      await atMembership;
      const enabling = enableDirectory(
        social,
        directory,
        id,
        proof,
        keys,
        true
      );
      // Observe the actual advisory-lock wait, not a timing-based guess.
      let waiting = false;
      try {
        for (let attempt = 0; attempt < 100 && !waiting; attempt++) {
          const rows = await directory.query(
            `SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%directory-recovery-authority-v1%'`
          );
          waiting = rows.length > 0;
          if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
        }
        assert.ok(waiting, 'enable did not reach Directory authority lock');
      } finally {
        proceed();
      }
      await assert.rejects(apply, /fenced|stale/i);
      await assert.rejects(enabling, /not traversed/);
      assert.equal(
        (
          await directory.query(
            'SELECT count(*)::int AS n FROM directory_reconciliation_receipt'
          )
        )[0].n,
        1
      );
      assert.equal(
        (
          await directory.query(
            `SELECT phase FROM directory_census_progress WHERE id='recovery'`
          )
        )[0].phase,
        'blocked'
      );
      await directory.query(
        `UPDATE directory_census_progress SET phase='traversed' WHERE id='recovery'`
      );
      for (const field of [
        'sourceEpoch',
        'recoveryEpoch',
        'owner',
        'activationId',
        'socialGeneration',
        'directoryGeneration',
      ]) {
        const changed = {
          ...id,
          [field]: field.endsWith('Generation') ? '2' : randomUUID(),
        };
        await assert.rejects(
          enableDirectory(social, directory, changed, proof, keys, true)
        );
      }
      for (const bad of [
        { ...proof, purpose: 'directory-enabled' },
        { ...proof, signature: 'A'.repeat(86) },
        { ...proof, owner: randomUUID() },
      ])
        await assert.rejects(
          enableDirectory(social, directory, id, bad, keys, true)
        );
      await assert.rejects(
        enableDirectory(
          social,
          directory,
          { ...id, owner: randomUUID() },
          proof,
          keys,
          true
        )
      );
      await assert.rejects(
        enableDirectory(
          social,
          directory,
          id,
          proof,
          {
            ...keys,
            socialPublicKey: generateKeyPairSync('ed25519').publicKey,
          },
          true
        )
      );
      await social.query(
        `UPDATE community_directory_epoch SET "preparedPayload"=jsonb_set("preparedPayload",'{digest}',to_jsonb($1::text)) WHERE id=1`,
        ['f'.repeat(64)]
      );
      await assert.rejects(
        enableDirectory(social, directory, id, proof, keys, true)
      );
      await social.query(
        `UPDATE community_directory_epoch SET "preparedPayload"=$1::jsonb WHERE id=1`,
        [JSON.stringify(prepared)]
      );
      await directory.query(
        `CREATE FUNCTION s3_fail_enable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.phase='enabled' THEN RAISE EXCEPTION 'crash'; END IF; RETURN NEW; END $$`
      );
      await directory.query(
        `CREATE TRIGGER s3_fail_enable BEFORE UPDATE ON directory_census_progress FOR EACH ROW EXECUTE FUNCTION s3_fail_enable()`
      );
      await assert.rejects(
        enableDirectory(social, directory, id, proof, keys, true)
      );
      assert.equal(
        (
          await directory.query(
            'SELECT count(*)::int AS n FROM directory_reconciliation_receipt'
          )
        )[0].n,
        1
      );
      await directory.query(
        'DROP TRIGGER s3_fail_enable ON directory_census_progress'
      );
      await directory.query('DROP FUNCTION s3_fail_enable()');
      const [a, b] = await Promise.all([
        enableDirectory(social, directory, id, proof, keys, true),
        enableDirectory(social, directory, id, proof, keys, true),
      ]);
      assert.deepEqual(a, b);
      assert.equal(a.retirementCount, '1');
      const signed = signOperatorAttestation(
        'directory-enabled',
        id,
        { version: 'social-prepared-v1', digest: a.preparedDigest },
        dk.privateKey,
        keys
      );
      verifyOperatorAttestation(
        signed,
        'directory-enabled',
        id,
        { version: 'social-prepared-v1', digest: a.preparedDigest },
        keys
      );
      const fs = require('node:fs'),
        os = require('node:os'),
        path = require('node:path'),
        { spawnSync } = require('node:child_process');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 's3-enable-'));
      try {
        const privatePem = dk.privateKey
          .export({ type: 'pkcs8', format: 'pem' })
          .toString();
        fs.writeFileSync(path.join(dir, 'private'), privatePem, {
          mode: 0o600,
        });
        fs.writeFileSync(
          path.join(dir, 'social'),
          sk.publicKey.export({ type: 'spki', format: 'pem' })
        );
        fs.writeFileSync(
          path.join(dir, 'directory'),
          dk.publicKey.export({ type: 'spki', format: 'pem' })
        );
        const env = {
          ...process.env,
          TS_NODE_PROJECT: 'apps/directory/tsconfig.json',
          SOCIAL_DATABASE_URL: process.env.S3_SOCIAL_TEST_URL,
          DIRECTORY_DATABASE_URL: process.env.S3_DIRECTORY_TEST_URL,
          DIRECTORY_OPERATOR_PRIVATE_KEY_FILE: path.join(dir, 'private'),
          SOCIAL_OPERATOR_PUBLIC_KEY_FILE: path.join(dir, 'social'),
          DIRECTORY_OPERATOR_PUBLIC_KEY_FILE: path.join(dir, 'directory'),
          SOCIAL_OPERATOR_KEY_ID: 'social',
          DIRECTORY_OPERATOR_KEY_ID: 'directory',
        };
        const invoke = (confirmation, extra = {}) =>
          spawnSync(
            process.execPath,
            [
              '-r',
              'ts-node/register/transpile-only',
              'apps/directory/src/directory-enable-operator.ts',
              confirmation,
              ...Object.values(id),
            ],
            {
              env: { ...env, ...extra },
              input: JSON.stringify(proof),
              encoding: 'utf8',
              timeout: 15000,
            }
          );
        assert.notEqual(invoke('--no-fence').status, 0);
        assert.notEqual(
          invoke('--confirm-external-fence', {
            DIRECTORY_OPERATOR_PRIVATE_KEY_FILE: path.join(dir, 'social'),
          }).status,
          0
        );
        const output = invoke('--confirm-external-fence');
        assert.equal(output.status, 0, output.stderr);
        assert.ok(!(output.stdout + output.stderr).includes(privatePem));
        assert.deepEqual(JSON.parse(output.stdout), {
          result: a,
          attestation: signed,
        });
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      await directory.query(
        `INSERT INTO directory_reconciliation_receipt ("eventId","communityId","slotId","eventNonce","sourceEpoch","recoveryEpoch") VALUES (2,$1,1,$2,$3,$4)`,
        [community, randomUUID(), id.sourceEpoch, id.recoveryEpoch]
      );
      const retry = await enableDirectory(
        social,
        directory,
        id,
        proof,
        keys,
        true
      );
      assert.deepEqual(retry, a);
      assert.deepEqual(
        signOperatorAttestation(
          'directory-enabled',
          id,
          { version: 'social-prepared-v1', digest: retry.preparedDigest },
          dk.privateKey,
          keys
        ),
        signed
      );
      assert.equal(
        (
          await directory.query(
            'SELECT count(*)::int AS n FROM directory_reconciliation_receipt'
          )
        )[0].n,
        1
      );
      assert.equal(
        (
          await directory.query(
            'SELECT count(*)::int AS n FROM directory_receipt_slot'
          )
        )[0].n,
        20
      );
      assert.equal(
        (
          await directory.query(
            'SELECT name FROM directory_town WHERE "communityId"=$1',
            [community]
          )
        )[0].name,
        'preserved'
      );
      await social.query(
        `UPDATE community_directory_epoch SET phase='fenced' WHERE id=1`
      );
      await assert.rejects(
        enableDirectory(social, directory, id, proof, keys, true)
      );
    } finally {
      await directory.destroy();
      await social.destroy();
    }
  }
);
