import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794260740862 implements MigrationInterface {
  name = 'DirectoryFoundation1794260740862';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_listing_identity" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "communityId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, CONSTRAINT "PK_d2f4f71abc02702ad88ee5d4207" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_listing_identity_source" ON "directory_listing_identity" ("communityId", "scanId", "sourceFileRowNumber") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_listing_identity_source"`
    );
    await queryRunner.query(`DROP TABLE "directory_listing_identity"`);
  }
}
