import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794951718340 implements MigrationInterface {
  // Generated against a freshly migrated scratch database. The generator also emitted uuid_generate_v4() -> gen_random_uuid()
  // id-default drift on unrelated tables; that was trimmed because this change does not touch those tables.
  name = 'DirectoryFoundation1794951718340';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_acquisition_run" ("id" uuid NOT NULL, "provider" character varying(32) NOT NULL, "release" character varying(32), "kind" character varying(24) NOT NULL, "townIds" jsonb NOT NULL DEFAULT '[]', "status" character varying(24) NOT NULL DEFAULT 'queued', "blockedReason" character varying(32), "startedById" uuid, "reason" character varying(1024) NOT NULL DEFAULT '', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "startedAt" TIMESTAMP WITH TIME ZONE, "heartbeatAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "observedCount" bigint NOT NULL DEFAULT '0', "acceptedCount" bigint NOT NULL DEFAULT '0', "rejectedCount" bigint NOT NULL DEFAULT '0', "budgetReservedCents" integer NOT NULL DEFAULT '0', "budgetUsedCents" integer NOT NULL DEFAULT '0', "lastError" character varying(256), CONSTRAINT "CHK_directory_acquisition_run_kind" CHECK ("kind" IN ('overture-stage','poc-import','census-stage','historical')), CONSTRAINT "CHK_directory_acquisition_run_status" CHECK ("status" IN ('queued','running','succeeded','succeeded_empty','partial','blocked','failed_retryable','failed_permanent','cancel_requested','cancelled')), CONSTRAINT "PK_8da72cfbb8bfb81df515dfa7263" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_acquisition_run_status" ON "directory_acquisition_run" ("status", "createdAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_acquisition_run_job" ("runId" uuid NOT NULL, "unitKey" character varying(64) NOT NULL, "townId" uuid, "scanId" character varying(64), "status" character varying(24) NOT NULL DEFAULT 'queued', "blockedReason" character varying(32), "checkpoint" jsonb, "attempt" integer NOT NULL DEFAULT '0', "observedCount" bigint NOT NULL DEFAULT '0', "acceptedCount" bigint NOT NULL DEFAULT '0', "rejectedCount" bigint NOT NULL DEFAULT '0', "lastError" character varying(256), "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_acquisition_run_job_status" CHECK ("status" IN ('queued','running','succeeded','succeeded_empty','partial','blocked','failed_retryable','failed_permanent','cancelled')), CONSTRAINT "PK_5b807ba686af9edd2d7edeccd3a" PRIMARY KEY ("runId", "unitKey"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_acquisition_run_job_town" ON "directory_acquisition_run_job" ("townId") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_acquisition_run_event" ("id" uuid NOT NULL, "runId" uuid, "action" character varying(16) NOT NULL, "actorId" uuid, "reason" character varying(1024) NOT NULL, "unitKey" character varying(64), "statusBefore" character varying(24), "statusAfter" character varying(24), "ofEventId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_acquisition_run_event_action" CHECK ("action" IN ('cancel','resume','retry','import_history','consumed')), CONSTRAINT "PK_6fcd8ec87c873c804f7e637d863" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_acquisition_run_event_consumed" ON "directory_acquisition_run_event" ("ofEventId") WHERE "ofEventId" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_acquisition_run_event_run" ON "directory_acquisition_run_event" ("runId", "createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_acquisition_run_event_run"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_acquisition_run_event_consumed"`
    );
    await queryRunner.query(`DROP TABLE "directory_acquisition_run_event"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_acquisition_run_job_town"`
    );
    await queryRunner.query(`DROP TABLE "directory_acquisition_run_job"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_acquisition_run_status"`
    );
    await queryRunner.query(`DROP TABLE "directory_acquisition_run"`);
  }
}
