const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { DirectoryTown } = require('../src/entity');
const {
  beginRegisterRecovery,
  advanceRegisterRecovery,
} = require('../src/register-recovery-authority');
const { reconcileRegisterV2 } = require('../src/register-reconciliation-v2');
const { mergeTownInto } = require('../src/town-merge');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;

test(
  'register reconcile clears mergedIntoCommunityId when a merged town is eligible again, and keeps it through a removal',
  { skip: !url },
  async () => {
    const u = new URL(url);
    assert.equal(u.hostname, '127.0.0.1');
    assert.match(
      u.pathname,
      /^\/(?:directory_test_[a-f0-9]{32}|s10_geom_[a-z0-9_]+)$/
    );
    const db = new DataSource({
      type: 'postgres',
      url,
      entities: [DirectoryTown],
    });
    await db.initialize();
    try {
      const auth = await beginRegisterRecovery(db, {
        sourceEpoch: randomUUID(),
        activationId: randomUUID(),
        socialGeneration: '1',
        owner: randomUUID(),
        expectedPrevious: null,
        externalFence: true,
      });
      await advanceRegisterRecovery(
        db,
        auth,
        { phase: 'blocked', cursor: null },
        { phase: 'reg-source', cursor: null }
      );
      const source = randomUUID();
      const target = randomUUID();
      const snapshot = (id, name) => ({
        id,
        name,
        slug: null,
        adminArea: 'GA',
        appScope: 'local-hub',
        isPrivate: false,
        localityType: 'city',
      });
      const register = (id, snap) =>
        reconcileRegisterV2(db, auth, id, randomUUID(), async () => ({
          status: 'current',
          snapshot: snap,
        }));
      const pointer = async () =>
        (
          await db.query(
            'SELECT "mergedIntoCommunityId" AS m, eligible FROM directory_town WHERE "communityId"=$1',
            [source]
          )
        )[0];

      await register(source, snapshot(source, 'Old Town'));
      await register(target, snapshot(target, 'New Town'));
      // Social retires the source, then the directory merges it into the target.
      await register(source, null);
      assert.deepEqual(await pointer(), { m: null, eligible: false });
      await mergeTownInto(db, { communityId: source, intoCommunityId: target });
      assert.deepEqual(await pointer(), { m: target, eligible: false });

      // A removal reported again keeps the redirect: the town is still gone, and the merge still stands.
      await register(source, null);
      assert.deepEqual(await pointer(), { m: target, eligible: false });

      // Eligible again: the town is its own town, so it no longer redirects.
      await register(source, snapshot(source, 'Old Town'));
      assert.deepEqual(await pointer(), { m: null, eligible: true });
    } finally {
      await db.destroy();
    }
  }
);
