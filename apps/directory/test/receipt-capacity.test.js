const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/data-source').default;
const {
  DirectoryReconciler,
  configureReceiptPool,
} = require('../src/reconciliation');
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const { beginRecovery } = require('../src/recovery-authority');

test(
  'fixed pool applies concurrent events atomically and releases only after exact absence',
  { skip: !url },
  async () => {
    db.setOptions({ url });
    await db.initialize();
    const authority = await beginRecovery(db, {
      sourceEpoch: randomUUID(),
      owner: randomUUID(),
      activationId: randomUUID(),
      socialGeneration: '1',
    });
    const nonces = new Map();
    const identity = (revision, communityId) => {
      if (!nonces.has(revision)) nonces.set(revision, randomUUID());
      return {
        revision,
        communityId,
        eventNonce: nonces.get(revision),
        sourceEpoch: authority.sourceEpoch,
        recoveryEpoch: authority.recoveryEpoch,
      };
    };
    const ids = Array.from({ length: 4 }, () => randomUUID());
    const snapshots = new Map(
      ids.map((id) => [
        id,
        {
          id,
          name: 'Public',
          slug: null,
          adminArea: null,
          appScope: 'local-hub',
          isPrivate: false,
          localityType: 'town',
        },
      ])
    );
    const pending = new Set(['900001', '900002', '900003', '900004']);
    let outage = false;
    const reconciler = new DirectoryReconciler(
      db,
      async (id) => snapshots.get(id),
      async (event, id, sourceEpoch, eventNonce) => {
        if (outage) throw Error('Social unavailable');
        return pending.has(event)
          ? {
              status: 'pending',
              sourceEpoch,
              eventNonce,
              snapshot: snapshots.get(id),
            }
          : { status: 'absent' };
      }
    );
    try {
      await configureReceiptPool(db, 2);
      await db.query(
        'INSERT INTO directory_town ("communityId", name, eligible) VALUES ($1, $2, true)',
        [ids[2], 'Before']
      );
      const results = await Promise.allSettled(
        ids
          .slice(0, 3)
          .map((id, i) => reconciler.apply(identity(String(900001 + i), id)))
      );
      assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_reconciliation_receipt'
          )
        )[0].n,
        2
      );
      const failed = results.findIndex((r) => r.status === 'rejected');
      if (failed === 2)
        assert.equal(
          (
            await db.query(
              'SELECT name FROM directory_town WHERE "communityId"=$1',
              [ids[2]]
            )
          )[0].name,
          'Before'
        );
      else
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int n FROM directory_town WHERE "communityId"=$1',
              [ids[failed]]
            )
          )[0].n,
          0
        );
      const first = results.findIndex((r) => r.status === 'fulfilled');
      const event = String(900001 + first);
      assert.equal(
        await reconciler.apply(identity(event, ids[first])),
        'applied'
      );
      snapshots.set(ids[first], {
        ...snapshots.get(ids[first]),
        isPrivate: true,
      });
      await assert.rejects(reconciler.apply(identity('900004', ids[first])));
      assert.equal(
        (
          await db.query(
            'SELECT eligible FROM directory_town WHERE "communityId"=$1',
            [ids[first]]
          )
        )[0].eligible,
        true
      );
      await assert.rejects(configureReceiptPool(db, 3), /differs/);
      outage = true;
      await assert.rejects(reconciler.cleanup(identity(event, ids[first])));
      await assert.rejects(reconciler.apply(identity('900004', ids[first])));
      outage = false;
      assert.equal(
        await reconciler.cleanup(identity(event, ids[first])),
        'pending'
      );
      pending.delete(event);
      assert.equal(
        await reconciler.cleanup(identity(event, ids[first])),
        'retired'
      );
      assert.equal(
        await reconciler.apply(identity('900004', ids[first])),
        'applied'
      );
      assert.equal(
        (
          await db.query(
            'SELECT eligible FROM directory_town WHERE "communityId"=$1',
            [ids[first]]
          )
        )[0].eligible,
        false
      );
      await assert.rejects(
        db.query(
          'INSERT INTO directory_reconciliation_receipt ("eventId", "communityId", "slotId") SELECT 999999, $1, "slotId" FROM directory_reconciliation_receipt LIMIT 1',
          [ids[first]]
        )
      );
    } finally {
      await db.query(
        'DELETE FROM directory_reconciliation_receipt WHERE "communityId" = ANY($1::uuid[])',
        [ids]
      );
      await db.query(
        'DELETE FROM directory_provider_work WHERE "communityId" = ANY($1::uuid[])',
        [ids]
      );
      await db.query(
        'DELETE FROM directory_town WHERE "communityId" = ANY($1::uuid[])',
        [ids]
      );
      await db.query(
        "DELETE FROM directory_census_progress WHERE id='recovery'"
      );
      await db.query(
        "DELETE FROM directory_installation WHERE id='recovery-authority'"
      );
      await db.destroy();
    }
  }
);
