const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  requestBusinessLink,
  reviewBusinessLink,
  revokeBusinessLink,
} = require('../src/listing-business-link');
const { executeDirectoryAccountDeletion } = require('../src/account-lifecycle');

const url = process.env.S5_EVIDENCE_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s5ev_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S5_EVIDENCE_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable test database required');
}

const within = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out (deadlock?)`)), ms)
    ),
  ]);
const ROUNDS = 12;

// Both races commit on separate pooled connections, so each run uses fresh ids and removes them afterwards.
test(
  'business link races settle to one consistent state with consistent audit events',
  { skip: !url },
  async () => {
    const db = new DataSource({
      type: 'postgres',
      url,
      extra: { max: 10 },
    });
    await db.initialize();
    const tx = {
      transaction: (fn) => db.transaction(fn),
      query: (...x) => db.query(...x),
    };
    const town = randomUUID();
    const page = randomUUID();
    const reviewer = randomUUID();
    const operations = [];
    const requests = [];
    const authority = (profiles) => ({
      validate: async (value) => ({
        accountId: value.accountId,
        scope: { currentProfileIds: profiles, legacyProfileIds: [] },
      }),
    });
    const grant = (action, operationId, accountId) => ({
      contractVersion: 1,
      operationId,
      accountId,
      appId: 'local-hub',
      owner: 'directory',
      action,
      attempt: 1,
      leaseOwner: randomUUID(),
      expiresAt: '2026-11-16T00:00:00.000Z',
      signature: 'a'.repeat(64),
    });
    const erase = (action, operationId, accountId) =>
      executeDirectoryAccountDeletion(
        { db: tx, authority: authority([]) },
        grant(action, operationId, accountId),
        action
      );
    const seed = async (owner) => {
      const listingId = randomUUID();
      const requestId = randomUUID();
      await db.query(
        'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',
        [listingId, town, randomUUID().replace(/-/g, '').repeat(2)]
      );
      const req = {
        townId: town,
        listingId,
        businessCommunityId: page,
        ownerId: owner,
        requestId,
      };
      await requestBusinessLink(tx, req);
      requests.push(requestId);
      return req;
    };
    const state = async (req) => {
      const [row] = await db.query(
        'SELECT status,"ownerId" FROM directory_business_link_request WHERE "requestId"=$1',
        [req.requestId]
      );
      const active = await db.query(
        'SELECT "listingId" FROM directory_business_link_active WHERE "requestId"=$1 OR "listingId"=$2',
        [req.requestId, req.listingId]
      );
      const events = await db.query(
        'SELECT action,"actorDomain","actorId" FROM directory_business_link_event WHERE "requestId"=$1 ORDER BY "createdAt",action',
        [req.requestId]
      );
      return {
        status: row.status,
        ownerId: row.ownerId,
        active: active.length,
        actions: events.map((e) => e.action).sort(),
        events,
      };
    };
    const settled = (results) =>
      results.map((r) => (r.status === 'fulfilled' ? 'ok' : r.reason.message));
    try {
      const outcomes = { approveFirst: 0, withdrawFirst: 0 };
      for (let i = 0; i < ROUNDS; i++) {
        const owner = randomUUID();
        const req = await seed(owner);
        const results = await within(
          Promise.allSettled([
            reviewBusinessLink(tx, {
              ...req,
              reviewerId: reviewer,
              decision: 'approve',
              evidenceUrl: 'https://example.org/proof',
            }),
            revokeBusinessLink(tx, {
              townId: town,
              listingId: req.listingId,
              requestId: req.requestId,
              actorId: owner,
              actorRole: 'owner',
            }),
          ]),
          15000,
          'approve vs withdraw'
        );
        const s = await state(req);
        const [approve, withdraw] = settled(results);
        // The withdraw always lands; whichever order won, the link ends withdrawn with nothing active.
        assert.equal(withdraw, 'ok', `withdraw failed: ${withdraw}`);
        assert.equal(s.status, 'revoked');
        assert.equal(s.active, 0, 'no orphan active link');
        if (approve === 'ok') {
          outcomes.approveFirst++;
          assert.deepEqual(s.actions, ['approve', 'request', 'revoke']);
        } else {
          outcomes.withdrawFirst++;
          assert.equal(approve, 'Invalid business link decision');
          assert.deepEqual(s.actions, ['request', 'revoke']);
        }
        assert.equal(
          s.events.filter((e) => e.action === 'revoke').length,
          1,
          'exactly one revoke event'
        );
      }
      assert.equal(outcomes.approveFirst + outcomes.withdrawFirst, ROUNDS);

      // Approved link: a second reviewer decision cannot create a second active link, and a racing pair of
      // approvals yields exactly one winner.
      for (let i = 0; i < ROUNDS; i++) {
        const owner = randomUUID();
        const req = await seed(owner);
        const results = await within(
          Promise.allSettled([
            reviewBusinessLink(tx, {
              ...req,
              reviewerId: reviewer,
              decision: 'approve',
              evidenceUrl: 'https://example.org/a',
            }),
            reviewBusinessLink(tx, {
              ...req,
              reviewerId: randomUUID(),
              decision: 'reject',
              evidenceUrl: 'https://example.org/b',
            }),
          ]),
          15000,
          'approve vs reject'
        );
        const s = await state(req);
        const ok = settled(results).filter((r) => r === 'ok').length;
        assert.equal(ok, 1, 'exactly one reviewer decision wins');
        assert.equal(
          s.actions.filter((a) => a === 'approve' || a === 'reject').length,
          1
        );
        assert.equal(s.active, s.status === 'approved' ? 1 : 0);
        assert.ok(['approved', 'rejected'].includes(s.status));
      }

      // Owner revoke versus the owner's account deletion.
      for (let i = 0; i < ROUNDS; i++) {
        const owner = randomUUID();
        const req = await seed(owner);
        await reviewBusinessLink(tx, {
          ...req,
          reviewerId: reviewer,
          decision: 'approve',
          evidenceUrl: 'https://example.org/proof',
        });
        const op = randomUUID();
        operations.push(op);
        const results = await within(
          Promise.allSettled([
            revokeBusinessLink(tx, {
              townId: town,
              listingId: req.listingId,
              requestId: req.requestId,
              actorId: owner,
              actorRole: 'owner',
            }),
            (async () => {
              await erase('fence', op, owner);
              return erase('erase', op, owner);
            })(),
          ]),
          20000,
          'revoke vs deletion'
        );
        const s = await state(req);
        const [revoke, deletion] = settled(results);
        // Deletion always completes; the owner's revoke either lands first or is stopped by the fence.
        assert.equal(deletion, 'ok', `deletion failed: ${deletion}`);
        if (revoke !== 'ok')
          assert.match(
            revoke,
            /ACCOUNT_DELETION_FENCED|Invalid business link revocation/
          );
        assert.equal(s.status, 'revoked');
        assert.equal(s.active, 0, 'no orphan active link');
        assert.equal(s.ownerId, null, 'owner erased');
        // Exactly one revoke event, whoever wrote it, and no event still names the deleted account.
        assert.equal(s.events.filter((e) => e.action === 'revoke').length, 1);
        assert.ok(
          s.events.every((e) => e.actorId !== owner),
          'no event names the deleted owner'
        );
        assert.deepEqual(s.actions, ['approve', 'request', 'revoke']);
      }
    } finally {
      if (requests.length) {
        await db.query(
          'DELETE FROM directory_business_link_active WHERE "requestId"=ANY($1::uuid[])',
          [requests]
        );
        await db.query(
          'DELETE FROM directory_business_link_event WHERE "requestId"=ANY($1::uuid[])',
          [requests]
        );
        await db.query(
          'DELETE FROM directory_business_link_request WHERE "requestId"=ANY($1::uuid[])',
          [requests]
        );
      }
      await db.query(
        'DELETE FROM directory_listing_identity WHERE "communityId"=$1',
        [town]
      );
      if (operations.length)
        await db.query(
          'DELETE FROM account_deletion_write_fence WHERE "operationId"=ANY($1::uuid[])',
          [operations]
        );
      await db.destroy();
    }
  }
);
