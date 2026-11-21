import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1793815352610 implements MigrationInterface {
  name = 'DirectoryFoundation1793815352610';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_town" ("communityId" uuid NOT NULL, "name" character varying NOT NULL, "slug" character varying, "administrativeArea" character varying, "eligible" boolean NOT NULL, "geometryStatus" character varying NOT NULL DEFAULT 'pending', "geometryVersion" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_604668b0aff2005ed450f02832c" PRIMARY KEY ("communityId"))`
    );
    await queryRunner.query(
      `CREATE TABLE "directory_town_geometry" ("communityId" uuid NOT NULL, "version" integer NOT NULL, "boundary" geometry(Geometry,4326) NOT NULL, "source" character varying NOT NULL, "vintage" character varying NOT NULL, "rights" character varying NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a10eb255cf9bff52036440afb76" PRIMARY KEY ("communityId", "version"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_town_geometry"`);
    await queryRunner.query(`DROP TABLE "directory_town"`);
  }
}
