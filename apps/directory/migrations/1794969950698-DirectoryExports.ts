import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryExports1794969950698 implements MigrationInterface {
  name = 'DirectoryExports1794969950698';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_export_job" ("id" uuid NOT NULL, "actorId" uuid, "releaseId" character varying(100) NOT NULL, "scope" jsonb NOT NULL DEFAULT '{}', "format" character varying(16) NOT NULL DEFAULT 'jsonl', "requestHash" character(64) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'queued', "attempts" integer NOT NULL DEFAULT '0', "leaseToken" uuid, "leaseExpiresAt" TIMESTAMP WITH TIME ZONE, "errorCode" character varying(64), "rowCount" integer NOT NULL DEFAULT '0', "excludedRows" integer NOT NULL DEFAULT '0', "byteCount" bigint NOT NULL DEFAULT '0', "sha256" character(64), "artifactName" character varying(200), "schemaVersion" character varying(64) NOT NULL DEFAULT 'town-square-directory-export/v1', "scanIds" jsonb NOT NULL DEFAULT '[]', "expiresAt" TIMESTAMP WITH TIME ZONE, "completedAt" TIMESTAMP WITH TIME ZONE, "withdrawnAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_export_job_status" CHECK ("status" IN ('queued','running','complete','failed','expired','withdrawn')), CONSTRAINT "PK_56f440239d0e83294d0dc66e59c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_export_job_status" ON "directory_export_job" ("status", "updatedAt") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_export_download" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "jobId" uuid NOT NULL, "actorId" uuid, "outcome" character varying(16) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_export_download_outcome" CHECK ("outcome" IN ('served','not_ready','expired','withdrawn','integrity_failed')), CONSTRAINT "PK_b56309a781dcf020a0ad0d336a7" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_export_download_job" ON "directory_export_download" ("jobId", "createdAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_export_download_job"`
    );
    await queryRunner.query(`DROP TABLE "directory_export_download"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_export_job_status"`
    );
    await queryRunner.query(`DROP TABLE "directory_export_job"`);
  }
}
