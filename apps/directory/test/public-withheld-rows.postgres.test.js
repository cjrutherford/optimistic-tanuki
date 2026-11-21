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
  revokeBusinessLink,
} = require('../src/listing-business-link');

// Disposable, loopback-only database named s5ev_scratch_*; everything runs in one rolled-back transaction.
const url = process.env.S5_EVIDENCE_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s5ev_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S5_EVIDENCE_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s5ev_scratch_* database required');
}
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const hex = (c) => c.repeat(64);

// Every key a public response may ever contain. Anything else (operator, profile, owner, subscription, ...) fails.
const ALLOWED_KEYS = new Set([
  'acquiredAt',
  'address',
  'attribution',
  'category',
  'coordinates',
  'coverage',
  'freshDays',
  'hasMore',
  'id',
  'link',
  'listing',
  'listings',
  'location',
  'name',
  'nextCursor',
  'notices',
  'policyVersion',
  'reference',
  'releaseId',
  'sourceFreshness',
  'sourcePublishedAt',
  'staleDays',
  'state',
  'termsUrls',
  'thresholds',
  'type',
  'withheldReviewedDetails',
]);
const FORBIDDEN =
  /operator|profile|subscription|lemon|owner|reviewer|actor|email|secret|hmac|stack|scanId|sourceFileRow|regionId|decision/i;
const keysOf = (value, into = new Set()) => {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, into));
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      keysOf(v, into);
    }
  return into;
};

