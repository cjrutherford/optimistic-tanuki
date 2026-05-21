import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTopicIntentAndExcludedTerms2026033000000 implements MigrationInterface {
  name = 'AddTopicIntentAndExcludedTerms2026033000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD "excludedTerms" text array NOT NULL DEFAULT '{}'::text[]
    `);
    await queryRunner.query(`
      ALTER TABLE "lead_topics"
      ADD "discoveryIntent" text NOT NULL DEFAULT 'job-openings'
    `);
    await queryRunner.query(`
      UPDATE "lead_topics"
      SET "excludedTerms" = '{}'::text[],
          "discoveryIntent" = 'job-openings'
      WHERE "excludedTerms" IS NULL
         OR "discoveryIntent" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "discoveryIntent"`);
    await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "excludedTerms"`);
  }
}
