require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const {
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');
const {
  requestBusinessLink,
  reviewBusinessLink,
} = require('../src/listing-business-link');
const { runDirectoryDeletion } = require('../src/account-lifecycle');

// Disposable, loopback-only database named s5sup_scratch_*; everything runs in one rolled-back transaction.
const url = process.env.S5_SUPPRESSION_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s5sup_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S5_SUPPRESSION_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s5sup_scratch_* database required');
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hex = (c) => c.repeat(64);

// Everything a suppression must leave untouched: the source provenance of the listing.
const PROVENANCE = [
  'directory_overture_private_row',
  'directory_overture_private_completion',
  'directory_overture_private_membership',
  'directory_overture_private_policy',
  'directory_overture_private_revocation',
  'directory_overture_private_row_revocation',
  'directory_listing_identity',
];

test(
  'a reviewer suppression hides a listing from every public read, lifts cleanly and never touches provenance',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const r = db.createQueryRunner();
    await r.connect();
    await r.startTransaction();
    const town = id(5),
      localSecret = 's5sup-local-secret-01234567890123456789',
      linkSecret = 's5sup-link-secret-012345678901234567890',
      owner = id(80),
      reviewer = id(81),
      reviewer2 = id(83),
      page = id(82);
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
    const query = (sql, params) =>
      sql.includes('FROM directory_census_progress p')
        ? Promise.resolve([authority])
        : r.query(sql, params);
    const wrapper = { query, transaction: (fn) => fn(r.manager) };
    const listingOf = (name, address) => ({
      name,
      category: 'restaurant',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Example'],
      notices: [],
      termsUrls: [],
      assignmentChangeToken: town,
      reviewed: {
        address,
        attribution: ['Example'],
        notices: [],
        termsUrls: [],
        evidenceUrl: 'https://example.org/evidence',
      },
    });
    const digest = async () => {
      const out = {};
      for (const t of PROVENANCE)
        out[t] = (
          await r.query(
            `SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) AS h FROM ${t} x`
          )
        )[0];
      return out;
    };
    let server;
    try {
      await r.query(
        'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
        [hex('1')]
      );
      await r.query(
        'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
        [hex('a'), hex('1')]
      );
      await r.query(
        'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
        [hex('a')]
      );
      const rows = [
        { n: 1, name: 'Target Cafe', addr: '1 Target Way' },
        { n: 2, name: 'Control Bakery', addr: '2 Control Rd' },
      ];
      const candidate = id(900);
      for (const x of rows) {
        await r.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [hex('a'), x.n, town, JSON.stringify(listingOf(x.name, x.addr))]
        );
        await r.query(
          'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,$4)',
          [id(100 + x.n), town, hex('a'), x.n]
        );
        await r.query(
          `INSERT INTO directory_address_review_candidate (id,"communityId","scanId","sourceFileRowNumber",name,category,point,addresses,websites,phones,rights,risk,verdict,reasons,checks,"policyVersion",status)
           VALUES ($1,$2,$3,$4,$5,'restaurant','{}','[]','[]','[]','allowed','{}','approve','[]','[]','v','published')`,
          [id(300 + x.n), town, hex('a'), x.n, x.name]
        );
        await r.query(
          `INSERT INTO directory_reviewed_binding (id,"candidateId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","decisionId",state,"verifiedUntil")
           VALUES ($1,$2,$3,$4,$5,'source_file',$6,$6,$7,'active',now()+interval '1 day')`,
          [
            id(200 + x.n),
            id(300 + x.n),
            town,
            hex('a'),
            x.n,
            hex('d'),
            id(400 + x.n),
          ]
        );
        await r.query(
          `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId",point,"listingDigest","validatorVersion")
           SELECT $1::varchar,$2::bigint,$3::uuid,$4::uuid,ST_SetSRID(ST_MakePoint(-83,31),4326),md5(listing::text),1 FROM directory_overture_private_row WHERE "scanId"=$1::varchar AND "sourceFileRowNumber"=$2::bigint`,
          [hex('a'), x.n, id(200 + x.n), town]
        );
      }
      void candidate;
      await r.query(
        `INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion","rebuildCompletedAt") VALUES ('current',1,now())`
      );
      const link = (n, req) => ({
        townId: town,
        listingId: id(100 + n),
        businessCommunityId: page,
        ownerId: owner,
        requestId: req,
      });
      await requestBusinessLink(wrapper, link(1, id(501)));
      await reviewBusinessLink(wrapper, {
        ...link(1, id(501)),
        reviewerId: id(84),
        decision: 'approve',
        evidenceUrl: 'https://example.org/business',
      });

      const readChecks = pendingChecks(
        { query },
        source,
        identity,
        localSecret
      );
      const writeChecks = pendingChecks(wrapper, source, identity, localSecret);
      const checks = {
        ...readChecks,
        suppressionList: writeChecks.suppressionList,
        suppressionCreate: writeChecks.suppressionCreate,
        suppressionLift: writeChecks.suppressionLift,
      };
      server = pendingServer(
        checks,
        undefined,
        undefined,
        undefined,
        undefined,
        localSecret,
        linkSecret
      );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const L = `/internal/local-evaluation/towns/${town}`;
      const call = async (method, path, body, secret = localSecret) => {
        const res = await fetch(base + path, {
          method,
          headers: {
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        assert.equal(res.headers.get('cache-control'), 'no-store');
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
      };
      const names = async (q) =>
        (
          await call('GET', `${L}/listings?q=${encodeURIComponent(q)}`)
        ).json.listings.map((l) => l.name);
      const boundsNames = async () =>
        (
          await call(
            'GET',
            `${L}/listings?pagination=cursor&bounds=-84,30,-82,32`
          )
        ).json.listings.map((l) => l.name);

      const plain = await call('GET', `${L}/listings?pagination=cursor`);
      const reference = plain.json.listings.find(
        (l) => l.name === 'Target Cafe'
      ).reference;
      const surfaces = async () => ({
        search: await names('Target'),
        list: (await call('GET', `${L}/listings`)).json.listings.map(
          (l) => l.name
        ),
        bounds: (await boundsNames()).sort(),
        byId: (await call('GET', `${L}/listings/${id(101)}`)).status,
        byRef: (await call('GET', `${L}/listings/${reference}`)).status,
        link: (
          await call(
            'GET',
            `${L}/business-links/${id(101)}`,
            undefined,
            linkSecret
          )
        ).json.link,
        control: (await call('GET', `${L}/listings/${id(102)}`)).status,
        controlSearch: await names('Control'),
      });

      // Control: everything is visible, so the hidden state below is not vacuous.
      const before = await surfaces();
      assert.deepEqual(before.search, ['Target Cafe']);
      assert.ok(before.list.includes('Target Cafe'));
      assert.deepEqual(before.bounds.sort(), ['Control Bakery', 'Target Cafe']);
      assert.equal(before.byId, 200);
      assert.equal(before.byRef, 200);
      assert.ok(before.link, 'link is public before');
      const provenanceBefore = await digest();

      // Auth: reviewer routes are credentialed.
      assert.equal(
        (
          await call(
            'GET',
            `${L}/listing-suppressions`,
            undefined,
            'x'.repeat(40)
          )
        ).status,
        401
      );

      // Suppress (not a correction).
      const s1 = id(701);
      const body1 = {
        suppressionId: s1,
        listingId: id(101),
        reasonCode: 'rights-request',
        note: 'owner asked',
        actorId: reviewer,
      };
      const done = await call('POST', `${L}/listing-suppressions`, body1);
      assert.equal(done.status, 200);
      assert.equal(done.json.replayed, false);
      assert.equal(done.json.sentToReview, 0);
      const hidden = await surfaces();
      assert.deepEqual(hidden.search, []);
      assert.ok(!hidden.list.includes('Target Cafe'));
      assert.deepEqual(hidden.bounds, ['Control Bakery']);
      assert.equal(hidden.byId, 404);
      assert.equal(hidden.byRef, 404);
      assert.equal(hidden.link, null);
      // Only the named listing is affected.
      assert.equal(hidden.control, 200);
      assert.deepEqual(hidden.controlSearch, ['Control Bakery']);
      // Provenance is byte-identical, and the binding still stands (not a correction).
      assert.deepEqual(await digest(), provenanceBefore);
      assert.equal(
        (
          await r.query(
            `SELECT state FROM directory_reviewed_binding WHERE id=$1`,
            [id(201)]
          )
        )[0].state,
        'active'
      );

      // Idempotent replay; conflicting replay; a second open suppression of the same row; unknown listing.
      const replay = await call('POST', `${L}/listing-suppressions`, body1);
      assert.equal(replay.status, 200);
      assert.equal(replay.json.replayed, true);
      assert.equal(
        (
          await call('POST', `${L}/listing-suppressions`, {
            ...body1,
            reasonCode: 'safety',
          })
        ).status,
        409
      );
      assert.equal(
        (
          await call('POST', `${L}/listing-suppressions`, {
            ...body1,
            actorId: reviewer2,
          })
        ).status,
        409
      );
      assert.equal(
        (
          await call('POST', `${L}/listing-suppressions`, {
            ...body1,
            suppressionId: id(702),
          })
        ).status,
        409
      );
      assert.equal(
        (
          await call('POST', `${L}/listing-suppressions`, {
            ...body1,
            suppressionId: id(703),
            listingId: id(999),
          })
        ).status,
        404
      );
      assert.equal(
        (
          await r.query(
            'SELECT count(*)::int AS n FROM directory_listing_suppression'
          )
        )[0].n,
        1
      );

      // The reviewer list shows reason, actor, time and listing name, and only to the credentialed caller.
      const listed = await call('GET', `${L}/listing-suppressions`);
      assert.equal(listed.json.suppressions.length, 1);
      assert.deepEqual(
        {
          ...listed.json.suppressions[0],
          createdAt: typeof listed.json.suppressions[0].createdAt,
        },
        {
          suppressionId: s1,
          listingId: id(101),
          listingName: 'Target Cafe',
          reasonCode: 'rights-request',
          note: 'owner asked',
          actorId: reviewer,
          createdAt: 'string',
          liftedAt: null,
          liftReasonCode: null,
          liftedById: null,
        }
      );

      // Lift restores everything, as a new fact on the same row; replay and a different reason behave.
      const liftBody = {
        reasonCode: 'mistaken-suppression',
        actorId: reviewer2,
      };
      const lifted = await call(
        'POST',
        `${L}/listing-suppressions/${s1}/lift`,
        liftBody
      );
      assert.equal(lifted.status, 200);
      assert.equal(lifted.json.replayed, false);
      assert.equal(
        (await call('POST', `${L}/listing-suppressions/${s1}/lift`, liftBody))
          .json.replayed,
        true
      );
      assert.equal(
        (
          await call('POST', `${L}/listing-suppressions/${s1}/lift`, {
            ...liftBody,
            reasonCode: 'resolved',
          })
        ).status,
        409
      );
      assert.equal(
        (
          await call(
            'POST',
            `${L}/listing-suppressions/${id(799)}/lift`,
            liftBody
          )
        ).status,
        404
      );
      assert.deepEqual(await surfaces(), before);
      assert.deepEqual(await digest(), provenanceBefore);
      const history = (
        await r.query(
          'SELECT "liftedAt","liftReasonCode","liftedById" FROM directory_listing_suppression WHERE id=$1',
          [s1]
        )
      )[0];
      assert.ok(history.liftedAt);
      assert.equal(history.liftReasonCode, 'mistaken-suppression');
      assert.equal(history.liftedById, reviewer2);

      // A correction: suppress and send back to review; nothing is copied; a lift does not re-publish.
      const s2 = id(711);
      const fix = await call('POST', `${L}/listing-suppressions`, {
        suppressionId: s2,
        listingId: id(101),
        reasonCode: 'incorrect-details',
        actorId: reviewer,
      });
      assert.equal(fix.status, 200);
      assert.equal(fix.json.sentToReview, 1);
      assert.deepEqual((await surfaces()).search, []);
      const binding = (
        await r.query(
          'SELECT state,"stateCause","reviewedHash","stageContentHash" FROM directory_reviewed_binding WHERE id=$1',
          [id(201)]
        )
      )[0];
      assert.equal(binding.state, 'suspended');
      assert.equal(binding.stateCause, 'listing_correction');
      assert.equal(binding.reviewedHash, hex('d'));
      assert.equal(
        (
          await r.query(
            'SELECT status FROM directory_address_review_candidate WHERE id=$1',
            [id(301)]
          )
        )[0].status,
        'needs_human'
      );
      assert.equal(
        (
          await r.query(
            'SELECT count(*)::int AS n FROM directory_reviewed_spatial WHERE "bindingId"=$1',
            [id(201)]
          )
        )[0].n,
        0
      );
      assert.equal(
        (
          await r.query(
            `SELECT count(*)::int AS n FROM directory_reviewed_binding_event WHERE "bindingId"=$1 AND kind='suspended'`,
            [id(201)]
          )
        )[0].n,
        1
      );
      assert.deepEqual(await digest(), provenanceBefore);
      await call('POST', `${L}/listing-suppressions/${s2}/lift`, {
        reasonCode: 'resolved',
        actorId: reviewer,
      });
      // Lifted, but the suspended binding still hides the reviewed fields and the map point.
      const after = await surfaces();
      assert.deepEqual(after.search, ['Target Cafe']);
      assert.equal(after.byId, 200);
      assert.ok(!after.bounds.includes('Target Cafe'));
      const detail = await call('GET', `${L}/listings/${id(101)}`);
      assert.equal(detail.json.listing.reviewed, undefined);
      assert.ok(!JSON.stringify(detail.json).includes('1 Target Way'));
      assert.deepEqual(await digest(), provenanceBefore);

      // A row hidden by another fact stays hidden when its suppression lifts.
      await r.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,2)',
        [hex('a')]
      );
      const s3 = id(721);
      assert.equal(
        (
          await call('POST', `${L}/listing-suppressions`, {
            suppressionId: s3,
            listingId: id(102),
            reasonCode: 'duplicate',
            actorId: reviewer,
          })
        ).status,
        200
      );
      await call('POST', `${L}/listing-suppressions/${s3}/lift`, {
        reasonCode: 'other',
        actorId: reviewer,
      });
      assert.equal((await call('GET', `${L}/listings/${id(102)}`)).status, 404);
      await r.query(
        'DELETE FROM directory_overture_private_row_revocation WHERE "scanId"=$1 AND "sourceFileRowNumber"=2',
        [hex('a')]
      );

      // Public bodies never carry reviewer data.
      const publicBody = JSON.stringify(
        (await call('GET', `${L}/listings`)).json
      );
      for (const secretValue of [
        reviewer,
        reviewer2,
        'owner asked',
        'rights-request',
      ])
        assert.ok(!publicBody.includes(secretValue), `${secretValue} leaked`);

      // Account deletion scrubs the actor and the note, and keeps the audit fact.
      await runDirectoryDeletion(
        { transaction: (fn) => fn(r.manager) },
        {
          operationId: id(990),
          accountId: id(991),
          profileIds: [reviewer],
          legacyProfileIds: [],
        },
        'erase'
      );
      const scrubbed = await r.query(
        'SELECT id,"actorId","liftedById",note,"reasonCode" FROM directory_listing_suppression ORDER BY id'
      );
      assert.equal(scrubbed.length, 3);
      for (const row of scrubbed) {
        assert.equal(row.actorId, null);
        assert.equal(row.note, null);
        assert.ok(row.reasonCode);
      }
      // reviewer2 lifted s1 and is not the deleted profile.
      assert.equal(scrubbed.find((x) => x.id === s1).liftedById, reviewer2);
      assert.equal(scrubbed.find((x) => x.id === s2).liftedById, null);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await r.rollbackTransaction();
      await r.release();
      await db.destroy();
    }
  }
);

