import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdvertisingCampaignMediaUrl1785000000000
  implements MigrationInterface
{
  name = 'AdvertisingCampaignMediaUrl1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable(
      'advertising_campaign_creatives'
    );
    if (hasTable) {
      await queryRunner.query(
        'ALTER TABLE "advertising_campaign_creatives" ADD COLUMN IF NOT EXISTS "mediaUrl" character varying'
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable(
      'advertising_campaign_creatives'
    );
    if (hasTable) {
      await queryRunner.query(
        'ALTER TABLE "advertising_campaign_creatives" DROP COLUMN IF EXISTS "mediaUrl"'
      );
    }
  }
}
