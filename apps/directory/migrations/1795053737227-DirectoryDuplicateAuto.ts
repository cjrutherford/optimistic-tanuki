import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryDuplicateAuto1795053737227 implements MigrationInterface {
  name = 'DirectoryDuplicateAuto1795053737227';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" DROP CONSTRAINT "CHK_directory_duplicate_case_state"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" DROP CONSTRAINT "CHK_directory_duplicate_case_event_kind"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" ADD "decidedBy" character varying(16)`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" ADD "autoRule" character varying(48)`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" ADD "actorKind" character varying(16) NOT NULL DEFAULT 'system'`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" ADD "ruleId" character varying(48)`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" ADD CONSTRAINT "CHK_directory_duplicate_case_decided_by" CHECK ("decidedBy" IS NULL OR "decidedBy" IN ('reviewer','auto','system'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" ADD CONSTRAINT "CHK_directory_duplicate_case_state_v2" CHECK ("state" IN ('queued','kept_separate','merged','stale'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" ADD CONSTRAINT "CHK_directory_duplicate_case_event_actor_kind" CHECK ("actorKind" IN ('reviewer','auto','system'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" ADD CONSTRAINT "CHK_directory_duplicate_case_event_kind_v2" CHECK ("kind" IN ('queued','kept_separate','merged','undone','auto_merged','closed_stale','swapped'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" DROP CONSTRAINT "CHK_directory_duplicate_case_event_kind_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" DROP CONSTRAINT "CHK_directory_duplicate_case_event_actor_kind"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" DROP CONSTRAINT "CHK_directory_duplicate_case_state_v2"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" DROP CONSTRAINT "CHK_directory_duplicate_case_decided_by"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" DROP COLUMN "ruleId"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" DROP COLUMN "actorKind"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" DROP COLUMN "autoRule"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" DROP COLUMN "decidedBy"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case_event" ADD CONSTRAINT "CHK_directory_duplicate_case_event_kind" CHECK (((kind)::text = ANY ((ARRAY['queued'::character varying, 'kept_separate'::character varying, 'merged'::character varying, 'undone'::character varying])::text[])))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_duplicate_case" ADD CONSTRAINT "CHK_directory_duplicate_case_state" CHECK (((state)::text = ANY ((ARRAY['queued'::character varying, 'kept_separate'::character varying, 'merged'::character varying])::text[])))`
    );
  }
}
