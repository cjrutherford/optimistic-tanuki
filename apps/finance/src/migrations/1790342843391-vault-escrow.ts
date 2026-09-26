import { MigrationInterface, QueryRunner } from 'typeorm';

export class VaultEscrow1790342843391 implements MigrationInterface {
  name = 'VaultEscrow1790342843391';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "finance_tenant_member" DROP CONSTRAINT "FK_finance_tenant_member_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "FK_transaction_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_account_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_item" DROP CONSTRAINT "FK_inventory_item_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "budget" DROP CONSTRAINT "FK_budget_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" DROP CONSTRAINT "FK_recurring_item_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" DROP CONSTRAINT "FK_linked_bank_account_connection"`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" DROP CONSTRAINT "FK_linked_bank_account_finance_account"`
    );
    await queryRunner.query(
      `ALTER TABLE "bank_connection" DROP CONSTRAINT "FK_bank_connection_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_invoice" DROP CONSTRAINT "FK_financial_invoice_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" DROP CONSTRAINT "FK_financial_checkout_session_invoice"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" DROP CONSTRAINT "FK_financial_checkout_session_tenant"`
    );
    await queryRunner.query(
      `CREATE TABLE "vault_escrows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying(512) NOT NULL, "tenantId" character varying(128) NOT NULL, "beneficiary" character varying(255) NOT NULL, "bankName" character varying(255) NOT NULL, "encryptedRoutingNumber" text NOT NULL, "routingNumberIv" character varying(64) NOT NULL, "routingNumberAuthTag" character varying(64) NOT NULL, "encryptedAccountNumber" text NOT NULL, "accountNumberIv" character varying(64) NOT NULL, "accountNumberAuthTag" character varying(64) NOT NULL, "encryptedTotpSecret" text NOT NULL, "totpSecretIv" character varying(64) NOT NULL, "totpSecretAuthTag" character varying(64) NOT NULL, "reference" character varying(255) NOT NULL, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5fa6a0e5ec61c58be544c8725ba" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vault_escrows_tenant_active" ON "vault_escrows" ("tenantId", "active") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_vault_escrows_tenant_token" ON "vault_escrows" ("tenantId", "token") `
    );
    await queryRunner.query(
      `ALTER TABLE "vault_escrows" ENABLE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `ALTER TABLE "vault_escrows" FORCE ROW LEVEL SECURITY`
    );
    await queryRunner.query(
      `CREATE POLICY "vault_escrows_tenant_isolation" ON "vault_escrows" USING ("tenantId" = current_setting('app.current_tenant_id', true)) WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true))`
    );
    await queryRunner.query(
      `ALTER TABLE "finance_tenant_member" ADD CONSTRAINT "FK_53cb1eac8f66929d25f3794fa98" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "FK_59362ae6c545b38be85351a0cca" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_6d5184542539a16abc28d80084e" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_item" ADD CONSTRAINT "FK_093b2a08785c949f2b4ab8efbbb" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "budget" ADD CONSTRAINT "FK_034b1c144f39ab0b3f242f72917" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" ADD CONSTRAINT "FK_cba68c333f3892aeaa1b5e522d2" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" ADD CONSTRAINT "FK_c67d44b013a071cc1bd454a5525" FOREIGN KEY ("connectionId") REFERENCES "bank_connection"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" ADD CONSTRAINT "FK_0620eafe707b3b807f027ec0e9d" FOREIGN KEY ("financeAccountId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_invoice" ADD CONSTRAINT "FK_32f80ef787343850886b43df560" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" ADD CONSTRAINT "FK_064b94e85a828b55821854a3e39" FOREIGN KEY ("invoiceId") REFERENCES "financial_invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" ADD CONSTRAINT "FK_2fd6b7090782397685d8065e333" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" DROP CONSTRAINT "FK_2fd6b7090782397685d8065e333"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" DROP CONSTRAINT "FK_064b94e85a828b55821854a3e39"`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_invoice" DROP CONSTRAINT "FK_32f80ef787343850886b43df560"`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" DROP CONSTRAINT "FK_0620eafe707b3b807f027ec0e9d"`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" DROP CONSTRAINT "FK_c67d44b013a071cc1bd454a5525"`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" DROP CONSTRAINT "FK_cba68c333f3892aeaa1b5e522d2"`
    );
    await queryRunner.query(
      `ALTER TABLE "budget" DROP CONSTRAINT "FK_034b1c144f39ab0b3f242f72917"`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_item" DROP CONSTRAINT "FK_093b2a08785c949f2b4ab8efbbb"`
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_6d5184542539a16abc28d80084e"`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "FK_59362ae6c545b38be85351a0cca"`
    );
    await queryRunner.query(
      `ALTER TABLE "finance_tenant_member" DROP CONSTRAINT "FK_53cb1eac8f66929d25f3794fa98"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_vault_escrows_tenant_token"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_vault_escrows_tenant_active"`
    );
    await queryRunner.query(`DROP TABLE "vault_escrows"`);
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" ADD CONSTRAINT "FK_financial_checkout_session_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_checkout_session" ADD CONSTRAINT "FK_financial_checkout_session_invoice" FOREIGN KEY ("invoiceId") REFERENCES "financial_invoice"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "financial_invoice" ADD CONSTRAINT "FK_financial_invoice_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "bank_connection" ADD CONSTRAINT "FK_bank_connection_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" ADD CONSTRAINT "FK_linked_bank_account_finance_account" FOREIGN KEY ("financeAccountId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" ADD CONSTRAINT "FK_linked_bank_account_connection" FOREIGN KEY ("connectionId") REFERENCES "bank_connection"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" ADD CONSTRAINT "FK_recurring_item_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "budget" ADD CONSTRAINT "FK_budget_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_item" ADD CONSTRAINT "FK_inventory_item_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_account_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "FK_transaction_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "finance_tenant_member" ADD CONSTRAINT "FK_finance_tenant_member_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }
}
