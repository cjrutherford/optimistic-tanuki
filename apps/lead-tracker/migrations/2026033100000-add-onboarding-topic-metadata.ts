import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOnboardingTopicMetadata2026033100000
  implements MigrationInterface
{
  name = 'AddOnboardingTopicMetadata2026033100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "priority" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "targetCompanies" text array
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "buyerPersona" text
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "painPoints" text array
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "valueProposition" text
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "searchStrategy" text
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD COLUMN IF NOT EXISTS "confidence" integer
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "confidence"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "searchStrategy"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "valueProposition"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "painPoints"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "buyerPersona"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "targetCompanies"
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      DROP COLUMN IF EXISTS "priority"
    `);
  }
}
