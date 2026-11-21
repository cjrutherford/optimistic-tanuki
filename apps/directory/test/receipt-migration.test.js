const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { randomUUID } = require('node:crypto');
const {
  DirectoryReceiptBackfill1793839657452: Backfill,
} = require('../migrations/1793839657452-DirectoryReceiptBackfill');
const {
  DirectoryFoundation1793839629340: AddSlots,
} = require('../migrations/1793839629340-DirectoryFoundation');
const {
  DirectoryFoundation1793839678131: RequireSlots,
} = require('../migrations/1793839678131-DirectoryFoundation');
const url = process.env.DIRECTORY_MIGRATION_TEST_DATABASE_URL;

test(
  'receipt upgrade locks concurrent legacy writer and rollback preserves receipts',
  { skip: !url, timeout: 30000 },
  async () => {
    // Dedicated disposable database only: this test creates and drops its own schema.
    const schema = 'receipt_test_' + randomUUID().replaceAll('-', '');
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const migration = db.createQueryRunner(),
      writer = db.createQueryRunner();
    const previous = process.env.DIRECTORY_RECEIPT_CAPACITY;
    try {
      await db.query(`CREATE SCHEMA "${schema}"`);
      await migration.connect();
      await writer.connect();
      await migration.query(`SET search_path TO "${schema}"`);
      await writer.query(`SET search_path TO "${schema}"`);
      await migration.query(
        'CREATE TABLE directory_reconciliation_receipt ("eventId" bigint PRIMARY KEY, "communityId" uuid NOT NULL)'
      );
      for (const value of [undefined, '', '0', '01', '1000001']) {
        if (value === undefined) delete process.env.DIRECTORY_RECEIPT_CAPACITY;
        else process.env.DIRECTORY_RECEIPT_CAPACITY = value;
        await migration.startTransaction();
        await new AddSlots().up(migration);
        await assert.rejects(
          new Backfill().up(migration),
          /DIRECTORY_RECEIPT_CAPACITY/
        );
        await migration.rollbackTransaction();
        assert.equal(
          (
            await migration.query(
              "SELECT to_regclass('directory_receipt_slot') AS slot"
            )
          )[0].slot,
          null
        );
      }
      const id = randomUUID();
      await migration.query(
        'INSERT INTO directory_reconciliation_receipt VALUES (1, $1), (2, $1)',
        [id]
      );
      for (const value of [undefined, '1', '1000001', '01']) {
        if (value === undefined) delete process.env.DIRECTORY_RECEIPT_CAPACITY;
        else process.env.DIRECTORY_RECEIPT_CAPACITY = value;
        await migration.startTransaction();
        await new AddSlots().up(migration);
        await assert.rejects(
          new Backfill().up(migration),
          /DIRECTORY_RECEIPT_CAPACITY/
        );
        await migration.rollbackTransaction();
        assert.equal(
          (
            await migration.query(
              'SELECT count(*)::int n FROM directory_reconciliation_receipt'
            )
          )[0].n,
          2
        );
      }
      process.env.DIRECTORY_RECEIPT_CAPACITY = '3';
      await migration.startTransaction();
      await new AddSlots().up(migration);
      await new Backfill().up(migration);
      await new RequireSlots().up(migration);
      const [{ pid }] = await writer.query('SELECT pg_backend_pid() AS pid');
      let settled = false;
      const concurrent = writer
        .query(
          'INSERT INTO directory_reconciliation_receipt ("eventId", "communityId") VALUES (3, $1)',
          [id]
        )
        .then(
          () => 'inserted',
          (e) => e.code
        )
        .finally(() => {
          settled = true;
        });
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal(settled, false);
      assert.ok(
        (
          await db.query(
            'SELECT cardinality(pg_blocking_pids($1)) AS blockers',
            [pid]
          )
        )[0].blockers > 0
      );
      await migration.commitTransaction();
      assert.equal(await concurrent, '23502');
      assert.deepEqual(
        await migration.query(
          'SELECT "eventId", "slotId" FROM directory_reconciliation_receipt ORDER BY "eventId"'
        ),
        [
          { eventId: '1', slotId: 1 },
          { eventId: '2', slotId: 2 },
        ]
      );
      await migration.startTransaction();
      await new RequireSlots().down(migration);
      await new Backfill().down(migration);
      assert.equal(
        (
          await migration.query(
            'SELECT count(*)::int n FROM directory_reconciliation_receipt WHERE "slotId" IS NULL'
          )
        )[0].n,
        2
      );
      assert.equal(
        (
          await migration.query(
            'SELECT count(*)::int n FROM directory_receipt_slot'
          )
        )[0].n,
        0
      );
      await migration.commitTransaction();
    } finally {
      if (migration.isTransactionActive) await migration.rollbackTransaction();
      if (previous === undefined) delete process.env.DIRECTORY_RECEIPT_CAPACITY;
      else process.env.DIRECTORY_RECEIPT_CAPACITY = previous;
      await migration.release();
      await writer.release();
      await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await db.destroy();
    }
  }
);
