import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumModeration1775000001000 implements MigrationInterface {
  name = 'AddForumModeration1775000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "thread" ADD "moderationStatus" character varying NOT NULL DEFAULT 'visible'`
    );
    await queryRunner.query(
      `ALTER TABLE "thread" ADD "moderationNotes" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "thread" ADD "moderatedBy" character varying`
    );
    await queryRunner.query(`ALTER TABLE "thread" ADD "moderatedAt" TIMESTAMP`);
    await queryRunner.query(
      `ALTER TABLE "forum_post" ADD "moderationStatus" character varying NOT NULL DEFAULT 'visible'`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_post" ADD "moderationNotes" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_post" ADD "moderatedBy" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_post" ADD "moderatedAt" TIMESTAMP`
    );
    await queryRunner.query(
      `CREATE TABLE "forum_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporterId" character varying NOT NULL, "contentType" character varying NOT NULL, "contentId" character varying NOT NULL, "reason" character varying NOT NULL, "description" character varying, "status" character varying NOT NULL DEFAULT 'pending', "adminNotes" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7d75d93bfef6d4b802482d0112b" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "forum_report"`);
    await queryRunner.query(
      `ALTER TABLE "forum_post" DROP COLUMN "moderatedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_post" DROP COLUMN "moderatedBy"`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_post" DROP COLUMN "moderationNotes"`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_post" DROP COLUMN "moderationStatus"`
    );
    await queryRunner.query(`ALTER TABLE "thread" DROP COLUMN "moderatedAt"`);
    await queryRunner.query(`ALTER TABLE "thread" DROP COLUMN "moderatedBy"`);
    await queryRunner.query(
      `ALTER TABLE "thread" DROP COLUMN "moderationNotes"`
    );
    await queryRunner.query(
      `ALTER TABLE "thread" DROP COLUMN "moderationStatus"`
    );
  }
}
