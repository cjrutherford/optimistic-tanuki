import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryTownRefresh1795017215166 implements MigrationInterface {
  name = 'DirectoryTownRefresh1795017215166';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_acquisition_town_request" ("id" uuid NOT NULL, "provider" character varying(16) NOT NULL, "communityId" uuid NOT NULL, "actorId" uuid, "reason" character varying(1024) NOT NULL, "requestedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "consumedAt" TIMESTAMP WITH TIME ZONE, "runId" uuid, CONSTRAINT "CHK_directory_acquisition_town_request_provider" CHECK ("provider" IN ('overture','alltheplaces')), CONSTRAINT "PK_efa98f0f49efffac1ed58bec7df" PRIMARY KEY ("id", "provider"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_acquisition_town_request_pending" ON "directory_acquisition_town_request" ("communityId", "provider") WHERE "consumedAt" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_town_scan_target" ADD "geometryVersion" integer`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_town_scan_target" DROP COLUMN "geometryVersion"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_acquisition_town_request_pending"`
    );
    await queryRunner.query(`DROP TABLE "directory_acquisition_town_request"`);
  }
}
