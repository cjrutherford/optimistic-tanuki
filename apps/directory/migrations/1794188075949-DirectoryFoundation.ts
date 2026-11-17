import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryFoundation1794188075949 implements MigrationInterface {
  name = 'DirectoryFoundation1794188075949';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_anonymous_overture_attempt" ("attemptId" uuid NOT NULL, "period" character varying(7) NOT NULL, "policyId" character varying(64) NOT NULL, "assetSha256" character varying(64) NOT NULL, "method" character varying(4) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_directory_anonymous_overture_period" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'), CONSTRAINT "CHK_directory_anonymous_overture_method" CHECK ("method" IN ('GET', 'HEAD')), CONSTRAINT "PK_0beb25e37d7663d5a271a088419" PRIMARY KEY ("attemptId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE "directory_anonymous_overture_attempt"`
    );
  }
}
