import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryAtpGeoapify1794994739098 implements MigrationInterface {
  name = 'DirectoryAtpGeoapify1794994739098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_provider_status" ("provider" character varying(32) NOT NULL, "status" character varying(24) NOT NULL, "detail" character varying(256) NOT NULL DEFAULT '', "checkedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d4cbd753a2fc55ab6df80c07b2" PRIMARY KEY ("provider"))`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_geoapify_enrichment" ("scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "details" jsonb NOT NULL, "fetchedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_b95f6899ff645371a9ba338595f" PRIMARY KEY ("scanId", "sourceFileRowNumber"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_directory_geoapify_enrichment_expiry" ON "directory_geoapify_enrichment" ("expiresAt") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_directory_geoapify_enrichment_expiry"`
    );
    await queryRunner.query(`DROP TABLE "directory_geoapify_enrichment"`);
    await queryRunner.query(`DROP TABLE "directory_provider_status"`);
  }
}
