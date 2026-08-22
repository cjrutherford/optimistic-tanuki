import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CLI-generated. Adds the two "dream company" ATS sources (Greenhouse, Lever)
 * and the `lead_topics.aspirationalCompanies` column that holds the verified
 * board tokens they watch.
 */

export class AddAspirationalAtsSources1787226492478
  implements MigrationInterface
{
  name = 'AddAspirationalAtsSources1787226492478';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lead_topics" ADD "aspirationalCompanies" jsonb`
    );
    await queryRunner.query(
      `ALTER TYPE "public"."leads_source_enum" RENAME TO "leads_source_enum_old"`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'arbeitnow', 'remotive', 'themuse', 'hackernews', 'overpass', 'greenhouse', 'lever', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "source" TYPE "public"."leads_source_enum" USING "source"::"text"::"public"."leads_source_enum"`
    );
    await queryRunner.query(`DROP TYPE "public"."leads_source_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Leads recorded against the new sources would not fit the narrower enum.
    await queryRunner.query(
      `UPDATE "leads" SET "source" = 'other' WHERE "source" IN ('greenhouse', 'lever')`
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leads_source_enum_old" AS ENUM('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'funding-news', 'arbeitnow', 'remotive', 'themuse', 'hackernews', 'overpass', 'indeed', 'google-maps', 'referral', 'cold', 'other', 'upwork', 'linkedin', 'local')`
    );
    await queryRunner.query(
      `ALTER TABLE "leads" ALTER COLUMN "source" TYPE "public"."leads_source_enum_old" USING "source"::"text"::"public"."leads_source_enum_old"`
    );
    await queryRunner.query(`DROP TYPE "public"."leads_source_enum"`);
    await queryRunner.query(
      `ALTER TYPE "public"."leads_source_enum_old" RENAME TO "leads_source_enum"`
    );
    await queryRunner.query(
      `ALTER TABLE "lead_topics" DROP COLUMN "aspirationalCompanies"`
    );
  }
}
