const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const {
  requestBusinessLink,
  reviewBusinessLink,
  revokeBusinessLink,
  readBusinessLink,
} = require('../src/listing-business-link');
const {
  DirectoryDeletionBlockedError,
  executeDirectoryAccountDeletion,
  runDirectoryDeletion,
} = require('../src/account-lifecycle');
const {
  validateDeletionGrantShape,
} = require('../../../libs/models/src/lib/libs/account-deletion/account-deletion.contract');
const url = process.env.S5_LIFECYCLE_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s5_identity_[0-9]+$/.test(u.pathname) ||
    process.env.S5_LIFECYCLE_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable test database required');
}

// Deletion commits, so every run uses fresh identifiers and removes its rows afterwards.
test(
  'Directory erases exact-domain identity, blocks ambiguity, and fences writes',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const tx = {
      transaction: (fn) => db.transaction(fn),
      query: (...x) => db.query(...x),
    };
    const ids = Object.fromEntries(
      [
        'town',
        'l1',
        'l2',
        'l3',
        'l4',
        'page',
        'owner',
        'ownerProfile',
        'other',
        'otherProfile',
        'blocked',
        'blockedProfile',
        'legacy',
        'r1',
        'r2',
        'rOther',
        'rBlocked',
        'rLate',
        'bMine',
        'bOther',
        'bLegacy',
        'cMine',
        'cOther',
        'cAuto',
      ].map((k) => [k, randomUUID()])
    );
    const operations = [randomUUID(), randomUUID(), randomUUID()];
    const boundary = (requestId, reviewerId) =>
      db.query(
        `INSERT INTO directory_boundary_decision ("requestId","communityId","reviewerId",decision,"sourceUrl","sourceEpoch","activationId","socialGeneration","recoveryEpoch","directoryGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,'approve','https://example.org/boundary',$4,$4,1,$4,1,$4,'1304000','place','2024','13',$5,$5)`,
        [requestId, ids.town, reviewerId, randomUUID(), 'b'.repeat(64)]
      );
    const addressDecision = (candidateId, actorKind, actorId) =>
      db.query(
        `INSERT INTO directory_address_review_decision ("candidateId","actorKind","actorId",decision,"evidenceUrl","evidenceHash",reason,checks,"policyVersion") VALUES ($1,$2,$3,'approve','https://example.org/evidence',$4,'reviewer note','{"storefront":true}','test-v1')`,
        [candidateId, actorKind, actorId, 'c'.repeat(64)]
      );
    const request = (listingId, ownerId, requestId) => ({
      townId: ids.town,
      listingId,
      businessCommunityId: ids.page,
      ownerId,
      requestId,
    });
    const one = async (sql, params) => (await db.query(sql, params))[0];
    const events = (requestId) =>
      db.query(
        'SELECT action,"actorId","actorDomain","evidenceUrl" FROM directory_business_link_event WHERE "requestId"=$1 ORDER BY "createdAt",action',
        [requestId]
      );
    const authority = (profiles, legacy = []) => ({
      validate: async (value) => ({
        accountId: value.accountId,
        scope: { currentProfileIds: profiles, legacyProfileIds: legacy },
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
    // Every grant field is checked by the shared contract.
    const run = (action, operationId, accountId, profiles, legacy) =>
      executeDirectoryAccountDeletion(
        { db: tx, authority: authority(profiles, legacy) },
        grant(action, operationId, accountId),
        action
      );
    try {
      for (const l of [ids.l1, ids.l2, ids.l3, ids.l4])
        await db.query(
          'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',
          [l, ids.town, randomUUID().replace(/-/g, '').repeat(2)]
        );
      // The departing owner has an approved link and a pending claim, and reviews as a profile.
      await requestBusinessLink(tx, request(ids.l1, ids.owner, ids.r1));
      await reviewBusinessLink(tx, {
        ...request(ids.l1, ids.owner, ids.r1),
        reviewerId: ids.otherProfile,
        decision: 'approve',
        evidenceUrl: 'https://example.org/owner-proof',
      });
      await requestBusinessLink(tx, request(ids.l2, ids.owner, ids.r2));
      await requestBusinessLink(tx, request(ids.l3, ids.other, ids.rOther));
      await reviewBusinessLink(tx, {
        ...request(ids.l3, ids.other, ids.rOther),
        reviewerId: ids.ownerProfile,
        decision: 'approve',
        evidenceUrl: 'https://example.org/other-proof',
      });
      await boundary(ids.bMine, ids.ownerProfile);
      await boundary(ids.bOther, ids.otherProfile);
      await addressDecision(ids.cMine, 'human', ids.ownerProfile);
      await addressDecision(ids.cOther, 'human', ids.otherProfile);
      await addressDecision(ids.cAuto, 'auto', null);
      const untouched = async () => ({
        request: await one(
          'SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=$1',
          [ids.rOther]
        ),
        link: await readBusinessLink(tx, ids.town, ids.l3),
        boundary: await one(
          'SELECT "reviewerId","sourceUrl" FROM directory_boundary_decision WHERE "requestId"=$1',
          [ids.bOther]
        ),
        address: await one(
          'SELECT "actorId",reason,checks FROM directory_address_review_decision WHERE "candidateId"=$1',
          [ids.cOther]
        ),
        auto: await one(
          'SELECT "actorId",reason,checks FROM directory_address_review_decision WHERE "candidateId"=$1',
          [ids.cAuto]
        ),
      });
      const before = await untouched();
      assert.deepEqual(before.link, {
        businessCommunityId: ids.page,
        ownerId: ids.other,
      });

      // Fence: counts what erase will handle, changes no rows, and stops writes at once.
      assert.deepEqual(
        await run('fence', operations[0], ids.owner, [ids.ownerProfile]),
        { verified: true, remaining: 7, blocked: 0 }
      );
      assert.deepEqual(
        await one(
          'SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=$1',
          [ids.r1]
        ),
        { ownerId: ids.owner, status: 'approved' }
      );
      await assert.rejects(
        requestBusinessLink(tx, request(ids.l4, ids.owner, ids.rLate)),
        /ACCOUNT_DELETION_FENCED/
      );
      await assert.rejects(
        reviewBusinessLink(tx, {
          ...request(ids.l2, ids.owner, ids.r2),
          reviewerId: ids.otherProfile,
          decision: 'approve',
          evidenceUrl: 'https://example.org/late',
        }),
        /ACCOUNT_DELETION_FENCED/
      );
      await assert.rejects(
        revokeBusinessLink(tx, {
          townId: ids.town,
          listingId: ids.l1,
          requestId: ids.r1,
          actorId: ids.owner,
          actorRole: 'owner',
        }),
        /ACCOUNT_DELETION_FENCED/
      );
      await assert.rejects(
        revokeBusinessLink(tx, {
          townId: ids.town,
          listingId: ids.l1,
          requestId: ids.r1,
          actorId: ids.otherProfile,
          actorRole: 'reviewer',
        }),
        /ACCOUNT_DELETION_FENCED/
      );
      await assert.rejects(
        reviewBusinessLink(tx, {
          ...request(ids.l3, ids.other, ids.rOther),
          reviewerId: ids.ownerProfile,
          decision: 'reject',
          evidenceUrl: 'https://example.org/late',
        }),
        /ACCOUNT_DELETION_FENCED/
      );
      assert.equal(
        (
          await one(
            'SELECT count(*)::int AS n FROM directory_business_link_request WHERE "requestId"=$1',
            [ids.rLate]
          )
        ).n,
        0
      );
      assert.deepEqual(
        await one(
          'SELECT status FROM directory_business_link_request WHERE "requestId"=$1',
          [ids.r2]
        ),
        { status: 'pending' }
      );
      // A second operation cannot take over an installed fence.
      await assert.rejects(
        run('fence', operations[1], ids.owner, [ids.ownerProfile])
      );

      assert.deepEqual(
        await run('erase', operations[0], ids.owner, [ids.ownerProfile]),
        { verified: true, remaining: 0, blocked: 0 }
      );
      assert.deepEqual(
        await db.query(
          'SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=ANY($1::uuid[]) ORDER BY status',
          [[ids.r1, ids.r2]]
        ),
        [
          { ownerId: null, status: 'revoked' },
          { ownerId: null, status: 'revoked' },
        ]
      );
      assert.equal(await readBusinessLink(tx, ids.town, ids.l1), null);
      assert.equal(
        (
          await one(
            'SELECT count(*)::int AS n FROM directory_business_link_active WHERE "requestId"=ANY($1::uuid[])',
            [[ids.r1, ids.r2]]
          )
        ).n,
        0
      );
      const mine = await events(ids.r1);
      assert.deepEqual(mine.map((e) => e.action).sort(), [
        'approve',
        'request',
        'revoke',
      ]);
      assert.deepEqual(
        mine.find((e) => e.action === 'request'),
        {
          action: 'request',
          actorId: null,
          actorDomain: 'account',
          evidenceUrl: null,
        }
      );
      // The other reviewer's decision on the erased owner's claim keeps its actor and loses the owner's evidence.
      assert.deepEqual(
        mine.find((e) => e.action === 'approve'),
        {
          action: 'approve',
          actorId: ids.otherProfile,
          actorDomain: 'profile',
          evidenceUrl: null,
        }
      );
      assert.deepEqual(
        mine.find((e) => e.action === 'revoke'),
        {
          action: 'revoke',
          actorId: null,
          actorDomain: 'system',
          evidenceUrl: null,
        }
      );
      // Reviewer-profile erase: the decision stays, the reviewer does not.
      assert.deepEqual(
        (await events(ids.rOther)).find((e) => e.action === 'approve'),
        {
          action: 'approve',
          actorId: null,
          actorDomain: 'profile',
          evidenceUrl: 'https://example.org/other-proof',
        }
      );
      assert.deepEqual(
        await one(
          'SELECT "reviewerId","sourceUrl",decision FROM directory_boundary_decision WHERE "requestId"=$1',
          [ids.bMine]
        ),
        {
          reviewerId: null,
          sourceUrl: 'https://example.org/boundary',
          decision: 'approve',
        }
      );
      assert.deepEqual(
        await one(
          'SELECT "actorId",reason,checks,"evidenceUrl",decision FROM directory_address_review_decision WHERE "candidateId"=$1',
          [ids.cMine]
        ),
        {
          actorId: null,
          reason: null,
          checks: {},
          evidenceUrl: 'https://example.org/evidence',
          decision: 'approve',
        }
      );
      assert.deepEqual(await untouched(), before);
      assert.deepEqual(before.address, {
        actorId: ids.otherProfile,
        reason: 'reviewer note',
        checks: { storefront: true },
      });

      // Idempotent: a repeated erase and a readback find nothing and append nothing.
      const eventCount = async () =>
        (
          await one(
            'SELECT count(*)::int AS n FROM directory_business_link_event WHERE "requestId"=ANY($1::uuid[])',
            [[ids.r1, ids.r2, ids.rOther]]
          )
        ).n;
      const settled = await eventCount();
      assert.deepEqual(
        await run('erase', operations[0], ids.owner, [ids.ownerProfile]),
        { verified: true, remaining: 0, blocked: 0 }
      );
      assert.deepEqual(
        await run('readback', operations[0], ids.owner, [ids.ownerProfile]),
        { verified: true, remaining: 0, blocked: 0 }
      );
      assert.equal(await eventCount(), settled);
      assert.deepEqual(await untouched(), before);
      // The fence outlives the erase, so a retried write cannot bring the identity back.
      await assert.rejects(
        requestBusinessLink(tx, request(ids.l4, ids.owner, ids.rLate)),
        /ACCOUNT_DELETION_FENCED/
      );

      // Ambiguity: a legacy event with no recorded domain, and a UUID-shaped legacy key used as a reviewer.
      await requestBusinessLink(tx, request(ids.l4, ids.blocked, ids.rBlocked));
      await db.query(
        'UPDATE directory_business_link_event SET "actorDomain"=NULL WHERE "requestId"=$1',
        [ids.rBlocked]
      );
      await boundary(ids.bLegacy, ids.legacy);
      const scope = [
        ids.blocked,
        [ids.blockedProfile],
        [ids.legacy, 'legacy-key-that-is-not-a-uuid'],
      ];
      assert.deepEqual(await run('fence', operations[2], ...scope), {
        verified: true,
        remaining: 1,
        blocked: 2,
      });
      await assert.rejects(
        run('erase', operations[2], ...scope),
        (error) =>
          error instanceof DirectoryDeletionBlockedError &&
          error.report.remaining === 1 &&
          error.report.blocked === 2
      );
      assert.deepEqual(
        await one(
          'SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=$1',
          [ids.rBlocked]
        ),
        { ownerId: ids.blocked, status: 'pending' }
      );
      assert.deepEqual(await run('readback', operations[2], ...scope), {
        verified: false,
        remaining: 1,
        blocked: 2,
      });
      await assert.rejects(
        requestBusinessLink(tx, request(ids.l4, ids.blocked, randomUUID())),
        /ACCOUNT_DELETION_FENCED/
      );
      // Once an operator records the domain and removes the stray reference, the same operation completes.
      await db.query(
        `UPDATE directory_business_link_event SET "actorDomain"='account' WHERE "requestId"=$1`,
        [ids.rBlocked]
      );
      await db.query(
        'UPDATE directory_boundary_decision SET "reviewerId"=NULL WHERE "requestId"=$1',
        [ids.bLegacy]
      );
      assert.deepEqual(await run('erase', operations[2], ...scope), {
        verified: true,
        remaining: 0,
        blocked: 0,
      });
      assert.deepEqual(
        await one(
          'SELECT "ownerId",status FROM directory_business_link_request WHERE "requestId"=$1',
          [ids.rBlocked]
        ),
        { ownerId: null, status: 'revoked' }
      );
      assert.deepEqual(await untouched(), before);

      // A write that began before the fence either commits first or is refused; the fence waits for it.
      const racer = randomUUID(),
        racerRequest = randomUUID(),
        racerOperation = randomUUID();
      operations.push(racerOperation);
      ids.racerRequest = racerRequest;
      const [written, fenced] = await Promise.allSettled([
        requestBusinessLink(tx, request(ids.l4, racer, racerRequest)),
        runDirectoryDeletion(
          tx,
          {
            operationId: racerOperation,
            accountId: racer,
            profileIds: [],
            legacyProfileIds: [],
          },
          'fence'
        ),
      ]);
      assert.equal(fenced.status, 'fulfilled');
      const left = await runDirectoryDeletion(
        tx,
        {
          operationId: racerOperation,
          accountId: racer,
          profileIds: [],
          legacyProfileIds: [],
        },
        'erase'
      );
      assert.deepEqual(left, { remaining: 0, blocked: 0 });
      assert.equal(
        (
          await one(
            'SELECT count(*)::int AS n FROM directory_business_link_request WHERE "ownerId"=$1',
            [racer]
          )
        ).n,
        0
      );
      if (written.status === 'rejected')
        assert.match(String(written.reason), /ACCOUNT_DELETION_FENCED/);
    } finally {
      const requests = [
        ids.r1,
        ids.r2,
        ids.rOther,
        ids.rBlocked,
        ids.rLate,
        ids.racerRequest,
      ].filter(Boolean);
      await db.query(
        'DELETE FROM directory_business_link_active WHERE "requestId"=ANY($1::uuid[])',
        [requests]
      );
      await db.query(
        'DELETE FROM directory_business_link_event WHERE "requestId" IN (SELECT "requestId" FROM directory_business_link_request WHERE "townId"=$1)',
        [ids.town]
      );
      await db.query(
        'DELETE FROM directory_business_link_request WHERE "townId"=$1',
        [ids.town]
      );
      await db.query(
        'DELETE FROM directory_boundary_decision WHERE "communityId"=$1',
        [ids.town]
      );
      await db.query(
        'DELETE FROM directory_address_review_decision WHERE "candidateId"=ANY($1::uuid[])',
        [[ids.cMine, ids.cOther, ids.cAuto]]
      );
      await db.query(
        'DELETE FROM directory_listing_identity WHERE "communityId"=$1',
        [ids.town]
      );
      await db.query(
        'DELETE FROM account_deletion_write_fence WHERE "operationId"=ANY($1::uuid[])',
        [operations]
      );
      await db.destroy();
    }
  }
);

test(
  'blocked-row report is read-only, counts only, and agrees with the readback',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const ids = Object.fromEntries(
      [
        'town',
        'l1',
        'page',
        'account',
        'profile',
        'legacy',
        'op',
        'rOwn',
        'rNull',
        'bLegacy',
        'cAcct',
        'cOk',
      ].map((k) => [k, randomUUID()])
    );
    const script = path.resolve(
      __dirname,
      '../../../scripts/local-directory-account-lifecycle-blocked.cjs'
    );
    const report = (...args) =>
      spawnSync('node', [script, ...args], {
        encoding: 'utf8',
        env: { ...process.env, DIRECTORY_REVIEW_DATABASE_URL: url },
      });
    const fences = async () =>
      (
        await db.query(
          'SELECT count(*)::int AS n FROM account_deletion_write_fence'
        )
      )[0].n;
    const tx = {
      transaction: (fn) => db.transaction(fn),
      query: (...x) => db.query(...x),
    };
    try {
      await db.query(
        'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',
        [ids.l1, ids.town, 'd'.repeat(64)]
      );
      const link = (requestId, ownerId) =>
        db.query(
          'INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId","ownerId",status) VALUES ($1,$2,$3,$4,$5,\'pending\')',
          [requestId, ids.town, ids.l1, ids.page, ownerId]
        );
      await link(ids.rOwn, ids.account);
      await db.query(
        'INSERT INTO directory_business_link_event ("requestId","actorId",action,"actorDomain") VALUES ($1,$2,\'request\',NULL)',
        [ids.rOwn, ids.account]
      );
      await db.query(
        `INSERT INTO directory_boundary_decision ("requestId","communityId","reviewerId",decision,"sourceUrl","sourceEpoch","activationId","socialGeneration","recoveryEpoch","directoryGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,'approve','https://example.org/boundary',$4,$4,1,$4,1,$4,'1304000','place','2024','13',$5,$5)`,
        [ids.bLegacy, ids.town, ids.legacy, randomUUID(), 'b'.repeat(64)]
      );
      const decision = (candidateId, actorId) =>
        db.query(
          `INSERT INTO directory_address_review_decision ("candidateId","actorKind","actorId",decision,"evidenceUrl","evidenceHash",reason,checks,"policyVersion") VALUES ($1,'human',$2,'approve','https://example.org/evidence',$3,'note','{}','test-v1')`,
          [candidateId, actorId, 'c'.repeat(64)]
        );
      await decision(ids.cAcct, ids.account);
      await decision(ids.cOk, ids.profile);
      const before = await fences();
      const out = report(
        '--account',
        ids.account,
        '--profile',
        ids.profile,
        '--legacy',
        ids.legacy,
        '--legacy',
        'not-a-uuid'
      );
      assert.equal(out.status, 0, out.stderr);
      const result = JSON.parse(out.stdout);
      const by = (table) => result.tables.find((t) => t.table === table);
      assert.deepEqual(by('directory_business_link_request'), {
        table: 'directory_business_link_request',
        column: 'ownerId',
        erasable: 1,
        blocking: [],
        blockingTotal: 0,
      });
      assert.deepEqual(by('directory_business_link_event').blocking, [
        { matchedAs: 'account', rowDomain: 'unset', count: 1 },
      ]);
      assert.deepEqual(by('directory_boundary_decision').blocking, [
        { matchedAs: 'legacy', rowDomain: 'n/a', count: 1 },
      ]);
      assert.deepEqual(by('directory_address_review_decision').blocking, [
        { matchedAs: 'account', rowDomain: 'n/a', count: 1 },
      ]);
      assert.equal(by('directory_address_review_decision').erasable, 1);
      // Counts only: no scope identifier, no row text, no connection details.
      for (const needle of [
        ids.account,
        ids.profile,
        ids.legacy,
        'example.org',
        'note',
        new URL(url).password,
      ].filter(Boolean))
        assert.ok(!out.stdout.includes(needle) && !out.stderr.includes(needle));
      // Same rules as the erase path: its readback sees the same totals. Readback installs a fence, so it runs after the report.
      assert.equal(await fences(), before, 'the report installed a fence');
      const readback = await runDirectoryDeletion(
        tx,
        {
          operationId: ids.op,
          accountId: ids.account,
          profileIds: [ids.profile],
          legacyProfileIds: [ids.legacy],
        },
        'readback'
      );
      assert.deepEqual(
        { remaining: result.remaining, blocked: result.blocked },
        readback
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM directory_business_link_request WHERE "ownerId"=$1',
            [ids.account]
          )
        )[0].n,
        1
      );
      // Bad input and a missing database are refused without echoing the value.
      const bad = report('--account', 'not-a-uuid');
      assert.equal(bad.status, 1);
      assert.equal(
        spawnSync('node', [script, '--account', ids.account], {
          encoding: 'utf8',
          env: { ...process.env, DIRECTORY_REVIEW_DATABASE_URL: '' },
        }).status,
        1
      );
    } finally {
      await db.query(
        'DELETE FROM directory_business_link_event WHERE "requestId"=$1',
        [ids.rOwn]
      );
      await db.query(
        'DELETE FROM directory_business_link_request WHERE "townId"=$1',
        [ids.town]
      );
      await db.query(
        'DELETE FROM directory_boundary_decision WHERE "communityId"=$1',
        [ids.town]
      );
      await db.query(
        'DELETE FROM directory_address_review_decision WHERE "candidateId"=ANY($1::uuid[])',
        [[ids.cAcct, ids.cOk]]
      );
      await db.query(
        'DELETE FROM directory_listing_identity WHERE "communityId"=$1',
        [ids.town]
      );
      await db.query(
        'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
        [ids.op]
      );
      await db.destroy();
    }
  }
);

