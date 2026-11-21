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
  scanDirectoryRegisterV2,
  readDirectoryRegisterSnapshotV2,
  readCurrentDirectoryRegister,
} = require('../../social/src/app/services/community-directory-register-read');
const {
  scanSourceCommunities,
  repairSourceCommunityRegister,
} = require('../../social/src/app/services/community-directory-census');
const { beginRegisterRecovery } = require('../src/register-recovery-authority');
const {
  registerBootstrapPage,
} = require('../../directory-worker/src/register-bootstrap');
const {
  registerSweepPage,
} = require('../../directory-worker/src/register-sweep');
const { readRegisterSweep } = require('../src/register-sweep-authority');

const directoryUrl = process.env.S3_REGISTER_DIRECTORY_URL;
const socialUrl = process.env.S3_REGISTER_SOCIAL_URL;
const enabled = process.env.S3_REGISTER_PAIR_TEST === 'disposable';

function assertDisposableUrl(value, database) {
  assert.ok(
    value,
    `S3_REGISTER_*_URL must name the disposable ${database} database`
  );
  const url = new URL(value);
  assert.equal(url.protocol, 'postgres:');
  assert.equal(
    url.hostname,
    '127.0.0.1',
    'pair tests are restricted to loopback PostgreSQL'
  );
  assert.equal(
    url.pathname,
    `/${database}`,
    'pair tests require the explicitly disposable database name'
  );
}

