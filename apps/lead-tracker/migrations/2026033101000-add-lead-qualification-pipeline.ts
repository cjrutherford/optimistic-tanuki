import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeadQualificationPipeline2026033101000
  implements MigrationInterface
{
  name = 'AddLeadQualificationPipeline2026033101000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "lead_onboarding_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" character varying,
        "profile" jsonb NOT NULL,
        "currentStep" integer NOT NULL DEFAULT 0,
        "completedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_lead_onboarding_profiles_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "lead_qualifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "leadId" uuid NOT NULL,
        "topicId" uuid,
        "relevanceScore" integer,
        "relevanceStatus" text NOT NULL DEFAULT 'unavailable',
        "relevanceReasons" text array NOT NULL DEFAULT '{}',
        "difficultyScore" integer,
        "difficultyStatus" text NOT NULL DEFAULT 'unavailable',
        "difficultyReasons" text array NOT NULL DEFAULT '{}',
        "userFitScore" integer,
        "userFitStatus" text NOT NULL DEFAULT 'unavailable',
        "userFitReasons" text array NOT NULL DEFAULT '{}',
        "finalScore" integer,
        "classification" text NOT NULL DEFAULT 'review',
        "pipelineVersion" text NOT NULL DEFAULT '2.0',
        "analyzedAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_lead_qualifications_leadId" UNIQUE ("leadId"),
        CONSTRAINT "PK_lead_qualifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "lead_qualifications"
      ADD CONSTRAINT "FK_lead_qualifications_lead"
      FOREIGN KEY ("leadId") REFERENCES "leads"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "lead_qualifications"
      ADD CONSTRAINT "FK_lead_qualifications_topic"
      FOREIGN KEY ("topicId") REFERENCES "lead_topics"("id")
      ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lead_qualifications" DROP CONSTRAINT "FK_lead_qualifications_topic"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_qualifications" DROP CONSTRAINT "FK_lead_qualifications_lead"
    `);
    await queryRunner.query(`DROP TABLE "lead_qualifications"`);
    await queryRunner.query(`DROP TABLE "lead_onboarding_profiles"`);
  }
}
