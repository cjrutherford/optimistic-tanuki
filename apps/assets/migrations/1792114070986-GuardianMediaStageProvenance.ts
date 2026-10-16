import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianMediaStageProvenance1792114070986
  implements MigrationInterface
{
  name = 'GuardianMediaStageProvenance1792114070986';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "originKind" character varying NOT NULL DEFAULT 'ordinary'`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "originProfileId" uuid`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "originAppId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ALTER COLUMN "audienceCommunityIds" SET DEFAULT '[]'::jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ALTER COLUMN "audienceRestrictions" SET DEFAULT '[]'::jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "changedFieldNames" SET DEFAULT '[]'::jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD CONSTRAINT "CHK_asset_guardian_origin_scope" CHECK (("originKind" = 'ordinary' AND "originProfileId" IS NULL AND "originAppId" IS NULL) OR ("originKind" = 'guardian-staged' AND "originProfileId"::text = "profileId" AND "originAppId" IN ('client-interface', 'local-hub')))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP CONSTRAINT "CHK_asset_guardian_origin_scope"`
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_asset_activity" ALTER COLUMN "changedFieldNames" SET DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ALTER COLUMN "audienceRestrictions" SET DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ALTER COLUMN "audienceCommunityIds" SET DEFAULT '[]'`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "originAppId"`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "originProfileId"`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "originKind"`
    );
  }
}
