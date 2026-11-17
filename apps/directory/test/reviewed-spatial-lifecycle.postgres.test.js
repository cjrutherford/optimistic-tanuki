const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const f = require('./reviewed-binding-fixtures');
const {
  revalidateBinding,
  transitionBinding,
} = require('../src/reviewed-binding-revalidate');
const { reviewedHash } = require('../src/reviewed-binding');
const {
  projectBinding,
  unprojectBinding,
  REVIEWED_SPATIAL_VALIDATOR_VERSION,
  SpatialProjectionConflict,
} = require('../src/reviewed-spatial');
const { OverturePrivateSink } = require('../src/overture-private-sink');
const {
  recordHumanAddressReviewDecision,
} = require('../src/address-review-store');

const liveUrl = process.env.S5_SPATIAL_TEST_DATABASE_URL;
const stageUrl = process.env.S5_SPATIAL_STAGE_TEST_DATABASE_URL;
const enabled = Boolean(liveUrl && stageUrl);
if (enabled) {
  for (const [value, pattern] of [
    [liveUrl, /^\/directory_spatial_test_[a-z0-9_]+$/i],
    [stageUrl, /^\/directory_spatial_stage_[a-z0-9_]+$/i],
  ]) {
    const parsed = new URL(value);
    if (
      !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
      !pattern.test(parsed.pathname)
    ) {
      throw Error(
        'Dedicated loopback directory_spatial_test_* and directory_spatial_stage_* databases are required'
      );
    }
  }
}

const DAY = 86_400_000;
const opts = {
  apply: true,
  stageInstallationId: 'stage-a',
  runId: 'spatial-test',
};

async function withWorld(run) {
  const live = new DataSource({ type: 'postgres', url: liveUrl });
  const stage = new DataSource({ type: 'postgres', url: stageUrl });
  await live.initialize();
  await stage.initialize();
  try {
    await f.reset(live, stage);
    await live.query('TRUNCATE directory_reviewed_spatial');
    return await run({ live, stage });
  } finally {
    await live.destroy();
    await stage.destroy();
  }
}

const projection = (live, n) =>
  live.query(
    'SELECT "bindingId","communityId",ST_X(point) AS lng,ST_Y(point) AS lat,(point IS NULL) AS "noPoint","listingDigest","validatorVersion" FROM directory_reviewed_spatial WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
    [f.liveScan, n]
  );
const projectionCount = async (live) =>
  (
    await live.query(
      'SELECT count(*)::int AS n FROM directory_reviewed_spatial'
    )
  )[0].n;
// The shared fixture's live listing lacks the attribution and reviewed evidence URL a served listing carries, so add them here.
const reviewedOf = (n) => ({
  ...f.reviewedFor(n),
  evidenceUrl: 'https://example.test/evidence',
});
async function seed(w, n, options) {
  const seeded = await f.seedRow(w.live, w.stage, n, options);
  await w.live.query(
    `UPDATE directory_overture_private_row SET listing=listing||jsonb_build_object('attribution',jsonb_build_array('Overture'),'notices','[]'::jsonb,'termsUrls',jsonb_build_array('https://example.test/terms'),'reviewed',$3::jsonb) WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
    [f.liveScan, n, JSON.stringify(reviewedOf(n))]
  );
  if (options.provenance !== 'unknown_legacy') {
    await w.live.query(
      'UPDATE directory_reviewed_binding SET "reviewedHash"=$2 WHERE id=$1',
      [seeded.bindingId, reviewedHash(f.key, reviewedOf(n))]
    );
  }
  return seeded;
}
const active = (w, n) =>
  seed(w, n, { state: 'active', until: new Date(Date.now() + DAY) });
async function confirmed(w, n) {
  const seeded = await seed(w, n, { state: 'pending' });
  const result = await revalidateBinding(
    w.live,
    w.stage,
    f.key,
    seeded.bindingId,
    opts
  );
  assert.equal(result.outcome, 'confirmed');
  return seeded;
}
async function makeWebsiteOnly(w, n, bindingId) {
  const reviewed = reviewedOf(n);
  delete reviewed.address;
  await w.live.query(
    `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{reviewed}',$3::jsonb) WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
    [f.liveScan, n, JSON.stringify(reviewed)]
  );
  await w.live.query(
    'UPDATE directory_reviewed_binding SET "reviewedHash"=$2 WHERE id=$1',
    [bindingId, reviewedHash(f.key, reviewed)]
  );
}
const forceRetire = (w, bindingId, cause) =>
  w.live.transaction(async (m) => {
    const [binding] = await m.query(
      'SELECT * FROM directory_reviewed_binding WHERE id=$1 FOR UPDATE',
      [bindingId]
    );
    assert.equal(
      await transitionBinding(m, binding, { action: 'retire', cause }, null),
      true
    );
  });

