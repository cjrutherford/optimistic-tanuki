require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { DataSource } = require('typeorm'),
  { of } = require('rxjs');
const {
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');
const {
  DirectoryBusinessLinkController,
} = require('../../gateway/src/controllers/directory/directory-business-link.controller');
const url = process.env.S5_LINK_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s5_identity_[0-9]+$/.test(u.pathname) ||
    process.env.S5_LINK_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable database required');
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test(
  'gateway and Directory transport execute reviewed linking against PostgreSQL',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const r = db.createQueryRunner();
    await r.connect();
    await r.startTransaction();
    const env = { ...process.env },
      secret = 's5-compose-link-secret-123456789012345',
      localSecret = 's5-compose-local-secret-123456789012345',
      town = id(5),
      listing = id(6),
      page = id(7),
      owner = id(8),
      requestId = id(9),
      reviewer = id(10),
      scan = 'a'.repeat(64),
      policy = 'b'.repeat(64);
    const identity = {
      sourceEpoch: id(1),
      recoveryEpoch: id(2),
      owner: id(3),
      activationId: id(4),
      socialGeneration: '1',
      directoryGeneration: '2',
    };
    const authority = {
      ...identity,
      authorityEpoch: identity.recoveryEpoch,
      protocol: 'register-pending-v1',
      phase: 'reg-running',
      cursor: null,
      eligible: true,
      dbNow: new Date('2026-01-01T00:10:00Z'),
      registerRequest: {
        ...identity,
        sweep: { generation: '1' },
        lastCompletedSweep: {
          generation: '1',
          completedAt: '2026-01-01T00:00:00Z',
        },
      },
    };
    const source = {
      scan: async () => [],
      current: async () => ({
        status: 'current',
        changeToken: town,
        snapshot: {
          id: town,
          name: 'Town',
          appScope: 'local-hub',
          isPrivate: false,
          localityType: 'town',
        },
      }),
    };
    const wrapper = {
      query: (sql, params) =>
        sql.includes('FROM directory_census_progress p')
          ? Promise.resolve([authority])
          : r.query(sql, params),
      transaction: (fn) => fn(r.manager),
    };
    let server;
    try {
      await r.query(
        'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1)',
        [policy]
      );
      await r.query(
        'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
        [scan, policy]
      );
      await r.query(
        'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
        [scan]
      );
      const value = {
        name: 'Cafe',
        category: 'restaurant',
        location: { type: 'Point', coordinates: [-83, 31] },
        attribution: ['Source'],
        notices: [],
        termsUrls: [],
      };
      await r.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3)',
        [scan, town, JSON.stringify(value)]
      );
      await r.query(
        'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',
        [listing, town, scan]
      );
      server = pendingServer(
        pendingChecks(wrapper, source, identity, localSecret),
        undefined,
        undefined,
        undefined,
        undefined,
        localSecret,
        secret
      );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
      process.env.DIRECTORY_INTERNAL_URL = `http://127.0.0.1:${
        server.address().port
      }`;
      process.env.DIRECTORY_BUSINESS_LINK_SECRET = secret;
      const social = {
          send: () =>
            of({
              id: page,
              appScope: 'local-hub',
              isPrivate: false,
              slug: 'cafe',
              name: 'Cafe',
            }),
        },
        payments = {
          send: () =>
            of({
              communityId: page,
              ownerId: owner,
              lemonSqueezySubscriptionId: 'not-public',
            }),
        };
      const c = new DirectoryBusinessLinkController(social, payments);
      await c.request(
        town,
        listing,
        { businessCommunityId: page, requestId },
        { user: { userId: owner } }
      );
      assert.equal((await c.read(town, listing)).link, null);
      assert.equal(
        (await c.mine(town, listing, { user: { userId: owner } })).requests[0]
          .status,
        'pending'
      );
      assert.equal(
        (await c.mine(town, listing, { user: { userId: id(11) } })).requests
          .length,
        0
      );
      assert.equal(
        (await c.requests(town, listing, { user: { profileId: reviewer } }))
          .requests.length,
        1
      );
      await c.review(
        town,
        listing,
        {
          businessCommunityId: page,
          ownerId: owner,
          requestId,
          decision: 'approve',
          evidenceUrl: 'https://example.org/official',
          attested: true,
        },
        { user: { profileId: reviewer } }
      );
      assert.deepEqual(await c.read(town, listing), {
        link: { communityId: page, slug: 'cafe', name: 'Cafe' },
      });
      assert.equal(
        (await c.mine(town, listing, { user: { userId: owner } })).requests[0]
          .status,
        'approved'
      );
      await c.revoke(town, listing, { requestId }, { user: { userId: owner } });
      assert.equal((await c.read(town, listing)).link, null);
      assert.equal(
        (await c.mine(town, listing, { user: { userId: owner } })).requests
          .length,
        0
      );
      assert.equal(
        (
          await r.query(
            'SELECT count(*)::int AS n FROM directory_business_link_event WHERE "requestId"=$1',
            [requestId]
          )
        )[0].n,
        3
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      process.env = env;
      await r.rollbackTransaction();
      await r.release();
      await db.destroy();
    }
  }
);
