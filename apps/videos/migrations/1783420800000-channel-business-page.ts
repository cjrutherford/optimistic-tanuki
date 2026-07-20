import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChannelBusinessPage1783420800000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "businessPageId" uuid'
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_channel_business_page_id" ON "channel" ("businessPageId")'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_channel_business_page_id"'
    );
    await queryRunner.query(
      'ALTER TABLE "channel" DROP COLUMN IF EXISTS "businessPageId"'
    );
  }
}
