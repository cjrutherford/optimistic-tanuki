import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E5: `invoices` → `appointment_receipts` + `billingInvoiceId` reference.
 *
 * Rewritten from the generated create+drop (which loses rows) into a
 * data-preserving rename. Existing receipt rows keep their ids; the new
 * reference starts NULL and fills as receipts link to billing quotes.
 */
export class RenameInvoicesToReceipts1789932550562
  implements MigrationInterface
{
  name = 'RenameInvoicesToReceipts1789932550562';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "invoices" RENAME TO "appointment_receipts"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointment_receipts" ADD "billingInvoiceId" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "appointment_receipts" DROP COLUMN "billingInvoiceId"`
    );
    await queryRunner.query(
      `ALTER TABLE "appointment_receipts" RENAME TO "invoices"`
    );
  }
}
