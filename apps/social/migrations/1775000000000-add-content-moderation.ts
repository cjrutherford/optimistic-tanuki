import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContentModeration1775000000000 implements MigrationInterface {
  name = 'AddContentModeration1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "post" ADD "moderationStatus" character varying NOT NULL DEFAULT 'visible'`
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "moderationNotes" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "post" ADD "moderatedBy" character varying`
    );
    await queryRunner.query(`ALTER TABLE "post" ADD "moderatedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "comment" ADD "moderationStatus" character varying NOT NULL DEFAULT 'visible'`
    );
    await queryRunner.query(
      `ALTER TABLE "comment" ADD "moderationNotes" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "comment" ADD "moderatedBy" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "comment" ADD "moderatedAt" TIMESTAMP`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "moderatedAt"`);
    await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "moderatedBy"`);
    await queryRunner.query(
      `ALTER TABLE "comment" DROP COLUMN "moderationNotes"`
    );
    await queryRunner.query(
      `ALTER TABLE "comment" DROP COLUMN "moderationStatus"`
    );
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "moderatedAt"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "moderatedBy"`);
    await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "moderationNotes"`);
    await queryRunner.query(
      `ALTER TABLE "post" DROP COLUMN "moderationStatus"`
    );
  }
}
