import { MigrationInterface, QueryRunner } from 'typeorm';

export class N04AuditErasure1792842262217 implements MigrationInterface {
  name = 'N04AuditErasure1792842262217';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "forum_moderation_action" ALTER COLUMN "subjectId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_moderation_action" ALTER COLUMN "actorProfileId" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "forum_moderation_action" ALTER COLUMN "actorProfileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "forum_moderation_action" ALTER COLUMN "subjectId" SET NOT NULL`
    );
  }
}
