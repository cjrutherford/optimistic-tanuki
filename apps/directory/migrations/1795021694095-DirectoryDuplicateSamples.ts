import { MigrationInterface, QueryRunner } from 'typeorm';

export class DirectoryDuplicateSamples1795021694095
  implements MigrationInterface
{
  name = 'DirectoryDuplicateSamples1795021694095';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "directory_duplicate_sample" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "communityId" uuid NOT NULL, "round" character varying(64) NOT NULL, "seed" character varying(64) NOT NULL, "sampleSize" integer NOT NULL, "populationSize" integer NOT NULL, "createdById" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1f261858eeea5838fdeb489cf1c" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_directory_duplicate_sample_round" ON "directory_duplicate_sample" ("communityId", "round") `
    );
    await queryRunner.query(
      `CREATE TABLE "directory_duplicate_sample_item" ("sampleId" uuid NOT NULL, "caseId" uuid NOT NULL, "verdict" character varying(16), "judgedById" uuid, "judgedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_directory_duplicate_sample_item_verdict" CHECK ("verdict" IS NULL OR "verdict" IN ('duplicate','distinct')), CONSTRAINT "PK_c3d99af268fb748a8e8ec3c9c5f" PRIMARY KEY ("sampleId", "caseId"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "directory_duplicate_sample_item"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_directory_duplicate_sample_round"`
    );
    await queryRunner.query(`DROP TABLE "directory_duplicate_sample"`);
  }
}
