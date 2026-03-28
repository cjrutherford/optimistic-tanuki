import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerStripeConnectFields1775600000004
  implements MigrationInterface
{
  name = 'AddSellerStripeConnectFields1775600000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripeAccountId" character varying'
    );
    await queryRunner.query(
      `ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripeAccountStatus" character varying NOT NULL DEFAULT 'not-connected'`
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripeDetailsSubmitted" boolean NOT NULL DEFAULT false'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripeChargesEnabled" boolean NOT NULL DEFAULT false'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripePayoutsEnabled" boolean NOT NULL DEFAULT false'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripeOnboardingCompletedAt" timestamp'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets ADD COLUMN IF NOT EXISTS "stripeLastSyncedAt" timestamp'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripeLastSyncedAt"'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripeOnboardingCompletedAt"'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripePayoutsEnabled"'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripeChargesEnabled"'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripeDetailsSubmitted"'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripeAccountStatus"'
    );
    await queryRunner.query(
      'ALTER TABLE seller_wallets DROP COLUMN IF EXISTS "stripeAccountId"'
    );
  }
}
