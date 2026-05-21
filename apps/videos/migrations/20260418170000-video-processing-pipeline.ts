import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoProcessingPipeline20260418170000
  implements MigrationInterface
{
  name = 'VideoProcessingPipeline20260418170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "sourceAssetId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "playbackAssetId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "hlsManifestAssetId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "processingStatus" character varying NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "processingError" text`,
    );
    await queryRunner.query(
      `UPDATE "video" SET "sourceAssetId" = COALESCE("sourceAssetId", "assetId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "processingError"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "processingStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "hlsManifestAssetId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "playbackAssetId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "video" DROP COLUMN IF EXISTS "sourceAssetId"`,
    );
  }
}
