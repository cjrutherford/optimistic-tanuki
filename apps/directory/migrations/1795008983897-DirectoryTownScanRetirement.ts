import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryTownScanRetirement1795008983897
  implements MigrationInterface
{
  name = 'DirectoryTownScanRetirement1795008983897';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_town_scan_retirement" ("communityId" uuid NOT NULL, "scanId" character varying(64) NOT NULL, "reason" text NOT NULL, "actor" character varying(64) NOT NULL, "rowsRevoked" integer NOT NULL, "retiredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_0264cba54d9a60bfbad167b6049" PRIMARY KEY ("communityId", "scanId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_town_scan_retirement"`);
  }
}
