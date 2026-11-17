#!/usr/bin/env node
/**
 * Summarise the private address-review queue.
 *
 * Usage:
 *   DIRECTORY_REVIEW_DATABASE_URL=... \
 *     node scripts/local-directory-address-review-queue-report.cjs [--town <uuid>]
 *
 * Read-only. Prints a JSON report that separates the raw backlog from the
 * evidence-processed sample, so "needs human" totals are not confused with
 * "blocked by evidence".
 */
const { DataSource } = require('typeorm');

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const town = value('--town', '');
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!databaseUrl) {
  console.error('DIRECTORY_REVIEW_DATABASE_URL is required');
  process.exit(1);
}
if (
  town &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    town
  )
) {
  console.error('--town must be a UUID');
  process.exit(1);
}

const filter = town ? 'AND "communityId"=$1' : '';
const params = town ? [town] : [];

(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  try {
    const [status, processed, reasons, evidence, geocode, risk, rights, towns] =
      await Promise.all([
        db.query(
          `SELECT "status", count(*)::int AS count
           FROM "directory_address_review_candidate"
           WHERE true ${filter} GROUP BY "status" ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT count(*)::int AS total,
                  count(*) FILTER (WHERE "geocode" IS NOT NULL AND "geocode" <> 'null'::jsonb)::int AS geocoded,
                  count(*) FILTER (WHERE "officialEvidence" IS NOT NULL AND "officialEvidence" <> 'null'::jsonb)::int AS evidenced
           FROM "directory_address_review_candidate"
           WHERE true ${filter}`,
          params
        ),
        db.query(
          `SELECT reason, count(*)::int AS count
           FROM "directory_address_review_candidate" c,
                jsonb_array_elements_text(c."reasons") reason
           WHERE c."status"='needs_human' ${town ? 'AND c."communityId"=$1' : ''}
           GROUP BY reason ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT coalesce("officialEvidence"->>'status','none') AS evidence,
                  count(*)::int AS count
           FROM "directory_address_review_candidate"
           WHERE "status"='needs_human' ${filter}
           GROUP BY evidence ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT coalesce("geocode"->>'status','none') AS geocode,
                  count(*)::int AS count
           FROM "directory_address_review_candidate"
           WHERE "status"='needs_human' ${filter}
           GROUP BY geocode ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT coalesce("risk"->>'residential','unknown') AS residential,
                  coalesce("risk"->>'sensitive','unknown') AS sensitive,
                  coalesce("risk"->>'adult','unknown') AS adult,
                  count(*)::int AS count
           FROM "directory_address_review_candidate"
           WHERE "status"='needs_human' ${filter}
           GROUP BY 1,2,3 ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT "rights", count(*)::int AS count
           FROM "directory_address_review_candidate"
           WHERE "status"='needs_human' ${filter}
           GROUP BY "rights" ORDER BY count DESC`,
          params
        ),
        db.query(
          `SELECT t.name, t.slug, c."communityId", count(*)::int AS count
           FROM "directory_address_review_candidate" c
           LEFT JOIN "directory_town" t ON t."communityId"=c."communityId"
           WHERE c."status"='needs_human' ${town ? 'AND c."communityId"=$1' : ''}
           GROUP BY t.name, t.slug, c."communityId"
           ORDER BY count DESC LIMIT 20`,
          params
        ),
      ]);
    console.log(
      JSON.stringify(
        {
          town: town || 'all',
          generatedAt: new Date().toISOString(),
          status,
          processed: processed[0],
          reasons,
          evidence,
          geocode,
          risk,
          rights,
          busiestTowns: towns,
        },
        null,
        2
      )
    );
  } finally {
    await db.destroy();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
