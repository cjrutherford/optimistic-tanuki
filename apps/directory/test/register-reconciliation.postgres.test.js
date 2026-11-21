const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  beginRecovery: beginSocial,
  enableRegisterCapture,
} = require('../../social/src/app/services/community-directory-epoch');
const {
  initializeDirectoryRegister,
} = require('../../social/src/app/services/community-directory-register-initialize');
const {
  lockCommunityDirectoryWrite,
  recordCommunityChange,
} = require('../../social/src/app/services/community-directory-outbox');
const {
  readDirectoryRegisterSnapshot,
} = require('../../social/src/app/services/community-directory-register-read');
const { beginRecovery: beginDirectory } = require('../src/recovery-authority');
const { reconcileRegister } = require('../src/register-reconciliation');
const directoryUrl = process.env.S3_REGISTER_DIRECTORY_URL;
const socialUrl = process.env.S3_REGISTER_SOCIAL_URL;
const enabled = process.env.S3_REGISTER_PAIR_TEST === 'disposable';

test(
  'two stores replay current tokens and withdraw on a privacy change',
  { skip: !enabled, timeout: 30000 },
  async () => {
    for (const [value, name] of [
      [directoryUrl, '/directorytest'],
      [socialUrl, '/s3social'],
    ]) {
      const url = new URL(value || '');
      assert.equal(url.hostname, '127.0.0.1');
      assert.equal(url.pathname, name);
    }
    assert.notEqual(directoryUrl, socialUrl);
    const directory = new DataSource({ type: 'postgres', url: directoryUrl });
    const social = new DataSource({ type: 'postgres', url: socialUrl });
    const oldMode = process.env.SOCIAL_DIRECTORY_MODE;
    const id = randomUUID();
    let owned = false;
    try {
      await directory.initialize();
      await social.initialize();
      assert.equal(
        (await social.query('SELECT 1 FROM community_directory_epoch')).length,
        0
      );
      assert.equal(
        (
          await directory.query(
            "SELECT 1 FROM directory_installation WHERE id='recovery-authority'"
          )
        ).length,
        0
      );
      for (const table of [
        'community',
        'community_directory_register',
        'community_directory_change',
      ]) {
        assert.equal(
          (await social.query(`SELECT 1 FROM "${table}" LIMIT 1`)).length,
          0,
          `Social ${table} must be empty`
        );
      }
      for (const table of [
        'directory_town',
        'directory_provider_work',
        'directory_census_progress',
      ]) {
        assert.equal(
          (await directory.query(`SELECT 1 FROM "${table}" LIMIT 1`)).length,
          0,
          `Directory ${table} must be empty`
        );
      }
      owned = true;
      await social.query(
        `INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,$2,'owner','owner','local-hub','town',false)`,
        [id, `Pair fixture ${id}`]
      );
      await beginSocial(social);
      await initializeDirectoryRegister(social, true);
      await enableRegisterCapture(social, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';
      const [{ sourceEpoch }] = await social.query(
        'SELECT "sourceEpoch" FROM community_directory_epoch WHERE id=1'
      );
      const dir = await beginDirectory(directory, {
        sourceEpoch,
        activationId: randomUUID(),
        owner: randomUUID(),
        socialGeneration: '1',
      });
      const [{ changeToken }] = await social.query(
        'SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1',
        [id]
      );
      const identity = {
        sourceEpoch,
        recoveryEpoch: dir.recoveryEpoch,
        communityId: id,
        changeToken,
      };
      const read = (request) =>
        social.transaction((m) =>
          readDirectoryRegisterSnapshot(
            m,
            request.sourceEpoch,
            request.communityId,
            request.changeToken
          )
        );
      assert.equal(
        await reconcileRegister(directory, identity, read),
        'applied'
      );
      assert.equal(
        await reconcileRegister(directory, identity, read),
        'applied'
      );
      assert.deepEqual(
        await directory.query(
          'SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [id]
        ),
        [{ eligible: true, geometryStatus: 'pending' }]
      );
      assert.deepEqual(
        await directory.query(
          'SELECT status FROM directory_provider_work WHERE "communityId"=$1',
          [id]
        ),
        [{ status: 'blocked' }]
      );
      // A Social mutation after the exact read can race the Directory commit.
      // This projection remains private/pending; the newer dirty token repairs it.
      let release, reached;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      const ready = new Promise((resolve) => {
        reached = resolve;
      });
      const staleApply = reconcileRegister(
        directory,
        identity,
        async (request) => {
          const result = await read(request);
          reached();
          await gate;
          return result;
        }
      );
      await ready;
      try {
        await social.transaction(async (manager) => {
          await lockCommunityDirectoryWrite(manager);
          await manager.query(
            'UPDATE community SET "isPrivate"=true WHERE id=$1',
            [id]
          );
          await recordCommunityChange(manager, id, 'changed');
        });
      } finally {
        release();
      }
      assert.equal(await staleApply, 'applied');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [id]
        ),
        [{ eligible: true, geometryStatus: 'pending' }]
      );
      assert.equal(
        await reconcileRegister(directory, identity, read),
        'superseded'
      );
      const [{ changeToken: newToken }] = await social.query(
        'SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1',
        [id]
      );
      assert.equal(
        await reconcileRegister(
          directory,
          { ...identity, changeToken: newToken },
          read
        ),
        'applied'
      );
      assert.deepEqual(
        await directory.query(
          'SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [id]
        ),
        [{ eligible: false, geometryStatus: 'pending' }]
      );
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',
            [id]
          )
        ).length,
        0
      );
      await beginSocial(social);
      await assert.rejects(
        reconcileRegister(
          directory,
          { ...identity, changeToken: newToken },
          read
        )
      );
    } finally {
      if (oldMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      else process.env.SOCIAL_DIRECTORY_MODE = oldMode;
      try {
        if (owned) {
          await directory.query(
            'DELETE FROM directory_provider_work WHERE "communityId"=$1',
            [id]
          );
          await directory.query(
            'DELETE FROM directory_town WHERE "communityId"=$1',
            [id]
          );
          await directory.query(
            "DELETE FROM directory_census_progress WHERE id='recovery'"
          );
          await directory.query(
            "DELETE FROM directory_installation WHERE id='recovery-authority'"
          );
          await social.query(
            'DELETE FROM community_directory_register WHERE "communityId"=$1',
            [id]
          );
          await social.query('DELETE FROM community WHERE id=$1', [id]);
          await social.query(
            'DELETE FROM community_directory_epoch WHERE id=1'
          );
        }
      } finally {
        try {
          if (directory.isInitialized) await directory.destroy();
        } finally {
          if (social.isInitialized) await social.destroy();
        }
      }
    }
  }
);
