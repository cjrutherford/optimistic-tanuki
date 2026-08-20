import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated. Adds `overpass` (OpenStreetMap) to the lead source enum — the
 * keyless counterpart to Google Places, so local business discovery works in a
 * deployment with no Places API key.
 */

export class AddOverpassLeadSource2026082005000 implements MigrationInterface {
  name = 'AddOverpassLeadSource2026082005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."leads_source_enum" RENAME TO "leads_source_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'arbeitnow', 'remotive', 'themuse', 'hackernews', 'overpass', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "source" TYPE "public"."leads_source_enum" USING "source"::"text"::"public"."leads_source_enum"`
    );
    await queryRunner.query(`DROP TYPE "public"."leads_source_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Leads recorded against the new source would not fit the narrower enum.
    await queryRunner.query(
      `UPDATE "leads" SET "source" = 'local' WHERE "source" = 'overpass'`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum_old" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'arbeitnow', 'remotive', 'themuse', 'hackernews', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
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
