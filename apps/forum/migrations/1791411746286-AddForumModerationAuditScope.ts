import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForumModerationAuditScope1791411746286
  implements MigrationInterface
{
  name = 'AddForumModerationAuditScope1791411746286';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "forum_moderation_action" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "appScope" character varying NOT NULL, "action" character varying NOT NULL, "subjectType" character varying NOT NULL, "subjectId" character varying NOT NULL, "actorProfileId" character varying NOT NULL, "details" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_531611f1c44d1dbddeeefdb44bb" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_report" ADD "appScope" character varying`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "forum_report" DROP COLUMN "appScope"`
    );
    await queryRunner.query(`DROP TABLE "forum_moderation_action"`);
  }
}
