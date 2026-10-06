import { MigrationInterface, QueryRunner } from 'typeorm';

export class CivicTenants1791043873312 implements MigrationInterface {
  name = 'CivicTenants1791043873312';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "civic_tenants" ("id" character varying(128) NOT NULL, "displayName" character varying(255) NOT NULL, "townName" character varying(255) NOT NULL, "state" character varying(2) NOT NULL, "kind" character varying(32) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_797d4cac97906bec6fbb58dc6e3" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "civic_tenants"`);
  }
}
