require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');
const {
  runTaxonomyPass,
  runTaxonomyBatch,
} = require('../src/taxonomy-reclassification');
const { getOrCreateListingIdentities } = require('../src/listing-identity');
const { townCoverage } = require('../src/town-coverage');

// Disposable, loopback-only database named s7d_scratch_*. Data is committed there; the caller drops the database.
const url = process.env.S7D_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s7d_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S7D_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s7d_scratch_* database required');
}
const hex = () => randomBytes(32).toString('hex');
const VERSION = 'overture-v3-local-2026-11.1';

test(
  'taxonomy: mapping install, classification reads, cases with overrides, and the reclassification run lifecycle',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const town = randomUUID(),
      localSecret = 's7d-local-secret-01234567890123456789012',
      actor = randomUUID(),
      scanA = hex(),
      policyA = hex(),
      scanB = hex(),
      policyB = hex(),
      business = randomUUID();
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
    const listingOf = (name, category, extra = {}) => ({
      name,
      category,
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Example'],
      notices: [],
      termsUrls: [],
      assignmentChangeToken: town,
      reviewed: {
        address: `${name} Way`,
        attribution: ['Example'],
        notices: [],
        termsUrls: [],
        evidenceUrl: 'https://example.org/evidence',
      },
      ...extra,
    });
    let server;
    try {
      await ds.query(
        `TRUNCATE directory_taxonomy_run_before, directory_taxonomy_run, directory_taxonomy_event, directory_taxonomy_case, directory_listing_category_override, directory_listing_classification, directory_taxonomy_mapping_row, directory_taxonomy_mapping_version, directory_business_assertion, directory_business, directory_listing_identity, directory_reviewed_spatial, directory_reviewed_binding, directory_address_review_candidate, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_scan_lock, directory_overture_private_membership, directory_overture_private_completion, directory_overture_private_policy CASCADE`
      );
      const addScan = async (scan, policy) => {
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
      };
      const addRow = (scan, n, listing) =>
        ds.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [scan, n, town, JSON.stringify(listing)]
        );
      await addScan(scanA, policyA);
      const rows = [
        [1, 'Corner Diner', 'restaurant'],
        [2, 'Town Radio', 'radio_station'],
        [3, 'Mystery Shop', 'weird_unknown_category'],
        [4, 'Plain Bar', 'bar'],
        [5, 'After Dark', 'adult_entertainment_venue'],
      ];
      for (const [n, name, category] of rows)
        await addRow(
          scanA,
          n,
          listingOf(
            name,
            category,
            n === 5 ? { taxonomyPath: ['adult_entertainment_venue'] } : {}
          )
        );
      // Corner Diner is a business (its identity survives a rescan); the others are row-scoped listings.
      await ds.query(
        'INSERT INTO directory_business (id,"communityId") VALUES ($1,$2)',
        [business, town]
      );
      await ds.query(
        `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,state) VALUES ($1,$2,$3,1,$4,'origin','origin','current')`,
        [business, town, scanA, policyA]
      );
      // Rows 1 and 4 are reviewed and mappable, so the bounds read serves them.
      for (const n of [1, 4]) {
        const candidate = randomUUID(),
          binding = randomUUID();
        await ds.query(
          `INSERT INTO directory_address_review_candidate (id,"communityId","scanId","sourceFileRowNumber",name,category,point,addresses,websites,phones,rights,risk,verdict,reasons,checks,"policyVersion",status)
           VALUES ($1,$2,$3,$4,$5,'restaurant','{}','[]','[]','[]','allowed','{}','approve','[]','[]','v','published')`,
          [candidate, town, scanA, n, `Row ${n}`]
        );
        await ds.query(
          `INSERT INTO directory_reviewed_binding (id,"candidateId","communityId","scanId","sourceFileRowNumber",provenance,"stageContentHash","reviewedHash","decisionId",state,"verifiedUntil")
           VALUES ($1,$2,$3,$4,$5,'source_file',$6,$6,$7,'active',now()+interval '1 day')`,
          [binding, candidate, town, scanA, n, hex(), randomUUID()]
        );
        await ds.query(
          `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId",point,"listingDigest","validatorVersion")
           SELECT $1::varchar,$2::bigint,$3::uuid,$4::uuid,ST_SetSRID(ST_MakePoint(-83,31),4326),md5(listing::text),1 FROM directory_overture_private_row WHERE "scanId"=$1::varchar AND "sourceFileRowNumber"=$2::bigint`,
          [scanA, n, binding, town]
        );
      }
      await ds.query(
        `INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion","rebuildCompletedAt") VALUES ('current',1,now()) ON CONFLICT DO NOTHING`
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
          Object.entries(writeChecks).filter(([k]) => k.startsWith('taxonomy'))
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
      const T = '/internal/taxonomy';
      const served = async (q = '') =>
        Object.fromEntries(
          (await call('GET', `${L}/listings${q}`)).json.listings.map((l) => [
            l.name,
            l.category,
          ])
        );
      const bounded = async (q = '') =>
        Object.fromEntries(
          (
            await call(
              'GET',
              `${L}/listings?pagination=cursor&bounds=-84,30,-82,32${q}`
            )
          ).json.listings.map((l) => [l.name, l.category])
        );
      const runOf = async (id) => (await call('GET', `${T}/runs/${id}`)).json;
      const body = (extra) => ({ actorId: actor, reason: 'because', ...extra });

      // ---- Auth, validation, and the pre-install baseline ------------------------------------------------
      assert.equal(
        (await call('GET', `${T}/mappings`, undefined, 'x'.repeat(40))).status,
        401
      );
      assert.equal(
        (await call('POST', `${T}/mappings/install`, { version: VERSION }))
          .status,
        400
      );
      assert.deepEqual(await served(), {
        'Corner Diner': 'restaurant',
        'Town Radio': 'radio_station',
        'Mystery Shop': 'weird_unknown_category',
        'Plain Bar': 'bar',
        'After Dark': 'adult_entertainment_venue',
      });

      // ---- Install mapping: idempotent --------------------------------------------------------------------
      const install = (activate = true) =>
        call('POST', `${T}/mappings/install`, {
          actorId: actor,
          version: VERSION,
          activate,
        });
      const first = await install();
      assert.equal(first.status, 200);
      assert.equal(first.json.replayed, false);
      assert.equal(first.json.version.active, true);
      assert.ok(first.json.version.rowCount > 50);
      const second = await install();
      assert.equal(second.json.replayed, true);
      assert.equal(
        second.json.version.sourceHash,
        first.json.version.sourceHash
      );
      assert.equal((await install(false)).json.replayed, true);
      assert.equal(
        (
          await call('POST', `${T}/mappings/install`, {
            actorId: actor,
            version: 'nope',
            activate: true,
          })
        ).status,
        400
      );
      const mappings = (await call('GET', `${T}/mappings`)).json;
      assert.equal(mappings.versions.length, 1);
      assert.deepEqual(mappings.available, [{ id: VERSION, installed: true }]);
      // Installing changes nothing that is served until a run applies it.
      assert.equal((await served())['Corner Diner'], 'restaurant');

      // ---- Dry run writes nothing -------------------------------------------------------------------------
      const dryId = randomUUID();
      const dry = {
        id: dryId,
        mappingVersion: VERSION,
        scope: 'town',
        townId: town,
        mode: 'dry_run',
      };
      const created = await call('POST', `${T}/runs`, body(dry));
      assert.equal(created.status, 200);
      assert.equal(created.json.replayed, false);
      assert.equal(
        (await call('POST', `${T}/runs`, body(dry))).json.replayed,
        true
      );
      assert.equal(
        (await call('POST', `${T}/runs`, body({ ...dry, reason: 'different' })))
          .status,
        409
      );
      // One run at a time.
      assert.equal(
        (await call('POST', `${T}/runs`, body({ ...dry, id: randomUUID() })))
          .status,
        409
      );
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const dryRun = await runOf(dryId);
      assert.equal(dryRun.status, 'complete');
      assert.match(dryRun.planHash, /^[0-9a-f]{64}$/);
      assert.equal(dryRun.scannedRows, 5);
      assert.equal(dryRun.appliedRows, 0);
      const arrows = dryRun.summary.transitions
        .map((t) => `${t.from}>${t.to}:${t.count}`)
        .sort();
      assert.deepEqual(arrows, [
        'adult_entertainment_venue>excluded:1',
        'bar>restaurants:1',
        'radio_station>services:1',
        'restaurant>restaurants:1',
      ]);
      assert.equal(
        dryRun.summary.unmapped,
        1,
        'the unknown category keeps its stored value'
      );
      assert.equal(dryRun.summary.excluded, 1);
      assert.equal(
        Number(
          (
            await ds.query(
              'SELECT count(*)::int AS n FROM directory_listing_classification'
            )
          )[0].n
        ),
        0
      );
      assert.equal((await served())['Plain Bar'], 'bar');

      // ---- Apply guards ------------------------------------------------------------------------------------
      const applyBody = (id, extra = {}) =>
        body({
          id,
          mappingVersion: VERSION,
          scope: 'town',
          townId: town,
          mode: 'apply',
          expectedPlanHash: dryRun.planHash,
          confirm: 'APPLY',
          ...extra,
        });
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs`,
            applyBody(randomUUID(), { confirm: 'yes' })
          )
        ).status,
        400
      );
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs`,
            applyBody(randomUUID(), { expectedPlanHash: 'a'.repeat(64) })
          )
        ).status,
        409,
        'an apply must name the plan of a completed dry run'
      );

      // ---- Apply: interrupted mid-run, then resumed --------------------------------------------------------
      const applyId = randomUUID();
      assert.equal(
        (await call('POST', `${T}/runs`, applyBody(applyId))).status,
        200
      );
      await runTaxonomyPass(writeDb, { batchSize: 2, maxBatches: 3 }); // finishes the plan pass
      let mid = await runOf(applyId);
      assert.equal(mid.phase, 'apply');
      assert.equal(mid.status, 'running');
      await assert.rejects(
        runTaxonomyBatch(writeDb, {
          batchSize: 2,
          beforeCommit: () => {
            throw Error('crash before commit');
          },
        })
      );
      mid = await runOf(applyId);
      assert.equal(
        mid.appliedRows,
        0,
        'the failed batch rolled back with its cursor'
      );
      assert.equal(mid.attempts, 1);
      assert.equal(
        Number(
          (
            await ds.query(
              'SELECT count(*)::int AS n FROM directory_listing_classification'
            )
          )[0].n
        ),
        0
      );
      await runTaxonomyBatch(writeDb, { batchSize: 2 }); // one batch, then stop: an interruption
      mid = await runOf(applyId);
      assert.equal(mid.status, 'running');
      assert.ok(
        mid.appliedRows > 0 && mid.appliedRows < 5,
        'partially applied'
      );
      assert.equal(mid.attempts, 0);
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const applied = await runOf(applyId);
      assert.equal(applied.status, 'complete');
      assert.equal(applied.appliedRows, 5);
      assert.equal(applied.actorId, actor);
      assert.equal(applied.reason, 'because');
      assert.ok(applied.completedAt);
      assert.equal(
        await call('POST', `${T}/runs`, applyBody(applyId)).then(
          (r) => r.json.replayed
        ),
        true
      );
      assert.deepEqual(await served(), {
        'Corner Diner': 'restaurants',
        'Town Radio': 'services',
        'Mystery Shop': 'weird_unknown_category',
        'Plain Bar': 'restaurants',
      });
      assert.deepEqual(await served('?category=restaurants'), {
        'Corner Diner': 'restaurants',
        'Plain Bar': 'restaurants',
      });
      assert.deepEqual(await served('?category=bar'), {});
      assert.deepEqual(await served('?q=services'), {
        'Town Radio': 'services',
      });
      assert.deepEqual(await bounded(), {
        'Corner Diner': 'restaurants',
        'Plain Bar': 'restaurants',
      });
      assert.deepEqual(await bounded('&category=restaurants'), {
        'Corner Diner': 'restaurants',
        'Plain Bar': 'restaurants',
      });
      assert.equal(
        (await townCoverage({ query }, town, town)).state !== undefined,
        true
      );
      // After Dark is excluded for a visitor who did not opt in to adult listings.
      const radio = (
        await ds.query(
          `SELECT "placeTypeId",basis FROM directory_listing_classification WHERE "scanId"=$1 AND "sourceFileRowNumber"=2`,
          [scanA]
        )
      )[0];
      assert.deepEqual(radio, {
        placeTypeId: 'radio_station',
        basis: 'mapping',
      });

      // ---- Idempotent replay: a second apply of the same plan changes nothing -----------------------------
      const again = randomUUID();
      assert.equal(
        (await call('POST', `${T}/runs`, applyBody(again))).status,
        200
      );
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const repeat = await runOf(again);
      assert.equal(repeat.status, 'complete');
      assert.equal(repeat.appliedRows, 0);
      assert.equal(repeat.planHash, dryRun.planHash);
      // Nothing to roll back for an apply that wrote nothing: still allowed, still a no-op.

      // ---- Cancel ------------------------------------------------------------------------------------------
      const pending = randomUUID();
      await call('POST', `${T}/runs`, body({ ...dry, id: pending }));
      const canceled = await call(
        'POST',
        `${T}/runs/${pending}/cancel`,
        body({ reason: 'stop' })
      );
      assert.equal(canceled.json.run.status, 'canceled');
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs/${pending}/cancel`,
            body({ reason: 'stop' })
          )
        ).json.replayed,
        true
      );
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs/${pending}/cancel`,
            body({ reason: 'other' })
          )
        ).status,
        409
      );
      const running = randomUUID();
      await call('POST', `${T}/runs`, body({ ...dry, id: running }));
      await runTaxonomyPass(writeDb, { batchSize: 2, maxBatches: 1 });
      assert.equal((await runOf(running)).status, 'running');
      const cancelRequested = await call(
        'POST',
        `${T}/runs/${running}/cancel`,
        body({ reason: 'stop now' })
      );
      assert.equal(cancelRequested.json.run.cancelRequested, true);
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      assert.equal((await runOf(running)).status, 'canceled');

      // ---- Rollback restores the before-images --------------------------------------------------------------
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs/${dryId}/rollback`,
            body({ confirm: 'ROLLBACK' })
          )
        ).status,
        409,
        'a dry run has nothing to roll back'
      );
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs/${applyId}/rollback`,
            body({ confirm: 'no' })
          )
        ).status,
        400
      );
      const rb = await call(
        'POST',
        `${T}/runs/${applyId}/rollback`,
        body({ confirm: 'ROLLBACK' })
      );
      assert.equal(rb.status, 200);
      assert.equal(rb.json.run.status, 'rolling_back');
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs/${applyId}/rollback`,
            body({ confirm: 'ROLLBACK' })
          )
        ).json.replayed,
        true
      );
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const rolled = await runOf(applyId);
      assert.equal(rolled.status, 'rolled_back');
      assert.equal(rolled.restoredRows, 5);
      assert.equal(
        Number(
          (
            await ds.query(
              'SELECT count(*)::int AS n FROM directory_listing_classification'
            )
          )[0].n
        ),
        0
      );
      assert.equal(
        (await served())['Plain Bar'],
        'bar',
        'reads fall back to the stored category'
      );
      assert.equal((await served())['After Dark'], 'adult_entertainment_venue');
      // Re-apply for the case tests.
      const replan = randomUUID();
      await call('POST', `${T}/runs`, body({ ...dry, id: replan }));
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const replanned = await runOf(replan);
      const reapply = randomUUID();
      assert.equal(
        (
          await call(
            'POST',
            `${T}/runs`,
            applyBody(reapply, { expectedPlanHash: replanned.planHash })
          )
        ).status,
        200
      );
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      assert.equal((await runOf(reapply)).appliedRows, 5);
      assert.equal((await served())['Plain Bar'], 'restaurants');

      // ---- Cases: assign, history, undo, stale and idempotent decisions -------------------------------------
      const [mystery] = await getOrCreateListingIdentities(ds, town, [
        { scanId: scanA, row: '3' },
      ]);
      const caseA = randomUUID();
      const raise = (id, listingId) =>
        call(
          'POST',
          `${T}/cases`,
          body({ caseId: id, townId: town, listingId })
        );
      assert.equal((await raise(caseA, randomUUID())).status, 404);
      const raised = await raise(caseA, business);
      assert.equal(raised.status, 200);
      assert.equal(raised.json.replayed, false);
      assert.equal(raised.json.case.status, 'open');
      assert.equal(raised.json.case.listingId, business);
      assert.equal(raised.json.case.observedCategory, 'restaurant');
      assert.equal((await raise(caseA, business)).json.replayed, true);
      assert.equal(
        (await raise(randomUUID(), business)).json.case.id,
        caseA,
        'one open case per listing'
      );
      const caseB = randomUUID();
      assert.equal((await raise(caseB, mystery.id)).json.case.status, 'open');
      const listed = (await call('GET', `${T}/cases?status=open&limit=100`))
        .json.cases;
      assert.equal(listed.length, 2);
      const d0 = (await call('GET', `${T}/cases/${caseA}`)).json;
      assert.equal(
        d0.versionToken,
        listed.find((c) => c.id === caseA).versionToken
      );
      const decide = (id, extra) =>
        call('POST', `${T}/cases/${id}/decisions`, body(extra));
      const assign = {
        decisionId: randomUUID(),
        action: 'assign',
        categoryId: 'activities',
        expectedVersionToken: d0.versionToken,
      };
      assert.equal(
        (
          await decide(caseA, {
            ...assign,
            expectedVersionToken: 'f'.repeat(64),
          })
        ).json.code,
        'stale_decision'
      );
      assert.equal(
        (await decide(caseA, { ...assign, categoryId: 'adult' })).status,
        400,
        'operators cannot assign adult'
      );
      assert.equal(
        (await decide(caseA, { ...assign, categoryId: 'nonsense' })).status,
        400
      );
      assert.equal(
        (await decide(caseA, { ...assign, placeTypeId: 'auto_dealer' })).status,
        400
      );
      const ok = await decide(caseA, assign);
      assert.deepEqual(ok.json, { replayed: false, status: 'assigned' });
      assert.deepEqual((await decide(caseA, assign)).json, {
        replayed: true,
        status: 'assigned',
      });
      assert.equal(
        (await decide(caseA, { ...assign, categoryId: 'services' })).json.code,
        'decision_conflict'
      );
      assert.deepEqual(await served('?category=activities'), {
        'Corner Diner': 'activities',
      });
      assert.deepEqual(await served('?category=restaurants'), {
        'Plain Bar': 'restaurants',
      });
      assert.equal((await bounded())['Corner Diner'], 'activities');
      const assignedDetail = (await call('GET', `${T}/cases/${caseA}`)).json;
      assert.equal(assignedDetail.assignedCategoryId, 'activities');
      const assignEntry = assignedDetail.history.find(
        (h) => h.decisionId === assign.decisionId
      );
      assert.equal(assignEntry.reversible, true);
      const plain = await call('GET', `${L}/listings?pagination=cursor`);
      const ref = plain.json.listings.find(
        (l) => l.name === 'Corner Diner'
      ).reference;
      const byRef = await call('GET', `${L}/listings/${ref}`);
      assert.equal(byRef.status, 200);
      assert.match(JSON.stringify(byRef.json), /"category":"activities"/);

      // Undo restores the mapped category; the stale token and non-latest undo are refused.
      const undo = (id, extra) =>
        call('POST', `${T}/cases/${id}/undo`, body(extra));
      assert.equal(
        (
          await undo(caseA, {
            decisionId: randomUUID(),
            undoOf: assign.decisionId,
            expectedVersionToken: d0.versionToken,
          })
        ).json.code,
        'stale_decision'
      );
      assert.equal(
        (
          await undo(caseA, {
            decisionId: randomUUID(),
            undoOf: randomUUID(),
            expectedVersionToken: assignedDetail.versionToken,
          })
        ).json.code,
        'not_latest'
      );
      const undoId = randomUUID();
      const undone = await undo(caseA, {
        decisionId: undoId,
        undoOf: assign.decisionId,
        expectedVersionToken: assignedDetail.versionToken,
      });
      assert.deepEqual(undone.json, { replayed: false, status: 'open' });
      assert.equal(
        (
          await undo(caseA, {
            decisionId: undoId,
            undoOf: assign.decisionId,
            expectedVersionToken: assignedDetail.versionToken,
          })
        ).json.replayed,
        true
      );
      assert.equal((await served())['Corner Diner'], 'restaurants');
      assert.equal(
        Number(
          (
            await ds.query(
              'SELECT count(*)::int AS n FROM directory_listing_category_override'
            )
          )[0].n
        ),
        0
      );
      const afterUndo = (await call('GET', `${T}/cases/${caseA}`)).json;
      assert.equal(
        afterUndo.history.find((h) => h.decisionId === assign.decisionId)
          .undoneBy,
        undoId
      );

      // Reject, defer and reopen move status only.
      const dB = (await call('GET', `${T}/cases/${caseB}`)).json;
      const deferred = await decide(caseB, {
        decisionId: randomUUID(),
        action: 'defer',
        expectedVersionToken: dB.versionToken,
      });
      assert.equal(deferred.json.status, 'deferred');
      const dB2 = (await call('GET', `${T}/cases/${caseB}`)).json;
      assert.equal(
        (
          await decide(caseB, {
            decisionId: randomUUID(),
            action: 'defer',
            expectedVersionToken: dB2.versionToken,
          })
        ).json.code,
        'invalid_state'
      );
      const rejected = await decide(caseB, {
        decisionId: randomUUID(),
        action: 'reject',
        expectedVersionToken: dB2.versionToken,
      });
      assert.equal(rejected.json.status, 'rejected');
      assert.equal((await served())['Mystery Shop'], 'weird_unknown_category');

      // ---- The override survives a rescan of the same business ----------------------------------------------
      const dA = (await call('GET', `${T}/cases/${caseA}`)).json;
      const assign2 = randomUUID();
      assert.equal(
        (
          await decide(caseA, {
            decisionId: assign2,
            action: 'assign',
            categoryId: 'activities',
            expectedVersionToken: dA.versionToken,
          })
        ).status,
        200
      );
      await addScan(scanB, policyB);
      await addRow(scanB, 1, listingOf('Corner Diner', 'restaurant'));
      await ds.query(
        `UPDATE directory_business_assertion SET state='superseded' WHERE "businessId"=$1`,
        [business]
      );
      await ds.query(
        `INSERT INTO directory_business_assertion ("businessId","communityId","scanId","sourceFileRowNumber","policyId",evidence,confidence,state) VALUES ($1,$2,$3,1,$4,'origin','carried','current')`,
        [business, town, scanB, policyB]
      );
      await ds.query(
        'UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',
        [policyA]
      );
      assert.deepEqual(
        await served(),
        { 'Corner Diner': 'activities' },
        'new scan row, same business, same override'
      );
      // A run over the rescanned row records it as an override-based classification.
      const plan3 = randomUUID();
      await call('POST', `${T}/runs`, body({ ...dry, id: plan3 }));
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const p3 = await runOf(plan3);
      assert.equal(p3.scannedRows, 1);
      const apply3 = randomUUID();
      await call(
        'POST',
        `${T}/runs`,
        applyBody(apply3, { expectedPlanHash: p3.planHash })
      );
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      assert.equal((await runOf(apply3)).status, 'complete');
      const overridden = (
        await ds.query(
          `SELECT "categoryId",basis FROM directory_listing_classification WHERE "scanId"=$1 AND "sourceFileRowNumber"=1`,
          [scanB]
        )
      )[0];
      assert.deepEqual(overridden, {
        categoryId: 'activities',
        basis: 'override',
      });
      assert.equal((await served())['Corner Diner'], 'activities');

      // An apply whose data moved since its dry run fails without writing.
      const plan4 = randomUUID();
      await call('POST', `${T}/runs`, body({ ...dry, id: plan4 }));
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const p4 = await runOf(plan4);
      await addRow(scanB, 2, listingOf('Late Cafe', 'cafe'));
      const apply4 = randomUUID();
      await call(
        'POST',
        `${T}/runs`,
        applyBody(apply4, { expectedPlanHash: p4.planHash })
      );
      await runTaxonomyPass(writeDb, { batchSize: 2 });
      const stale = await runOf(apply4);
      assert.equal(stale.status, 'failed');
      assert.match(stale.lastError, /plan hash/);
      assert.equal(stale.appliedRows, 0);
      assert.equal((await served())['Late Cafe'], 'cafe');

      // The route surface is closed to anything but the local secret, and rejects unknown fields.
      assert.equal(
        (await call('GET', `${T}/runs?limit=1`)).json.runs.length,
        1
      );
      assert.equal((await call('GET', `${T}/runs?bogus=1`)).status, 400);
      assert.equal(
        (
          await call(
            'POST',
            `${T}/cases/${caseA}/decisions`,
            body({
              decisionId: randomUUID(),
              action: 'defer',
              expectedVersionToken: 'f'.repeat(64),
              extra: 1,
            })
          )
        ).status,
        400
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await ds.destroy();
    }
  }
);
