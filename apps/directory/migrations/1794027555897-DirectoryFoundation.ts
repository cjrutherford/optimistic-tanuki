import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794027555897 implements MigrationInterface {
  name = 'DirectoryFoundation1794027555897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_overture_private_row_revocation" ("scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, CONSTRAINT "PK_a827393904877662ff1a12ce731" PRIMARY KEY ("scanId", "sourceFileRowNumber"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "directory_overture_private_row_revocation"`
    );
  }
}
