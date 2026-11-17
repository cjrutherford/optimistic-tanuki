import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794796724646 implements MigrationInterface {
  name = 'DirectoryFoundation1794796724646';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_reviewed_spatial" ("scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "bindingId" uuid NOT NULL, "communityId" uuid NOT NULL, "point" geometry(Point,4326), "listingDigest" character varying(32) NOT NULL, "validatorVersion" integer NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9076d0858c3d373e2c4094477e8" PRIMARY KEY ("scanId", "sourceFileRowNumber"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_reviewed_spatial_point" ON "directory_reviewed_spatial" USING GiST ("point") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_reviewed_spatial_town_keyset" ON "directory_reviewed_spatial" ("communityId", "scanId", "sourceFileRowNumber") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_reviewed_spatial_binding" ON "directory_reviewed_spatial" ("bindingId") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_reviewed_spatial_state" ("id" character varying(16) NOT NULL, "validatorVersion" integer NOT NULL, "rebuildStartedAt" TIMESTAMP WITH TIME ZONE, "rebuildCompletedAt" TIMESTAMP WITH TIME ZONE, "reconciledAt" TIMESTAMP WITH TIME ZONE, "missing" integer NOT NULL DEFAULT '0', "stale" integer NOT NULL DEFAULT '0', "orphaned" integer NOT NULL DEFAULT '0', CONSTRAINT "CHK_directory_reviewed_spatial_state_singleton" CHECK ("id" = 'current'), CONSTRAINT "PK_5b7fc66638b2c3e38bda595daa8" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_reviewed_spatial_state"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_reviewed_spatial_binding"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_reviewed_spatial_town_keyset"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_reviewed_spatial_point"`
    );
    await queryRunner.query(`DROP TABLE "directory_reviewed_spatial"`);
  }
}
