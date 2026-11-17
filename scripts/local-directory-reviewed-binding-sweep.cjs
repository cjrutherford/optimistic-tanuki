#!/usr/bin/env node
/**
 * Revalidates reviewed-field bindings against the contact stage.
 *
 * Dry-run by default: reads the stage (read-only) and reports what each binding
 * would do. With --apply it confirms pending bindings, extends leases, suspends
 * on uncertain signals and retires on withdrawal, in live transactions.
 * If the stage cannot be read nothing changes and no lease is extended.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... DIRECTORY_CONTACT_STAGE_DATABASE_URL=... \
 *   DIRECTORY_CONTACT_STAGE_LABEL=... DIRECTORY_REVIEWED_BINDING_HMAC_KEY=... \
 *     TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only \
 *     scripts/local-directory-reviewed-binding-sweep.cjs [--apply] [--limit 500] \
 *       [--lease-hours 24] [--suspension-days 30]
 */
const { DataSource } = require('typeorm');
const {
  reviewedBindingKeyFromEnv,
} = require('../apps/directory/src/reviewed-binding');
const {
  sweepBindings,
} = require('../apps/directory/src/reviewed-binding-revalidate');

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const apply = args.includes('--apply');
const limit = Number(value('--limit', '500'));
const leaseHours = Number(value('--lease-hours', '24'));
const suspensionDays = Number(value('--suspension-days', '30'));

async function main() {
  const liveUrl =
    process.env.DIRECTORY_DATABASE_URL ||
    process.env.DIRECTORY_REVIEW_DATABASE_URL;
  const stageUrl = process.env.DIRECTORY_CONTACT_STAGE_DATABASE_URL;
  if (!liveUrl) throw Error('DIRECTORY_DATABASE_URL is required');
  if (!stageUrl)
    throw Error('DIRECTORY_CONTACT_STAGE_DATABASE_URL is required');
  if (
    ![limit, leaseHours, suspensionDays].every(
      (n) => Number.isFinite(n) && n > 0
    )
  )
    throw Error('Invalid numeric option');
  const label = (process.env.DIRECTORY_CONTACT_STAGE_LABEL || '').trim();
  if (!label) throw Error('DIRECTORY_CONTACT_STAGE_LABEL is required');
  const key = reviewedBindingKeyFromEnv();
  const live = new DataSource({ type: 'postgres', url: liveUrl });
  // The stage is only ever read: the session itself is read-only.
  const stage = new DataSource({
    type: 'postgres',
    url: stageUrl,
    extra: {
      options: '-c default_transaction_read_only=on -c statement_timeout=15000',
      connectionTimeoutMillis: 5000,
    },
  });
  await live.initialize();
  try {
    try {
      await stage.initialize();
    } catch {
      console.log(JSON.stringify({ apply, stage: 'unreachable', changed: 0 }));
      process.exitCode = 2;
      return;
    }
    try {
      const summary = await sweepBindings(live, stage, key, {
        apply,
        limit,
        leaseMs: leaseHours * 3_600_000,
        suspensionTimeoutMs: suspensionDays * 86_400_000,
        stageInstallationId: label,
      });
      const [health] = await live.query(
        `SELECT count(*) FILTER (WHERE state='active' AND "verifiedUntil"<=now())::int AS "expiredLeases",
                count(*) FILTER (WHERE state='suspended')::int AS suspended,
                count(*) FILTER (WHERE state='pending')::int AS pending,
                count(*) FILTER (WHERE state='active' AND "verifiedUntil">now())::int AS active
         FROM directory_reviewed_binding`
      );
      console.log(
        JSON.stringify({
          apply,
          examined: summary.examined,
          counts: summary.counts,
          health,
        })
      );
      const interesting = summary.results.filter(
        (r) => !['unchanged', 'skipped'].includes(r.outcome)
      );
      for (const r of interesting.slice(0, 50)) console.log(JSON.stringify(r));
      if (summary.counts.unreachable > 0) process.exitCode = 2;
    } finally {
      await stage.destroy();
    }
  } finally {
    await live.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'sweep failed');
  process.exit(1);
});
