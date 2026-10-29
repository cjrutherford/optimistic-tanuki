import { MigrationInterface, QueryRunner } from 'typeorm';

export class N04AuditErasure1792842249946 implements MigrationInterface {
  name = 'N04AuditErasure1792842249946';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guardian_profile_activity" ALTER COLUMN "actorUserId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_profile_activity" ALTER COLUMN "dependentUserId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_profile_activity" ALTER COLUMN "profileId" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guardian_profile_activity" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_profile_activity" ALTER COLUMN "dependentUserId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_profile_activity" ALTER COLUMN "actorUserId" SET NOT NULL`
    );
  }
}
