const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const h = require('./reviewed-spatial-helpers');
const f = require('./business-identity-carry-fixtures');
const { applyCarry, planCarry } = require('../src/business-identity-carry');
const {
  requestBusinessLink,
  reviewBusinessLink,
} = require('../src/listing-business-link');
const { stageLinkCarries } = require('../src/business-link-carry');
const {
  businessIdentityHealth,
  listIdentityReviewQueue,
} = require('../src/business-identity-review');

const url = h.databaseUrl(
  'S5_QUEUE_TEST_DATABASE_URL',
  /^\/s5_identity_queue_[a-z0-9_]+$/i
);
const town = '44444444-4444-4444-8444-444444444444';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const reviewer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
const page = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04';
const P0 = f.hex('0'),
  A = f.hex('a'),
  B = f.hex('b');
const scanA = f.hex('c'),
  scanB = f.hex('d'),
  scanB2 = f.hex('e');
const row = (id) => [{ n: 1, id, name: `Biz ${id}` }];
const carry = async (db, from, to) => {
  const o = { fromPolicyId: from, toPolicyId: to, key: f.KEY };
  const plan = await planCarry(db, o);
  await applyCarry(db, { ...o, planDigest: plan.digest });
};
const binding = (db, scan, n) =>
  db.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","fieldHashes",state,"verifiedAt","verifiedUntil")
   VALUES (gen_random_uuid(),gen_random_uuid(),$1,$2,$3,'source_file',$4,$4,'{}'::jsonb,'active',now()-interval '1 day',now()+interval '30 days')`,
    [town, scan, n, f.hex('9')]
  );

async function reset(db) {
  await f.clear(db);
  await db.query(
    'TRUNCATE directory_reviewed_binding, directory_business_link_carry, directory_business_link_event, directory_business_link_active, directory_business_link_request'
  );
}

test(
  'health is counts only and empty when nothing needs a person',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await reset(db);
      assert.deepEqual(await businessIdentityHealth(db), {
        unresolved: 0,
        absent: 0,
        awaitingOwner: 0,
        carryIncomplete: 0,
        carriedUnbound: 0,
      });
      assert.deepEqual(await listIdentityReviewQueue(db, town), {
        carriedUnbound: [],
        unresolved: [],
        awaitingOwner: [],
      });
      await assert.rejects(listIdentityReviewQueue(db, 'nope'), /review/i);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a verified predecessor with an unbound carried row and a waiting owner link are queued',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await reset(db);
      await f.cohort(db, {
        policy: A,
        town,
        release: '2026-09-23.0',
        scans: [{ scan: scanA, rows: row('k1') }],
      });
      await carry(db, P0, A);
      const listing = (
        await db.query(
          'INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,1) RETURNING id',
          [town, scanA]
        )
      )[0].id;
      const req = {
        townId: town,
        listingId: listing,
        businessCommunityId: page,
        ownerId: owner,
        requestId: randomUUID(),
      };
      await requestBusinessLink(db, req);
      await reviewBusinessLink(db, {
        ...req,
        reviewerId: reviewer,
        decision: 'approve',
        evidenceUrl: 'https://example.org/proof',
      });
      await binding(db, scanA, 1);
      await f.cohort(db, {
        policy: B,
        town,
        release: '2026-10-21.0',
        scans: [{ scan: scanB, rows: row('k1') }],
      });
      await carry(db, A, B);
      await stageLinkCarries(db, { townId: town });
      const health = await businessIdentityHealth(db);
      assert.deepEqual(health, {
        unresolved: 0,
        absent: 0,
        awaitingOwner: 1,
        carryIncomplete: 0,
        carriedUnbound: 1,
      });
      const queue = await listIdentityReviewQueue(db, town);
      assert.deepEqual(
        queue.carriedUnbound.map((r) => [r.scanId, r.sourceFileRowNumber]),
        [[scanB, '1']]
      );
      assert.equal(queue.awaitingOwner.length, 1);
      assert.deepEqual(
        (await listIdentityReviewQueue(db, randomUUID())).carriedUnbound,
        []
      );
      // Once the new row has its own live binding it leaves the queue.
      await binding(db, scanB, 1);
      assert.equal((await businessIdentityHealth(db)).carriedUnbound, 0);
      // A business whose predecessor was never verified is not queued.
      await db.query('TRUNCATE directory_reviewed_binding');
      assert.equal((await businessIdentityHealth(db)).carriedUnbound, 0);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'unresolved duplicates and absent businesses are counted until resolved',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      await reset(db);
      await f.cohort(db, {
        policy: A,
        town,
        release: '2026-09-23.0',
        scans: [{ scan: scanA, rows: row('k1') }],
      });
      await carry(db, P0, A);
      await f.cohort(db, {
        policy: B,
        town,
        release: '2026-10-21.0',
        scans: [
          { scan: scanB, rows: row('k1') },
          { scan: scanB2, rows: row('k1') },
        ],
      });
      await carry(db, A, B);
      assert.deepEqual(await businessIdentityHealth(db), {
        unresolved: 2,
        absent: 0,
        awaitingOwner: 0,
        carryIncomplete: 0,
        carriedUnbound: 0,
      });
      assert.equal(
        (await listIdentityReviewQueue(db, town)).unresolved.length,
        2
      );
      await db.query(
        'UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',
        [A]
      );
      assert.equal((await businessIdentityHealth(db)).absent, 1);
      // Withdrawing one duplicate row takes it out of the unresolved count.
      await db.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1)',
        [scanB2]
      );
      assert.equal((await businessIdentityHealth(db)).unresolved, 1);
      // The health block names no id, key or name.
      assert.ok(
        Object.values(await businessIdentityHealth(db)).every((v) =>
          Number.isInteger(v)
        )
      );
    } finally {
      await db.destroy();
    }
  }
);
