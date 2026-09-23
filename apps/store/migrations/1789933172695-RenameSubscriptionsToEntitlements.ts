import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * E7: `subscriptions` → `product_entitlements` + `billingSubscriptionId`.
 *
 * Rewritten from the generated create+drop (which loses rows and pointlessly
 * rebuilds the receipts FK) into a data-preserving rename. Existing
 * entitlement rows keep their ids; the reference fills as gateway
 * dual-writes mint canonical billing subscriptions.
 */
export class RenameSubscriptionsToEntitlements1789933172695
  implements MigrationInterface
{
  name = 'RenameSubscriptionsToEntitlements1789933172695';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" RENAME TO "product_entitlements"`
    );
    await queryRunner.query(
      `ALTER TABLE "product_entitlements" ADD "billingSubscriptionId" uuid`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product_entitlements" DROP COLUMN "billingSubscriptionId"`
    );
    await queryRunner.query(
      `ALTER TABLE "product_entitlements" RENAME TO "subscriptions"`
    );
  }
}
