import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetAudience1791388918098 implements MigrationInterface {
  name = 'AddAssetAudience1791388918098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "audienceCommunityIds" jsonb NOT NULL DEFAULT '[]'::jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "audienceCommunityIds"`
    );
  }
}
