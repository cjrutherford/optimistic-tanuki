import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSocialModerationAudit1791412157642
  implements MigrationInterface
{
  name = 'AddSocialModerationAudit1791412157642';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "content_moderation_action" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "appScope" character varying NOT NULL, "workspaceId" character varying, "action" character varying NOT NULL, "subjectType" character varying NOT NULL, "subjectId" character varying NOT NULL, "reportId" character varying, "actorProfileId" character varying NOT NULL, "details" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_964415b59e88b275bd5a860d556" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "content_moderation_action"`);
  }
}
