const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  requestBusinessLink,
  reviewBusinessLink,
  revokeBusinessLink,
  readBusinessLink,
  listBusinessLinkRequests,
  listTownBusinessLinkRequests,
  listOwnerBusinessLinks,
} = require('../src/listing-business-link');
const url = process.env.S5_LINK_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s5_identity_[0-9]+$/.test(u.pathname) ||
    process.env.S5_LINK_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable test database required');
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test(
  'link approval and revocation are atomic, audited and scoped',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const r = db.createQueryRunner();
    await r.connect();
    await r.startTransaction();
    try {
      const tx = {
        transaction: (fn) => fn(r.manager),
        query: (...x) => r.query(...x),
      };
      await r.query(
        'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',
        [id(2), id(1), 'a'.repeat(64)]
      );
      const req = {
        townId: id(1),
        listingId: id(2),
        businessCommunityId: id(3),
        ownerId: id(4),
        requestId: id(5),
      };
      await requestBusinessLink(tx, req);
      await requestBusinessLink(tx, req);
      assert.equal(await readBusinessLink(tx, id(1), id(2)), null);
      assert.deepEqual(await listOwnerBusinessLinks(tx, id(1), id(2), id(4)), [
        { requestId: id(5), businessCommunityId: id(3), status: 'pending' },
      ]);
      assert.deepEqual(
        await listOwnerBusinessLinks(tx, id(1), id(2), id(9)),
        []
      );
      assert.deepEqual(await listBusinessLinkRequests(tx, id(1), id(2)), [
        { requestId: id(5), businessCommunityId: id(3), ownerId: id(4) },
      ]);
      assert.deepEqual(await listBusinessLinkRequests(tx, id(7), id(2)), []);
      assert.deepEqual(await listTownBusinessLinkRequests(tx, id(1)), {
        requests: [
          {
            listingId: id(2),
            requestId: id(5),
            businessCommunityId: id(3),
            ownerId: id(4),
          },
        ],
        nextCursor: null,
      });
      assert.deepEqual(await listTownBusinessLinkRequests(tx, id(1), id(5)), {
        requests: [],
        nextCursor: null,
      });
      await assert.rejects(
        requestBusinessLink(tx, { ...req, ownerId: id(9) }),
        /link/i
      );
      await reviewBusinessLink(tx, {
        ...req,
        reviewerId: id(6),
        decision: 'approve',
        evidenceUrl: 'https://example.org/business',
      });
      assert.deepEqual(await readBusinessLink(tx, id(1), id(2)), {
        businessCommunityId: id(3),
        ownerId: id(4),
      });
      assert.equal(await readBusinessLink(tx, id(7), id(2)), null);
      await assert.rejects(
        revokeBusinessLink(tx, {
          townId: id(1),
          listingId: id(2),
          requestId: id(5),
          actorId: id(9),
          actorRole: 'owner',
        }),
        /link/i
      );
      assert.ok(await readBusinessLink(tx, id(1), id(2)));
      await revokeBusinessLink(tx, {
        townId: id(1),
        listingId: id(2),
        requestId: id(5),
        actorId: id(4),
        actorRole: 'owner',
      });
      assert.equal(await readBusinessLink(tx, id(1), id(2)), null);
      assert.deepEqual(
        await listOwnerBusinessLinks(tx, id(1), id(2), id(4)),
        []
      );
      const events = await r.query(
        'SELECT action,"actorDomain" FROM directory_business_link_event WHERE "requestId"=$1 ORDER BY action',
        [id(5)]
      );
      assert.deepEqual(events, [
        { action: 'approve', actorDomain: 'profile' },
        { action: 'request', actorDomain: 'account' },
        { action: 'revoke', actorDomain: 'account' },
      ]);
      const reviewerRequest = { ...req, requestId: id(10) };
      await requestBusinessLink(tx, reviewerRequest);
      await revokeBusinessLink(tx, {
        townId: id(1),
        listingId: id(2),
        requestId: id(10),
        actorId: id(6),
        actorRole: 'reviewer',
      });
      const reviewerEvent = await r.query(
        'SELECT "actorDomain" FROM directory_business_link_event WHERE "requestId"=$1 AND action=\'revoke\'',
        [id(10)]
      );
      assert.deepEqual(reviewerEvent, [{ actorDomain: 'profile' }]);
      await r.query(
        `INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId","ownerId",status) SELECT gen_random_uuid(),$1,$2,$3,$4,'pending' FROM generate_series(1,101)`,
        [id(1), id(2), id(3), id(4)]
      );
      const first = await listTownBusinessLinkRequests(tx, id(1));
      assert.equal(first.requests.length, 100);
      assert.ok(first.nextCursor);
      const second = await listTownBusinessLinkRequests(
        tx,
        id(1),
        first.nextCursor
      );
      assert.equal(second.requests.length, 1);
      assert.equal(second.nextCursor, null);
      assert.equal(
        new Set([...first.requests, ...second.requests].map((x) => x.requestId))
          .size,
        101
      );
    } finally {
      await r.rollbackTransaction();
      await r.release();
      await db.destroy();
    }
  }
);
