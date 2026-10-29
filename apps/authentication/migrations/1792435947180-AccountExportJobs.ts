import { MigrationInterface, QueryRunner } from 'typeorm';

export class AccountExportJobs1792435947180 implements MigrationInterface {
  name = 'AccountExportJobs1792435947180';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "account_export_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "accountId" uuid NOT NULL, "appId" character varying(120) NOT NULL, "kind" character varying(16) NOT NULL DEFAULT 'export', "idempotencyKey" uuid NOT NULL, "state" character varying(24) NOT NULL DEFAULT 'incomplete', "coverageVersion" character varying(48) NOT NULL DEFAULT '2026-10-17.v1', "attempt" integer NOT NULL DEFAULT '0', "leaseOwner" character varying(36), "leaseExpiresAt" TIMESTAMP WITH TIME ZONE, "coverageSummary" jsonb NOT NULL DEFAULT '{}'::jsonb, "lastErrorCode" character varying(100), "completedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_16b48511a5faa3e2ab040acec32" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "ix_account_export_job_active" ON "account_export_jobs" ("accountId", "appId", "kind", "state") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_account_export_job_idempotency" ON "account_export_jobs" ("accountId", "appId", "kind", "idempotencyKey") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."uq_account_export_job_idempotency"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."ix_account_export_job_active"`
    );
    await queryRunner.query(`DROP TABLE "account_export_jobs"`);
  }
}
