#!/usr/bin/env node
/**
 * Carries business identity from one release cohort (policy) to the next, so a business keeps its public id
 * across a cutover. Run it after every scan of the new cohort is imported and BEFORE the old policy is
 * revoked; the cutover script refuses to revoke until the carry is complete.
 *
 * Only an equal keyed upstream id carries, and only when it is unambiguous. It never merges, splits,
 * un-retires, crosses towns, copies reviewed fields, or touches a binding. Rows without a key stay
 * row-scoped. A cohort without any key is origin-only and needs no carry.
 *
 * --check (default) is read-only and prints a plan digest. --apply needs --confirm-database <name>, equal
 * to the database in DIRECTORY_DATABASE_URL, and --plan-digest <digest> from a --check of the same inputs.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY=... TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only scripts/local-directory-business-identity-carry.cjs \
 *     --from-policy <id> --to-policy <id> [--check | --apply --confirm-database <name> --plan-digest <digest>]
 */
const { DataSource } = require('typeorm');
const {
  businessIdentityKeyFromEnv,
} = require('../apps/directory/src/business-identity');
const {
  applyCarry,
  planCarry,
} = require('../apps/directory/src/business-identity-carry');

const databaseName = (url) =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
const option = (argv, name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};

/** Report shape shared by --check and --apply. Counts only: no row, name, key or hash is printed. */
async function run(
  db,
  { fromPolicyId, toPolicyId, key, apply = false, planDigest, hooks }
) {
  const opts = { fromPolicyId, toPolicyId, key };
  const plan = await planCarry(db, opts);
  const summary = {
    mode: apply ? 'apply' : 'check',
    keyed: plan.keyed,
    towns: plan.towns.length,
    planDigest: plan.digest,
    counts: plan.counts,
  };
  if (!apply) return summary;
  const result = await applyCarry(db, { ...opts, planDigest }, hooks);
  return { ...summary, applied: result.applied, complete: result.complete };
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
  const key = businessIdentityKeyFromEnv();
  if (!key) throw Error('DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY is required');
  const fromPolicyId = option(argv, '--from-policy'),
    toPolicyId = option(argv, '--to-policy');
  if (!fromPolicyId || !toPolicyId)
    throw Error('--from-policy and --to-policy are required');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    console.log(
      JSON.stringify({
        database: databaseName(url),
        ...(await run(db, {
          fromPolicyId,
          toPolicyId,
          key,
          apply,
          planDigest,
        })),
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
      error instanceof Error ? error.message : 'business identity carry failed'
    );
    process.exit(1);
  });
}
