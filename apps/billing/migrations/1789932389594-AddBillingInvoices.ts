import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingInvoices1789932389594 implements MigrationInterface {
  name = 'AddBillingInvoices1789932389594';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "billing_invoice_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'billing', "accountId" uuid, "status" character varying NOT NULL DEFAULT 'draft', "currency" character varying(3) NOT NULL DEFAULT 'USD', "subtotalCents" integer NOT NULL DEFAULT '0', "lines" jsonb NOT NULL DEFAULT '[]', "appointmentId" uuid, "orderId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9b6b5dfd6175561a60de2ffa796" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "billing_invoice_entity"`);
  }
}
