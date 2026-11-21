require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { createHash, createHmac } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');
const { runDirectoryDeletion } = require('../src/account-lifecycle');
const {
  purgeReportContacts,
  contactKeyFrom,
} = require('../src/listing-report');

// Disposable, loopback-only database named s6rep_scratch_*; everything runs in one rolled-back transaction.
const url = process.env.S6_REPORT_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s6rep_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S6_REPORT_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s6rep_scratch_* database required');
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hex = (c) => c.repeat(64);

test(
  'anonymous listing reports: receipt-only lookup, queue order, transitions, hashed contact',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const r = db.createQueryRunner();
    await r.connect();
    await r.startTransaction();
    const town = id(5),
      otherTown = id(6),
      localSecret = 's6rep-local-secret-01234567890123456789',
      reviewer = id(81);
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
      for (const x of [
        { n: 1, name: 'Target Cafe', addr: '1 Target Way' },
        { n: 2, name: 'Control Bakery', addr: '2 Control Rd' },
      ]) {
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
      await r.query(
        `INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion","rebuildCompletedAt") VALUES ('current',1,now())`
      );
      const checks = pendingChecks(wrapper, source, identity, localSecret);
      server = pendingServer(
        checks,
        undefined,
        undefined,
        undefined,
        undefined,
        localSecret
      );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const L = `/internal/local-evaluation/towns/${town}`;
      const call = async (method, path, body, secret = localSecret) => {
        const res = await fetch(base + path, {
          method,
          headers: {
            ...(secret ? { authorization: `Bearer ${secret}` } : {}),
            'content-type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        assert.equal(res.headers.get('cache-control'), 'no-store');
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
      };
      const email = 'Reporter@Example.com';

      // Credentials are required on every report route.
      assert.equal(
        (await call('POST', `${L}/listing-reports`, {}, '')).status,
        401
      );
      assert.equal(
        (await call('GET', `${L}/listing-reports`, undefined, 'x'.repeat(40)))
          .status,
        401
      );

      // Create: validation first, then a served listing in this town.
      const good = {
        listingId: id(101),
        reasonCode: 'incorrect-details',
        note: 'The hours are wrong',
      };
      for (const bad of [
        { ...good, reasonCode: 'spam' },
        { ...good, note: 'x'.repeat(1001) },
        { ...good, email: 'not-an-email' },
        { ...good, extra: 1 },
        { reasonCode: 'other' },
        { ...good, listingId: 'nope' },
      ])
        assert.equal(
          (await call('POST', `${L}/listing-reports`, bad)).status,
          400,
          JSON.stringify(bad)
        );
      assert.equal(
        (
          await call('POST', `${L}/listing-reports`, {
            ...good,
            listingId: id(999),
          })
        ).status,
        404
      );
      assert.equal(
        (
          await call(
            'POST',
            `/internal/local-evaluation/towns/${otherTown}/listing-reports`,
            good
          )
        ).status,
        503 // other town is not an eligible/current town; it never reaches a row
      );
      assert.equal(
        (
          await r.query('SELECT count(*)::int n FROM directory_listing_report')
        )[0].n,
        0,
        'refused reports store nothing'
      );

      const first = await call('POST', `${L}/listing-reports`, {
        ...good,
        email,
      });
      assert.equal(first.status, 200);
      assert.deepEqual(Object.keys(first.json), ['receipt']);
      assert.match(first.json.receipt, /^[A-Za-z0-9_-]{32}$/);
      const safety = await call('POST', `${L}/listing-reports`, {
        listingId: id(102),
        reasonCode: 'safety',
        note: 'Unsafe',
      });
      assert.equal(safety.status, 200);
      assert.notEqual(safety.json.receipt, first.json.receipt);

      // Stored shape: only hashes, derived priority, nothing plaintext.
      const stored = await r.query(
        'SELECT * FROM directory_listing_report ORDER BY "createdAt",id'
      );
      assert.equal(stored.length, 2);
      const mine = stored.find((x) => x.reasonCode === 'incorrect-details');
      assert.equal(
        mine.receiptTokenHash,
        createHash('sha256').update(first.json.receipt).digest('hex')
      );
      assert.equal(
        mine.contactEmailHash,
        createHmac('sha256', contactKeyFrom(localSecret))
          .update(email.toLowerCase())
          .digest('hex')
      );
      assert.equal(mine.priority, false);
      assert.equal(mine.status, 'received');
      assert.equal(mine.listingName, 'Target Cafe');
      assert.equal(
        stored.find((x) => x.reasonCode === 'safety').priority,
        true
      );
      assert.equal(
        stored.find((x) => x.reasonCode === 'safety').contactEmailHash,
        null
      );
      const dump = JSON.stringify(stored);
      assert.ok(
        !dump.includes(first.json.receipt) &&
          !dump.toLowerCase().includes('reporter@example.com')
      );

      // Nothing is hidden by a report.
      const served = (await call('GET', `${L}/listings`)).json.listings
        .map((l) => l.name)
        .sort();
      assert.deepEqual(served, ['Control Bakery', 'Target Cafe']);

      // Receipt lookup returns exactly status, reason, createdAt.
      const look = await call(
        'GET',
        `/internal/local-evaluation/listing-reports/${first.json.receipt}`
      );
      assert.equal(look.status, 200);
      assert.deepEqual(Object.keys(look.json).sort(), [
        'createdAt',
        'reasonCode',
        'status',
      ]);
      assert.equal(look.json.status, 'received');
      assert.equal(look.json.reasonCode, 'incorrect-details');
      assert.equal(
        (
          await call(
            'GET',
            `/internal/local-evaluation/listing-reports/${'A'.repeat(32)}`
          )
        ).status,
        404
      );

      // Queue: priority first although it is newer; no reporter data in any field.
      const queue = (await call('GET', `${L}/listing-reports`)).json.reports;
      assert.deepEqual(
        queue.map((q) => q.reasonCode),
        ['safety', 'incorrect-details']
      );
      assert.equal(queue[0].priority, true);
      assert.ok(!JSON.stringify(queue).toLowerCase().includes('example.com'));
      assert.ok(
        queue.every(
          (q) => !('contactEmailHash' in q) && !('receiptTokenHash' in q)
        )
      );
      assert.equal(
        (await call('GET', `${L}/listing-reports?status=resolved`)).json.reports
          .length,
        0
      );
      assert.equal(
        (await call('GET', `${L}/listing-reports?status=bogus`)).status,
        400
      );

      // Transitions.
      const rid = queue[1].reportId;
      const sid = queue[0].reportId;
      const T = (reportId, action, body) =>
        call('POST', `${L}/listing-reports/${reportId}/${action}`, body);
      assert.equal((await T(rid, 'review', { actorId: 'nope' })).status, 400);
      const review = await T(rid, 'review', { actorId: reviewer });
      assert.deepEqual(review.json, {
        replayed: false,
        reportId: rid,
        status: 'under_review',
      });
      assert.equal(
        (await T(rid, 'review', { actorId: reviewer })).json.replayed,
        true
      );
      assert.equal((await T(rid, 'review', { actorId: id(82) })).status, 409);
      assert.equal(
        (
          await call(
            'GET',
            `/internal/local-evaluation/listing-reports/${first.json.receipt}`
          )
        ).json.status,
        'under_review'
      );
      // Decline needs a note; a suppression link only belongs to resolve.
      assert.equal(
        (await T(rid, 'decline', { actorId: reviewer })).status,
        400
      );
      assert.equal(
        (
          await T(rid, 'decline', {
            actorId: reviewer,
            note: 'ok',
            suppressionId: id(1),
          })
        ).status,
        400
      );
      // A resolution may only link a suppression of the same listing and town.
      assert.equal(
        (await T(sid, 'resolve', { actorId: reviewer, suppressionId: id(777) }))
          .status,
        409
      );
      const sup = await call('POST', `${L}/listing-suppressions`, {
        suppressionId: id(701),
        listingId: id(101),
        reasonCode: 'incorrect-details',
        actorId: reviewer,
      });
      assert.equal(sup.status, 200);
      assert.equal(
        (await T(sid, 'resolve', { actorId: reviewer, suppressionId: id(701) }))
          .status,
        409,
        'suppression names another listing'
      );
      const resolved = await T(rid, 'resolve', {
        actorId: reviewer,
        suppressionId: id(701),
        note: 'Hours corrected',
      });
      assert.deepEqual(resolved.json, {
        replayed: false,
        reportId: rid,
        status: 'resolved',
      });
      assert.equal(
        (await T(rid, 'decline', { actorId: reviewer, note: 'late' })).status,
        409
      );
      const closed = (
        await r.query('SELECT * FROM directory_listing_report WHERE id=$1', [
          rid,
        ])
      )[0];
      assert.equal(closed.suppressionId, id(701));
      assert.equal(closed.decidedById, reviewer);
      assert.equal(closed.decisionNote, 'Hours corrected');
      assert.equal(
        closed.contactEmailHash,
        null,
        'closing a report clears the contact hash'
      );
      const declined = await T(sid, 'decline', {
        actorId: reviewer,
        note: 'Not actionable',
      });
      assert.equal(declined.json.status, 'declined');
      assert.equal(
        (
          await call(
            'GET',
            `/internal/local-evaluation/listing-reports/${safety.json.receipt}`
          )
        ).json.status,
        'declined'
      );
      assert.equal(
        (await call('GET', `${L}/listing-reports`)).json.reports.length,
        0
      );
      assert.equal(
        (await call('GET', `${L}/listing-reports?status=declined`)).json.reports
          .length,
        1
      );

      // Account deletion scrubs the deciding reviewer and the decision note, and keeps the audit facts.
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
        'SELECT "decidedById","decisionNote",status,"reasonCode","suppressionId" FROM directory_listing_report WHERE status<>\'received\''
      );
      assert.equal(scrubbed.length, 2);
      for (const row of scrubbed) {
        assert.equal(row.decidedById, null);
        assert.equal(row.decisionNote, null);
      }
      assert.deepEqual(scrubbed.map((x) => x.status).sort(), [
        'declined',
        'resolved',
      ]);

      // Retention: an old open report loses its contact hash.
      const old = await call('POST', `${L}/listing-reports`, {
        listingId: id(102),
        reasonCode: 'other',
        email,
      });
      assert.equal(old.status, 200);
      await r.query(
        `UPDATE directory_listing_report SET "createdAt"=now()-interval '200 days' WHERE "contactEmailHash" IS NOT NULL`
      );
      assert.equal(await purgeReportContacts({ query }), 1);
      assert.equal(
        (
          await r.query(
            'SELECT count(*)::int n FROM directory_listing_report WHERE "contactEmailHash" IS NOT NULL'
          )
        )[0].n,
        0
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await r.rollbackTransaction();
      await r.release();
      await db.destroy();
    }
  }
);
