require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  syncRightsCases,
  getRightsCase,
  decideRightsCase,
  undoRightsDecision,
} = require('../src/rights-case');

// Disposable, loopback-only database named s7r_scratch*. Data is committed there; the caller drops the database.
const url = process.env.S7R_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s7r_scratch[a-z0-9_]*$/.test(u.pathname) ||
    process.env.S7R_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s7r_scratch* database required');
}

const RELEASE = '2026-10-21.0';
const POLICY = {
  releaseId: RELEASE,
  operations: { publicDisplay: true },
  terms: [],
};

async function addCase(ds, key, scope, status, release = RELEASE) {
  const [row] = await ds.query(
    `INSERT INTO directory_rights_case (scope,"subjectKey",provider,"releaseId",ambiguous,reasons,"observedRows",status)
     VALUES ($1,$2,'overture',$3,$4,'[]'::jsonb,1,$5) RETURNING id`,
    [scope, key, release, scope === 'source', status]
  );
  return row.id;
}

test(
  'an approved policy resolves review cases once, never without a policy, and leaves other statuses alone',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    try {
      await ds.query(
        'TRUNCATE directory_rights_event, directory_rights_case CASCADE'
      );
      await ds.query('TRUNCATE directory_overture_private_membership');
      const actor = randomUUID();
      const db = {
        query: (s, p) => ds.query(s, p),
        transaction: (f) => ds.transaction(f),
      };
      const a = await addCase(
        ds,
        `source|${RELEASE}|d|l|*`,
        'source',
        'review'
      );
      const r = await addCase(
        ds,
        `release|${RELEASE}|publicDisplay`,
        'release',
        'review'
      );
      const x = await addCase(
        ds,
        `field|${RELEASE}|f|d|l`,
        'field',
        'excluded'
      );
      const other = await addCase(
        ds,
        'source|other|d|l|*',
        'source',
        'review',
        'other'
      );
      const statusOf = async (id) =>
        (
          await ds.query(
            'SELECT status FROM directory_rights_case WHERE id=$1',
            [id]
          )
        )[0].status;
      const input = {
        syncId: randomUUID(),
        actorId: actor,
        releaseId: RELEASE,
      };

      // No policy: the release case is wanted, the rest are only left alone.
      const none = await syncRightsCases(db, input);
      assert.equal(none.resolved, 0);
      assert.equal(await statusOf(a), 'review');

      const first = await syncRightsCases(db, { ...input, policy: POLICY });
      assert.equal(first.resolved, 2);
      assert.equal(await statusOf(a), 'resolved');
      assert.equal(await statusOf(r), 'resolved');
      assert.equal(await statusOf(x), 'excluded');
      assert.equal(await statusOf(other), 'review');

      const events = await ds.query(
        `SELECT * FROM directory_rights_event WHERE action='policy_resolved' ORDER BY "caseId"`
      );
      assert.equal(events.length, 2);
      for (const e of events) {
        assert.equal(e.actorId, actor);
        assert.equal(e.statusBefore, 'review');
        assert.equal(e.statusAfter, 'resolved');
        assert.match(e.reason, new RegExp(`${input.syncId}.*[0-9a-f]{64}`));
      }

      // Re-sync (same and new sync id) resolves nothing more and writes no events.
      for (const syncId of [input.syncId, randomUUID()]) {
        const again = await syncRightsCases(db, {
          ...input,
          syncId,
          policy: POLICY,
        });
        assert.equal(again.resolved, 0);
      }
      const [{ n }] = await ds.query(
        `SELECT count(*)::int n FROM directory_rights_event WHERE action='policy_resolved'`
      );
      assert.equal(n, 2);

      // A system resolution is not undoable; reopen is, and the case can be resolved again by a later sync.
      const detail = await getRightsCase(db, a);
      const resolvedEntry = detail.history.find(
        (h) => h.action === 'policy_resolved'
      );
      assert.equal(resolvedEntry.reversible, false);
      await assert.rejects(
        undoRightsDecision(db, {
          decisionId: randomUUID(),
          caseId: a,
          undoOf: resolvedEntry.decisionId,
          actorId: actor,
          reason: 'undo',
          expectedVersionToken: detail.versionToken,
        }),
        (e) => e.code === 'not_latest' || /not_latest/.test(String(e.message))
      );
      const reopen = await decideRightsCase(db, {
        decisionId: randomUUID(),
        caseId: a,
        action: 'reopen',
        actorId: actor,
        reason: 'revisit',
        expectedVersionToken: detail.versionToken,
      });
      assert.equal(reopen.status, 'review');
      const after = await getRightsCase(db, a);
      assert.equal(after.history.at(-1).action, 'reopen');
      assert.equal(after.history.at(-1).reversible, true);
      const re = await syncRightsCases(db, {
        ...input,
        syncId: randomUUID(),
        policy: POLICY,
      });
      assert.equal(re.resolved, 1);
      assert.equal(await statusOf(a), 'resolved');
    } finally {
      await ds.destroy();
    }
  }
);
