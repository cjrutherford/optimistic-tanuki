import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinancialUtilities1771500000000 implements MigrationInterface {
  name = 'FinancialUtilities1771500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "financial_invoice" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "invoiceNumber" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'business', "customerName" character varying NOT NULL, "customerEmail" character varying, "currency" character varying(3) NOT NULL DEFAULT 'USD', "lines" jsonb NOT NULL, "subtotal" numeric(15,2) NOT NULL DEFAULT '0', "total" numeric(15,2) NOT NULL DEFAULT '0', "amountPaid" numeric(15,2) NOT NULL DEFAULT '0', "status" character varying NOT NULL DEFAULT 'draft', "dueDate" TIMESTAMP, "sentAt" TIMESTAMP, "paidAt" TIMESTAMP, "notes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_financial_invoice_number" UNIQUE ("invoiceNumber"), CONSTRAINT "PK_financial_invoice" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "financial_checkout_session" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'business', "invoiceId" uuid, "amount" numeric(15,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'USD', "customerName" character varying NOT NULL, "customerEmail" character varying, "description" text, "providerReference" character varying, "providerCheckoutUrl" text, "status" character varying NOT NULL DEFAULT 'pending_provider', "successUrl" text, "cancelUrl" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_financial_checkout_session" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_invoice" ADD CONSTRAINT "FK_financial_invoice_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" ADD CONSTRAINT "FK_financial_checkout_session_invoice" FOREIGN KEY ("invoiceId") REFERENCES "financial_invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" ADD CONSTRAINT "FK_financial_checkout_session_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" DROP CONSTRAINT "FK_financial_checkout_session_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" DROP CONSTRAINT "FK_financial_checkout_session_invoice"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_invoice" DROP CONSTRAINT "FK_financial_invoice_tenant"`
    );
    await queryRunner.query(`DROP TABLE "financial_checkout_session"`);
    await queryRunner.query(`DROP TABLE "financial_invoice"`);
  }
}
