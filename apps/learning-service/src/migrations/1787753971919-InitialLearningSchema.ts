import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialLearningSchema1787753971919 implements MigrationInterface {
  name = 'InitialLearningSchema1787753971919';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lp_attempt" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "offeringId" character varying(128) NOT NULL, "activityId" character varying(128) NOT NULL, "activityType" character varying(32) NOT NULL, "state" character varying(32) NOT NULL DEFAULT 'submitted', "isAsync" boolean NOT NULL DEFAULT false, "submission" jsonb, "submittedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_3dafc11287092fbe1f87e57368b" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "lp_evaluation" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "attemptId" uuid NOT NULL, "mode" character varying(16) NOT NULL, "grader" character varying(16) NOT NULL, "score" numeric(10,2) NOT NULL, "maxScore" numeric(10,2) NOT NULL, "feedback" text NOT NULL, "rubric" jsonb, "humanOverride" boolean NOT NULL DEFAULT false, "recordedByUserId" uuid, "evaluatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c06698884e6517db0ba5343eb71" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "lp_credit_ledger_entry" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "offeringId" character varying(128) NOT NULL, "creditsAwarded" numeric(8,2) NOT NULL, "evaluationId" uuid NOT NULL, "awardedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_76c2ad7c020c2bcf3cbf35666ec" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "lp_program_track" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "trackId" character varying(128) NOT NULL, "displayName" character varying(256) NOT NULL, "data" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_12c4458ca5b04d547cf4a9476b3" UNIQUE ("trackId"), CONSTRAINT "PK_bc8f3186cfe6e93f3d52fab81c0" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE TABLE "lp_enrolment" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "profileId" uuid NOT NULL, "offeringId" character varying(128) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'active', "enrolledAt" TIMESTAMP NOT NULL DEFAULT now(), "withdrawnAt" TIMESTAMP, CONSTRAINT "PK_2b45511a740fdbd354f2dcebf05" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_612811c565c0483634b4d8b631" ON "lp_enrolment" ("profileId", "offeringId") `
    );
    await queryRunner.query(
      `CREATE TABLE "lp_lesson_progress" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "profileId" uuid NOT NULL, "enrolmentId" uuid NOT NULL, "lessonId" character varying(192) NOT NULL, "completed" boolean NOT NULL DEFAULT false, "completedExerciseIds" jsonb NOT NULL DEFAULT '[]', "points" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d0c332dc112cc74e617b9aa76b1" PRIMARY KEY ("id"))`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ae54e51cf4000d1ec64876073d" ON "lp_lesson_progress" ("profileId") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8584efeb040574ea055c86b5b4" ON "lp_lesson_progress" ("userId") `
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_e4d662ff65da77a7cf579536d5" ON "lp_lesson_progress" ("profileId", "lessonId") `
    );
    await queryRunner.query(
      `CREATE TABLE "lp_offering_ownership" ("offeringId" character varying(128) NOT NULL, "ownerProfileId" uuid NOT NULL, "coEditorProfileIds" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9a0d541e16d53e253379468ab5c" PRIMARY KEY ("offeringId"))`
    );
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" ADD CONSTRAINT "FK_78f534c13d069a7cf8684ca1919" FOREIGN KEY ("enrolmentId") REFERENCES "lp_enrolment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lp_lesson_progress" DROP CONSTRAINT "FK_78f534c13d069a7cf8684ca1919"`
    );
    await queryRunner.query(`DROP TABLE "lp_offering_ownership"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_e4d662ff65da77a7cf579536d5"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8584efeb040574ea055c86b5b4"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ae54e51cf4000d1ec64876073d"`
    );
    await queryRunner.query(`DROP TABLE "lp_lesson_progress"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_612811c565c0483634b4d8b631"`
    );
    await queryRunner.query(`DROP TABLE "lp_enrolment"`);
    await queryRunner.query(`DROP TABLE "lp_program_track"`);
    await queryRunner.query(`DROP TABLE "lp_credit_ledger_entry"`);
    await queryRunner.query(`DROP TABLE "lp_evaluation"`);
    await queryRunner.query(`DROP TABLE "lp_attempt"`);
  }
}
