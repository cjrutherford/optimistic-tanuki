const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { DirectoryTown, DirectoryTownGeometry } = require('../src/entity');
const { TownGeometryService } = require('../src/town-geometry');
const {
  storeBoundaryCandidate,
  readCurrentBoundaryCandidate,
} = require('../src/boundary-review');
const {
  recordBoundaryDecision,
  recordAutomaticBoundaryDecision,
} = require('../src/boundary-decision');
const { installReviewedBoundary } = require('../src/reviewed-boundary-install');
const {
  beginRegisterRecovery,
  advanceRegisterRecovery,
} = require('../src/register-recovery-authority');
const { reconcileRegisterV2 } = require('../src/register-reconciliation-v2');
const {
  runAutoBoundarySweep,
  selectAutoBoundaryTowns,
  reconcileAutoBoundary,
} = require('../src/auto-boundary');
const {
  installLockedBoundary,
  canonicalJson,
} = require('../src/locked-boundary');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const SHA = 'b'.repeat(64);
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
const options = { limit: 10, retryErrorMs: 0, retryReviewMs: 0 };

test('canonicalJson sorts keys so the evidence hash ignores key order', () => {
  assert.equal(
    canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } }),
    canonicalJson({ a: { c: null, d: [2, { y: 2, z: 1 }] }, b: 1 })
  );
});

