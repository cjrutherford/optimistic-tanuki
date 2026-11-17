import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794057360305 implements MigrationInterface {
  name = 'DirectoryFoundation1794057360305';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_overture_private_policy" ("policyId" character varying(64) NOT NULL, "revoked" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_8792971829035833dedc83e7189" PRIMARY KEY ("policyId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_overture_private_membership" ("scanId" character varying(64) NOT NULL, "policyId" character varying(64) NOT NULL, CONSTRAINT "PK_2423609b2590a636f1349a7690b" PRIMARY KEY ("scanId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "directory_overture_private_membership"`
    );
    await queryRunner.query(`DROP TABLE "directory_overture_private_policy"`);
  }
}
