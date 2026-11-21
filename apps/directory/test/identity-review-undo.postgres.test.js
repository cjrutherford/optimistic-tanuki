const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { pendingChecks } = require('../src/register-pending-runtime');
const { planCarry, applyCarry } = require('../src/business-identity-carry');
const { decideBusinessIdentity } = require('../src/business-identity-decision');
const {
  identityVersionTokens,
  undoBusinessIdentityDecision,
  getBusinessIdentityReviewItem,
} = require('../src/business-identity-undo');
const {
  reconcile,
} = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');
const f = require('./business-identity-carry-fixtures');

const url = process.env.S7B_REVIEW_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/s7b_review_[a-z0-9_]+$/i.test(parsed.pathname)
  )
    throw Error('A dedicated loopback s7b_review_* database is required');
}

const identity = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const town = randomUUID();
const changeToken = randomUUID();
const secret = 'cursor-postgres-fixture-secret-32-bytes';
const snapshot = {
  id: town,
  name: 'Fixture Town',
  slug: null,
  adminArea: 'GA',
  appScope: 'local-hub',
  isPrivate: false,
  localityType: 'town',
};
const P0 = f.hex('0'),
  A = f.hex('a'),
  B = f.hex('b'),
  scanA = f.hex('c'),
  scanB = f.hex('d');
const checksFor = (db) =>
  pendingChecks(
    db,
    {
      scan: async () => [],
      current: async () => ({ status: 'current', changeToken, snapshot }),
    },
    identity,
    secret
  );
const opts = (from, to) => ({ fromPolicyId: from, toPolicyId: to, key: f.KEY });
const rows = (...ids) =>
  ids.map((id, i) => ({ n: i + 1, id, name: `Biz ${id}` }));

async function setup(db) {
  await f.clear(db);
  await db.query(
    'TRUNCATE directory_reviewed_binding_event, directory_reviewed_binding, directory_reviewed_spatial, directory_reviewed_spatial_state'
  );
  const request = {
    ...identity,
    sweep: { generation: '1' },
    lastCompletedSweep: {
      generation: '1',
      completedAt: new Date().toISOString(),
    },
  };
  await db.query(
    `INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`,
    [identity.recoveryEpoch]
  );
  await db.query(
    `INSERT INTO directory_census_progress (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration")
     VALUES ('recovery','reg-running',NULL,'register-pending-v1',$1::jsonb,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET phase=EXCLUDED.phase,cursor=NULL,protocol=EXCLUDED.protocol,"registerRequest"=EXCLUDED."registerRequest","sourceEpoch"=EXCLUDED."sourceEpoch","recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,"activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","directoryGeneration"=EXCLUDED."directoryGeneration"`,
    [
      JSON.stringify(request),
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
      identity.socialGeneration,
      identity.directoryGeneration,
    ]
  );
  await db.query(
    `INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'Fixture Town',true) ON CONFLICT ("communityId") DO UPDATE SET eligible=true`,
    [town]
  );
}
const stamp = async (db) => {
  // The fixture rows carry no change token; give every row the town's current one so the listing query sees them.
  await db.query(
    `UPDATE directory_overture_private_row SET listing = jsonb_set(listing,'{assignmentChangeToken}',to_jsonb($1::text))`,
    [changeToken]
  );
  await reconcile(db, { apply: true });
};
const cohort = (db, policy, scan, release, rs) =>
  f.cohort(db, { policy, town, release, scans: [{ scan, rows: rs }] });
const listed = (checks) =>
  checks.localListings(town, 0, '', false, '', false, '', undefined, '', true);
const nullish = (v) => v === null || v === undefined;

const open = async () => {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  return db;
};

const reviewer = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03';
const actor = { id: reviewer, domain: 'profile' };
const token = async (db, id) =>
  (await identityVersionTokens(db, town, [id])).get(id);
const decide = async (db, o) =>
  decideBusinessIdentity(db, {
    decisionId: randomUUID(),
    townId: town,
    actor,
    reason: 'reviewed by hand',
    expectedVersionToken: await token(db, o.businessId),
    ...o,
  });
const undo = async (db, o) =>
  undoBusinessIdentityDecision(db, {
    decisionId: randomUUID(),
    townId: town,
    actor,
    reason: 'changed my mind',
    expectedVersionToken: await token(db, o.businessId),
    ...o,
  });
const code = (c) => (e) => e && e.code === c;
const biz = async (db, n) =>
  (
    await db.query(
      'SELECT "businessId" AS id FROM directory_business_assertion WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [scanA, n]
    )
  )[0].id;
const stateOf = async (db, id) =>
  (
    await db.query(
      'SELECT state,"successorId","stateCause" FROM directory_business WHERE id=$1',
      [id]
    )
  )[0];
const count = async (db, table) =>
  (await db.query(`SELECT count(*)::int n FROM ${table}`))[0].n;

