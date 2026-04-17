import { MigrationInterface, QueryRunner } from 'typeorm';

export class BankConnections1771000000000 implements MigrationInterface {
  name = 'BankConnections1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bank_connection" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" character varying NOT NULL, "itemId" character varying NOT NULL, "accessToken" text NOT NULL, "institutionId" character varying, "institutionName" character varying, "status" character varying NOT NULL DEFAULT 'healthy', "lastCursor" text, "lastError" text, "lastSuccessfulSyncAt" TIMESTAMP, "lastAttemptedSyncAt" TIMESTAMP, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bank_connection_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "linked_bank_account" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "connectionId" uuid NOT NULL, "financeAccountId" uuid NOT NULL, "providerAccountId" character varying NOT NULL, "name" character varying NOT NULL, "mask" character varying, "subtype" character varying, "providerType" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_linked_bank_account_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "providerConnectionId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "providerAccountId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "institutionName" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "syncStatus" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "account" ADD "lastSyncedAt" TIMESTAMP`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "sourceType" character varying NOT NULL DEFAULT 'manual'`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "sourceProvider" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "externalTransactionId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "pending" boolean NOT NULL DEFAULT false`
    );
    await queryRunner.query(
      `ALTER TABLE "transaction" ADD "reviewStatus" character varying NOT NULL DEFAULT 'needs-review'`
    );
    await queryRunner.query(
      `ALTER TABLE "bank_connection" ADD CONSTRAINT "FK_bank_connection_tenant" FOREIGN KEY ("tenantId") REFERENCES "finance_tenant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" ADD CONSTRAINT "FK_linked_bank_account_connection" FOREIGN KEY ("connectionId") REFERENCES "bank_connection"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" ADD CONSTRAINT "FK_linked_bank_account_finance_account" FOREIGN KEY ("financeAccountId") REFERENCES "account"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" DROP CONSTRAINT "FK_linked_bank_account_finance_account"`
    );
    await queryRunner.query(
      `ALTER TABLE "linked_bank_account" DROP CONSTRAINT "FK_linked_bank_account_connection"`
    );
    await queryRunner.query(
      `ALTER TABLE "bank_connection" DROP CONSTRAINT "FK_bank_connection_tenant"`
    );
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "reviewStatus"`);
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "pending"`);
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "externalTransactionId"`);
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "sourceProvider"`);
    await queryRunner.query(`ALTER TABLE "transaction" DROP COLUMN "sourceType"`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "lastSyncedAt"`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "syncStatus"`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "institutionName"`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "providerAccountId"`);
    await queryRunner.query(`ALTER TABLE "account" DROP COLUMN "providerConnectionId"`);
    await queryRunner.query(`DROP TABLE "linked_bank_account"`);
    await queryRunner.query(`DROP TABLE "bank_connection"`);
  }
}