test(
  'confirm creates a projection row with the reviewed point; website-only gets a NULL point',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const mapped = await confirmed(w, 1);
      const [row] = await projection(w.live, 1);
      assert.equal(row.bindingId, mapped.bindingId);
      assert.equal(row.communityId, f.town);
      assert.deepEqual(
        [row.lng, row.lat, row.noPoint, row.validatorVersion],
        [-83, 31, false, REVIEWED_SPATIAL_VALIDATOR_VERSION]
      );
      const [{ same }] = await w.live.query(
        `SELECT "listingDigest"=md5(r.listing::text) AS same FROM directory_reviewed_spatial p JOIN directory_overture_private_row r ON r."scanId"=p."scanId" AND r."sourceFileRowNumber"=p."sourceFileRowNumber"`
      );
      assert.equal(same, true);

      const bare = await seed(w, 2, { state: 'pending' });
      await makeWebsiteOnly(w, 2, bare.bindingId);
      assert.equal(
        (await revalidateBinding(w.live, w.stage, f.key, bare.bindingId, opts))
          .outcome,
        'confirmed'
      );
      const [bareRow] = await projection(w.live, 2);
      assert.equal(bareRow.noPoint, true);
    })
);

test(
  'lease extension is idempotent and repairs a deleted or stale row',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const seeded = await active(w, 1);
      assert.equal(
        (
          await revalidateBinding(
            w.live,
            w.stage,
            f.key,
            seeded.bindingId,
            opts
          )
        ).outcome,
        'extended'
      );
      const [first] = await projection(w.live, 1);
      assert.equal(await projectionCount(w.live), 1);
      assert.equal(
        (
          await revalidateBinding(
            w.live,
            w.stage,
            f.key,
            seeded.bindingId,
            opts
          )
        ).outcome,
        'extended'
      );
      assert.deepEqual(await projection(w.live, 1), [first]);
      assert.equal(await projectionCount(w.live), 1);

      await w.live.query('DELETE FROM directory_reviewed_spatial');
      await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, opts);
      assert.deepEqual(await projection(w.live, 1), [first]);

      await w.live.query(
        `UPDATE directory_reviewed_spatial SET "listingDigest"='stale',point=NULL,"validatorVersion"=0`
      );
      await revalidateBinding(w.live, w.stage, f.key, seeded.bindingId, opts);
      assert.deepEqual(await projection(w.live, 1), [first]);
    })
);

const removalCases = [
  [
    'suspend',
    'a stage content change',
    async (w, s) => {
      await w.stage.query(
        `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{addresses,0,freeform}','"9 New Rd"')`
      );
      assert.equal(
        (await revalidateBinding(w.live, w.stage, f.key, s.bindingId, opts))
          .outcome,
        'suspended'
      );
    },
  ],
  [
    'retire (stage scan revoked)',
    null,
    async (w, s) => {
      await w.stage.query(
        'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)',
        [f.stageScan]
      );
      assert.equal(
        (await revalidateBinding(w.live, w.stage, f.key, s.bindingId, opts))
          .outcome,
        'retired'
      );
    },
  ],
  [
    'retire (live row withdrawn)',
    null,
    async (w, s) => {
      await w.live.query(
        'DELETE FROM directory_overture_private_row WHERE "scanId"=$1',
        [f.liveScan]
      );
      assert.equal(
        (await revalidateBinding(w.live, w.stage, f.key, s.bindingId, opts))
          .outcome,
        'retired'
      );
    },
  ],
  [
    'human revoke',
    null,
    async (w, s) => {
      const result = await recordHumanAddressReviewDecision(w.live, {
        candidateId: s.candidateId,
        actorId: randomUUID(),
        decision: 'revoke',
        reason: 'Wrong town',
      });
      assert.equal(result.status, 'revoked');
    },
  ],
];
for (const [name, , run] of removalCases) {
  test(`${name} removes the projection row`, { skip: !enabled }, () =>
    withWorld(async (w) => {
      const seeded = await confirmed(w, 1);
      assert.equal(await projectionCount(w.live), 1);
      await run(w, seeded);
      assert.equal(await projectionCount(w.live), 0);
    })
  );
}

