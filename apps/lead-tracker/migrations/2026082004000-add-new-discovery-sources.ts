import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated. Adds the four keyless sources added in D5 — Arbeitnow,
 * Remotive, The Muse, and the HN "Who is hiring?" thread — to the lead source
 * enum. Generated cleanly with no unrelated drift, now that the entity and
 * database agree (see AlignLeadQualificationConstraints).
 */

export class AddNewDiscoverySources2026082004000 implements MigrationInterface {
  name = 'AddNewDiscoverySources2026082004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."leads_source_enum" RENAME TO "leads_source_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'arbeitnow', 'remotive', 'themuse', 'hackernews', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "source" TYPE "public"."leads_source_enum" USING "source"::"text"::"public"."leads_source_enum"`
    );
    await queryRunner.query(`DROP TYPE "public"."leads_source_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Leads already recorded against a new source would not fit the narrower
    // enum, so give them a generic provenance before the type is rebuilt.
    await queryRunner.query(
      `UPDATE "leads" SET "source" = 'other' WHERE "source" IN ('arbeitnow', 'remotive', 'themuse', 'hackernews')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum_old" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
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
