import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1770000000000 implements MigrationInterface {
  name = 'InitialSchema1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_program_track" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "trackId" character varying(128) NOT NULL,
        "displayName" character varying(256) NOT NULL,
        "data" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lp_program_track_trackId" UNIQUE ("trackId"),
        CONSTRAINT "PK_lp_program_track" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_attempt" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "offeringId" character varying(128) NOT NULL,
        "activityId" character varying(128) NOT NULL,
        "activityType" character varying(32) NOT NULL,
        "state" character varying(32) NOT NULL DEFAULT 'submitted',
        "isAsync" boolean NOT NULL DEFAULT false,
        "submission" jsonb,
        "submittedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_attempt" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_attempt_userId" ON "lp_attempt" ("userId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_attempt_offeringId" ON "lp_attempt" ("offeringId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_evaluation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "attemptId" uuid NOT NULL,
        "mode" character varying(16) NOT NULL,
        "grader" character varying(16) NOT NULL,
        "score" decimal(10,2) NOT NULL,
        "maxScore" decimal(10,2) NOT NULL,
        "feedback" text NOT NULL,
        "rubric" jsonb,
        "humanOverride" boolean NOT NULL DEFAULT false,
        "evaluatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_evaluation" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_evaluation_attemptId" ON "lp_evaluation" ("attemptId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lp_credit_ledger_entry" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "offeringId" character varying(128) NOT NULL,
        "creditsAwarded" decimal(8,2) NOT NULL,
        "evaluationId" uuid NOT NULL,
        "awardedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lp_credit_ledger_entry" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_lp_credit_ledger_userId" ON "lp_credit_ledger_entry" ("userId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_credit_ledger_entry"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_evaluation"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_attempt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lp_program_track"`);
  }
}
