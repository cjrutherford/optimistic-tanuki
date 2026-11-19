const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
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
const { requireTownContainment } = require('../src/address-review-publish');
const { pendingChecks } = require('../src/register-pending-runtime');
const { readCurrentBoundaryCandidate } = require('../src/boundary-review');
const { reconcileAutoBoundary } = require('../src/auto-boundary');

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
  'a lock yields an owner-verified decision and binding that every boundary consumer accepts',
  {
    skip: !url,
  },
  async () => {
    assert.match(new URL(url).pathname, /^\/directory_test_[a-f0-9]{32}$/);
    const db = new DataSource({
      type: 'postgres',
      url,
      entities: [DirectoryTown, DirectoryTownGeometry],
    });
    await db.initialize();
    const gateway = createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const [lng, lat] = [
        Number(u.searchParams.get('longitude')),
        Number(u.searchParams.get('latitude')),
      ];
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          town: { id: u.pathname.split('/')[4] },
          status: 'ready',
          covers:
            Math.abs(lng - point[0]) < 0.1 && Math.abs(lat - point[1]) < 0.1,
        })
      );
    });
    await new Promise((r) => gateway.listen(0, '127.0.0.1', r));
    try {
      const sourceEpoch = randomUUID(),
        activationId = randomUUID(),
        owner = randomUUID();
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
      const running = () =>
        db.query(
          `UPDATE directory_census_progress SET phase='reg-running', "registerRequest"="registerRequest" || $1::jsonb WHERE id='recovery'`,
          [
            JSON.stringify({
              sweep: { generation: '1' },
              lastCompletedSweep: {
                generation: '1',
                completedAt: new Date().toISOString(),
              },
            }),
          ]
        );
      const input = {
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
      };
      const inside = { lat: point[1], lng: point[0] };
      const outside = { lat: 40, lng: -100 };
      // The Social geography is deliberately unavailable: a locked town needs no Social candidate.
      const social = { geography: async () => ({ status: 'gone' }) };
      const decisions = () =>
        db.query(
          `SELECT "reviewerId",automatic,reason,"changeToken","invalidatedAt","recoveryEpoch","directoryGeneration" FROM directory_boundary_decision WHERE "communityId"=$1 ORDER BY "createdAt"`,
          [id]
        );

      // Before the lock: no verified boundary.
      assert.equal(await queryVerifiedBoundary(db, id, inside, inside), null);

      const dry = await installLockedBoundary(db, input, { dryRun: true });
      assert.equal(dry.status, 'would-install');
      assert.equal((await decisions()).length, 0);

      const done = await installLockedBoundary(db, input);
      assert.equal(done.status, 'installed');
      const [d] = await decisions();
      assert.equal(d.reviewerId, null);
      assert.equal(d.automatic, false);
      assert.equal(d.reason, OWNER_LOCK_REASON);
      assert.equal(d.invalidatedAt, null);
      assert.equal(
        d.changeToken,
        ownerLockChangeToken(done.evidenceHash, done.version)
      );

      // D11 strong match input and publish containment accept the locked town.
      const row = await queryVerifiedBoundary(db, id, inside, inside, true);
      assert.ok(row);
      assert.equal(row.geocode_inside, true);
      assert.equal(row.source_inside, true);
      assert.equal(row.changeToken, d.changeToken);
      assert.equal(
        (await queryVerifiedBoundary(db, id, outside, inside)).geocode_inside,
        false
      );
      process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL = `http://127.0.0.1:${
        gateway.address().port
      }/`;
      const containment = await requireTownContainment(
        {
          communityId: id,
          geocode: { status: 'match', coordinates: inside },
          point: inside,
        },
        db
      );
      assert.deepEqual(containment, {
        basis: 'verified_boundary',
        changeToken: d.changeToken,
      });
      await assert.rejects(
        requireTownContainment(
          {
            communityId: id,
            geocode: { status: 'match', coordinates: outside },
            point: inside,
          },
          db
        ),
        /outside the assigned town/
      );
      // The recovery runtime reports it verified without any Social candidate.
      await running();
      const runtime = pendingChecks(db, social, auth);
      assert.deepEqual(await runtime.containment(id, inside.lng, inside.lat), {
        status: 'ready',
        covers: true,
      });
      assert.equal((await runtime.boundary(id)).status, 'ready');

      // The automatic reconcile and a stale-candidate read leave it alone.
      await reconcileAutoBoundary(db, auth);
      assert.equal(
        await readCurrentBoundaryCandidate(db, auth, id, async () => ({
          status: 'gone',
        })),
        null
      );
      assert.ok(await queryVerifiedBoundary(db, id, inside, inside));

      // Re-running the install reports nothing to do while the records exist.
      assert.equal(
        (await installLockedBoundary(db, input)).status,
        'unchanged'
      );

      // A recovery reset re-creates the records under the new authority: still verified.
      auth = await begin(auth);
      const reset = await decisions();
      assert.equal(reset.filter((x) => x.invalidatedAt === null).length, 1);
      assert.equal(
        reset.find((x) => x.invalidatedAt === null).recoveryEpoch,
        auth.recoveryEpoch
      );
      assert.equal(
        reset.find((x) => x.invalidatedAt === null).changeToken,
        d.changeToken
      );
      assert.ok(await queryVerifiedBoundary(db, id, inside, inside));
      await running();
      assert.deepEqual(
        await pendingChecks(db, social, auth).containment(
          id,
          inside.lng,
          inside.lat
        ),
        { status: 'ready', covers: true }
      );

      // A lock installed before this change (records missing) is backfilled, once, and a dry run writes nothing.
      await db.query(
        'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
        [id]
      );
      await db.query(
        'DELETE FROM directory_boundary_decision WHERE "communityId"=$1',
        [id]
      );
      assert.equal(await queryVerifiedBoundary(db, id, inside, inside), null);
      assert.equal(
        (await installLockedBoundary(db, input, { dryRun: true })).status,
        'would-backfill'
      );
      assert.equal((await decisions()).length, 0);
      assert.equal(
        (await installLockedBoundary(db, input)).status,
        'backfilled'
      );
      assert.ok(await queryVerifiedBoundary(db, id, inside, inside));
      assert.equal(
        (await installLockedBoundary(db, input)).status,
        'unchanged'
      );
      assert.equal((await decisions()).length, 1);
    } finally {
      delete process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL;
      gateway.close();
      await db.destroy();
    }
  }
);
