import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated. Creates `lead_applications`, which stores generated resume and
 * cover-letter pairs per (profile, lead) with version history — regeneration
 * inserts a new row rather than overwriting, so an earlier draft is recoverable.
 * The evidence report is stored alongside because what the generator *removed*
 * matters as much as what it kept.
 */

export class AddLeadApplications1787227913318 implements MigrationInterface {
  name = 'AddLeadApplications1787227913318';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lead_applications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "leadId" uuid NOT NULL, "profileId" character varying NOT NULL, "userId" character varying, "version" integer NOT NULL DEFAULT '1', "resume" jsonb NOT NULL, "coverLetter" jsonb NOT NULL, "evidence" jsonb NOT NULL, "modelGenerated" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b6a0622ae783133f0879e786d95" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_96c53d98d2501ebf5ecfc13ac1" ON "lead_applications" ("profileId", "leadId", "version") `
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_96c53d98d2501ebf5ecfc13ac1"`
    );
    await queryRunner.query(`DROP TABLE "lead_applications"`);
  }
}
