import { MigrationInterface, QueryRunner } from 'typeorm';

// This data backfill cannot be inferred from entity metadata. Run the whole
// sequence in one transaction with old Directory writers stopped.
export class DirectoryReceiptBackfill1793839657452
  implements MigrationInterface
{
  name = 'DirectoryReceiptBackfill1793839657452';
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive)
      throw new Error('Receipt backfill requires a transaction');
    await queryRunner.query(
      'LOCK TABLE directory_reconciliation_receipt IN ACCESS EXCLUSIVE MODE'
    );
    const [{ count }] = await queryRunner.query(
      'SELECT count(*)::int AS count FROM directory_reconciliation_receipt'
    );
    const raw = process.env.DIRECTORY_RECEIPT_CAPACITY;
    const capacity = raw && /^[1-9][0-9]*$/.test(raw) ? Number(raw) : NaN;
    if (
      !Number.isSafeInteger(capacity) ||
      capacity > 1000000 ||
      capacity < count
    ) {
      throw new Error(
        'DIRECTORY_RECEIPT_CAPACITY must be between 1 (or the existing receipt count, if higher) and 1000000'
      );
    }
    if (!count) return;
    await queryRunner.query(
      'INSERT INTO directory_receipt_slot (id) SELECT generate_series(1, $1::integer)',
      [capacity]
    );
    await queryRunner.query(`UPDATE directory_reconciliation_receipt r SET "slotId" = ranked.slot
      FROM (SELECT "eventId", row_number() OVER (ORDER BY "eventId")::integer AS slot FROM directory_reconciliation_receipt) ranked
      WHERE r."eventId" = ranked."eventId"`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive)
      throw new Error('Receipt backfill rollback requires a transaction');
    await queryRunner.query(
      'LOCK TABLE directory_reconciliation_receipt IN ACCESS EXCLUSIVE MODE'
    );
    await queryRunner.query(
      'UPDATE directory_reconciliation_receipt SET "slotId" = NULL'
    );
    await queryRunner.query('DELETE FROM directory_receipt_slot');
  }
}
