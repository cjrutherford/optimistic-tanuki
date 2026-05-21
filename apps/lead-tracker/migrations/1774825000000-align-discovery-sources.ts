import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignDiscoverySources1774825000000 implements MigrationInterface {
    name = 'AlignDiscoverySources1774825000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        const newLeadSources = [
            'remoteok',
            'himalayas',
            'weworkremotely',
            'justremote',
            'jobicy',
            'clutch',
            'crunchbase',
            'indeed',
            'google-maps',
        ];

        for (const source of newLeadSources) {
            await queryRunner.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1
                        FROM pg_type t
                        JOIN pg_enum e ON t.oid = e.enumtypid
                        WHERE t.typname = 'leads_source_enum'
                          AND e.enumlabel = '${source}'
                    ) THEN
                        ALTER TYPE "public"."leads_source_enum" ADD VALUE '${source}';
                    END IF;
                END
                $$;
            `);
        }

        await queryRunner.query(`ALTER TABLE "lead_topics" ADD "googleMapsCities" text array`);
        await queryRunner.query(`ALTER TABLE "lead_topics" ADD "googleMapsTypes" text array`);

        await queryRunner.query(`
            UPDATE "lead_topics"
            SET "googleMapsCities" = CASE
                WHEN "locality" IS NULL OR btrim("locality") = '' THEN NULL
                ELSE ARRAY[btrim("locality")]
            END
        `);

        await queryRunner.query(`
            UPDATE "lead_topics"
            SET "sources" = CASE
                WHEN COALESCE(array_length(
                    ARRAY(
                        SELECT DISTINCT source
                        FROM unnest(array_replace(COALESCE("sources", '{}'::text[]), 'local', 'google-maps')) AS source
                        WHERE source NOT IN ('upwork', 'linkedin', 'referral', 'cold', 'other')
                    ),
                    1
                ), 0) = 0
                    THEN ARRAY['remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'indeed', 'google-maps']::text[]
                ELSE ARRAY(
                    SELECT DISTINCT source
                    FROM unnest(array_replace(COALESCE("sources", '{}'::text[]), 'local', 'google-maps')) AS source
                    WHERE source NOT IN ('upwork', 'linkedin', 'referral', 'cold', 'other')
                )
            END
        `);

        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "searchRadiusMiles"`);
        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "locality"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lead_topics" ADD "locality" text`);
        await queryRunner.query(`ALTER TABLE "lead_topics" ADD "searchRadiusMiles" integer`);

        await queryRunner.query(`
            UPDATE "lead_topics"
            SET "locality" = CASE
                WHEN "googleMapsCities" IS NULL OR array_length("googleMapsCities", 1) = 0 THEN NULL
                ELSE "googleMapsCities"[1]
            END,
            "searchRadiusMiles" = NULL
        `);

        await queryRunner.query(`
            UPDATE "lead_topics"
            SET "sources" = CASE
                WHEN COALESCE("googleMapsCities", '{}'::text[]) <> '{}'::text[]
                    THEN ARRAY['local']::text[]
                ELSE ARRAY['upwork', 'linkedin', 'referral', 'cold', 'local', 'other']::text[]
            END
        `);

        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "googleMapsTypes"`);
        await queryRunner.query(`ALTER TABLE "lead_topics" DROP COLUMN "googleMapsCities"`);

        await queryRunner.query(`
            UPDATE "leads"
            SET "source" = 'other'
            WHERE "source"::text IN ('remoteok', 'himalayas', 'weworkremotely', 'justremote', 'jobicy', 'clutch', 'crunchbase', 'indeed', 'google-maps')
        `);

        await queryRunner.query(`ALTER TYPE "public"."leads_source_enum" RENAME TO "leads_source_enum_old"`);
        await queryRunner.query(`
            CREATE TYPE "public"."leads_source_enum" AS ENUM(
                'upwork',
                'linkedin',
                'referral',
                'cold',
                'local',
                'other'
            )
        `);
        await queryRunner.query(`
            ALTER TABLE "leads"
            ALTER COLUMN "source" TYPE "public"."leads_source_enum"
            USING ("source"::text::"public"."leads_source_enum")
        `);
        await queryRunner.query(`DROP TYPE "public"."leads_source_enum_old"`);
    }
}
