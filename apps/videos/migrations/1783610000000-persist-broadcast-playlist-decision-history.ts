import { MigrationInterface, QueryRunner } from 'typeorm';

export class PersistBroadcastPlaylistDecisionHistory1783610000000
  implements MigrationInterface
{
  name = 'PersistBroadcastPlaylistDecisionHistory1783610000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistSessionId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistBlockId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" ADD COLUMN IF NOT EXISTS "activePlaylistVideoId" uuid`
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "playlist_decision_history" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "feedId" uuid NOT NULL,
        "kind" character varying(20) NOT NULL,
        "reason" character varying(120) NOT NULL,
        "sessionId" uuid,
        "blockId" uuid,
        "videoId" uuid,
        "placementType" character varying(20),
        "mediaUrl" text,
        "decidedAt" timestamp NOT NULL,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_playlist_decision_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_playlist_decision_history_feed" FOREIGN KEY ("feedId")
          REFERENCES "channel_feed"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_playlist_decision_history_feed_created" ON "playlist_decision_history" ("feedId", "createdAt")`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "playlist_decision_history"`);
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistVideoId"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistBlockId"`
    );
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP COLUMN IF EXISTS "activePlaylistSessionId"`
    );
  }
}