test(
  'register bootstrap resumes two-store pages, repairs absent towns, and withdraws private data',
  { skip: !enabled, timeout: 30000 },
  async () => {
    assertDisposableUrl(directoryUrl, 'directorybootstrap');
    assertDisposableUrl(socialUrl, 's3social');
    assert.notEqual(directoryUrl, socialUrl);

    const directory = new DataSource({ type: 'postgres', url: directoryUrl });
    const social = new DataSource({ type: 'postgres', url: socialUrl });
    const oldMode = process.env.SOCIAL_DIRECTORY_MODE;
    const publicId = randomUUID();
    const privateId = randomUUID();
    const directoryOnlyId = randomUUID();
    const lateId = '00000000-0000-4000-8000-000000000001';
    const bypassId = '00000000-0000-4000-8000-000000000002';
    let owned = false;
    try {
      await directory.initialize();
      await social.initialize();
      assert.equal(
        (await social.query('SELECT 1 FROM community_directory_epoch')).length,
        0,
        'Social authority table must be empty'
      );
      assert.equal(
        (
          await directory.query(
            "SELECT 1 FROM directory_installation WHERE id='recovery-authority'"
          )
        ).length,
        0,
        'Directory authority must be empty'
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
        `INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES
      ($1,$3,'owner','owner','local-hub','town',false),($2,$4,'owner','owner','local-hub','town',false)`,
        [
          publicId,
          privateId,
          `Bootstrap public ${publicId}`,
          `Bootstrap private ${privateId}`,
        ]
      );
      await beginSocial(social);
      await initializeDirectoryRegister(social, true);
      await enableRegisterCapture(social, true);
      process.env.SOCIAL_DIRECTORY_MODE = 'register-only';

      // This town exists only in Directory and must be scrubbed by the repair pass.
      await directory.query(
        `INSERT INTO directory_town ("communityId",name,slug,"administrativeArea",eligible,"geometryStatus") VALUES ($1,'private old name','old-slug','old-area',true,'ready')`,
        [directoryOnlyId]
      );
      await directory.query(
        `INSERT INTO directory_provider_work ("communityId",status) VALUES ($1,'pending')`,
        [directoryOnlyId]
      );

      const [source] = await social.query(
        'SELECT "sourceEpoch", "activationId", "socialGeneration" FROM community_directory_epoch WHERE id=1'
      );
      const begin = {
        ...source,
        owner: randomUUID(),
        expectedPrevious: null,
        externalFence: true,
      };
      const identity = await beginRegisterRecovery(directory, begin);
      assert.deepEqual(
        await beginRegisterRecovery(directory, begin),
        identity,
        'restarting the bootstrap command must reuse its authority'
      );
      const sourceIdentity = {
        sourceEpoch: source.sourceEpoch,
        activationId: source.activationId,
        socialGeneration: source.socialGeneration,
      };
      const exactRead = (id, token) =>
        social.transaction((manager) =>
          readDirectoryRegisterSnapshotV2(manager, sourceIdentity, id, token)
        );
      const currentRead = (id) =>
        social.transaction((manager) =>
          readCurrentDirectoryRegister(manager, sourceIdentity, id)
        );
      let failNextScan = false;
      const sourceAdapter = {
        scan: (incarnation, cursor, limit) => {
          if (failNextScan) {
            failNextScan = false;
            throw new Error('injected page interruption');
          }
          return social.transaction((manager) =>
            scanDirectoryRegisterV2(
              manager,
              {
                sourceEpoch: incarnation.sourceEpoch,
                activationId: incarnation.activationId,
                socialGeneration: incarnation.socialGeneration,
              },
              cursor,
              limit
            )
          );
        },
        read: (_incarnation, id, token) => exactRead(id, token),
        current: (_incarnation, id) => currentRead(id),
        census: (_incarnation, cursor, limit) =>
          social.transaction((manager) =>
            scanSourceCommunities(manager, sourceIdentity, cursor, limit)
          ),
        repair: (_incarnation, id) =>
          social.transaction((manager) =>
            repairSourceCommunityRegister(manager, sourceIdentity, id)
          ),
      };

      // Advance blocked -> source, then commit a single source token as its own checkpoint.
      assert.equal(
        await registerBootstrapPage(directory, identity, sourceAdapter, 1),
        'more'
      );
      assert.equal(
        await registerBootstrapPage(directory, identity, sourceAdapter, 1),
        'more'
      );
      const checkpoint = await directory.query(
        "SELECT phase,cursor FROM directory_census_progress WHERE id='recovery'"
      );
      assert.equal(checkpoint[0].phase, 'reg-source');
      assert.equal(
        checkpoint[0].cursor,
        publicId < privateId ? publicId : privateId
      );
      // A failed page leaves its previous checkpoint intact; a new invocation resumes safely.
      failNextScan = true;
      await assert.rejects(
        registerBootstrapPage(directory, identity, sourceAdapter, 1),
        /injected page interruption/
      );
      assert.deepEqual(
        await directory.query(
          "SELECT phase,cursor FROM directory_census_progress WHERE id='recovery'"
        ),
        checkpoint
      );
      assert.equal(
        await registerBootstrapPage(directory, identity, sourceAdapter, 1),
        'more'
      );
      assert.equal(
        await registerBootstrapPage(directory, identity, sourceAdapter, 1),
        'more'
      );
      assert.equal(
        (
          await directory.query(
            "SELECT phase FROM directory_census_progress WHERE id='recovery'"
          )
        )[0].phase,
        'reg-directory'
      );
      assert.deepEqual(
        await directory.query(
          'SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [publicId]
        ),
        [{ eligible: true, geometryStatus: 'pending' }]
      );
      assert.deepEqual(
        await directory.query(
          'SELECT status FROM directory_provider_work WHERE "communityId"=$1',
          [publicId]
        ),
        [{ status: 'blocked' }]
      );

      // Privacy changes after the source pass; the Directory repair pass reads current state.
      await social.transaction(async (manager) => {
        await lockCommunityDirectoryWrite(manager);
        await manager.query(
          'UPDATE community SET "isPrivate"=true WHERE id=$1',
          [privateId]
        );
        await recordCommunityChange(manager, privateId, 'changed');
      });
      // Directory phase walks both retained towns, including the Social-private one.
      const directoryPages = [];
      let result = 'more';
      while (result === 'more' && directoryPages.length < 5) {
        result = await registerBootstrapPage(
          directory,
          identity,
          sourceAdapter,
          1
        );
        directoryPages.push(
          (
            await directory.query(
              "SELECT phase,cursor FROM directory_census_progress WHERE id='recovery'"
            )
          )[0]
        );
      }
      assert.equal(result, 'complete');
      assert.equal(
        directoryPages.length,
        4,
        'three directory repairs and a final empty page are checkpointed'
      );
      assert.equal(
        (
          await directory.query(
            "SELECT phase FROM directory_census_progress WHERE id='recovery'"
          )
        )[0].phase,
        'reg-running'
      );
      assert.deepEqual(
        await directory.query(
          'SELECT name,slug,"administrativeArea",eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [privateId]
        ),
        [
          {
            name: '',
            slug: null,
            administrativeArea: null,
            eligible: false,
            geometryStatus: 'pending',
          },
        ]
      );
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',
            [privateId]
          )
        ).length,
        0
      );
      assert.deepEqual(
        await directory.query(
          'SELECT name,eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [directoryOnlyId]
        ),
        [{ name: '', eligible: false, geometryStatus: 'pending' }]
      );
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',
            [directoryOnlyId]
          )
        ).length,
        0
      );
      // A captured rename is delivered by the real sweep, and replaying its same token is idempotent.
      await social.transaction(async (manager) => {
        await lockCommunityDirectoryWrite(manager);
        await manager.query('UPDATE community SET name=$2 WHERE id=$1', [
          publicId,
          `Renamed ${publicId}`,
        ]);
        await recordCommunityChange(manager, publicId, 'changed');
      });
      const [renameEntry] = await social.query(
        'SELECT "changeToken" FROM community_directory_register WHERE "communityId"=$1',
        [publicId]
      );
      let replay = 'more';
      for (let i = 0; i < 40 && replay === 'more'; i++)
        replay = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(replay, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT name,eligible FROM directory_town WHERE "communityId"=$1',
          [publicId]
        ),
        [{ name: `Renamed ${publicId}`, eligible: true }]
      );
      const workBeforeReplay = await directory.query(
        'SELECT count(*)::int AS count FROM directory_provider_work WHERE "communityId"=$1',
        [publicId]
      );
      assert.equal(workBeforeReplay[0].count, 1);
      const {
        reconcileRegisterV2,
      } = require('../src/register-reconciliation-v2');
      assert.equal(
        await reconcileRegisterV2(
          directory,
          identity,
          publicId,
          renameEntry.changeToken,
          () => exactRead(publicId, renameEntry.changeToken)
        ),
        'applied'
      );
      assert.deepEqual(
        await directory.query(
          'SELECT count(*)::int AS count FROM directory_town WHERE "communityId"=$1',
          [publicId]
        ),
        [{ count: 1 }]
      );
      assert.deepEqual(
        await directory.query(
          'SELECT count(*)::int AS count FROM directory_provider_work WHERE "communityId"=$1',
          [publicId]
        ),
        [{ count: 1 }]
      );

      // Losing appScope eligibility removes provider work; restoring eligibility recreates it.
      await social.transaction(async (manager) => {
        await lockCommunityDirectoryWrite(manager);
        await manager.query(
          'UPDATE community SET "appScope"=\'social\' WHERE id=$1',
          [publicId]
        );
        await recordCommunityChange(manager, publicId, 'changed');
      });
      replay = 'more';
      for (let i = 0; i < 40 && replay === 'more'; i++)
        replay = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(replay, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible FROM directory_town WHERE "communityId"=$1',
          [publicId]
        ),
        [{ eligible: false }]
      );
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',
            [publicId]
          )
        ).length,
        0
      );
      await social.transaction(async (manager) => {
        await lockCommunityDirectoryWrite(manager);
        await manager.query(
          'UPDATE community SET "appScope"=\'local-hub\' WHERE id=$1',
          [publicId]
        );
        await recordCommunityChange(manager, publicId, 'changed');
      });
      replay = 'more';
      for (let i = 0; i < 40 && replay === 'more'; i++)
        replay = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(replay, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible FROM directory_town WHERE "communityId"=$1',
          [publicId]
        ),
        [{ eligible: true }]
      );
      assert.deepEqual(
        await directory.query(
          'SELECT status FROM directory_provider_work WHERE "communityId"=$1',
          [publicId]
        ),
        [{ status: 'blocked' }]
      );

      // An insertion behind a sweep cursor must appear on the following durable pass.
      assert.equal(
        await registerSweepPage(directory, identity, sourceAdapter, 1),
        'more'
      );
      for (let i = 0; i < 10; i++) {
        const state = await readRegisterSweep(directory, identity);
        if (state.phase === 'source' && state.cursor !== null) break;
        assert.equal(
          await registerSweepPage(directory, identity, sourceAdapter, 1),
          'more'
        );
      }
      assert.equal(
        (await readRegisterSweep(directory, identity)).phase,
        'source'
      );
      await social.transaction(async (manager) => {
        await lockCommunityDirectoryWrite(manager);
        await manager.query(
          `INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,'Late town','owner','owner','local-hub','town',false)`,
          [lateId]
        );
        await recordCommunityChange(manager, lateId, 'changed');
      });
      let sweep = 'more';
      for (let i = 0; i < 40 && sweep === 'more'; i++)
        sweep = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(sweep, 'complete');
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_town WHERE "communityId"=$1',
            [lateId]
          )
        ).length,
        0
      );
      sweep = 'more';
      for (let i = 0; i < 40 && sweep === 'more'; i++)
        sweep = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(sweep, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible,"geometryStatus" FROM directory_town WHERE "communityId"=$1',
          [lateId]
        ),
        [{ eligible: true, geometryStatus: 'pending' }]
      );
      assert.deepEqual(
        await directory.query(
          'SELECT status FROM directory_provider_work WHERE "communityId"=$1',
          [lateId]
        ),
        [{ status: 'blocked' }]
      );
      // Privileged direct writes are recovered by source and Directory census, not capture.
      await social.query(
        `INSERT INTO community (id,name,"ownerId","ownerProfileId","appScope","localityType","isPrivate") VALUES ($1,'Bypass town','owner','owner','local-hub','town',false)`,
        [bypassId]
      );
      sweep = 'more';
      for (let i = 0; i < 40 && sweep === 'more'; i++)
        sweep = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(sweep, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible FROM directory_town WHERE "communityId"=$1',
          [bypassId]
        ),
        [{ eligible: true }]
      );
      // A bypassed privacy or name update is repaired even when its token did not rotate.
      await social.query('UPDATE community SET "isPrivate"=true WHERE id=$1', [
        bypassId,
      ]);
      sweep = 'more';
      for (let i = 0; i < 40 && sweep === 'more'; i++)
        sweep = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(sweep, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible FROM directory_town WHERE "communityId"=$1',
          [bypassId]
        ),
        [{ eligible: false }]
      );
      assert.equal(
        (
          await directory.query(
            'SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',
            [bypassId]
          )
        ).length,
        0
      );
      await social.query(
        'UPDATE community SET "isPrivate"=false,name=$2 WHERE id=$1',
        [bypassId, 'Repaired bypass town']
      );
      sweep = 'more';
      for (let i = 0; i < 40 && sweep === 'more'; i++)
        sweep = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(sweep, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT name,eligible FROM directory_town WHERE "communityId"=$1',
          [bypassId]
        ),
        [{ name: 'Repaired bypass town', eligible: true }]
      );
      assert.deepEqual(
        await directory.query(
          'SELECT status FROM directory_provider_work WHERE "communityId"=$1',
          [bypassId]
        ),
        [{ status: 'blocked' }]
      );
      await social.query('DELETE FROM community WHERE id=$1', [bypassId]);
      sweep = 'more';
      for (let i = 0; i < 40 && sweep === 'more'; i++)
        sweep = await registerSweepPage(directory, identity, sourceAdapter, 1);
      assert.equal(sweep, 'complete');
      assert.deepEqual(
        await directory.query(
          'SELECT eligible FROM directory_town WHERE "communityId"=$1',
          [bypassId]
        ),
        [{ eligible: false }]
      );
      await assert.rejects(
        registerBootstrapPage(
          directory,
          { ...identity, owner: randomUUID() },
          sourceAdapter,
          1
        ),
        /authority/
      );
      // A refence between scan and reconciliation must reject the old page.
      assert.equal(
        await registerSweepPage(directory, identity, sourceAdapter, 1),
        'more'
      );
      let releaseScan, reachedScan;
      const gate = new Promise((resolve) => {
        releaseScan = resolve;
      });
      const reached = new Promise((resolve) => {
        reachedScan = resolve;
      });
      const interrupted = registerSweepPage(
        directory,
        identity,
        {
          ...sourceAdapter,
          census: async (...args) => {
            const rows = await sourceAdapter.census(...args);
            reachedScan();
            await gate;
            return rows;
          },
        },
        1
      );
      await reached;
      const previous = Object.fromEntries(
        [
          'sourceEpoch',
          'activationId',
          'socialGeneration',
          'recoveryEpoch',
          'owner',
          'directoryGeneration',
        ].map((key) => [key, identity[key]])
      );
      try {
        await beginRegisterRecovery(directory, {
          ...begin,
          owner: randomUUID(),
          expectedPrevious: previous,
        });
      } finally {
        releaseScan();
      }
      await assert.rejects(interrupted, /authority/);
      assert.equal(
        (
          await directory.query(
            "SELECT phase FROM directory_census_progress WHERE id='recovery'"
          )
        )[0].phase,
        'blocked'
      );
      await beginSocial(social);
      await assert.rejects(currentRead(publicId), /authority/);
    } finally {
      if (oldMode === undefined) delete process.env.SOCIAL_DIRECTORY_MODE;
      else process.env.SOCIAL_DIRECTORY_MODE = oldMode;
      try {
        if (owned) {
          await directory.query(
            'DELETE FROM directory_provider_work WHERE "communityId" = ANY($1::uuid[])',
            [[publicId, privateId, directoryOnlyId, lateId, bypassId]]
          );
          await directory.query(
            'DELETE FROM directory_town WHERE "communityId" = ANY($1::uuid[])',
            [[publicId, privateId, directoryOnlyId, lateId, bypassId]]
          );
          await directory.query(
            "DELETE FROM directory_census_progress WHERE id='recovery'"
          );
          await directory.query(
            "DELETE FROM directory_installation WHERE id='recovery-authority'"
          );
          await social.query(
            'DELETE FROM community_directory_register WHERE "communityId" = ANY($1::uuid[])',
            [[publicId, privateId, lateId, bypassId, directoryOnlyId]]
          );
          await social.query(
            'DELETE FROM community WHERE id = ANY($1::uuid[])',
            [[publicId, privateId, lateId, bypassId]]
          );
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
