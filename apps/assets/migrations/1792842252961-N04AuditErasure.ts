import { MigrationInterface, QueryRunner } from 'typeorm';

export class N04AuditErasure1792842252961 implements MigrationInterface {
  name = 'N04AuditErasure1792842252961';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "actorUserId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "dependentUserId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "profileId" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "assetId" DROP NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "assetId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "profileId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "dependentUserId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "actorUserId" SET NOT NULL`
    );
  }
}
