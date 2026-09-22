import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E3: `transactions` → `payment_events` + `financeTransactionId`.
 *
 * Rewritten from the generated create-new-table (which strands the old table
 * and its rows) into a data-preserving rename. Event rows keep their ids;
 * the finance reference fills as postings are acknowledged.
 */
export class RenameTransactionsToPaymentEvents1789950504860
  implements MigrationInterface
{
  name = 'RenameTransactionsToPaymentEvents1789950504860';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" RENAME TO "payment_events"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_events" ADD "financeTransactionId" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payment_events" DROP COLUMN "financeTransactionId"`
    );
    await queryRunner.query(
      `ALTER TABLE "payment_events" RENAME TO "transactions"`
    );
  }
}
