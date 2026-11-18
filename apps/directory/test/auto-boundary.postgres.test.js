const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  beginRegisterRecovery,
  advanceRegisterRecovery,
} = require('../src/register-recovery-authority');
const { reconcileRegisterV2 } = require('../src/register-reconciliation-v2');
const {
  storeDiscoveredBoundaryCandidate,
} = require('../../directory-worker/src/boundary-review');
const { runAutoBoundarySweep } = require('../src/auto-boundary');
const { setControl } = require('../src/operating-controls');

const url = process.env.AUTO_BOUNDARY_TEST_DATABASE_URL;
const SHA = 'a'.repeat(64);
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
const options = { limit: 10, retryErrorMs: 0, retryReviewMs: 3600000 };

test(
  'automatic boundary sweep installs single matches and queues the rest',
  { skip: !url },
  async () => {
    const u = new URL(url);
    assert.equal(u.hostname, '127.0.0.1');
    assert.match(u.pathname, /^\/s10_geom_[a-z0-9_]+$/);
    const db = new DataSource({ type: 'postgres', url });
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
      const towns = {};
      for (const key of ['single', 'multi', 'none', 'cousub']) {
        const id = randomUUID(),
          token = randomUUID();
        towns[key] = { id, token };
        await reconcileRegisterV2(db, auth, id, token, async () => ({
          status: 'current',
          snapshot: {
            id,
            name: `Town ${key}`,
            slug: null,
            adminArea: 'GA',
            appScope: 'local-hub',
            isPrivate: false,
            localityType: 'city',
          },
        }));
      }
      const geographyOf = (key) => ({
        communityId: towns[key].id,
        name: `Town ${key}`,
        city: `City ${key}`,
        adminArea: 'GA',
        countryCode: 'US',
        localityType: 'city',
        referencePoint: point,
      });
      const byId = Object.fromEntries(
        Object.entries(towns).map(([k, v]) => [v.id, k])
      );
      const read = (id) => async () => ({
        status: 'current',
        changeToken: towns[byId[id]].token,
        geography: geographyOf(byId[id]),
      });
      const cand = (geoid, layer) => ({
        geoid,
        layer,
        vintage: '2026',
        stateFips: '13',
        sourceSha256: SHA,
      });
      const matches = {
        single: [cand('1323872', 'place'), cand('1306798765', 'cousub')],
        multi: [cand('1311111', 'place'), cand('1322222', 'place')],
        none: [],
        cousub: [cand('1306791234', 'cousub')],
      };
      let loads = 0;
      const deps = {
        db,
        identity: auth,
        read,
        discover: async (id) => ({
          status: 'candidate',
          changeToken: towns[byId[id]].token,
          candidates: matches[byId[id]],
        }),
        storeCandidate: async (id, found, candidate) =>
          storeDiscoveredBoundaryCandidate(
            db,
            auth,
            {
              status: 'candidate',
              sourceIdentity: {
                sourceEpoch,
                activationId,
                socialGeneration: '1',
              },
              changeToken: found.changeToken,
              reviewContext: {
                communityId: id,
                name: geographyOf(byId[id]).name,
                city: geographyOf(byId[id]).city,
                adminArea: 'GA',
                countryCode: 'US',
                localityType: 'city',
              },
              approximateLocation: { coordinates: point },
              candidates: [candidate],
            },
            { geography: read(id) }
          ),
        load: async (decision) => {
          loads++;
          return {
            status: 'candidate',
            geoid: decision.geoid,
            stateFips: decision.stateFips,
            layer: decision.layer,
            vintage: decision.vintage,
            sourceSha256: decision.archiveSha256,
            geometry: square,
          };
        },
      };
      const status = async (key) =>
        (
          await db.query(
            'SELECT "geometryStatus" AS s FROM directory_town WHERE "communityId"=$1',
            [towns[key].id]
          )
        )[0].s;
      const ledger = async (key) =>
        (
          await db.query(
            'SELECT status,reason,attempts FROM directory_boundary_auto_attempt WHERE "communityId"=$1',
            [towns[key].id]
          )
        )[0];

      // The kill switch stops the sweep before any town is touched.
      await setControl(db, {
        key: 'provider_acquisition',
        paused: true,
        reason: 'test',
        actorId: randomUUID(),
        expectedVersion: 0,
      });
      const paused = await runAutoBoundarySweep(deps, options);
      assert.equal(paused.status, 'paused');
      assert.equal(paused.examined, 0);
      assert.equal(await ledger('single'), undefined);
      await setControl(db, {
        key: 'provider_acquisition',
        paused: false,
        reason: null,
        actorId: randomUUID(),
        expectedVersion: 1,
      });

      const first = await runAutoBoundarySweep(deps, options);
      assert.equal(first.status, 'ok');
      assert.equal(first.installed, 2);
      assert.equal(first.queued, 2);
      assert.equal(first.errors, 0);
      for (const key of ['single', 'cousub']) {
        assert.equal(await status(key), 'ready');
        assert.equal((await ledger(key)).status, 'installed');
        const [g] = await db.query(
          'SELECT source,rights FROM directory_town_geometry WHERE "communityId"=$1',
          [towns[key].id]
        );
        assert.equal(g.source, 'census-tiger');
        assert.equal(g.rights, 'public domain');
        const [d] = await db.query(
          'SELECT automatic,reason,"reviewerId","invalidatedAt" FROM directory_boundary_decision WHERE "communityId"=$1',
          [towns[key].id]
        );
        assert.equal(d.automatic, true);
        assert.equal(d.reason, 'auto: unambiguous TIGER match');
        assert.equal(d.reviewerId, null);
        assert.equal(d.invalidatedAt, null);
      }
      // Re-reconciling the register (the worker does this on every sweep) must not drop the town back to pending.
      for (const key of ['single', 'cousub'])
        await reconcileRegisterV2(
          db,
          auth,
          towns[key].id,
          towns[key].token,
          async () => ({
            status: 'current',
            snapshot: {
              id: towns[key].id,
              name: `Town ${key} renamed`,
              slug: null,
              adminArea: 'GA',
              appScope: 'local-hub',
              isPrivate: false,
              localityType: 'city',
            },
          })
        );
      for (const key of ['single', 'cousub'])
        assert.equal(await status(key), 'ready');

      // A pending status left by an older deployment is healed by the next sweep without reinstalling.
      await db.query(
        `UPDATE directory_town SET "geometryStatus"='pending' WHERE "communityId"=$1`,
        [towns.cousub.id]
      );
      await runAutoBoundarySweep(deps, options);
      assert.equal(await status('cousub'), 'ready');

      // Place is preferred over county subdivision.
      const [chosen] = await db.query(
        'SELECT geoid,layer FROM directory_boundary_decision WHERE "communityId"=$1',
        [towns.single.id]
      );
      assert.deepEqual(
        { geoid: chosen.geoid, layer: chosen.layer },
        { geoid: '1323872', layer: 'place' }
      );
      assert.equal(await status('multi'), 'pending');
      assert.equal((await ledger('multi')).status, 'ambiguous');
      assert.equal((await ledger('multi')).reason, 'multiple_place_matches');
      assert.equal(await status('none'), 'pending');
      assert.equal((await ledger('none')).reason, 'no_tiger_match');
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM directory_boundary_decision WHERE "communityId"=ANY($1)',
            [[towns.multi.id, towns.none.id]]
          )
        )[0].n,
        0
      );

      // A second sweep inside the review retry window changes nothing.
      const loadsAfterFirst = loads;
      const second = await runAutoBoundarySweep(deps, options);
      assert.equal(second.examined, 0);
      assert.equal(loads, loadsAfterFirst);
      assert.equal((await ledger('multi')).attempts, 1);

      // Undo through the existing path leaves the town pending and is not reinstalled.
      await db.query(
        'UPDATE directory_boundary_decision SET "invalidatedAt"=CURRENT_TIMESTAMP WHERE "communityId"=$1',
        [towns.single.id]
      );
      await db.query(
        'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
        [towns.single.id]
      );
      await runAutoBoundarySweep(deps, options);
      assert.equal(await status('single'), 'pending');
      assert.equal((await ledger('single')).status, 'undone');
      assert.equal(loads, loadsAfterFirst);

      // A town whose lookup fails is recorded as an error and retried.
      const failing = {
        ...deps,
        discover: async () => {
          throw Error('archive_digest_mismatch');
        },
      };
      await db.query(
        'DELETE FROM directory_boundary_auto_attempt WHERE "communityId"=$1',
        [towns.none.id]
      );
      const failed = await runAutoBoundarySweep(failing, options);
      assert.equal(failed.errors, 1);
      assert.match((await ledger('none')).reason, /archive_digest_mismatch/);
      assert.equal(await status('none'), 'pending');
    } finally {
      await db.destroy();
    }
  }
);
