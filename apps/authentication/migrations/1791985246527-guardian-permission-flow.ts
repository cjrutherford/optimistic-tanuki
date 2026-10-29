import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianPermissionFlow1791985246527 implements MigrationInterface {
  name = 'GuardianPermissionFlow1791985246527';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guardian_permission" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "applicantEmail" character varying(320) NOT NULL, "guardianEmail" character varying(320), "dateOfBirth" date, "userId" uuid, "status" character varying(32) NOT NULL, "guardianTokenHash" character varying(64), "resumeTokenHash" character varying(64), "withdrawalTokenHash" character varying(64), "attestationVersion" character varying(128), "attestationText" text, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "attestedAt" TIMESTAMP WITH TIME ZONE, "deleteAfter" TIMESTAMP WITH TIME ZONE, "resumeExpiresAt" TIMESTAMP WITH TIME ZONE, "appId" character varying(64) NOT NULL, "appName" character varying(256) NOT NULL, "uiBaseUrl" character varying(512) NOT NULL, "emailFrom" character varying(320) NOT NULL, "replyTo" character varying(320), CONSTRAINT "UQ_8fecd706f58efae491682c50ed5" UNIQUE ("guardianTokenHash"), CONSTRAINT "UQ_69c7140150d39fc4b14c3ae9bab" UNIQUE ("resumeTokenHash"), CONSTRAINT "UQ_743fae095294a5ab74ead8b1267" UNIQUE ("withdrawalTokenHash"), CONSTRAINT "PK_8305ce84536da38431dee04e66d" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_guardian_permission_user_id" ON "guardian_permission" ("userId") `
    );
    await queryRunner.query(
      `ALTER TABLE "user_entity" ADD "ageEligibilityStatus" character varying(32) NOT NULL DEFAULT 'unassessed'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_entity" DROP COLUMN "ageEligibilityStatus"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guardian_permission_user_id"`
    );
    await queryRunner.query(`DROP TABLE "guardian_permission"`);
  }
}