async function world(db) {
  await setup(db);
  await db.query('TRUNCATE directory_business_identity_decision');
  await cohort(db, A, scanA, '2026-09-23.0', rows('k1', 'k2', 'k3'));
  await planCarry(db, opts(P0, A)).then((p) =>
    applyCarry(db, { ...opts(P0, A), planDigest: p.digest })
  );
  await stamp(db);
  const checks = checksFor(db);
  return {
    checks,
    x: await biz(db, 1),
    y: await biz(db, 2),
    z: await biz(db, 3),
  };
}

test(
  'a stale token is a 409 stale_decision and writes nothing',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { x } = await world(db);
      const seen = await token(db, x);
      await decide(db, { action: 'confirm', businessId: x });
      const before = await count(db, 'directory_business_identity_decision');
      await assert.rejects(
        decide(db, {
          action: 'retire',
          businessId: x,
          expectedVersionToken: seen,
        }),
        code('stale_decision')
      );
      await assert.rejects(
        decide(db, {
          action: 'retire',
          businessId: x,
          expectedVersionToken: 'nope',
        }),
        /Invalid version token/
      );
      assert.equal(
        await count(db, 'directory_business_identity_decision'),
        before
      );
      assert.equal((await stateOf(db, x)).state, 'active');
      // The fresh token is accepted.
      await decide(db, { action: 'retire', businessId: x });
      assert.equal((await stateOf(db, x)).state, 'retired');
    } finally {
      await db.destroy();
    }
  }
);

