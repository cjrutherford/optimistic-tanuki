import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data migration, created with the TypeORM CLI `migration:create` rather than
 * generated: this is a backfill of existing rows and cannot be inferred from
 * entity metadata (AGENTS.md §TypeORM migrations permits that exception).
 *
 * `lead_topics.sources` is a text array, so retired ids sit in stored topics as
 * plain strings. Three things happen here:
 *
 *  - `crunchbase` becomes `funding-news`. Same provider, same feed, honest name.
 *  - `clutch`, `indeed`, and `justremote` are stripped. All three were incapable
 *    of returning results (two answer HTTP 403 to any server request, one's feed
 *    no longer exists), so no discovery capability is lost by removing them.
 *  - A topic left with no sources at all is given the defaults for its intent,
 *    because an empty `sources` array means the topic silently never runs.
 *
 * Reversible: `down` restores `crunchbase`. It cannot restore the stripped ids
 * — that information is gone once removed — so it is documented rather than
 * faked, and the retired ids remain valid enum members either way.
 */
export class MigrateTopicsOffRetiredSources2026082002000
  implements MigrationInterface
{
  name = 'MigrateTopicsOffRetiredSources2026082002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // crunchbase -> funding-news
    await queryRunner.query(
      `UPDATE "lead_topics"
       SET "sources" = array_replace("sources", 'crunchbase', 'funding-news')
       WHERE 'crunchbase' = ANY("sources")`
    );

    // strip the three sources that cannot return results
    await queryRunner.query(
      `UPDATE "lead_topics"
       SET "sources" = ARRAY(
         SELECT s FROM unnest("sources") AS s
         WHERE s NOT IN ('clutch', 'indeed', 'justremote')
       )
       WHERE "sources" && ARRAY['clutch', 'indeed', 'justremote']::text[]`
    );

    // a topic with no sources never runs; give it the defaults for its intent
    await queryRunner.query(
      `UPDATE "lead_topics"
       SET "sources" = CASE
         WHEN "discoveryIntent" = 'service-buyers'
           THEN ARRAY['funding-news', 'google-maps']::text[]
         ELSE ARRAY['remoteok', 'himalayas', 'weworkremotely', 'jobicy']::text[]
       END
       WHERE "sources" IS NULL OR cardinality("sources") = 0`
    );

    // leads keep their provenance; only the renamed label is corrected
    await queryRunner.query(
      `UPDATE "leads" SET "source" = 'funding-news' WHERE "source" = 'crunchbase'`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "leads" SET "source" = 'crunchbase' WHERE "source" = 'funding-news'`
    );
    await queryRunner.query(
      `UPDATE "lead_topics"
       SET "sources" = array_replace("sources", 'funding-news', 'crunchbase')
       WHERE 'funding-news' = ANY("sources")`
    );
    // Topics that had clutch/indeed/justremote stripped are not restored: the
    // original membership is not recoverable, and those providers no longer
    // exist to serve them.
  }
}
