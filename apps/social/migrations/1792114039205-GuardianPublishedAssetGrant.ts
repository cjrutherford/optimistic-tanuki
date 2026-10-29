import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianPublishedAssetGrant1792114039205
  implements MigrationInterface
{
  name = 'GuardianPublishedAssetGrant1792114039205';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guardian_published_asset_grant" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "assetId" uuid NOT NULL, "resourceType" character varying NOT NULL, "resourceId" uuid NOT NULL, "dependentProfileId" uuid NOT NULL, "appId" character varying NOT NULL, "actorUserId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_67b9d133286e8a1eaf52822987b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_guardian_published_asset_grant_scope" ON "guardian_published_asset_grant" ("assetId", "resourceType", "resourceId", "dependentProfileId", "appId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_guardian_published_asset_grant_scope"`
    );
    await queryRunner.query(`DROP TABLE "guardian_published_asset_grant"`);
  }
}
