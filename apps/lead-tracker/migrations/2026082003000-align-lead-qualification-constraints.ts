import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated (`nx run lead-tracker:typeorm:migration:generate`).
 *
 * Clears the schema drift that two previous generated migrations kept trying to
 * sweep into unrelated changes:
 *
 *  - The `lead_qualifications` foreign keys carried hand-written names from the
 *    initial migration, so TypeORM proposed a rename on every generate. They are
 *    renamed once, here, to the names TypeORM derives.
 *  - `leadId` keeps ON DELETE CASCADE. Earlier generations proposed NO ACTION
 *    because the entity omitted `onDelete`; that was the entity being wrong, not
 *    the database. A qualification is derived data with no meaning without its
 *    lead, and NO ACTION would have made a qualified lead impossible to delete.
 *    The entity now declares CASCADE, so this migration preserves behaviour.
 *  - `lead_onboarding_profiles.appScope` becomes NOT NULL, matching the entity.
 */
export class AlignLeadQualificationConstraints2026082003000
  implements MigrationInterface
{
  name = 'AlignLeadQualificationConstraints2026082003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" DROP CONSTRAINT "FK_lead_qualifications_lead"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" DROP CONSTRAINT "FK_lead_qualifications_topic"`
    );

    // SET NOT NULL fails outright if any row still holds NULL, so settle those
    // on the column's own default first.
    await queryRunner.query(
      `UPDATE "lead_onboarding_profiles" SET "appScope" = 'leads-app' WHERE "appScope" IS NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ALTER COLUMN "appScope" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ALTER COLUMN "discTranscript" SET DEFAULT '[]'::jsonb`
    );

    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" ADD CONSTRAINT "FK_d929802e8f42d30ea0cb3dd310e" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" ADD CONSTRAINT "FK_dbcc2c90481b88eaeaf044a6b93" FOREIGN KEY ("topicId") REFERENCES "lead_topics"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" DROP CONSTRAINT "FK_dbcc2c90481b88eaeaf044a6b93"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" DROP CONSTRAINT "FK_d929802e8f42d30ea0cb3dd310e"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ALTER COLUMN "discTranscript" SET DEFAULT '[]'::jsonb`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ALTER COLUMN "appScope" DROP NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" ADD CONSTRAINT "FK_lead_qualifications_topic" FOREIGN KEY ("topicId") REFERENCES "lead_topics"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_qualifications" ADD CONSTRAINT "FK_lead_qualifications_lead" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }
}
