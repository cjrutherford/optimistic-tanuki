const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const h = require('./reviewed-spatial-helpers');
const f = require('./business-identity-carry-fixtures');
const { applyCarry, planCarry } = require('../src/business-identity-carry');
const {
  requestBusinessLink,
  reviewBusinessLink,
  revokeBusinessLink,
  readBusinessLink,
  listOwnerBusinessLinks,
} = require('../src/listing-business-link');
const {
  stageLinkCarries,
  reconcileLinkCarries,
  restoreLinkCarry,
  confirmLinkCarry,
  listOwnerLinkCarries,
  SYSTEM_ACTOR,
} = require('../src/business-link-carry');
const {
  deletionIdentityKey,
} = require('../../../libs/storage/src/lib/account-deletion-write-fence');

const url = h.databaseUrl(
  'S5_LINKCARRY_TEST_DATABASE_URL',
  /^\/s5_identity_linkcarry_[a-z0-9_]+$/i
);
const town = '44444444-4444-4444-8444-444444444444';
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const other = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
const reviewer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
const page = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04';
const P0 = f.hex('0'),
  A = f.hex('a'),
  B = f.hex('b');
const scanA = f.hex('c'),
  scanB = f.hex('d');
const rows = (...ids) =>
  ids.map((id, i) => ({ n: i + 1, id, name: `Biz ${id}` }));
const carry = async (db) => {
  const o = { fromPolicyId: A, toPolicyId: B, key: f.KEY };
  const plan = await planCarry(db, o);
  await applyCarry(db, { ...o, planDigest: plan.digest });
};
const identity = async (db, scan, n) =>
  (
    await db.query(
      'SELECT id FROM directory_listing_identity WHERE "communityId"=$1 AND "scanId"=$2 AND "sourceFileRowNumber"=$3',
      [town, scan, n]
    )
  )[0]?.id;
