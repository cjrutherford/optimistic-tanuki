import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryRunQuality1795053954495 implements MigrationInterface {
  name = 'DirectoryRunQuality1795053954495';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_scan_normalization" ("scanId" character varying(64) NOT NULL, "normalizerVersion" character varying(32) NOT NULL, "rowCount" integer NOT NULL DEFAULT '0', "normalizedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_907d71ed72cd359adc186eb726b" PRIMARY KEY ("scanId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "directory_acquisition_run" ADD "quality" jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "directory_acquisition_run" DROP COLUMN "quality"`
    );
    await queryRunner.query(`DROP TABLE "directory_scan_normalization"`);
  }
}
