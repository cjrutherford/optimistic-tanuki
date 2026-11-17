import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794054532463 implements MigrationInterface {
  name = 'DirectoryFoundation1794054532463';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_overture_private_completion" ("scanId" character varying(64) NOT NULL, CONSTRAINT "PK_5f65250d3fae0024c1e362772a3" PRIMARY KEY ("scanId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "directory_overture_private_completion"`
    );
  }
}
