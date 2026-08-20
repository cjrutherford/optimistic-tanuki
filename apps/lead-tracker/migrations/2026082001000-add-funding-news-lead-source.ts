import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated (`nx run lead-tracker:typeorm:migration:generate`).
 *
 * Adds `funding-news` to the lead source enum. The retired ids (`clutch`,
 * `indeed`, `crunchbase`, `justremote`) are deliberately kept: leads already
 * discovered through them must keep honest provenance, and dropping the values
 * would orphan those rows. They are excluded from selection by the source
 * registry instead, not by the database.
 *
 * The generator additionally wanted to rename both `lead_qualifications`
 * foreign keys and set `lead_onboarding_profiles.appScope` NOT NULL. Removed
 * after review — the FK rewrite silently changes `leadId` from
 * ON DELETE CASCADE to ON DELETE NO ACTION. That drift needs its own migration.
 */
export class AddFundingNewsLeadSource2026082001000
  implements MigrationInterface
{
  name = 'AddFundingNewsLeadSource2026082001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."leads_source_enum" RENAME TO "leads_source_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "source" TYPE "public"."leads_source_enum" USING "source"::"text"::"public"."leads_source_enum"`
    );
    await queryRunner.query(`DROP TYPE "public"."leads_source_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Any lead recorded as 'funding-news' would not fit the old enum, so move
    // it back to the label it previously carried before narrowing the type.
    await queryRunner.query(
      `UPDATE "leads" SET "source" = 'crunchbase' WHERE "source" = 'funding-news'`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum_old" AS ENUM('upwork', 'linkedin', 'referral', 'cold', 'local', 'other', 'remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'indeed', 'google-maps')`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "source" TYPE "public"."leads_source_enum_old" USING "source"::"text"::"public"."leads_source_enum_old"`
    );
    await queryRunner.query(`DROP TYPE "public"."leads_source_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."leads_source_enum_old" RENAME TO "leads_source_enum"`
    );
  }
}
