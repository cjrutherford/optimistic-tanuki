import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794018156049 implements MigrationInterface {
  name = 'DirectoryFoundation1794018156049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_overture_private_checkpoint" ("id" integer NOT NULL, "scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, CONSTRAINT "PK_d5855fa955621aef4d1a2e00343" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_overture_private_row" ("scanId" character varying(64) NOT NULL, "sourceFileRowNumber" bigint NOT NULL, "regionId" character varying, "listing" jsonb, CONSTRAINT "PK_c11fc1b07baa0d30a662a954bdc" PRIMARY KEY ("scanId", "sourceFileRowNumber"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_overture_private_row"`);
    await queryRunner.query(
      `DROP TABLE "directory_overture_private_checkpoint"`
    );
  }
}
