import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryTaxonomyAutoCases1794978667755
  implements MigrationInterface
{
  name = 'DirectoryTaxonomyAutoCases1794978667755';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_case" DROP CONSTRAINT "CHK_directory_taxonomy_case_status"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_event" DROP CONSTRAINT "CHK_directory_taxonomy_event_action"`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_taxonomy_run_plan" ("runId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "digest" character(64) NOT NULL, CONSTRAINT "PK_494ca4c59bbdee6a5a888f9901c" PRIMARY KEY ("runId", "scanId", "sourceFileRowNumber"))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_run" ADD "driftedRows" integer NOT NULL DEFAULT '0'`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_case" ADD CONSTRAINT "CHK_directory_taxonomy_case_status_v2" CHECK ("status" IN ('open','assigned','rejected','deferred','dismissed'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_event" ADD CONSTRAINT "CHK_directory_taxonomy_event_action_v2" CHECK ("action" IN ('open','assign','reject','defer','reopen','dismiss','undo'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_event" DROP CONSTRAINT "CHK_directory_taxonomy_event_action_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_case" DROP CONSTRAINT "CHK_directory_taxonomy_case_status_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_run" DROP COLUMN "driftedRows"`
    );
    await queryRunner.query(`DROP TABLE "directory_taxonomy_run_plan"`);
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_event" ADD CONSTRAINT "CHK_directory_taxonomy_event_action" CHECK (((action)::text = ANY ((ARRAY['open'::character varying, 'assign'::character varying, 'reject'::character varying, 'defer'::character varying, 'reopen'::character varying, 'undo'::character varying])::text[])))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_taxonomy_case" ADD CONSTRAINT "CHK_directory_taxonomy_case_status" CHECK (((status)::text = ANY ((ARRAY['open'::character varying, 'assigned'::character varying, 'rejected'::character varying, 'deferred'::character varying])::text[])))`
    );
  }
}
