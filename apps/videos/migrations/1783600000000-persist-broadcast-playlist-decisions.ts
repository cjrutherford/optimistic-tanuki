import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersistBroadcastPlaylistDecisions1783600000000
  implements MigrationInterface
{
  name = 'PersistBroadcastPlaylistDecisions1783600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistKind" character varying(20) NOT NULL DEFAULT 'offline'`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistReason" character varying(120) NOT NULL DEFAULT 'no-playable-source-available'`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistPlacementType" character varying(20)`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistMediaUrl" text`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistDecidedAt" timestamp`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistDecidedAt"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistMediaUrl"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistPlacementType"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistReason"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistKind"`
    );
  }
}