test(
  'a failure after the removal rolls the removal back with the transition',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const seeded = await confirmed(w, 1);
      await assert.rejects(
        w.live.transaction(async (m) => {
          const [binding] = await m.query(
            'SELECT * FROM directory_reviewed_binding WHERE id=$1 FOR UPDATE',
            [seeded.bindingId]
          );
          await transitionBinding(
            m,
            binding,
            { action: 'suspend', cause: 'stage_content_changed' },
            null
          );
          assert.equal(
            await m
              .query('SELECT 1 FROM directory_reviewed_spatial')
              .then((r) => r.length),
            0
          );
          throw Error('forced failure');
        }),
        /forced failure/
      );
      assert.equal(await projectionCount(w.live), 1);
      assert.equal(
        (await f.bindingState(w.live, seeded.bindingId)).state,
        'active'
      );
    })
);

test('forced retire for each cause removes the row', { skip: !enabled }, () =>
  withWorld(async (w) => {
    for (const cause of [
      'stage_row_revoked',
      'stage_policy_revoked',
      'suspension_expired',
    ]) {
      await f.reset(w.live, w.stage);
      await w.live.query('TRUNCATE directory_reviewed_spatial');
      const seeded = await confirmed(w, 1);
      await forceRetire(w, seeded.bindingId, cause);
      assert.equal(await projectionCount(w.live), 0, cause);
    }
  })
);

test(
  'scan withdrawal, policy cleanup and row withdrawal leave no rows',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const sink = new OverturePrivateSink(w.live);
      await confirmed(w, 1);
      await confirmed(w, 2);
      assert.equal(await projectionCount(w.live), 2);
      await sink.withdrawRow(f.liveScan, 1);
      assert.equal((await projection(w.live, 1)).length, 0);
      assert.equal((await projection(w.live, 2)).length, 1);

      await sink.withdraw(f.liveScan);
      assert.equal(await projectionCount(w.live), 0);

      await f.reset(w.live, w.stage);
      await w.live.query('TRUNCATE directory_reviewed_spatial');
      await confirmed(w, 1);
      await confirmed(w, 2);
      assert.equal(await projectionCount(w.live), 2);
      assert.deepEqual(await sink.withdrawPolicy(f.livePolicy), {
        complete: true,
      });
      assert.equal(await projectionCount(w.live), 0);
    })
);

test(
  'a listing changed between the read and the insert aborts the projection',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const seeded = await seed(w, 1, { state: 'pending' });
      const binding = {
        id: seeded.bindingId,
        scanId: f.liveScan,
        sourceFileRowNumber: '1',
        communityId: f.town,
      };
      await w.live.query(
        `UPDATE directory_reviewed_binding SET state='active',"stateCause"='confirmed',"verifiedUntil"=now()+interval '1 day' WHERE id=$1`,
        [seeded.bindingId]
      );
      await assert.rejects(
        w.live.transaction(async (m) => {
          const racing = {
            query: async (sql, params) => {
              const result = await m.query(sql, params);
              if (/^SELECT listing/.test(sql))
                await w.live.query(
                  `UPDATE directory_overture_private_row SET listing=listing||'{"changed":true}'::jsonb`
                );
              return result;
            },
          };
          await projectBinding(racing, binding);
        }),
        SpatialProjectionConflict
      );
      assert.equal(await projectionCount(w.live), 0);
    })
);

test(
  'only an active binding can own a projection row',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const pending = await seed(w, 1, { state: 'pending' });
      const fileBound = await seed(w, 2, {
        state: 'pending',
        provenance: 'source_file',
      });
      const legacy = await seed(w, 3, {
        state: 'suspended',
        provenance: 'unknown_legacy',
        suspendedAt: new Date(),
      });
      for (const [n, seeded] of [
        [1, pending],
        [2, fileBound],
        [3, legacy],
      ]) {
        await assert.rejects(
          w.live.transaction((m) =>
            projectBinding(m, {
              id: seeded.bindingId,
              scanId: f.liveScan,
              sourceFileRowNumber: String(n),
              communityId: f.town,
            })
          ),
          SpatialProjectionConflict
        );
      }
      await revalidateBinding(
        w.live,
        w.stage,
        f.key,
        fileBound.bindingId,
        opts
      );
      await revalidateBinding(w.live, w.stage, f.key, legacy.bindingId, opts);
      await w.stage.query(
        `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{addresses,0,freeform}','"9 New Rd"') WHERE "sourceFileRowNumber"=1`
      );
      assert.equal(
        (
          await revalidateBinding(
            w.live,
            w.stage,
            f.key,
            pending.bindingId,
            opts
          )
        ).outcome,
        'suspended'
      );
      assert.equal(await projectionCount(w.live), 0);
      await unprojectBinding(w.live.manager, pending.bindingId);
    })
);
