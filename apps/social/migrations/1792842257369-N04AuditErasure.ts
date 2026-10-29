import { MigrationInterface, QueryRunner } from 'typeorm';

export class N04AuditErasure1792842257369 implements MigrationInterface {
  name = 'N04AuditErasure1792842257369';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profile_view" ALTER COLUMN "profileId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_view" ALTER COLUMN "viewerId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "content_moderation_action" ALTER COLUMN "subjectId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "content_moderation_action" ALTER COLUMN "actorProfileId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_membership_audit" ALTER COLUMN "workspaceId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_membership_audit" ALTER COLUMN "subjectId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_membership_audit" ALTER COLUMN "actorId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "actorUserId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "dependentUserId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "dependentProfileId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "resourceId" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "resourceId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "dependentProfileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "dependentUserId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_content_audit" ALTER COLUMN "actorUserId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_membership_audit" ALTER COLUMN "actorId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_membership_audit" ALTER COLUMN "subjectId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "community_membership_audit" ALTER COLUMN "workspaceId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "content_moderation_action" ALTER COLUMN "actorProfileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "content_moderation_action" ALTER COLUMN "subjectId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_view" ALTER COLUMN "viewerId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "profile_view" ALTER COLUMN "profileId" SET NOT NULL`
    );
  }
}
