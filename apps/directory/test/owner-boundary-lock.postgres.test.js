const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { DirectoryTown, DirectoryTownGeometry } = require('../src/entity');
const {
  beginRegisterRecovery,
  advanceRegisterRecovery,
} = require('../src/register-recovery-authority');
const { reconcileRegisterV2 } = require('../src/register-reconciliation-v2');
const { installLockedBoundary } = require('../src/locked-boundary');
const {
  ownerLockChangeToken,
  OWNER_LOCK_REASON,
} = require('../src/locked-boundary-binding');
const { queryVerifiedBoundary } = require('../src/address-strong-match');
const {
  lockBoundary,
  unlockBoundary,
  readBoundaryLock,
} = require('../src/owner-boundary-lock');
const { ReviewConflictError } = require('../src/review-version');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const point = [-82.854335, 31.506114];
const square = {
  type: 'Polygon',
  coordinates: [
    [
      [point[0] - 0.1, point[1] - 0.1],
      [point[0] + 0.1, point[1] - 0.1],
      [point[0] + 0.1, point[1] + 0.1],
      [point[0] - 0.1, point[1] + 0.1],
      [point[0] - 0.1, point[1] - 0.1],
    ],
  ],
};

test(
  'owner lock and unlock agree with recovery in both directions and write audit rows',
  { skip: !url },
  async () => {
    assert.match(new URL(url).pathname, /^\/directory_test_[a-f0-9]{32}$/);
    const db = new DataSource({
      type: 'postgres',
      url,
      entities: [DirectoryTown, DirectoryTownGeometry],
    });
    await db.initialize();
    try {
      const sourceEpoch = randomUUID(),
        activationId = randomUUID(),
        owner = randomUUID(),
        actor = randomUUID();
      const begin = (expectedPrevious) =>
        beginRegisterRecovery(db, {
          sourceEpoch,
          activationId,
          socialGeneration: '1',
          owner,
          expectedPrevious,
          externalFence: true,
        });
      let auth = await begin(null);
      await advanceRegisterRecovery(
        db,
        auth,
        { phase: 'blocked', cursor: null },
        { phase: 'reg-source', cursor: null }
      );
      const id = randomUUID();
      await reconcileRegisterV2(db, auth, id, randomUUID(), async () => ({
        status: 'current',
        snapshot: {
          id,
          name: 'Locked Town',
          slug: null,
          adminArea: 'GA',
          appScope: 'local-hub',
          isPrivate: false,
          localityType: 'city',
        },
      }));
      const inside = { lat: point[1], lng: point[0] };
      const live = () =>
        db.query(
          'SELECT count(*)::int AS n FROM directory_boundary_decision WHERE "communityId"=$1 AND "invalidatedAt" IS NULL',
          [id]
        );
      const audit = () =>
        db.query(
          `SELECT action,"actorId",reason FROM directory_operator_event WHERE kind='boundary_lock' AND "subjectId"=$1 ORDER BY at`,
          [id]
        );
      assert.deepEqual(await readBoundaryLock(db, id), {
        locked: false,
        townName: 'Locked Town',
        lock: null,
      });
      // Nothing verified yet, so a console lock has nothing to pin.
      await assert.rejects(
        lockBoundary(db, { communityId: id, actorId: actor, reason: 'pin' }),
        (e) =>
          e instanceof ReviewConflictError &&
          e.detail === 'no_verified_boundary'
      );
      await assert.rejects(
        unlockBoundary(db, { communityId: id, actorId: actor, reason: 'x' }),
        (e) => e instanceof ReviewConflictError && e.detail === 'not_locked'
      );

      // Locked (here through the manifest install): recovery keeps it and re-creates its binding.
      await installLockedBoundary(db, {
        communityId: id,
        expectedName: 'Locked Town',
        geoid: '1323872',
        layer: 'place',
        vintage: '2026',
        stateFips: '13',
        archiveSha256: 'b'.repeat(64),
        sourceUrl:
          'https://www2.census.gov/geo/tiger/TIGER2026/PLACE/tl_2026_13_place.zip',
        geometry: square,
        areaSqKm: { min: 100, max: 1000 },
        evidence: { rationale: 'test' },
      });
      assert.equal((await readBoundaryLock(db, id)).locked, true);
      await assert.rejects(
        lockBoundary(db, { communityId: id, actorId: actor, reason: 'again' }),
        (e) => e instanceof ReviewConflictError && e.detail === 'already_locked'
      );
      auth = await begin(auth);
      assert.ok(await queryVerifiedBoundary(db, id, inside, inside));
      assert.equal((await live())[0].n, 1);

      // Unlock: the row, the owner-lock decision and the verified boundary are gone, the town is pending again.
      const state = await unlockBoundary(db, {
        communityId: id,
        actorId: actor,
        reason: 'boundary was wrong',
      });
      assert.deepEqual(state, {
        locked: false,
        townName: 'Locked Town',
        lock: null,
      });
      assert.equal(await queryVerifiedBoundary(db, id, inside, inside), null);
      assert.equal((await live())[0].n, 0);
      const [town] = await db.query(
        'SELECT "geometryStatus" FROM directory_town WHERE "communityId"=$1',
        [id]
      );
      assert.equal(town.geometryStatus, 'pending');
      assert.deepEqual(await audit(), [
        { action: 'unlock', actorId: actor, reason: 'boundary was wrong' },
      ]);

      // ...and recovery does not bring the lock back.
      auth = await begin(auth);
      assert.equal((await readBoundaryLock(db, id)).locked, false);
      assert.equal(await queryVerifiedBoundary(db, id, inside, inside), null);
      assert.equal((await live())[0].n, 0);
      await assert.rejects(
        unlockBoundary(db, { communityId: id, actorId: actor, reason: 'x' }),
        (e) => e instanceof ReviewConflictError && e.detail === 'not_locked'
      );
    } finally {
      await db.destroy();
    }
  }
);