test(
  'reviewed bindings survive reviewer erasure and unfenced sweeps proceed during a fence',
  { skip: !url },
  async () => {
    const { revalidateBinding } = require('../src/reviewed-binding-revalidate');
    const {
      stageContentHash,
      reviewedHash,
    } = require('../src/reviewed-binding');
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const tx = {
      transaction: (fn) => db.transaction(fn),
      query: (...x) => db.query(...x),
    };
    const key = 'lifecycle-binding-test-key-0123456789abcdef';
    const hex = () => randomUUID().replace(/-/g, '').repeat(2);
    const ids = Object.fromEntries(
      ['town', 'candidate', 'account', 'profile'].map((k) => [k, randomUUID()])
    );
    const operation = randomUUID(),
      liveScan = hex(),
      stageScan = hex(),
      policy = hex();
    const authority = {
      validate: async (value) => ({
        accountId: value.accountId,
        scope: { currentProfileIds: [ids.profile], legacyProfileIds: [] },
      }),
    };
    const grant = (action) => ({
      contractVersion: 1,
      operationId: operation,
      accountId: ids.account,
      appId: 'local-hub',
      owner: 'directory',
      action,
      attempt: 1,
      leaseOwner: randomUUID(),
      expiresAt: '2026-11-16T00:00:00.000Z',
      signature: 'a'.repeat(64),
    });
    const run = (action) =>
      executeDirectoryAccountDeletion(
        { db: tx, authority },
        grant(action),
        action
      );
    const listing = {
      name: 'Lifecycle Cafe',
      category: 'cafe',
      location: { type: 'Point', coordinates: [-83, 31] },
      addresses: [{ freeform: '1 Main St' }],
      websites: [],
      phones: [],
      sources: [],
    };
    const reviewed = {
      address: '1 Main St',
      attribution: [],
      notices: [],
      termsUrls: [],
    };
    try {
      await db.query(
        'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
        [policy]
      );
      for (const scan of [liveScan, stageScan]) {
        await db.query(
          'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
          [scan]
        );
        await db.query(
          'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
          [scan, policy]
        );
        await db.query(
          'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
          [scan]
        );
      }
      await db.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)',
        [stageScan, ids.town, JSON.stringify(listing)]
      );
      await db.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)',
        [liveScan, ids.town, JSON.stringify({ ...listing, reviewed })]
      );
      await db.query(
        `INSERT INTO directory_address_review_candidate (id,"communityId","scanId","sourceFileRowNumber",name,category,point,addresses,websites,phones,rights,risk,verdict,reasons,checks,"policyVersion",status) VALUES ($1,$2,$3,1,'Lifecycle Cafe','cafe','{}','[]','[]','[]','eligible','{}','auto_approve','[]','{}','v1','published')`,
        [ids.candidate, ids.town, liveScan]
      );
      const [decision] = await db.query(
        `INSERT INTO directory_address_review_decision ("candidateId","actorKind","actorId",decision,"evidenceUrl",checks,"policyVersion") VALUES ($1,'human',$2,'approve','https://example.org/e','{}','v1') RETURNING id`,
        [ids.candidate, ids.profile]
      );
      const [binding] = await db.query(
        `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageInstallationId","stageScanId","stageSourceFileRowNumber","stagePolicyId","stageContentHash","reviewedHash",state,"stateCause") VALUES ($1,$2,$3,$4,1,'contact_stage','stage-a',$5,1,$6,$7,$8,'pending','published') RETURNING id`,
        [
          ids.candidate,
          decision.id,
          ids.town,
          liveScan,
          stageScan,
          policy,
          stageContentHash(key, listing),
          reviewedHash(key, reviewed),
        ]
      );

      // The reviewer's account is fenced. The sweep names no identity, so it is neither blocked nor blocking.
      await run('fence');
      const swept = await revalidateBinding(db, db, key, binding.id, {
        apply: true,
        stageInstallationId: 'stage-a',
      });
      assert.equal(swept.outcome, 'confirmed');

      // Erasing the reviewer clears the decision's actor; the binding and its link to the decision stay.
      assert.deepEqual(await run('erase'), {
        verified: true,
        remaining: 0,
        blocked: 0,
      });
      assert.deepEqual(
        await db.query(
          'SELECT "actorId" FROM directory_address_review_decision WHERE id=$1',
          [decision.id]
        ),
        [{ actorId: null }]
      );
      assert.deepEqual(
        await db.query(
          'SELECT state,"decisionId" FROM directory_reviewed_binding WHERE id=$1',
          [binding.id]
        ),
        [{ state: 'active', decisionId: decision.id }]
      );
      const again = await revalidateBinding(db, db, key, binding.id, {
        apply: true,
        stageInstallationId: 'stage-a',
      });
      assert.equal(again.outcome, 'extended');
    } finally {
      await db.query(
        'DELETE FROM directory_reviewed_binding_event WHERE "bindingId" IN (SELECT id FROM directory_reviewed_binding WHERE "candidateId"=$1)',
        [ids.candidate]
      );
      await db.query(
        'DELETE FROM directory_reviewed_binding WHERE "candidateId"=$1',
        [ids.candidate]
      );
      await db.query(
        'DELETE FROM directory_address_review_decision WHERE "candidateId"=$1',
        [ids.candidate]
      );
      await db.query(
        'DELETE FROM directory_address_review_candidate WHERE id=$1',
        [ids.candidate]
      );
      await db.query(
        'DELETE FROM directory_overture_private_row WHERE "scanId"=ANY($1)',
        [[liveScan, stageScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_membership WHERE "scanId"=ANY($1)',
        [[liveScan, stageScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_completion WHERE "scanId"=ANY($1)',
        [[liveScan, stageScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_scan_lock WHERE "scanId"=ANY($1)',
        [[liveScan, stageScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_policy WHERE "policyId"=$1',
        [policy]
      );
      await db.query(
        'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
        [operation]
      );
      await db.destroy();
    }
  }
);

test(
  'erasing an owner closes a waiting link carry, and erasing a reviewer keeps the identity decision without them',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const tx = {
      transaction: (fn) => db.transaction(fn),
      query: (...x) => db.query(...x),
    };
    const ids = Object.fromEntries(
      [
        'town',
        'from',
        'to',
        'page',
        'owner',
        'reviewer',
        'request',
        'business',
        'decision',
        'operationA',
        'operationB',
      ].map((k) => [k, randomUUID()])
    );
    const run = (action, operationId, accountId, profiles) =>
      executeDirectoryAccountDeletion(
        {
          db: tx,
          authority: {
            validate: async (value) => ({
              accountId: value.accountId,
              scope: { currentProfileIds: profiles, legacyProfileIds: [] },
            }),
          },
        },
        {
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
        },
        action
      );
    try {
      await db.query(
        'INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId","ownerId","businessId",status) VALUES ($1,$2,$3,$4,$5,$6,\'approved\')',
        [ids.request, ids.town, ids.from, ids.page, ids.owner, ids.business]
      );
      await db.query(
        'INSERT INTO directory_business_link_carry ("requestId","businessId","fromListingId","toListingId") VALUES ($1,$2,$3,$4)',
        [ids.request, ids.business, ids.from, ids.to]
      );
      await db.query(
        `INSERT INTO directory_business_identity_decision (id,"communityId",action,"businessId","actorId","actorDomain",reason) VALUES ($1,$2,'retire',$3,$4,'profile','looked wrong to Pat')`,
        [ids.decision, ids.town, ids.business, ids.reviewer]
      );
      assert.deepEqual(
        await run('erase', ids.operationA, randomUUID(), [ids.reviewer]),
        { verified: true, remaining: 0, blocked: 0 }
      );
      assert.deepEqual(
        await db.query(
          'SELECT "actorId","actorDomain",reason,action FROM directory_business_identity_decision WHERE id=$1',
          [ids.decision]
        ),
        [
          {
            actorId: null,
            actorDomain: 'profile',
            reason: '',
            action: 'retire',
          },
        ]
      );
      assert.deepEqual(
        await db.query(
          'SELECT state FROM directory_business_link_carry WHERE "requestId"=$1',
          [ids.request]
        ),
        [{ state: 'awaiting_confirmation' }],
        'another account does not touch it'
      );
      const account = ids.owner;
      assert.deepEqual(await run('erase', ids.operationB, account, []), {
        verified: true,
        remaining: 0,
        blocked: 0,
      });
      assert.deepEqual(
        await db.query(
          'SELECT state FROM directory_business_link_carry WHERE "requestId"=$1',
          [ids.request]
        ),
        [{ state: 'closed' }]
      );
      assert.deepEqual(
        await db.query(
          'SELECT status,"ownerId" FROM directory_business_link_request WHERE "requestId"=$1',
          [ids.request]
        ),
        [{ status: 'revoked', ownerId: null }]
      );
    } finally {
      await db.query(
        'DELETE FROM directory_business_link_carry WHERE "requestId"=$1',
        [ids.request]
      );
      await db.query(
        'DELETE FROM directory_business_link_event WHERE "requestId"=$1',
        [ids.request]
      );
      await db.query(
        'DELETE FROM directory_business_link_request WHERE "requestId"=$1',
        [ids.request]
      );
      await db.query(
        'DELETE FROM directory_business_identity_decision WHERE id=$1',
        [ids.decision]
      );
      await db.query(
        'DELETE FROM account_deletion_write_fence WHERE "operationId"=ANY($1::uuid[])',
        [[ids.operationA, ids.operationB]]
      );
      await db.destroy();
    }
  }
);
