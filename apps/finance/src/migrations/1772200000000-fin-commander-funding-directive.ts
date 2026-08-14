import { MigrationInterface, QueryRunner } from 'typeorm';

export class FinCommanderFundingDirective1772200000000
  implements MigrationInterface
{
  name = 'FinCommanderFundingDirective1772200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "fin_commander_funding_directive" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "goalId" uuid NOT NULL, "recurringItemId" uuid, "amountCents" integer NOT NULL, "cadence" character varying NOT NULL DEFAULT 'monthly', "startDate" date NOT NULL, "fundingAccountId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'approved', "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "tenantId" uuid NOT NULL, "appScope" character varying NOT NULL DEFAULT 'finance', "approvedAt" TIMESTAMP, "approvedByUserId" character varying, "cancelledAt" TIMESTAMP, "cancelledByUserId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_fin_commander_funding_directive_id" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_goal" ADD COLUMN IF NOT EXISTS "fundingDirectiveId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" ADD COLUMN IF NOT EXISTS "fundingDirectiveId" uuid`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_fin_commander_funding_directive_goal_tenant" ON "fin_commander_funding_directive" ("goalId", "tenantId")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_fin_commander_funding_directive_tenant" ON "fin_commander_funding_directive" ("tenantId", "profileId")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_fin_commander_funding_directive_tenant"`
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "UQ_fin_commander_funding_directive_goal_tenant"`
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_item" DROP COLUMN IF EXISTS "fundingDirectiveId"`
    );
    await queryRunner.query(
      `ALTER TABLE "fin_commander_goal" DROP COLUMN IF EXISTS "fundingDirectiveId"`
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "fin_commander_funding_directive"`
    );
  }
}
