import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryBoundaryLock1795024683148 implements MigrationInterface {
  name = 'DirectoryBoundaryLock1795024683148';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_boundary_lock" ("communityId" uuid NOT NULL, "version" integer NOT NULL, "geoid" character varying(10) NOT NULL, "layer" character varying(6) NOT NULL, "vintage" character varying(4) NOT NULL, "stateFips" character varying(2) NOT NULL, "archiveSha256" character varying(64) NOT NULL, "geometryHash" character varying(64) NOT NULL, "evidenceHash" character varying(64) NOT NULL, "sourceUrl" character varying(2048) NOT NULL, "evidence" jsonb NOT NULL, "lockedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_de38f3b5d8539739add56d405df" PRIMARY KEY ("communityId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_boundary_lock"`);
  }
}
