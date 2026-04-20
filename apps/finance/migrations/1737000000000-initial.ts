import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1737000000000 implements MigrationInterface {
  name = 'Initial1737000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "finance_tenant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "profileId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_finance_tenant_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "finance_tenant_member" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" uuid NOT NULL, "profileId" character varying NOT NULL, "role" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_finance_tenant_member_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" character varying NOT NULL, "balance" numeric(15,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'personal', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "description" text, "lastReviewedAt" TIMESTAMP, CONSTRAINT "PK_54115ee388cdb6d86bb4bf5b2ea" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "transaction" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(15,2) NOT NULL, "type" character varying NOT NULL, "category" character varying, "description" text, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'personal', "accountId" uuid NOT NULL, "transactionDate" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "reference" character varying, "isRecurring" boolean NOT NULL DEFAULT false, "payeeOrVendor" character varying, "transferType" character varying, CONSTRAINT "PK_89eadb93a89810556e1cbcd6ab9" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "inventory_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "quantity" integer NOT NULL DEFAULT '0', "unitValue" numeric(15,2) NOT NULL DEFAULT '0', "totalValue" numeric(15,2) NOT NULL DEFAULT '0', "category" character varying NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'net-worth', "sku" character varying, "location" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_a1e8b0c0c18e4f4d8e0f4c0e1d5" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "budget" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "category" character varying NOT NULL, "limit" numeric(15,2) NOT NULL, "spent" numeric(15,2) NOT NULL DEFAULT '0', "period" character varying NOT NULL, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'personal', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, "alertOnExceed" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_9af87bcfd2de21bd9630dddaa0e" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "recurring_item" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "amount" numeric(15,2) NOT NULL, "type" character varying NOT NULL, "category" character varying, "cadence" character varying NOT NULL, "nextDueDate" TIMESTAMP NOT NULL, "status" character varying NOT NULL DEFAULT 'scheduled', "payeeOrVendor" character varying, "notes" text, "accountId" uuid, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "workspace" character varying NOT NULL DEFAULT 'personal', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_3dbe4a6454d51dd9f504b365584" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "finance_tenant_member" ADD CONSTRAINT "FK_finance_tenant_member_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "FK_account_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "FK_transaction_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_item" ADD CONSTRAINT "FK_inventory_item_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "budget" ADD CONSTRAINT "FK_budget_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" ADD CONSTRAINT "FK_recurring_item_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD CONSTRAINT "FK_3d6e89b14baa44a71870450d14d" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "FK_3d6e89b14baa44a71870450d14d"`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" DROP CONSTRAINT "FK_recurring_item_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "budget" DROP CONSTRAINT "FK_budget_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_item" DROP CONSTRAINT "FK_inventory_item_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" DROP CONSTRAINT "FK_transaction_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT "FK_account_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "finance_tenant_member" DROP CONSTRAINT "FK_finance_tenant_member_tenant"`
    );
    await queryRunner.query(`DROP TABLE "recurring_item"`);
    await queryRunner.query(`DROP TABLE "budget"`);
    await queryRunner.query(`DROP TABLE "inventory_item"`);
    await queryRunner.query(`DROP TABLE "transaction"`);
    await queryRunner.query(`DROP TABLE "account"`);
    await queryRunner.query(`DROP TABLE "finance_tenant_member"`);
    await queryRunner.query(`DROP TABLE "finance_tenant"`);
  }
}
