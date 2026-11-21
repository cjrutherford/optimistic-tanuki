require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');
const { runWithdrawalPass } = require('../src/withdrawal-request');
const { townCoverage } = require('../src/town-coverage');

// Disposable, loopback-only database named s7c_scratch_*. Data is committed there; the caller drops the database.
const url = process.env.S7C_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s7c_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S7C_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s7c_scratch_* database required');
}
const hex = () => randomBytes(32).toString('hex');
const PROVENANCE = [
  'directory_overture_private_row',
  'directory_overture_private_membership',
  'directory_overture_private_policy',
  'directory_overture_private_completion',
];

test(
  'rights decisions are versioned, idempotent and refuse ambiguous terms; withdrawal is durable, resumable and removes public reads',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const town = randomUUID(),
      localSecret = 's7c-local-secret-01234567890123456789012',
      actor = randomUUID(),
      scanA = hex(),
      policyA = hex(),
      scanB = hex(),
      policyB = hex();
    const identity = {
      sourceEpoch: randomUUID(),
      recoveryEpoch: randomUUID(),
      owner: randomUUID(),
      activationId: randomUUID(),
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
      dbNow: new Date(Date.now() + 1000),
      registerRequest: {
        ...identity,
        sweep: { generation: '1' },
        lastCompletedSweep: {
          generation: '1',
          completedAt: new Date(Date.now() - 1000).toISOString(),
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
        : ds.query(sql, params);
    const writeDb = { query, transaction: (fn) => ds.transaction(fn) };
    const listingOf = (name, address, sources) => ({
      name,
      category: 'restaurant',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Example'],
      notices: [],
      termsUrls: [],
      assignmentChangeToken: town,
      sources,
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
          await ds.query(
            `SELECT count(*)::int AS n, md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) AS h FROM ${t} x`
          )
        )[0];
      return out;
    };
    let server;
    try {
      await ds.query(
        `TRUNCATE directory_withdrawal_request, directory_rights_event, directory_rights_case, directory_reviewed_spatial, directory_reviewed_binding, directory_address_review_candidate, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_scan_lock, directory_overture_private_membership, directory_overture_private_completion, directory_overture_private_policy CASCADE`
      );
      for (const [policy, scan] of [
        [policyA, scanA],
        [policyB, scanB],
      ]) {
        await ds.query(
          'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
          [policy]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
          [scan, policy]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
          [scan]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
          [scan]
        );
      }
      const lineages = [
        // A name lineage with a pointer, and a whole-record (ambiguous) lineage.
        [
          {
            dataset: 'meta',
            license: 'CDLA',
            property: '/properties/names/primary',
          },
        ],
        [{ dataset: 'whole', license: 'ODbL' }],
      ];
      const rows = [
        { n: 1, name: 'Target Cafe', addr: '1 Target Way' },
        { n: 2, name: 'Control Bakery', addr: '2 Control Rd' },
      ];
      for (const x of rows) {
        await ds.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [
            scanA,
            x.n,
            town,
            JSON.stringify(listingOf(x.name, x.addr, lineages[x.n - 1])),
          ]
        );
        const candidate = randomUUID(),
          binding = randomUUID();
        await ds.query(
          `INSERT INTO directory_address_review_candidate (id,"communityId","scanId","sourceFileRowNumber",name,category,point,addresses,websites,phones,rights,risk,verdict,reasons,checks,"policyVersion",status)
           VALUES ($1,$2,$3,$4,$5,'restaurant','{}','[]','[]','[]','allowed','{}','approve','[]','[]','v','published')`,
          [candidate, town, scanA, x.n, x.name]
        );
        await ds.query(
          `INSERT INTO directory_reviewed_binding (id,"candidateId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","decisionId",state,"verifiedUntil")
           VALUES ($1,$2,$3,$4,$5,'source_file',$6,$6,$7,'active',now()+interval '1 day')`,
          [binding, candidate, town, scanA, x.n, hex(), randomUUID()]
        );
        await ds.query(
          `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId",point,"listingDigest","validatorVersion")
           SELECT $1::varchar,$2::bigint,$3::uuid,$4::uuid,ST_SetSRID(ST_MakePoint(-83,31),4326),md5(listing::text),1 FROM directory_overture_private_row WHERE "scanId"=$1::varchar AND "sourceFileRowNumber"=$2::bigint`,
          [scanA, x.n, binding, town]
        );
      }
      await ds.query(
        `INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion","rebuildCompletedAt") VALUES ('current',1,now()) ON CONFLICT DO NOTHING`
      );
      // 1,200 rows under policy B: enough that withdrawPolicy needs three calls of one batch each.
      await ds.query(
        `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing)
         SELECT $1,g,$2,'{"name":"Bulk"}'::jsonb FROM generate_series(1,1200) g`,
        [scanB, randomUUID()]
      );

      const readChecks = pendingChecks(
        { query },
        source,
        identity,
        localSecret
      );
      const writeChecks = pendingChecks(writeDb, source, identity, localSecret);
      const checks = {
        ...readChecks,
        ...Object.fromEntries(
          Object.entries(writeChecks).filter(
            ([k]) => k.startsWith('rights') || k.startsWith('withdrawal')
          )
        ),
      };
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
            authorization: `Bearer ${secret}`,
            'content-type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        assert.equal(res.headers.get('cache-control'), 'no-store');
        const text = await res.text();
        return { status: res.status, json: text ? JSON.parse(text) : null };
      };

      // ---- Rights cases -------------------------------------------------------------------------------
      assert.equal(
        (await call('GET', '/internal/rights/cases', undefined, 'x'.repeat(40)))
          .status,
        401
      );
      const provenanceBefore = await digest();
      const sync = {
        syncId: randomUUID(),
        actorId: actor,
        releaseId: '2026-01-01.0',
      };
      const synced = await call('POST', '/internal/rights/cases/sync', sync);
      assert.equal(synced.status, 200);
      assert.ok(
        synced.json.created >= 3,
        'release, field and ambiguous source cases'
      );
      const again = await call('POST', '/internal/rights/cases/sync', {
        ...sync,
        syncId: randomUUID(),
      });
      assert.equal(again.json.created, 0, 'a re-sync creates nothing');
      assert.equal(again.json.existing, synced.json.created);
      const list = (
        await call('GET', '/internal/rights/cases?status=review&limit=100')
      ).json.cases;
      const fieldCase = list.find(
        (c) => c.scope === 'field' && c.field === 'name'
      );
      const ambiguous = list.find((c) => c.scope === 'source' && c.ambiguous);
      assert.ok(fieldCase && ambiguous);
      assert.ok(list.some((c) => c.scope === 'release'));
      const detail = async (id) =>
        (await call('GET', `/internal/rights/cases/${id}`)).json;
      const decide = (id, body) =>
        call('POST', `/internal/rights/cases/${id}/decisions`, {
          actorId: actor,
          reason: 'because',
          ...body,
        });
      const d0 = await detail(fieldCase.id);
      assert.equal(
        d0.versionToken,
        fieldCase.versionToken,
        'list token equals detail token'
      );

      const exclude = {
        decisionId: randomUUID(),
        action: 'exclude_field',
        expectedVersionToken: d0.versionToken,
      };
      assert.equal(
        (
          await decide(fieldCase.id, {
            ...exclude,
            expectedVersionToken: 'f'.repeat(64),
          })
        ).json.code,
        'stale_decision'
      );
      assert.equal(
        (
          await decide(fieldCase.id, {
            ...exclude,
            termsUrl: 'https://example.org/t',
            termsSha256: 'a'.repeat(64),
          })
        ).status,
        400,
        'exclude takes no evidence'
      );
      const done = await decide(fieldCase.id, exclude);
      assert.deepEqual(done.json, { replayed: false, status: 'excluded' });
      assert.equal(
        (await decide(fieldCase.id, exclude)).json.replayed,
        true,
        'idempotent replay'
      );
      const clash = await decide(fieldCase.id, {
        ...exclude,
        reason: 'different',
      });
      assert.equal(clash.status, 409);
      assert.equal(clash.json.code, 'decision_conflict');
      const d1 = await detail(fieldCase.id);
      assert.equal(d1.status, 'excluded');
      assert.equal(d1.history.at(-1).reversible, true);
      // A second decision on the stale token is refused.
      assert.equal(
        (
          await decide(fieldCase.id, {
            decisionId: randomUUID(),
            action: 'reopen',
            expectedVersionToken: d0.versionToken,
          })
        ).json.code,
        'stale_decision'
      );
      const undo = {
        decisionId: randomUUID(),
        undoOf: exclude.decisionId,
        expectedVersionToken: d1.versionToken,
        actorId: actor,
        reason: 'mistake',
      };
      const undone = await call(
        'POST',
        `/internal/rights/cases/${fieldCase.id}/undo`,
        undo
      );
      assert.deepEqual(undone.json, { replayed: false, status: 'review' });
      assert.equal(
        (
          await call(
            'POST',
            `/internal/rights/cases/${fieldCase.id}/undo`,
            undo
          )
        ).json.replayed,
        true
      );
      const d2 = await detail(fieldCase.id);
      assert.equal(
        d2.history.find((h) => h.decisionId === exclude.decisionId).undoneBy,
        undo.decisionId
      );
      assert.equal(
        (
          await call('POST', `/internal/rights/cases/${fieldCase.id}/undo`, {
            ...undo,
            decisionId: randomUUID(),
            expectedVersionToken: d2.versionToken,
          })
        ).json.code,
        'not_latest'
      );

      // confirm_terms: evidence is required, an ambiguous source pointer is refused, and it only records evidence.
      const dA = await detail(ambiguous.id);
      const evidence = {
        termsUrl: 'https://example.org/terms',
        termsSha256: 'a'.repeat(64),
      };
      const refused = await decide(ambiguous.id, {
        decisionId: randomUUID(),
        action: 'confirm_terms',
        expectedVersionToken: dA.versionToken,
        ...evidence,
      });
      assert.equal(refused.status, 409);
      assert.equal(refused.json.code, 'invalid_state');
      assert.equal(
        (
          await decide(fieldCase.id, {
            decisionId: randomUUID(),
            action: 'confirm_terms',
            expectedVersionToken: d2.versionToken,
          })
        ).status,
        400,
        'evidence required'
      );
      assert.equal(
        (
          await decide(fieldCase.id, {
            decisionId: randomUUID(),
            action: 'confirm_terms',
            expectedVersionToken: d2.versionToken,
            termsUrl: 'http://example.org/t',
            termsSha256: 'a'.repeat(64),
          })
        ).status,
        400,
        'https required'
      );
      const confirm = {
        decisionId: randomUUID(),
        action: 'confirm_terms',
        expectedVersionToken: d2.versionToken,
        ...evidence,
      };
      assert.deepEqual((await decide(fieldCase.id, confirm)).json, {
        replayed: false,
        status: 'resolved',
      });
      const d3 = await detail(fieldCase.id);
      assert.deepEqual(d3.history.at(-1).evidence, evidence);
      assert.equal(
        (
          await decide(ambiguous.id, {
            decisionId: randomUUID(),
            action: 'exclude_field',
            expectedVersionToken: dA.versionToken,
          })
        ).json.code,
        'invalid_state',
        'exclude needs a field case'
      );
      // Concurrent identical-token decisions: exactly one wins.
      const dC = await detail(ambiguous.id);
      const race = await Promise.all(
        [1, 2].map(() =>
          decide(ambiguous.id, {
            decisionId: randomUUID(),
            action: 'defer',
            expectedVersionToken: dC.versionToken,
          })
        )
      );
      assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
      // None of it changed what is served or retained.
      assert.deepEqual(await digest(), provenanceBefore);

      // ---- Withdrawal ---------------------------------------------------------------------------------
      const names = async (q) =>
        (
          await call('GET', `${L}/listings?q=${encodeURIComponent(q)}`)
        ).json.listings.map((l) => l.name);
      const bounds = async () =>
        (
          await call(
            'GET',
            `${L}/listings?pagination=cursor&bounds=-84,30,-82,32`
          )
        ).json.listings
          .map((l) => l.name)
          .sort();
      const plain = await call('GET', `${L}/listings?pagination=cursor`);
      const reference = plain.json.listings.find(
        (l) => l.name === 'Target Cafe'
      ).reference;
      const surfaces = async () => ({
        search: await names('Target'),
        list: (await call('GET', `${L}/listings`)).json.listings.map(
          (l) => l.name
        ),
        bounds: await bounds(),
        byRef: (await call('GET', `${L}/listings/${reference}`)).status,
        control: await names('Control'),
        coverage: (await townCoverage({ query }, town, town)).state,
      });
      const before = await surfaces();
      assert.deepEqual(before.search, ['Target Cafe']);
      assert.deepEqual(before.bounds, ['Control Bakery', 'Target Cafe']);
      assert.equal(before.byRef, 200);
      assert.equal(before.coverage, 'available');

      const rowRequest = {
        id: randomUUID(),
        kind: 'row',
        target: `${scanA}:1`,
        reason: 'owner asked',
        actorId: actor,
        confirm: 'WITHDRAW',
        rightsCaseId: fieldCase.id,
      };
      assert.equal(
        (
          await call('POST', '/internal/withdrawals', {
            ...rowRequest,
            confirm: 'withdraw',
          })
        ).status,
        400,
        'typed confirmation required'
      );
      assert.equal(
        (
          await call('POST', '/internal/withdrawals', {
            ...rowRequest,
            target: 'nope',
          })
        ).status,
        400
      );
      const created = await call('POST', '/internal/withdrawals', rowRequest);
      assert.equal(created.status, 200);
      assert.equal(created.json.replayed, false);
      assert.equal(created.json.request.status, 'pending');
      // Creating alone changes nothing; the worker does.
      assert.deepEqual((await surfaces()).bounds, [
        'Control Bakery',
        'Target Cafe',
      ]);
      // Duplicate request id is idempotent; different content under the same id conflicts.
      const dup = await call('POST', '/internal/withdrawals', rowRequest);
      assert.equal(dup.json.replayed, true);
      assert.equal(
        (
          await call('POST', '/internal/withdrawals', {
            ...rowRequest,
            reason: 'other',
          })
        ).json.code,
        'decision_conflict'
      );
      assert.equal(
        (
          await ds.query(
            'SELECT count(*)::int AS n FROM directory_withdrawal_request WHERE id=$1',
            [rowRequest.id]
          )
        )[0].n,
        1
      );

      assert.equal(await runWithdrawalPass(ds), 1);
      const got = (await call('GET', `/internal/withdrawals/${rowRequest.id}`))
        .json;
      assert.equal(got.status, 'complete');
      assert.ok(got.completedAt);
      assert.equal(got.actorId, actor);
      assert.equal(got.progress.rowsRemaining, 0);
      const after = await surfaces();
      assert.deepEqual(after.search, []);
      assert.ok(!after.list.includes('Target Cafe'));
      assert.deepEqual(after.bounds, ['Control Bakery']);
      assert.equal(after.byRef, 404);
      assert.deepEqual(
        after.control,
        ['Control Bakery'],
        'only the named row is withdrawn'
      );
      assert.equal(after.coverage, 'available', 'the control row still serves');
      // The linked rights case moved to withdrawn and cannot be undone or reopened.
      const dw = await detail(fieldCase.id);
      assert.equal(dw.status, 'withdrawn');
      assert.equal(dw.history.at(-1).action, 'withdraw');
      assert.equal(
        (
          await call('POST', `/internal/rights/cases/${fieldCase.id}/undo`, {
            decisionId: randomUUID(),
            undoOf: dw.history.at(-1).decisionId,
            expectedVersionToken: dw.versionToken,
            actorId: actor,
            reason: 'x',
          })
        ).json.code,
        'not_latest'
      );
      assert.equal(
        (
          await decide(fieldCase.id, {
            decisionId: randomUUID(),
            action: 'reopen',
            expectedVersionToken: dw.versionToken,
          })
        ).json.code,
        'invalid_state'
      );
      // A second pass has nothing to do.
      assert.equal(await runWithdrawalPass(ds), 0);

      const second = {
        id: randomUUID(),
        kind: 'row',
        target: `${scanA}:2`,
        reason: 'owner asked',
        actorId: actor,
        confirm: 'WITHDRAW',
      };
      await call('POST', '/internal/withdrawals', second);
      await runWithdrawalPass(ds);
      const gone = await surfaces();
      assert.deepEqual(gone.bounds, []);
      assert.notEqual(
        gone.coverage,
        'available',
        'coverage no longer reports served rows'
      );

      // A request that cannot succeed fails with a recorded error instead of looping.
      const bad = {
        id: randomUUID(),
        kind: 'row',
        target: `${hex()}:1`,
        reason: 'unbound',
        actorId: actor,
        confirm: 'WITHDRAW',
      };
      await call('POST', '/internal/withdrawals', bad);
      await runWithdrawalPass(ds);
      const failed = (await call('GET', `/internal/withdrawals/${bad.id}`))
        .json;
      assert.equal(failed.status, 'failed');
      assert.match(failed.lastError, /not bound/);

      // Interrupted policy withdrawal: one batch per pass; a "restart" is simply the next pass finding it running.
      const policyRequest = {
        id: randomUUID(),
        kind: 'policy',
        target: policyB,
        reason: 'rights holder',
        actorId: actor,
        confirm: 'WITHDRAW',
      };
      await call('POST', '/internal/withdrawals', policyRequest);
      await runWithdrawalPass(ds, { maxBatches: 1 });
      const mid = (
        await call('GET', `/internal/withdrawals/${policyRequest.id}`)
      ).json;
      assert.equal(mid.status, 'running');
      assert.equal(mid.progress.rowsRemaining, 700);
      assert.equal(mid.completedAt, null);
      assert.equal(
        (
          await ds.query(
            'SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1',
            [policyB]
          )
        )[0].revoked,
        true,
        'revoked before cleanup finishes'
      );
      const listed = (await call('GET', '/internal/withdrawals?status=running'))
        .json.requests;
      assert.ok(listed.some((r) => r.id === policyRequest.id));
      for (let i = 0; i < 6; i++) {
        const cur = (
          await call('GET', `/internal/withdrawals/${policyRequest.id}`)
        ).json;
        if (cur.status === 'complete') break;
        await runWithdrawalPass(ds, { maxBatches: 1 });
      }
      const fin = (
        await call('GET', `/internal/withdrawals/${policyRequest.id}`)
      ).json;
      assert.equal(fin.status, 'complete');
      assert.equal(fin.progress.rowsRemaining, 0);
      assert.ok(fin.steps >= 3);
      assert.equal(
        (
          await ds.query(
            'SELECT count(*)::int AS n FROM directory_overture_private_row WHERE "scanId"=$1',
            [scanB]
          )
        )[0].n,
        0
      );
      // Policy A was not touched by policy B's withdrawal.
      assert.equal(
        (
          await ds.query(
            'SELECT revoked FROM directory_overture_private_policy WHERE "policyId"=$1',
            [policyA]
          )
        )[0].revoked,
        false
      );
    } finally {
      server?.close();
      await ds.destroy();
    }
  }
);
