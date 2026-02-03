import { MigrationInterface, QueryRunner } from "typeorm";

export class Initial1770152975983 implements MigrationInterface {
    name = 'Initial1770152975983'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "video_view" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "videoId" uuid NOT NULL, "userId" character varying, "profileId" character varying, "ipAddress" character varying, "watchDurationSeconds" integer, "viewedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6902548160655a376f5d3705de0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "video" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "assetId" character varying NOT NULL, "thumbnailAssetId" character varying, "channelId" uuid NOT NULL, "durationSeconds" integer, "resolution" character varying, "encoding" character varying, "viewCount" integer NOT NULL DEFAULT '0', "likeCount" integer NOT NULL DEFAULT '0', "visibility" character varying NOT NULL DEFAULT 'public', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "publishedAt" TIMESTAMP, CONSTRAINT "PK_1a2f3856250765d72e7e1636c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "channel_subscription" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "channelId" uuid NOT NULL, "userId" character varying NOT NULL, "profileId" character varying NOT NULL, "subscribedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b46ebd4120b9bc33dbb2cde23cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "channel" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "profileId" character varying NOT NULL, "userId" character varying NOT NULL, "bannerAssetId" character varying, "avatarAssetId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_590f33ee6ee7d76437acf362e39" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "video_view" ADD CONSTRAINT "FK_86d596e576b782c3e486327dfcf" FOREIGN KEY ("videoId") REFERENCES "video"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "video" ADD CONSTRAINT "FK_2edd2d5b91d15d5262356ab2a5b" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "channel_subscription" ADD CONSTRAINT "FK_8ce6427ce49d80b46235eb6d554" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "channel_subscription" DROP CONSTRAINT "FK_8ce6427ce49d80b46235eb6d554"`);
        await queryRunner.query(`ALTER TABLE "video" DROP CONSTRAINT "FK_2edd2d5b91d15d5262356ab2a5b"`);
        await queryRunner.query(`ALTER TABLE "video_view" DROP CONSTRAINT "FK_86d596e576b782c3e486327dfcf"`);
        await queryRunner.query(`DROP TABLE "channel"`);
        await queryRunner.query(`DROP TABLE "channel_subscription"`);
        await queryRunner.query(`DROP TABLE "video"`);
        await queryRunner.query(`DROP TABLE "video_view"`);
    }

}
