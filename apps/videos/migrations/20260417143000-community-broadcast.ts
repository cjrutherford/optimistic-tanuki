import { MigrationInterface, QueryRunner } from 'typeorm';
import { Initial1770152975983 } from './1770152975983-initial';

export class CommunityBroadcast20260417143000 implements MigrationInterface {
  name = 'CommunityBroadcast20260417143000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasChannelTable = await queryRunner.hasTable('channel');

    if (!hasChannelTable) {
      await new Initial1770152975983().up(queryRunner);
    }

    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "communityId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "communitySlug" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "joinPolicy" character varying NOT NULL DEFAULT 'public'`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "appScope" character varying NOT NULL DEFAULT 'video-client'`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "memberCount" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "isPublic" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ADD COLUMN IF NOT EXISTS "timezone" character varying(100)`,
    );
    await queryRunner.query(
      `WITH normalized AS (
        SELECT
          "id",
          COALESCE(NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'channel') AS "baseSlug",
          row_number() OVER (
            PARTITION BY COALESCE(NULLIF(trim(both '-' from regexp_replace(lower("name"), '[^a-z0-9]+', '-', 'g')), ''), 'channel')
            ORDER BY "id"
          ) AS "slug_rank"
        FROM "channel"
        WHERE "communityId" IS NULL
      )
      UPDATE "channel" c
      SET
        "communityId" = c."id",
        "communitySlug" = CASE
          WHEN normalized."slug_rank" = 1 THEN normalized."baseSlug"
          ELSE normalized."baseSlug" || '-' || normalized."slug_rank"::text
        END,
        "memberCount" = 1,
        "timezone" = 'UTC'
      FROM normalized
      WHERE c."id" = normalized."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" ALTER COLUMN "communityId" SET NOT NULL`,
    );
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_channel_communityId'
        ) THEN
          ALTER TABLE "channel" ADD CONSTRAINT "UQ_channel_communityId" UNIQUE ("communityId");
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_channel_communitySlug'
        ) THEN
          ALTER TABLE "channel" ADD CONSTRAINT "UQ_channel_communitySlug" UNIQUE ("communitySlug");
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "video" ADD COLUMN IF NOT EXISTS "communityId" character varying`,
    );
    await queryRunner.query(
      `UPDATE "video" v SET "communityId" = c."communityId" FROM "channel" c WHERE c."id" = v."channelId" AND v."communityId" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "channel_feed" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channelId" uuid NOT NULL,
        "communityId" character varying NOT NULL,
        "timezone" character varying(100) NOT NULL DEFAULT 'UTC',
        "currentMode" character varying(20) NOT NULL DEFAULT 'offline',
        "activeProgramBlockId" uuid,
        "activeLiveSessionId" uuid,
        "activeVideoId" uuid,
        "lastTransitionAt" TIMESTAMP NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_feed" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_channel_feed_channelId" UNIQUE ("channelId"),
        CONSTRAINT "UQ_channel_feed_communityId" UNIQUE ("communityId")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "channel_feed" ("channelId", "communityId", "timezone", "currentMode", "lastTransitionAt")
      SELECT "id", "communityId", COALESCE("timezone", 'UTC'), 'offline', now()
      FROM "channel"
      ON CONFLICT ("channelId") DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "program_block" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "communityId" character varying NOT NULL,
        "channelId" uuid NOT NULL,
        "videoId" uuid,
        "blockType" character varying(20) NOT NULL DEFAULT 'prerecorded',
        "title" character varying(200) NOT NULL,
        "description" text,
        "status" character varying(20) NOT NULL DEFAULT 'scheduled',
        "startsAt" TIMESTAMP NOT NULL,
        "endsAt" TIMESTAMP NOT NULL,
        "actualStartAt" TIMESTAMP,
        "actualEndAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_program_block" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "live_session" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "communityId" character varying NOT NULL,
        "channelId" uuid,
        "title" character varying(200) NOT NULL,
        "description" text,
        "status" character varying(20) NOT NULL DEFAULT 'live',
        "startedByUserId" character varying NOT NULL,
        "startedByProfileId" character varying NOT NULL,
        "startedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "endedAt" TIMESTAMP,
        "thumbnailAssetId" character varying,
        "liveSourceUrl" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_live_session" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_channel_feed_channel'
        ) THEN
          ALTER TABLE "channel_feed"
          ADD CONSTRAINT "FK_channel_feed_channel"
          FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "channel_feed" DROP CONSTRAINT "FK_channel_feed_channel"`,
    );
    await queryRunner.query(`DROP TABLE "live_session"`);
    await queryRunner.query(`DROP TABLE "program_block"`);
    await queryRunner.query(`DROP TABLE "channel_feed"`);
    await queryRunner.query(`ALTER TABLE "video" DROP COLUMN "communityId"`);
    await queryRunner.query(
      `ALTER TABLE "channel" DROP CONSTRAINT "UQ_channel_communitySlug"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel" DROP CONSTRAINT "UQ_channel_communityId"`,
    );
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "timezone"`);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "isPublic"`);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "memberCount"`);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "appScope"`);
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "joinPolicy"`);
    await queryRunner.query(
      `ALTER TABLE "channel" DROP COLUMN "communitySlug"`,
    );
    await queryRunner.query(`ALTER TABLE "channel" DROP COLUMN "communityId"`);
  }
}
