import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated (`nx run lead-tracker:typeorm:migration:generate`).
 *
 * The generator also emitted unrelated pre-existing drift: it wanted to rename
 * the two `lead_qualifications` foreign keys and set `lead_onboarding_profiles.
 * appScope` NOT NULL. Those were removed after review — the FK rewrite would
 * have quietly changed `leadId` from ON DELETE CASCADE to ON DELETE NO ACTION,
 * which is a behaviour change nothing in this workstream asked for. That drift
 * needs its own deliberate migration.
 */
export class AddOnboardingDiscTranscript1787170007574
  implements MigrationInterface
{
  name = 'AddOnboardingDiscTranscript1787170007574';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" ADD "discTranscript" jsonb NOT NULL DEFAULT '[]'::jsonb`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_onboarding_profiles" DROP COLUMN "discTranscript"`
    );
  }
}
