import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianPolicyNoticeOutbox1792163157529
  implements MigrationInterface
{
  name = 'GuardianPolicyNoticeOutbox1792163157529';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guardian_policy_notice" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "policyVersion" character varying(128) NOT NULL, "policyUrl" character varying(2048) NOT NULL, "guardianUserId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "nextAttemptAt" TIMESTAMP WITH TIME ZONE NOT NULL, "leaseUntil" TIMESTAMP WITH TIME ZONE, "lastFailureCode" character varying(64), "acceptedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_77a5906598eb23344fc26b4b52f" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_policy_notice_created_at" ON "guardian_policy_notice" ("createdAt") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_policy_notice_delivery" ON "guardian_policy_notice" ("status", "nextAttemptAt") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_guardian_policy_notice_version_guardian" ON "guardian_policy_notice" ("policyVersion", "guardianUserId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_guardian_policy_notice_version_guardian"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guardian_policy_notice_delivery"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guardian_policy_notice_created_at"`
    );
    await queryRunner.query(`DROP TABLE "guardian_policy_notice"`);
  }
}
