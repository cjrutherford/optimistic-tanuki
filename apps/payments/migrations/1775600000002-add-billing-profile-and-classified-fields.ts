import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingProfileAndClassifiedFields1775600000002
    implements MigrationInterface {
    name = 'AddBillingProfileAndClassifiedFields1775600000002';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
      ALTER TABLE "classified_payments"
      ADD COLUMN IF NOT EXISTS "externalProvider" character varying,
      ADD COLUMN IF NOT EXISTS "externalTransactionId" character varying,
      ADD COLUMN IF NOT EXISTS "externalCustomerId" character varying,
      ADD COLUMN IF NOT EXISTS "externalInvoiceId" character varying,
      ADD COLUMN IF NOT EXISTS "checkoutToken" character varying,
      ADD COLUMN IF NOT EXISTS "checkoutSecretToken" character varying
    `);

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "profileId" uuid,
        "appScope" character varying NOT NULL,
        "externalProvider" character varying,
        "externalCustomerId" character varying,
        "email" character varying,
        "name" character varying,
        "defaultPaymentMethodId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_billing_profiles_id" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_billing_profiles_appscope_user" ON "billing_profiles" ("appScope", "userId")`
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_billing_profiles_appscope" ON "billing_profiles" ("appScope")`
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_billing_profiles_user" ON "billing_profiles" ("userId")`
        );

        await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_payment_methods" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "billingProfileId" uuid,
        "userId" uuid NOT NULL,
        "appScope" character varying NOT NULL,
        "externalProvider" character varying,
        "externalCustomerId" character varying,
        "externalPaymentMethodId" character varying,
        "brand" character varying,
        "last4" character varying,
        "expiryMonth" integer,
        "expiryYear" integer,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_payment_methods_id" PRIMARY KEY ("id")
      )
    `);

        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_saved_payment_methods_appscope" ON "saved_payment_methods" ("appScope")`
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_saved_payment_methods_appscope_user" ON "saved_payment_methods" ("appScope", "userId")`
        );
        await queryRunner.query(
            `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_saved_payment_methods_external" ON "saved_payment_methods" ("appScope", "externalPaymentMethodId")`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_payment_methods_external"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_payment_methods_appscope_user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_saved_payment_methods_appscope"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "saved_payment_methods"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_profiles_user"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_profiles_appscope"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_billing_profiles_appscope_user"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "billing_profiles"`);

        await queryRunner.query(`
      ALTER TABLE "classified_payments"
      DROP COLUMN IF EXISTS "checkoutSecretToken",
      DROP COLUMN IF EXISTS "checkoutToken",
      DROP COLUMN IF EXISTS "externalInvoiceId",
      DROP COLUMN IF EXISTS "externalCustomerId",
      DROP COLUMN IF EXISTS "externalTransactionId",
      DROP COLUMN IF EXISTS "externalProvider"
    `);
    }
}