test(
  'rejected, quarantined and revoked material is never retrievable from the public reads',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const r = db.createQueryRunner();
    await r.connect();
    await r.startTransaction();
    const town = id(5),
      localSecret = 's5ev-local-secret-0123456789012345678901',
      linkSecret = 's5ev-link-secret-01234567890123456789012',
      owner = id(80),
      reviewer = id(81),
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
    const wrapper = {
      query: (sql, params) =>
        sql.includes('FROM directory_census_progress p')
          ? Promise.resolve([authority])
          : r.query(sql, params),
      transaction: (fn) => fn(r.manager),
    };
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
    // The five withheld rows, each in a state that must hide it, plus one control that is served.
    const rows = [
      { n: 1, scan: hex('a'), name: 'Control Cafe', addr: '1 Visible Way' },
      { n: 2, scan: hex('a'), name: 'Quarantined Bakery', addr: null },
      { n: 3, scan: hex('a'), name: 'Revoked Row Diner', addr: '3 Revoked Rd' },
      {
        n: 4,
        scan: hex('b'),
        name: 'Revoked Scan Deli',
        addr: '4 Scan Revoked St',
      },
      {
        n: 5,
        scan: hex('c'),
        name: 'Revoked Policy Pub',
        addr: '5 Policy Revoked Ave',
      },
      {
        n: 6,
        scan: hex('a'),
        name: 'Rejected Review Shop',
        addr: '6 Rejected Review Ln',
      },
    ];
    const withheld = rows.filter((x) => x.n !== 1);
    let server;
    try {
      for (const [scan, policy, revoked] of [
        [hex('a'), hex('1'), false],
        [hex('b'), hex('2'), false],
        [hex('c'), hex('3'), true],
      ]) {
        await r.query(
          'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,$2)',
          [policy, revoked]
        );
        await r.query(
          'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
          [scan, policy]
        );
        await r.query(
          'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
          [scan]
        );
      }
      for (const x of rows) {
        await r.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [
            x.scan,
            x.n,
            town,
            x.addr === null ? null : JSON.stringify(listingOf(x.name, x.addr)),
          ]
        );
        await r.query(
          'INSERT INTO directory_listing_identity (id,"communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,$3,$4)',
          [id(100 + x.n), town, x.scan, x.n]
        );
        // Every row, hidden or not, has a binding and a map point: the attack is a stale projection.
        const state = x.n === 6 ? 'retired' : 'active';
        await r.query(
          `INSERT INTO directory_reviewed_binding (id,"candidateId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","decisionId",state,"verifiedUntil","stateCause")
           VALUES ($1,$2,$3,$4,$5,'source_file',$6,$6,$7,$8,now()+interval '1 day',$9)`,
          [
            id(200 + x.n),
            id(300 + x.n),
            town,
            x.scan,
            x.n,
            hex('d'),
            id(400 + x.n),
            state,
            x.n === 6 ? 'rejected' : null,
          ]
        );
        await r.query(
          `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId",point,"listingDigest","validatorVersion")
           SELECT $1::varchar,$2::bigint,$3::uuid,$4::uuid,ST_SetSRID(ST_MakePoint(-83,31),4326),COALESCE((SELECT md5(listing::text) FROM directory_overture_private_row WHERE "scanId"=$1::varchar AND "sourceFileRowNumber"=$2::bigint),'0'),1`,
          [x.scan, x.n, id(200 + x.n), town]
        );
      }
      await r.query(
        `INSERT INTO directory_address_review_candidate ("communityId","scanId","sourceFileRowNumber",name,category,point,addresses,websites,phones,rights,risk,verdict,reasons,checks,"policyVersion",status)
         VALUES ($1,$2,6,'Rejected Review Shop','restaurant','{}','[]','[]','[]','allowed','{}','reject','[]','[]','v','rejected')`,
        [town, hex('a')]
      );
      await r.query(
        `INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion","rebuildCompletedAt") VALUES ('current',1,now())`
      );
      // Revocations arrive after the projection was written.
      await r.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,3)',
        [hex('a')]
      );
      await r.query(
        'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)',
        [hex('b')]
      );

      // Business links: rejected, revoked, pending on the control; an approved-then-stale link on every withheld row.
      const tx = wrapper;
      const link = (n, req) => ({
        townId: town,
        listingId: id(100 + n),
        businessCommunityId: page,
        ownerId: owner,
        requestId: req,
      });
      const control = 1;
      await requestBusinessLink(tx, link(control, id(501)));
      await reviewBusinessLink(tx, {
        ...link(control, id(501)),
        reviewerId: reviewer,
        decision: 'reject',
        evidenceUrl: 'https://example.org/business',
      });
      await requestBusinessLink(tx, link(control, id(502)));
      await reviewBusinessLink(tx, {
        ...link(control, id(502)),
        reviewerId: reviewer,
        decision: 'approve',
        evidenceUrl: 'https://example.org/business',
      });
      await revokeBusinessLink(tx, {
        townId: town,
        listingId: id(100 + control),
        requestId: id(502),
        actorId: owner,
        actorRole: 'owner',
      });
      await requestBusinessLink(tx, link(control, id(503)));
      // Row 6 is still a served base listing, so its link is a rejected request rather than a stale active one.
      await requestBusinessLink(tx, link(6, id(516)));
      await reviewBusinessLink(tx, {
        ...link(6, id(516)),
        reviewerId: reviewer,
        decision: 'reject',
        evidenceUrl: 'https://example.org/business',
      });
      for (const x of withheld.filter((w) => w.n !== 6)) {
        const req = id(510 + x.n);
        await r.query(
          `INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId","ownerId",status) VALUES ($1,$2,$3,$4,$5,'approved')`,
          [req, town, id(100 + x.n), page, owner]
        );
        await r.query(
          'INSERT INTO directory_business_link_active ("listingId","requestId") VALUES ($1,$2)',
          [id(100 + x.n), req]
        );
      }

      // Reads run on the rolled-back transaction (no nested read-only transaction for the bounds query).
      const checks = pendingChecks(
        { query: wrapper.query },
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
        localSecret,
        linkSecret
      );
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const base = `http://127.0.0.1:${server.address().port}`;
      const L = `/internal/local-evaluation/towns/${town}`;
      const seen = [];
      const get = async (path, secret = localSecret) => {
        const res = await fetch(base + path, {
          headers: { authorization: `Bearer ${secret}` },
        });
        const text = await res.text();
        seen.push(text);
        return {
          status: res.status,
          text,
          json: text ? JSON.parse(text) : null,
        };
      };

      // Control: the served row is visible everywhere, so the checks below are not vacuous.
      const all = await get(`${L}/listings?identities=1`);
      assert.equal(all.status, 200);
      assert.deepEqual(all.json.listings.map((l) => l.name).sort(), [
        'Control Cafe',
        'Rejected Review Shop',
      ]);
      const plain = await get(`${L}/listings?pagination=cursor`);
      const controlRef = {
        id: all.json.listings.find((l) => l.name === 'Control Cafe').id,
        reference: plain.json.listings.find((l) => l.name === 'Control Cafe')
          .reference,
      };
      assert.equal(typeof controlRef.reference, 'string');
      const bounds = await get(
        `${L}/listings?pagination=cursor&bounds=-84,30,-82,32&identities=1`
      );
      assert.equal(bounds.status, 200);
      assert.deepEqual(
        bounds.json.listings.map((l) => l.name),
        ['Control Cafe']
      );
      assert.equal((await get(`${L}/listings/${controlRef.id}`)).status, 200);
      assert.equal(
        (await get(`${L}/listings/${controlRef.reference}`)).status,
        200
      );

      // Withheld rows: not by search, list, bounds, id, reference or link read.
      for (const x of withheld) {
        for (const q of [x.name, x.name.split(' ')[0].toLowerCase()]) {
          const search = await get(
            `${L}/listings?q=${encodeURIComponent(q)}&identities=1`
          );
          assert.equal(search.status, 200);
          const names = search.json.listings.map((l) => l.name);
          if (x.n === 6) continue; // checked below: listed without reviewed detail
          assert.ok(!names.includes(x.name), `${x.name} via search`);
        }
        const mapSearch = await get(
          `${L}/listings?pagination=cursor&bounds=-84,30,-82,32&q=${encodeURIComponent(
            x.name
          )}`
        );
        assert.equal(mapSearch.status, 200);
        assert.deepEqual(mapSearch.json.listings, [], `${x.name} via bounds`);
        const byId = await get(`${L}/listings/${id(100 + x.n)}`);
        if (x.n !== 6) assert.equal(byId.status, 404, `${x.name} by id`);
        const linkRead = await get(
          `${L}/business-links/${id(100 + x.n)}`,
          linkSecret
        );
        assert.equal(linkRead.status, 200);
        assert.deepEqual(linkRead.json, { link: null }, `${x.name} link`);
      }
      // The rejected review still has an unreviewed base listing, but nothing reviewed leaks.
      const rejected = await get(`${L}/listings/${id(106)}`);
      assert.equal(rejected.status, 200);
      assert.equal(rejected.json.listing.reviewed, undefined);
      for (const text of seen)
        for (const x of withheld)
          if (x.addr) assert.ok(!text.includes(x.addr), `${x.addr} leaked`);
      assert.ok(
        !seen.some((t) =>
          /Quarantined|Revoked Row|Revoked Scan|Revoked Policy/.test(t)
        )
      );

      // The control's rejected, revoked and pending requests never become a public link.
      const controlLink = await get(
        `${L}/business-links/${id(101)}`,
        linkSecret
      );
      assert.deepEqual(controlLink.json, { link: null });

      // Allowlist: no operator, profile, owner or subscription field in any response.
      const keys = new Set();
      for (const text of seen) if (text) keysOf(JSON.parse(text), keys);
      for (const key of keys) {
        assert.ok(!FORBIDDEN.test(key), `forbidden key ${key}`);
        assert.ok(ALLOWED_KEYS.has(key), `unexpected key ${key}`);
      }
      for (const text of seen) {
        assert.ok(!text.includes(owner) && !text.includes(reviewer));
        assert.ok(!text.includes(page));
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await r.rollbackTransaction();
      await r.release();
      await db.destroy();
    }
  }
);
