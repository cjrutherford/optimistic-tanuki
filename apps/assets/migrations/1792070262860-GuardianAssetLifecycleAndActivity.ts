import { MigrationInterface, QueryRunner } from 'typeorm';

export class GuardianAssetLifecycleAndActivity1792070262860
  implements MigrationInterface
{
  name = 'GuardianAssetLifecycleAndActivity1792070262860';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "guardian_asset_activity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorUserId" character varying NOT NULL, "dependentUserId" character varying NOT NULL, "profileId" character varying NOT NULL, "assetId" character varying NOT NULL, "appId" character varying NOT NULL, "operation" character varying NOT NULL, "changedFieldNames" jsonb NOT NULL DEFAULT '[]'::jsonb, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0510e420e6c6b52913a23280017" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3350bb945514eb61e9533da8c4" ON "guardian_asset_activity" ("createdAt") `
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "lifecycleState" character varying NOT NULL DEFAULT 'active'`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "lifecycleLeaseUntil" TIMESTAMP WITH TIME ZONE`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" ADD "lifecycleRetryAfter" TIMESTAMP WITH TIME ZONE`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN IF EXISTS (SELECT 1 FROM "asset_entity" WHERE "lifecycleState" <> 'active') THEN RAISE EXCEPTION 'Complete Assets pending cleanup, then retry migration down'; END IF; END $$`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "lifecycleRetryAfter"`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "lifecycleLeaseUntil"`
    );
    await queryRunner.query(
      `ALTER TABLE "asset_entity" DROP COLUMN "lifecycleState"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3350bb945514eb61e9533da8c4"`
    );
    await queryRunner.query(`DROP TABLE "guardian_asset_activity"`);
  }
}
