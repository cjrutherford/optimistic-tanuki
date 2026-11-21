const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const f = require('./reviewed-binding-fixtures');
const {
  revalidateBinding,
  sweepBindings,
  confirmBinding,
} = require('../src/reviewed-binding-revalidate');
const {
  recordHuman: recordHumanAddressReviewDecision,
} = require('./review-test-helpers');

const enabled = Boolean(f.connectionUrls());
const opts = { apply: true, stageInstallationId: 'stage-a', runId: 'race-run' };
const DAY = 86_400_000;

async function withWorld(run) {
  const world = await f.connect();
  try {
    await f.reset(world.live, world.stage);
    return await run(world);
  } finally {
    await world.close();
  }
}

/** The public gate: reviewed fields are served only under an active, current binding. */
const servedReviewed = (db) =>
  db.query(
    `SELECT r."sourceFileRowNumber" FROM directory_overture_private_row r
     WHERE r.listing ? 'reviewed' AND EXISTS (SELECT 1 FROM directory_reviewed_binding b
       WHERE b."scanId"=r."scanId" AND b."sourceFileRowNumber"=r."sourceFileRowNumber" AND b.state='active' AND b."verifiedUntil">now())`
  );

function poll(db) {
  const seen = { observations: 0, reviewedSeen: 0 };
  let stop = false;
  const done = (async () => {
    while (!stop) {
      const rows = await servedReviewed(db);
      seen.observations += 1;
      seen.reviewedSeen += rows.length;
    }
  })();
  return {
    seen,
    stop: async () => {
      stop = true;
      await done;
    },
  };
}

const within = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out (deadlock?)`)), ms)
    ),
  ]);

test(
  '(a) a stage row withdrawn after the publisher read it is never served',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      // The publisher read the stage (row present), then the stage withdrew the row,
      // then the live transaction committed a pending binding.
      const reader = await f.connect();
      const watcher = poll(reader.live);
      try {
        await w.stage.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)',
          [f.stageScan, f.town, JSON.stringify(f.stageListing(1))]
        );
        await w.stage.query(
          'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1)',
          [f.stageScan]
        );
        const seeded = await f.seedRow(w.live, w.stage, 1, { stageRow: false });
        const result = await confirmBinding(
          w.live,
          w.stage,
          f.key,
          seeded.bindingId,
          { stageInstallationId: 'stage-a' }
        );
        assert.deepEqual(
          [result.outcome, result.cause],
          ['retired', 'stage_row_revoked']
        );
        assert.equal(
          (await f.bindingState(w.live, seeded.bindingId)).state,
          'retired'
        );
        assert.equal(await f.liveReviewed(w.live, 1), false);
      } finally {
        await watcher.stop();
        await reader.close();
      }
      assert.ok(watcher.seen.observations > 0);
      assert.equal(watcher.seen.reviewedSeen, 0);
    })
);

test(
  '(b) a stage policy withdrawn after confirmation is hidden at lease expiry and retired by the next sweep',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const seeded = await f.seedRow(w.live, w.stage, 1);
      assert.equal(
        (
          await confirmBinding(w.live, w.stage, f.key, seeded.bindingId, {
            stageInstallationId: 'stage-a',
            leaseMs: 1500,
          })
        ).outcome,
        'confirmed'
      );
      assert.equal((await servedReviewed(w.live)).length, 1);
      await w.stage.query(
        'UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',
        [f.stagePolicy]
      );
      // No sweep runs: the lease alone must hide the fields.
      await new Promise((resolve) => setTimeout(resolve, 1700));
      assert.equal((await servedReviewed(w.live)).length, 0);
      assert.equal(
        (await f.bindingState(w.live, seeded.bindingId)).state,
        'active'
      );
      const summary = await sweepBindings(w.live, w.stage, f.key, opts);
      assert.equal(summary.counts.retired, 1);
      assert.equal(
        (await f.bindingState(w.live, seeded.bindingId)).stateCause,
        'stage_policy_revoked'
      );
      assert.equal(await f.liveReviewed(w.live, 1), false);
    })
);

test(
  '(c) a sweep and a human revoke on the same binding both return with one retired event',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      for (let round = 0; round < 12; round += 1) {
        await f.reset(w.live, w.stage);
        const seeded = await f.seedRow(w.live, w.stage, 1, {
          state: 'active',
          until: new Date(Date.now() + DAY),
        });
        await w.stage.query(
          'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,1)',
          [f.stageScan]
        );
        const revoke = recordHumanAddressReviewDecision(w.live, {
          candidateId: seeded.candidateId,
          actorId: randomUUID(),
          decision: 'revoke',
          reason: 'race',
        }).then(
          () => 'revoked',
          (error) => `rejected:${error.message}`
        );
        const sweep = revalidateBinding(
          w.live,
          w.stage,
          f.key,
          seeded.bindingId,
          opts
        ).then((r) => r.outcome);
        const [revokeResult, sweepResult] = await within(
          Promise.all([revoke, sweep]),
          20000,
          'revoke and sweep'
        );
        assert.match(
          revokeResult,
          /^(revoked|rejected:Invalid decision for current candidate status|rejected:stale_decision)$/
        );
        assert.match(sweepResult, /^(retired|skipped|unchanged)$/);
        // A sweep that skipped a locked candidate leaves it to the revoke; nothing may be left active.
        const row = await f.bindingState(w.live, seeded.bindingId);
        if (row.state !== 'retired')
          await revalidateBinding(
            w.live,
            w.stage,
            f.key,
            seeded.bindingId,
            opts
          );
        assert.equal(
          (await f.bindingState(w.live, seeded.bindingId)).state,
          'retired'
        );
        assert.equal(
          (await f.events(w.live, seeded.bindingId)).filter(
            (e) => e.kind === 'retired'
          ).length,
          1
        );
        assert.equal(await f.liveReviewed(w.live, 1), false);
      }
    })
);

test(
  '(d) two sweepers on the same batch do not double-transition',
  { skip: !enabled },
  () =>
    withWorld(async (w) => {
      const total = 24;
      const ids = [];
      for (let n = 1; n <= total; n += 1) {
        ids.push(
          (
            await f.seedRow(w.live, w.stage, n, {
              state: 'active',
              until: new Date(Date.now() + DAY),
            })
          ).bindingId
        );
      }
      await w.stage.query(
        'UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1',
        [f.stagePolicy]
      );
      const second = await f.connect();
      try {
        const [one, two] = await within(
          Promise.all([
            sweepBindings(w.live, w.stage, f.key, opts),
            sweepBindings(second.live, second.stage, f.key, opts),
          ]),
          60000,
          'sweepers'
        );
        assert.equal(one.counts.retired + two.counts.retired, total);
      } finally {
        await second.close();
      }
      const retired = await w.live.query(
        `SELECT "bindingId",count(*)::int AS n FROM directory_reviewed_binding_event WHERE kind='retired' GROUP BY "bindingId"`
      );
      assert.equal(retired.length, total);
      assert.ok(retired.every((row) => row.n === 1));
      const decisions = await w.live.query(
        `SELECT count(*)::int AS n FROM directory_address_review_decision WHERE "actorKind"='auto' AND decision='revoke'`
      );
      assert.equal(decisions[0].n, total);
      assert.equal(
        (
          await w.live.query(
            `SELECT 1 FROM directory_reviewed_binding WHERE state<>'retired'`
          )
        ).length,
        0
      );
    })
);
