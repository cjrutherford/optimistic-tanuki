import { createRequire } from 'node:module';

// Operator backfill for the duplicate queue (owner decisions D13/D18): closes stale cases and resolves obvious
// same-place pairs automatically. The directory-worker sweep does the same on every run, so this is only for draining
// the backlog at once. Idempotent; `--dry-run` reports counts and writes nothing.
//
//   DIRECTORY_DATABASE_URL=... TS_NODE_PROJECT=apps/directory/tsconfig.json \
//     node -r ts-node/register/transpile-only scripts/directory-duplicate-cleanup.mjs [--dry-run] [--town <uuid>]
const require = createRequire(import.meta.url);
const { DataSource } = require('typeorm');
const {
  autoResolveDuplicates,
  closeStaleDuplicateCases,
} = require('../apps/directory/src/duplicate-auto.ts');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// One pass covers the whole queue (the cap in duplicate-auto is 50,000), so a batch with no match cannot hide later ones.
const BATCH = 50000;
const MAX_ROUNDS = 100;

function parseArgs(argv) {
  const args = { dryRun: false, town: undefined };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--town' && uuid.test(argv[i + 1] ?? ''))
      args.town = argv[++i];
    else throw Error('Usage: [--dry-run] [--town <uuid>]');
  }
  return args;
}

async function drain(db, step, input) {
  const total = { examined: 0, done: 0, by: {} };
  // A dry run does not change anything, so one batch is all it can report; a real run loops until nothing is left.
  for (let round = 0; round < (input.dryRun ? 1 : MAX_ROUNDS); round++) {
    const r = await step(db, { ...input, limit: BATCH });
    const done = r.closed ?? r.resolved;
    const by = r.byReason ?? r.byRule;
    total.examined += r.examined;
    total.done += done;
    for (const [k, v] of Object.entries(by))
      total.by[k] = (total.by[k] ?? 0) + v;
    if (!done) break;
  }
  return total;
}

async function main() {
  const { dryRun, town } = parseArgs(process.argv.slice(2));
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const db = new DataSource({
    type: 'postgres',
    url,
    extra: { connectionTimeoutMillis: 5000, statement_timeout: 120000 },
  });
  await db.initialize();
  try {
    const input = { dryRun, ...(town ? { townId: town } : {}) };
    const stale = await drain(db, closeStaleDuplicateCases, input);
    const auto = await drain(db, autoResolveDuplicates, input);
    console.log(
      JSON.stringify(
        {
          dryRun,
          stale: {
            [dryRun ? 'wouldClose' : 'closed']: stale.done,
            byReason: stale.by,
          },
          autoResolve: {
            [dryRun ? 'wouldResolve' : 'resolved']: auto.done,
            byRule: auto.by,
          },
        },
        null,
        2
      )
    );
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'failed');
  process.exit(1);
});