test(
  'a locked boundary is installed, versioned and never overridden by the automatic paths',
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
      entities: [DirectoryTown, DirectoryTownGeometry],
    });
    await db.initialize();
    try {
      const sourceEpoch = randomUUID(),
        activationId = randomUUID();
      const auth = await beginRegisterRecovery(db, {
        sourceEpoch,
        activationId,
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
      const ids = { locked: randomUUID(), open: randomUUID() };
      const snapshot = (id, name) => ({
        id,
        name,
        slug: null,
        adminArea: 'GA',
        appScope: 'local-hub',
        isPrivate: false,
        localityType: 'city',
      });
      const register = (key, token = randomUUID()) =>
        reconcileRegisterV2(db, auth, ids[key], token, async () => ({
          status: 'current',
          snapshot: snapshot(ids[key], `Town ${key}`),
        }));
      await register('locked');
      await register('open');
      const row = async (key) =>
        (
          await db.query(
            'SELECT "geometryStatus" AS s,"geometryVersion" AS v FROM directory_town WHERE "communityId"=$1',
            [ids[key]]
          )
        )[0];
      const input = {
        communityId: ids.locked,
        expectedName: 'Town locked',
        geoid: '1323872',
        layer: 'place',
        vintage: '2026',
        stateFips: '13',
        archiveSha256: SHA,
        sourceUrl:
          'https://www2.census.gov/geo/tiger/TIGER2026/PLACE/tl_2026_13_place.zip',
        geometry: square,
        areaSqKm: { min: 100, max: 1000 },
        evidence: { rationale: 'test' },
      };

      const before = (await row('locked')).v;
      // Wrong name, an area outside the band and a non-Census source are all refused.
      await assert.rejects(
        installLockedBoundary(db, { ...input, expectedName: 'Other' }),
        /name does not match/
      );
      await assert.rejects(
        installLockedBoundary(db, { ...input, areaSqKm: { min: 1, max: 2 } }),
        /area outside/
      );
      await assert.rejects(
        installLockedBoundary(db, {
          ...input,
          sourceUrl: 'https://example.com/x.zip',
        }),
        /official source/
      );

      // Dry run writes nothing.
      const dry = await installLockedBoundary(db, input, { dryRun: true });
      assert.equal(dry.status, 'would-install');
      assert.equal(dry.version, before + 1);
      assert.equal((await row('locked')).v, before);
      assert.equal(
        (await db.query('SELECT 1 FROM directory_boundary_lock')).length,
        0
      );

      // The install bumps the geometry version and marks the town ready.
      const done = await installLockedBoundary(db, input);
      assert.equal(done.status, 'installed');
      assert.equal(done.version, before + 1);
      assert.deepEqual(await row('locked'), {
        s: 'ready',
        v: before + 1,
      });
      const stored = await db.query(
        'SELECT version FROM directory_town_geometry WHERE "communityId"=$1',
        [ids.locked]
      );
      assert.deepEqual(
        stored.map((r) => r.version),
        [before + 1]
      );

      // Repeating it is a no-op.
      const again = await installLockedBoundary(db, input);
      assert.equal(again.status, 'unchanged');
      assert.equal((await row('locked')).v, before + 1);
      const geometry = new TownGeometryService(db);
      await assert.rejects(
        geometry.setBoundary(ids.locked, {
          geometry: square,
          source: 'fixture',
          vintage: '2026',
          rights: 'public domain',
        }),
        /Boundary is locked/
      );

      // The sweep and its selection skip the locked town; the open town is still selected.
      const selected = await selectAutoBoundaryTowns(db, auth, options);
      assert.ok(selected.includes(ids.open));
      assert.ok(!selected.includes(ids.locked));
      let discovered = [];
      const deps = {
        db,
        identity: auth,
        read: () => async () => ({ status: 'gone' }),
        discover: async (id) => {
          discovered.push(id);
          return { status: 'unsupported', reason: 'test' };
        },
        storeCandidate: async () => undefined,
        load: async () => {
          throw Error('must not load');
        },
      };
      await runAutoBoundarySweep(deps, options);
      assert.ok(!discovered.includes(ids.locked));
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_boundary_auto_attempt WHERE "communityId"=$1',
            [ids.locked]
          )
        ).length,
        0
      );
      assert.deepEqual(await row('locked'), { s: 'ready', v: before + 1 });

      // The register re-reconcile and the auto reconcile leave the locked town ready.
      await register('locked');
      await reconcileAutoBoundary(db, auth);
      assert.deepEqual(await row('locked'), { s: 'ready', v: before + 1 });
      // An unlocked town is still reset to pending by the same register path.
      assert.equal((await row('open')).s, 'pending');

      const candidate = {
        communityId: ids.locked,
        changeToken: randomUUID(),
        geoid: '1323873',
        layer: input.layer,
        vintage: input.vintage,
        stateFips: input.stateFips,
        archiveSha256: SHA,
      };
      const read = async () => ({
        status: 'current',
        changeToken: candidate.changeToken,
        geography: {
          communityId: ids.locked,
          name: input.expectedName,
          city: input.expectedName,
          adminArea: 'GA',
          countryCode: 'US',
          localityType: 'city',
          referencePoint: point,
        },
      });
      await assert.rejects(
        storeBoundaryCandidate(db, auth, candidate, read, { automatic: true }),
        /Boundary is locked/
      );
      await storeBoundaryCandidate(db, auth, candidate, read);
      const current = await readCurrentBoundaryCandidate(
        db,
        auth,
        ids.locked,
        read
      );
      const requestId = randomUUID();
      const decision = {
        requestId,
        sourceUrl: input.sourceUrl,
        candidate: current,
      };
      await assert.rejects(
        recordAutomaticBoundaryDecision(
          db,
          auth,
          { ...decision, reason: 'test' },
          read
        ),
        /Boundary is locked/
      );
      await recordBoundaryDecision(
        db,
        auth,
        {
          ...decision,
          reviewerId: randomUUID(),
          decision: 'verified',
          attested: true,
        },
        read
      );
      await installReviewedBoundary(
        db,
        auth,
        { requestId, communityId: ids.locked },
        read,
        async () => ({
          ...candidate,
          status: 'candidate',
          sourceSha256: SHA,
          geometry: square,
        })
      );
      assert.deepEqual(await row('locked'), { s: 'ready', v: before + 2 });
      assert.equal(
        (await installLockedBoundary(db, input)).status,
        'unchanged'
      );
      assert.deepEqual(await row('locked'), { s: 'ready', v: before + 2 });
    } finally {
      await db.destroy();
    }
  }
);