const binding = (db, scan, n, address, extra = '') =>
  db.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","fieldHashes",state,"verifiedAt","verifiedUntil")
   VALUES (gen_random_uuid(),gen_random_uuid(),$1,$2,$3,'source_file',$4,$4,$5::jsonb,'active',now()-interval '1 day',now()+interval '30 days')`,
    [
      town,
      scan,
      n,
      f.hex('9'),
      JSON.stringify({ address: { hash: address, origin: 'reviewed' } }),
    ]
  );
const states = (db) =>
  db.query('SELECT state FROM directory_business_link_carry ORDER BY state');
const actions = async (db, request) =>
  (
    await db.query(
      'SELECT action,"actorDomain" FROM directory_business_link_event WHERE "requestId"=$1 ORDER BY "createdAt",action',
      [request]
    )
  ).map((r) => `${r.action}:${r.actorDomain}`);

/** Release A holds two keyed businesses with one approved owner link on the first; release B is carried and the link staged. */
async function setup(db, { stage = true } = {}) {
  await f.clear(db);
  await db.query(
    'TRUNCATE directory_reviewed_binding, directory_business_link_carry, directory_business_link_event, directory_business_link_active, directory_business_link_request'
  );
  await f.cohort(db, {
    policy: A,
    town,
    release: '2026-09-23.0',
    scans: [{ scan: scanA, rows: rows('k1', 'k2') }],
  });
  const plan = await planCarry(db, {
    fromPolicyId: P0,
    toPolicyId: A,
    key: f.KEY,
  });
  await applyCarry(db, {
    fromPolicyId: P0,
    toPolicyId: A,
    key: f.KEY,
    planDigest: plan.digest,
  });
  const listing = (
    await db.query(
      'INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,1) RETURNING id',
      [town, scanA]
    )
  )[0].id;
  const requestId = randomUUID();
  const req = {
    townId: town,
    listingId: listing,
    businessCommunityId: page,
    ownerId: owner,
    requestId,
  };
  await requestBusinessLink(db, req);
  await reviewBusinessLink(db, {
    ...req,
    reviewerId: reviewer,
    decision: 'approve',
    evidenceUrl: 'https://example.org/proof',
  });
  await f.cohort(db, {
    policy: B,
    town,
    release: '2026-10-21.0',
    scans: [{ scan: scanB, rows: rows('k1', 'k2') }],
  });
  await carry(db);
  const staged = stage ? await stageLinkCarries(db, { townId: town }) : null;
  return { listing, requestId, req, staged };
}

test(
  'a carried link is proposed and hidden, never moved by the carry itself',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const s = await setup(db);
      assert.deepEqual(s.staged, { proposed: 1, existing: 0, skipped: 0 });
      assert.deepEqual(await stageLinkCarries(db, { townId: town }), {
        proposed: 0,
        existing: 1,
        skipped: 0,
      });
      const target = await identity(db, scanB, 1);
      assert.ok(target);
      assert.equal(
        await readBusinessLink(db, town, s.listing),
        null,
        'hidden at the superseded row'
      );
      assert.equal(
        await readBusinessLink(db, town, target),
        null,
        'not shown at the carried row'
      );
      assert.deepEqual(await states(db), [{ state: 'awaiting_confirmation' }]);
      assert.ok(
        (await actions(db, s.requestId)).includes('carry_pending:system')
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_business_link_active WHERE "listingId"=$1',
            [target]
          )
        )[0].n,
        0
      );
      // The carry copied no binding and no reviewed field.
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_reviewed_binding'
          )
        )[0].n,
        0
      );
      assert.equal(
        await (async () =>
          (
            await listOwnerLinkCarries(db, town, owner)
          ).length)(),
        1
      );
      assert.equal((await listOwnerLinkCarries(db, town, other)).length, 0);
      assert.equal(
        (await reconcileLinkCarries(db, { townId: town })).restored,
        0,
        'carried alone does not restore'
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'corroboration needs an independent, equal reviewed address; then the link is restored',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const s = await setup(db);
      const target = await identity(db, scanB, 1);
      await binding(db, scanA, 1, f.hex('1'));
      assert.deepEqual(
        await reconcileLinkCarries(db, { townId: town }),
        { corroborated: 0, restored: 0, skipped: 0 },
        'no binding on the new row'
      );
      await binding(db, scanB, 1, f.hex('2'));
      assert.deepEqual(
        await reconcileLinkCarries(db, { townId: town }),
        { corroborated: 0, restored: 0, skipped: 0 },
        'a different address does not corroborate'
      );
      await db.query(
        `UPDATE directory_reviewed_binding SET "fieldHashes"='{"address":{"hash":"${f.hex(
          '1'
        )}","origin":"reviewed"}}'::jsonb WHERE "scanId"=$1`,
        [scanB]
      );
      assert.deepEqual(await reconcileLinkCarries(db, { townId: town }), {
        corroborated: 1,
        restored: 1,
        skipped: 0,
      });
      assert.deepEqual(
        await reconcileLinkCarries(db, { townId: town }),
        { corroborated: 0, restored: 0, skipped: 0 },
        'idempotent'
      );
      assert.deepEqual(await readBusinessLink(db, town, target), {
        businessCommunityId: page,
        ownerId: owner,
      });
      assert.deepEqual(
        await readBusinessLink(db, town, s.listing),
        { businessCommunityId: page, ownerId: owner },
        'the old id resolves to the same business'
      );
      assert.deepEqual(await states(db), [{ state: 'restored' }]);
      assert.ok(
        (await actions(db, s.requestId)).includes('carry_restore:system')
      );
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_event WHERE kind='corroborated'`
          )
        )[0].n,
        1
      );
      assert.equal((await f.assertions(db, B))[0].confidence, 'corroborated');
      assert.equal(
        (await listOwnerBusinessLinks(db, town, target, owner)).length,
        1
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'owner re-confirmation restores the link, records the owner and confirms the assertion; others cannot',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const s = await setup(db);
      const [{ carryId }] = await listOwnerLinkCarries(db, town, owner);
      await assert.rejects(
        confirmLinkCarry(db, { townId: town, carryId, ownerId: other }),
        /link carry/i
      );
      assert.deepEqual(await states(db), [{ state: 'awaiting_confirmation' }]);
      const key = deletionIdentityKey('account', owner);
      await db.query(
        `INSERT INTO account_deletion_write_fence ("key",kind,"operationId") VALUES ($1,'account',$2)`,
        [key, randomUUID()]
      );
      try {
        await assert.rejects(
          confirmLinkCarry(db, { townId: town, carryId, ownerId: owner }),
          /ACCOUNT_DELETION_FENCED/
        );
      } finally {
        await db.query(
          'DELETE FROM account_deletion_write_fence WHERE "key"=$1',
          [key]
        );
      }
      assert.equal(
        (await reconcileLinkCarries(db, { townId: town })).restored,
        0
      );
      assert.equal(
        await confirmLinkCarry(db, { townId: town, carryId, ownerId: owner }),
        true
      );
      assert.equal(
        await confirmLinkCarry(db, { townId: town, carryId, ownerId: owner }),
        false
      );
      assert.ok(await readBusinessLink(db, town, await identity(db, scanB, 1)));
      assert.ok(
        (await actions(db, s.requestId)).includes(`carry_confirm:account`)
      );
      const [a] = await f.assertions(db, B);
      assert.equal(a.confidence, 'confirmed');
      assert.equal(
        (
          await db.query(
            `SELECT count(*)::int n FROM directory_business_assertion WHERE evidence='owner_confirmed'`
          )
        )[0].n,
        1
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'revoking the link closes a waiting carry and works on a moved link',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const s = await setup(db);
      await revokeBusinessLink(db, {
        townId: town,
        listingId: s.listing,
        requestId: s.requestId,
        actorId: owner,
        actorRole: 'owner',
      });
      assert.deepEqual(await states(db), [{ state: 'closed' }]);
      assert.equal(
        (await reconcileLinkCarries(db, { townId: town })).restored,
        0
      );
      const t = await setup(db);
      const [{ carryId }] = await listOwnerLinkCarries(db, town, owner);
      await confirmLinkCarry(db, { townId: town, carryId, ownerId: owner });
      const target = await identity(db, scanB, 1);
      await revokeBusinessLink(db, {
        townId: town,
        listingId: target,
        requestId: t.requestId,
        actorId: owner,
        actorRole: 'owner',
      });
      assert.equal(await readBusinessLink(db, town, target), null);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_business_link_active'
          )
        )[0].n,
        0
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'two concurrent restores leave exactly one active link and one event',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const s = await setup(db);
      const [{ carryId }] = await listOwnerLinkCarries(db, town, owner);
      const results = await Promise.all(
        [1, 2, 3].map(() =>
          confirmLinkCarry(db, { townId: town, carryId, ownerId: owner })
        )
      );
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_business_link_active WHERE "requestId"=$1',
            [s.requestId]
          )
        )[0].n,
        1
      );
      assert.equal(
        (await actions(db, s.requestId)).filter((x) =>
          x.startsWith('carry_confirm')
        ).length,
        1
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a retired business never restores; a stale proposal is closed',
  { skip: !url },
  async () => {
    const db = await h.connect(url);
    try {
      const s = await setup(db);
      const [{ carryId }] = await listOwnerLinkCarries(db, town, owner);
      await db.query(
        `UPDATE directory_business SET state='retired' WHERE id=(SELECT "businessId" FROM directory_business_link_carry WHERE id=$1)`,
        [carryId]
      );
      assert.equal(
        await restoreLinkCarry(db, {
          townId: town,
          carryId,
          actor: SYSTEM_ACTOR,
          basis: 'corroborated',
        }),
        false
      );
      assert.deepEqual(await states(db), [{ state: 'closed' }]);
      assert.equal(await readBusinessLink(db, town, s.listing), null);
    } finally {
      await db.destroy();
    }
  }
);
