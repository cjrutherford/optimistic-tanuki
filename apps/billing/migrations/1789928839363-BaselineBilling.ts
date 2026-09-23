import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineBilling1789928839363 implements MigrationInterface {
  name = 'BaselineBilling1789928839363';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "billing_account_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'billing', "profileId" character varying, "name" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bd63fc506d093c2040a78554b0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "usage_block_grant_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'billing', "accountId" character varying NOT NULL, "meterId" character varying NOT NULL, "grantedQuantity" integer NOT NULL, "remainingQuantity" integer NOT NULL, "expiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_417cbed299ded79faf7978e3dab" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "usage_event_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tenantId" character varying NOT NULL, "appScope" character varying NOT NULL DEFAULT 'billing', "meterId" character varying NOT NULL, "eventKey" character varying NOT NULL, "quantity" integer NOT NULL, "occurredAt" TIMESTAMP NOT NULL DEFAULT now(), "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cae2766239e986207fd254cfd33" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_10a165bb25c837e7620f66fcb0" ON "usage_event_entity" ("tenantId", "appScope", "eventKey") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_10a165bb25c837e7620f66fcb0"`
    );
    await queryRunner.query(`DROP TABLE "usage_event_entity"`);
    await queryRunner.query(`DROP TABLE "usage_block_grant_entity"`);
    await queryRunner.query(`DROP TABLE "billing_account_entity"`);
  }
}
