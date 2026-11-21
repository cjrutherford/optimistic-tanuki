#!/usr/bin/env node
// Operator action (D12): retire a town's rows that carry no source provenance so the sweeps acquire it again.
// Dry-run by default; --apply commits. Usage: --town <slug> [--town <slug>] [--apply]
const { DataSource } = require('typeorm');
const {
  retireSourcelessTownRows,
} = require('../apps/directory/src/town-retirement');
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!databaseUrl) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
const parsed = new URL(databaseUrl);
if (
  !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
  parsed.pathname !== '/ot_directory'
)
  throw Error('Only the local ot_directory database is allowed');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const slugs = args.flatMap((a, i) => (a === '--town' ? [args[i + 1]] : []));
if (!slugs.length) throw Error('At least one --town <slug> is required');
(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  const report = [];
  try {
    for (const slug of slugs) {
      const [town] = await db.query(
        'SELECT "communityId" FROM directory_town WHERE slug=$1',
        [slug]
      );
      if (!town) throw Error(`Unknown town ${slug}`);
      let outcome;
      await db
        .transaction(async (tx) => {
          outcome = await retireSourcelessTownRows(
            {
              query: (...a) => tx.query(...a),
              transaction: (fn) => fn(tx),
            },
            {
              communityId: town.communityId,
              actor: 'operator:d12',
              reason:
                'D12: rows without source provenance retired so the town is acquired again',
            }
          );
          if (!apply) throw Object.assign(Error('dry-run'), { dry: true });
        })
        .catch((e) => {
          if (!e.dry) throw e;
        });
      report.push({ slug, ...outcome });
    }
    console.log(
      JSON.stringify({ mode: apply ? 'applied' : 'dry-run', report })
    );
  } finally {
    await db.destroy();
  }
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
