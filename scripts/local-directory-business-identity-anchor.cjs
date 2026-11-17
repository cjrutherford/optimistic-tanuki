#!/usr/bin/env node
/**
 * Mints `origin` businesses for historical rows that already anchor something durable: a listing identity with
 * a link request, a non-retired reviewed binding, or a published address-review candidate. Each anchored row
 * gets one assertion with no upstream key. Nothing is matched to any other row, and a row with no anchor stays
 * row-scoped. Safe to repeat: a row that already has an assertion is skipped.
 *
 * --check (default) is read-only and prints a plan digest and counts per anchor class; it never prints an id.
 * --apply needs --confirm-database <name>, equal to the database in DIRECTORY_DATABASE_URL, and
 * --plan-digest <digest> from a --check of the same database.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... [DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY=... (apply only)] \
 *   TS_NODE_PROJECT=apps/directory/tsconfig.json node -r ts-node/register/transpile-only \
 *     scripts/local-directory-business-identity-anchor.cjs [--check | --apply --confirm-database <name> --plan-digest <digest>]
 */
const { DataSource } = require('typeorm');
const {
  businessIdentityKeyFromEnv,
} = require('../apps/directory/src/business-identity');
const {
  applyAnchors,
  planAnchors,
} = require('../apps/directory/src/business-identity-anchor');

const databaseName = (url) =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
const option = (argv, name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};

/** Counts only: no row, listing, name, key or hash is printed. */
async function run(db, { apply = false, planDigest, key } = {}) {
  const plan = await planAnchors(db);
  const summary = {
    mode: apply ? 'apply' : 'check',
    towns: plan.towns,
    planDigest: plan.digest,
    counts: plan.counts,
  };
  if (!apply) return summary;
  const result = await applyAnchors(db, { planDigest, key });
  return { ...summary, minted: result.minted, skipped: result.skipped };
}

async function main(argv) {
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const apply = argv.includes('--apply');
  if (apply && argv.includes('--check'))
    throw Error('--check and --apply are exclusive');
  if (apply && option(argv, '--confirm-database') !== databaseName(url))
    throw Error(
      '--apply requires --confirm-database <name> matching the target database'
    );
  const planDigest = option(argv, '--plan-digest');
  if (apply && !/^[a-f0-9]{64}$/.test(planDigest || ''))
    throw Error('--apply requires --plan-digest <digest> from --check');
  const key = apply ? businessIdentityKeyFromEnv() : null;
  if (apply && !key)
    throw Error('DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY is required to apply');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    console.log(
      JSON.stringify({
        database: databaseName(url),
        ...(await run(db, { apply, planDigest, key })),
      })
    );
  } finally {
    await db.destroy();
  }
}

module.exports = { run };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error ? error.message : 'business identity anchor failed'
    );
    process.exit(1);
  });
}
