import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryExportRevocation1794978715901
  implements MigrationInterface
{
  name = 'DirectoryExportRevocation1794978715901';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" DROP CONSTRAINT "CHK_directory_export_job_status"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_download" DROP CONSTRAINT "CHK_directory_export_download_outcome"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" ADD "exportedSources" jsonb NOT NULL DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" ADD "revokedAt" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" ADD CONSTRAINT "CHK_directory_export_job_status_v2" CHECK ("status" IN ('queued','running','complete','failed','expired','withdrawn','revoked'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_download" ADD CONSTRAINT "CHK_directory_export_download_outcome_v2" CHECK ("outcome" IN ('served','not_ready','expired','withdrawn','revoked','integrity_failed'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_export_download" DROP CONSTRAINT "CHK_directory_export_download_outcome_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" DROP CONSTRAINT "CHK_directory_export_job_status_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" DROP COLUMN "revokedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" DROP COLUMN "exportedSources"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_download" ADD CONSTRAINT "CHK_directory_export_download_outcome" CHECK (((outcome)::text = ANY ((ARRAY['served'::character varying, 'not_ready'::character varying, 'expired'::character varying, 'withdrawn'::character varying, 'integrity_failed'::character varying])::text[])))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_export_job" ADD CONSTRAINT "CHK_directory_export_job_status" CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'running'::character varying, 'complete'::character varying, 'failed'::character varying, 'expired'::character varying, 'withdrawn'::character varying])::text[])))`
    );
  }
}
