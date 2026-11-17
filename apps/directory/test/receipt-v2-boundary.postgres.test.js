const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/data-source').default;
const {
  DirectoryReconciler,
  configureReceiptPool,
} = require('../src/reconciliation');
const url = process.env.DIRECTORY_TEST_DATABASE_URL;

test(
  'durable identity rejects collisions and legacy receipts without side effects',
  { skip: !url },
  async () => {
    db.setOptions({ url });
    await db.initialize();
    const sourceEpoch = randomUUID(),
      recoveryEpoch = randomUUID(),
      owner = randomUUID(),
      communityId = randomUUID();
    const id = {
      revision: '991001',
      communityId,
      eventNonce: randomUUID(),
      sourceEpoch,
      recoveryEpoch,
    };
    let reads = 0;
    const reconciler = new DirectoryReconciler(
      db,
      async () => null,
      async (_id, _town, sourceEpoch, eventNonce) => {
        reads++;
        return { status: 'pending', sourceEpoch, eventNonce, snapshot: null };
      }
    );
    try {
      await configureReceiptPool(db, 10);
      await db.query(
        'INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ($1,$2)',
        ['recovery-authority', recoveryEpoch]
      );
      await db.query(
        'INSERT INTO directory_census_progress (id, phase, "sourceEpoch", "recoveryEpoch", owner, "activationId", "socialGeneration", "directoryGeneration") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          'recovery',
          'blocked',
          sourceEpoch,
          recoveryEpoch,
          owner,
          randomUUID(),
          '1',
          '1',
        ]
      );
      await reconciler.apply(id);
      await reconciler.apply(id);
      assert.equal(reads, 1);
      for (const changed of [
        { eventNonce: randomUUID() },
        { sourceEpoch: randomUUID() },
        { recoveryEpoch: randomUUID() },
        { communityId: randomUUID() },
      ]) {
        await assert.rejects(
          reconciler.apply({ ...id, ...changed }),
          /collision|epoch/i
        );
      }
      assert.equal(reads, 1);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_reconciliation_receipt WHERE "eventId"=$1',
            [id.revision]
          )
        )[0].n,
        1
      );
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int n FROM directory_town WHERE "communityId"=$1',
            [communityId]
          )
        )[0].n,
        0
      );
      await db.query(
        'UPDATE directory_reconciliation_receipt SET "eventNonce"=NULL WHERE "eventId"=$1',
        [id.revision]
      );
      await assert.rejects(reconciler.apply(id), /collision/);
      await assert.rejects(reconciler.cleanup(id), /collision/);
      assert.equal(reads, 1);
    } finally {
      await db.query(
        'DELETE FROM directory_reconciliation_receipt WHERE "eventId"=$1',
        [id.revision]
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