test(
  'a suppression follows the business into a later scan',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const r = db.createQueryRunner();
    await r.connect();
    await r.startTransaction();
    const town = id(5),
      localSecret = 's5sup-local-secret-01234567890123456789',
      business = id(600);
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
    const query = (sql, params) =>
      sql.includes('FROM directory_census_progress p')
        ? Promise.resolve([authority])
        : r.query(sql, params);
    let server;
    try {
      for (const [scan, policy, row] of [
        [hex('a'), hex('1'), 1],
        [hex('b'), hex('2'), 1],
      ]) {
        await r.query(
          'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
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
        await r.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [
            scan,
            row,
            town,
            JSON.stringify({
              name: 'Carried Diner',
              category: 'restaurant',
              location: { type: 'Point', coordinates: [-83, 31] },
              attribution: ['Example'],
              notices: [],
              termsUrls: [],
              assignmentChangeToken: town,
            }),
          ]
        );
      }
      await r.query(
        'INSERT INTO directory_business (id,"communityId") VALUES ($1,$2)',
        [business, town]
      );
      // Only the first cohort asserts the business for now.
      await r.query(
        `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,state) VALUES ($1,$2,$3,1,$4,'origin','origin','current')`,
        [business, town, hex('a'), hex('1')]
      );
      await r.query(
        'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,1)',
        [id(101), town, hex('a')]
      );
      const checks = pendingChecks(
        { query, transaction: (fn) => fn(r.manager) },
        source,
        identity,
        localSecret
      );
      server = pendingServer(
        checks,
        undefined,
        undefined,
        undefined,
        undefined,
        localSecret
      );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${
        server.address().port
      }/internal/local-evaluation/towns/${town}`;
      const call = async (method, path, body) => {
        const res = await fetch(base + path, {
          method,
          headers: {
            authorization: `Bearer ${localSecret}`,
            'content-type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
      };
      // Suppress by the business id the public listing carries.
      const done = await call('POST', '/listing-suppressions', {
        suppressionId: id(701),
        listingId: business,
        reasonCode: 'closed-business',
        actorId: id(81),
      });
      assert.equal(done.status, 200);
      assert.equal(
        (
          await r.query(
            'SELECT "businessId","scanId" FROM directory_listing_suppression'
          )
        )[0].businessId,
        business
      );
      // A later cohort now asserts the same business on a different row; it must not bring the listing back.
      await r.query(
        `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,state) VALUES ($1,$2,$3,1,$4,'origin','carried','current')`,
        [business, town, hex('b'), hex('2')]
      );
      const shown = (await call('GET', '/listings')).json.listings.map(
        (l) => l.name
      );
      assert.deepEqual(
        shown,
        [],
        'neither row of the suppressed business is served'
      );
      // Lift: the business is visible again.
      await call('POST', `/listing-suppressions/${id(701)}/lift`, {
        reasonCode: 'resolved',
        actorId: id(81),
      });
      assert.ok((await call('GET', '/listings')).json.listings.length >= 1);
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await r.rollbackTransaction();
      await r.release();
      await db.destroy();
    }
  }
);
