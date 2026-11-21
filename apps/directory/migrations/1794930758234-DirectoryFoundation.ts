import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794930758234 implements MigrationInterface {
  name = 'DirectoryFoundation1794930758234';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_town_scan_target" ("communityId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "targetedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, "rowCount" integer, "provenance" character varying(24) NOT NULL, CONSTRAINT "CHK_directory_town_scan_target_provenance" CHECK ("provenance" IN ('recorded','backfill-rows')), CONSTRAINT "PK_c4e1272693cf855c1eec4b0ddd4" PRIMARY KEY ("communityId", "scanId"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_town_scan_target_scan" ON "directory_town_scan_target" ("scanId") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_town_scan_target_scan"`
    );
    await queryRunner.query(`DROP TABLE "directory_town_scan_target"`);
  }
}
