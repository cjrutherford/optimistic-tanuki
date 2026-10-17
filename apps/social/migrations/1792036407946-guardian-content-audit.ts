import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianContentAudit1792036407946 implements MigrationInterface {
  name = 'GuardianContentAudit1792036407946';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guardian_content_audit" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorUserId" uuid NOT NULL, "dependentUserId" uuid NOT NULL, "dependentProfileId" uuid NOT NULL, "appId" character varying NOT NULL, "resourceType" character varying NOT NULL, "resourceId" uuid NOT NULL, "operation" character varying NOT NULL, "changedFields" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2e07086ad164415e51bc0ef1ae0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_content_audit_created_at" ON "guardian_content_audit" ("createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_guardian_content_audit_created_at"`
    );
    await queryRunner.query(`DROP TABLE "guardian_content_audit"`);
  }
}
