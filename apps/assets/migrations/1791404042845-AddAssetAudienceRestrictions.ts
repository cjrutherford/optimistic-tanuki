import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssetAudienceRestrictions1791404042845
  implements MigrationInterface
{
  name = 'AddAssetAudienceRestrictions1791404042845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "audienceRestrictions" jsonb NOT NULL DEFAULT '[]'::jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ALTER COLUMN "audienceCommunityIds" SET DEFAULT '[]'::jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ALTER COLUMN "audienceCommunityIds" SET DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "audienceRestrictions"`
    );
  }
}