test(
  'an identical replay is a no-op; the same id with other input is refused',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { x } = await world(db);
      const decisionId = randomUUID();
      const first = await decide(db, {
        action: 'confirm',
        businessId: x,
        decisionId,
      });
      assert.equal(first.replayed, false);
      const stale = await token(db, x);
      const again = await decide(db, {
        action: 'confirm',
        businessId: x,
        decisionId,
        expectedVersionToken: 'a'.repeat(64),
      });
      assert.equal(again.replayed, true);
      assert.notEqual(stale, 'a'.repeat(64));
      await assert.rejects(
        decide(db, { action: 'retire', businessId: x, decisionId }),
        /Invalid business identity decision/
      );
      assert.equal(await count(db, 'directory_business_identity_decision'), 1);
      const u = { businessId: x, undoOf: decisionId, decisionId: randomUUID() };
      const undone = await undo(db, u);
      assert.equal(undone.replayed, false);
      const replay = await undo(db, {
        ...u,
        expectedVersionToken: 'b'.repeat(64),
      });
      assert.equal(replay.replayed, true);
      await assert.rejects(
        undo(db, { ...u, reason: 'different' }),
        /Invalid business identity decision/
      );
      assert.equal(await count(db, 'directory_business_identity_decision'), 2);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'merge then undo restores the public detail of both businesses',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { checks, x, y } = await world(db);
      assert.equal((await checks.localDetail(town, x)).id, x);
      assert.equal((await checks.localDetail(town, y)).id, y);
      const merge = randomUUID();
      await decide(db, {
        action: 'merge',
        businessId: x,
        otherBusinessId: y,
        decisionId: merge,
      });
      assert.equal(
        (await checks.localDetail(town, y)).id,
        x,
        'merged-away id follows its successor'
      );
      const item = await getBusinessIdentityReviewItem(db, town, x);
      assert.equal(item.history.at(-1).decisionId, merge);
      assert.equal(item.history.at(-1).reversible, true);
      await undo(db, { businessId: x, undoOf: merge });
      assert.deepEqual(await stateOf(db, y), {
        state: 'active',
        successorId: null,
        stateCause: null,
      });
      assert.equal((await checks.localDetail(town, x)).id, x);
      assert.equal((await checks.localDetail(town, y)).id, y);
      const ids = ((await listed(checks)).listings || []).map((l) => l.id);
      assert.ok(ids.includes(x) && ids.includes(y));
      const after = await getBusinessIdentityReviewItem(db, town, x);
      assert.equal(after.history.length, 2);
      assert.equal(after.history[0].undoneBy, after.history[1].decisionId);
      assert.equal(after.history[0].reversible, false);
      assert.equal(after.history[1].action, 'undo');
      assert.equal(after.history[1].reversible, false);
      // Both sides carry an inverse audit event linked to the undo decision.
      const events = await db.query(
        `SELECT "businessId" FROM directory_business_event WHERE kind='undone' AND "decisionId"=$1 ORDER BY 1`,
        [after.history[1].decisionId]
      );
      assert.equal(events.length, 2);
      // The original decision row is still there.
      assert.equal(await count(db, 'directory_business_identity_decision'), 2);
    } finally {
      await db.destroy();
    }
  }
);
test(
  'retire, confirm and split are reversible and leave the history intact',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { checks, x, y, z } = await world(db);
      const retire = randomUUID();
      await decide(db, { action: 'retire', businessId: x, decisionId: retire });
      assert.equal(await checks.localDetail(town, x), null);
      await undo(db, { businessId: x, undoOf: retire });
      assert.equal((await checks.localDetail(town, x)).id, x);
      assert.equal((await stateOf(db, x)).stateCause, null);

      const before = await db.query(
        `SELECT id,confidence,evidence FROM directory_business_assertion WHERE "businessId"=$1 ORDER BY id`,
        [y]
      );
      const confirm = randomUUID();
      await decide(db, {
        action: 'confirm',
        businessId: y,
        decisionId: confirm,
      });
      const confirmed = await db.query(
        `SELECT confidence FROM directory_business_assertion WHERE "businessId"=$1`,
        [y]
      );
      assert.ok(confirmed.every((r) => r.confidence === 'confirmed'));
      await undo(db, { businessId: y, undoOf: confirm });
      assert.deepEqual(
        await db.query(
          `SELECT id,confidence,evidence FROM directory_business_assertion WHERE "businessId"=$1 ORDER BY id`,
          [y]
        ),
        before
      );

      const rowsOf = await db.query(
        `SELECT id,"scanId","sourceFileRowNumber"::text AS "sourceFileRowNumber" FROM directory_business_assertion WHERE "businessId"=$1 AND state='current'`,
        [z]
      );
      const split = randomUUID();
      await decide(db, {
        action: 'split',
        businessId: z,
        decisionId: split,
        rows: rowsOf.map((r) => ({
          scanId: r.scanId,
          sourceFileRowNumber: r.sourceFileRowNumber,
        })),
      });
      const [moved] = await db.query(
        `SELECT "businessId" FROM directory_business_assertion WHERE id=$1`,
        [rowsOf[0].id]
      );
      assert.notEqual(moved.businessId, z);
      assert.equal((await stateOf(db, z)).state, 'split');
      await undo(db, { businessId: z, undoOf: split });
      const [back] = await db.query(
        `SELECT "businessId" FROM directory_business_assertion WHERE id=$1`,
        [rowsOf[0].id]
      );
      assert.equal(back.businessId, z);
      assert.equal((await stateOf(db, z)).state, 'active');
      assert.equal((await stateOf(db, moved.businessId)).state, 'retired');
      assert.equal((await checks.localDetail(town, z)).id, z);
      assert.equal(await checks.localDetail(town, moved.businessId), null);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'only the latest non-undone decision is undoable (not_latest)',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { x } = await world(db);
      const first = randomUUID();
      await decide(db, { action: 'confirm', businessId: x, decisionId: first });
      const second = randomUUID();
      await decide(db, { action: 'retire', businessId: x, decisionId: second });
      await assert.rejects(
        undo(db, { businessId: x, undoOf: first }),
        code('not_latest')
      );
      await undo(db, { businessId: x, undoOf: second });
      await assert.rejects(
        undo(db, { businessId: x, undoOf: second }),
        code('not_latest')
      );
      // Now the earlier confirm is the latest non-undone decision.
      await undo(db, { businessId: x, undoOf: first });
      const history = (await getBusinessIdentityReviewItem(db, town, x))
        .history;
      assert.deepEqual(
        history.map((h) => h.action),
        ['confirm', 'retire', 'undo', 'undo']
      );
      assert.ok(history.every((h) => !h.reversible));
      // An undo cannot itself be undone.
      await assert.rejects(
        undo(db, { businessId: x, undoOf: history[3].decisionId }),
        /Invalid business identity decision/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'two concurrent decisions on the same token: exactly one wins',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { x, y } = await world(db);
      const seen = await token(db, x);
      const results = await Promise.allSettled([
        decide(db, {
          action: 'retire',
          businessId: x,
          expectedVersionToken: seen,
        }),
        decide(db, {
          action: 'confirm',
          businessId: x,
          expectedVersionToken: seen,
        }),
        decide(db, {
          action: 'merge',
          businessId: x,
          otherBusinessId: y,
          expectedVersionToken: seen,
        }),
      ]);
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
      for (const r of results.filter((r) => r.status === 'rejected'))
        assert.equal(r.reason.code, 'stale_decision');
      assert.equal(await count(db, 'directory_business_identity_decision'), 1);

      // Same for two concurrent undos of the same decision against one token.
      const [won] = await db.query(
        'SELECT id FROM directory_business_identity_decision'
      );
      const fresh = await token(db, x);
      const undos = await Promise.allSettled([
        undo(db, {
          businessId: x,
          undoOf: won.id,
          expectedVersionToken: fresh,
        }),
        undo(db, {
          businessId: x,
          undoOf: won.id,
          expectedVersionToken: fresh,
        }),
      ]);
      assert.equal(undos.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(
        undos.find((r) => r.status === 'rejected').reason.code,
        'stale_decision'
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'the queue carries a version token per item that matches the detail',
  { skip: !url },
  async () => {
    const db = await open();
    try {
      const { x } = await world(db);
      const tokens = await identityVersionTokens(db, town, [x]);
      const item = await getBusinessIdentityReviewItem(db, town, x);
      assert.equal(item.versionToken, tokens.get(x));
      assert.equal(
        await getBusinessIdentityReviewItem(db, town, randomUUID()),
        null
      );
    } finally {
      await db.destroy();
    }
  }
);
