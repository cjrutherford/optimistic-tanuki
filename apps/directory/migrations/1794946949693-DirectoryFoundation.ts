import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * S7b review decisions. The column and index statements are what `typeorm migration:generate` produced; its
 * output also carried unrelated `id` default drift (uuid_generate_v4 vs gen_random_uuid), which is omitted here.
 * TypeORM does not diff CHECK constraints, so the two that must admit the new `undo` action and `undone` event
 * kind are replaced explicitly.
 */
export class DirectoryFoundation1794946949693 implements MigrationInterface {
  name = 'DirectoryFoundation1794946949693';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_address_review_decision" ADD "undoOf" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" ADD "undoOf" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" ADD "snapshot" jsonb`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_address_review_decision_undo" ON "directory_address_review_decision" ("undoOf") WHERE "undoOf" IS NOT NULL`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_business_identity_decision_undo" ON "directory_business_identity_decision" ("undoOf") WHERE "undoOf" IS NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" DROP CONSTRAINT "CHK_directory_business_identity_decision_action"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" ADD CONSTRAINT "CHK_directory_business_identity_decision_action" CHECK ("action" IN ('confirm','merge','split','retire','undo'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_event" DROP CONSTRAINT "CHK_directory_business_event_kind"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_event" ADD CONSTRAINT "CHK_directory_business_event_kind" CHECK ("kind" IN ('created','carried','corroborated','confirmed','unresolved','retired','merged','split','undone'))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_business_event" DROP CONSTRAINT "CHK_directory_business_event_kind"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_event" ADD CONSTRAINT "CHK_directory_business_event_kind" CHECK ("kind" IN ('created','carried','corroborated','confirmed','unresolved','retired','merged','split'))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" DROP CONSTRAINT "CHK_directory_business_identity_decision_action"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" ADD CONSTRAINT "CHK_directory_business_identity_decision_action" CHECK ("action" IN ('confirm','merge','split','retire'))`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_business_identity_decision_undo"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_address_review_decision_undo"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" DROP COLUMN "snapshot"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_business_identity_decision" DROP COLUMN "undoOf"`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_address_review_decision" DROP COLUMN "undoOf"`
    );
  }
}
