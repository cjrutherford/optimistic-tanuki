import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceLegacySponsorshipsWithCampaigns1783510400000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM "community_sponsorships"');
    await queryRunner.query('DROP TABLE "community_sponsorships"');
    await queryRunner.query(`CREATE TABLE "advertising_campaigns" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "businessPageId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "name" character varying NOT NULL,
      "status" character varying NOT NULL DEFAULT 'draft',
      "budget" numeric(10,2),
      "startsAt" TIMESTAMP NOT NULL,
      "endsAt" TIMESTAMP NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_advertising_campaigns" PRIMARY KEY ("id")
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_advertising_campaigns_business_page" ON "advertising_campaigns" ("businessPageId")'
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_advertising_campaigns_user" ON "advertising_campaigns" ("userId")'
    );
    await queryRunner.query(`CREATE TABLE "advertising_campaign_creatives" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "campaignId" uuid NOT NULL,
      "placementType" character varying NOT NULL,
      "headline" character varying,
      "body" text,
      "ctaLabel" character varying,
      "ctaUrl" character varying,
      "imageUrl" character varying,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_advertising_campaign_creatives" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_advertising_campaign_creatives_placement" UNIQUE ("campaignId", "placementType")
    )`);
    await queryRunner.query(`CREATE TABLE "advertising_campaign_target_placements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "campaignId" uuid NOT NULL,
      "targetType" character varying NOT NULL,
      "targetId" uuid NOT NULL,
      "placementType" character varying NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_advertising_campaign_target_placements" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_advertising_campaign_target_placement" UNIQUE ("campaignId", "targetType", "targetId", "placementType"),
      CONSTRAINT "CHK_advertising_community_on_page" CHECK ("targetType" = 'channel' OR "placementType" = 'on-page')
    )`);
    await queryRunner.query(
      'CREATE INDEX "IDX_advertising_target_placement_lookup" ON "advertising_campaign_target_placements" ("targetType", "targetId", "placementType")'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TABLE IF EXISTS "advertising_campaign_target_placements"'
    );
    await queryRunner.query(
      'DROP TABLE IF EXISTS "advertising_campaign_creatives"'
    );
    await queryRunner.query('DROP TABLE IF EXISTS "advertising_campaigns"');
    await queryRunner.query(`CREATE TABLE "community_sponsorships" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "communityId" uuid NOT NULL,
      "businessPageId" uuid, "channelId" uuid, "userId" uuid NOT NULL,
      "type" character varying NOT NULL, "adContent" text, "sponsorName" character varying,
      "sponsorTagline" text, "ctaLabel" character varying, "ctaUrl" character varying,
      "adImageUrl" character varying, "surface" character varying NOT NULL DEFAULT 'local-hub',
      "inventoryStatus" character varying NOT NULL DEFAULT 'pending', "amount" numeric(10,2) NOT NULL,
      "lemonSqueezyOrderId" character varying, "status" character varying NOT NULL DEFAULT 'pending',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "startsAt" TIMESTAMP NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL, "months" integer NOT NULL DEFAULT '1',
      CONSTRAINT "PK_f1cf8b2a7824ae1baa1c4211428" PRIMARY KEY ("id")
    )`);
  }
}
