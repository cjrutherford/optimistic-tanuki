#!/usr/bin/env node
/**
 * Optional, owner-approved verified re-read of historical anchors (design decision 6). It needs the network, so
 * it refuses to run unless BOTH --allow-network and --confirm-database <name> are given, and the name must equal
 * the database in DIRECTORY_DATABASE_URL. Without --apply it only counts what would change.
 *
 * The re-read must see the same object (etag equal to the scan's item-3 evidence) at the same file row number,
 * with the same name, category and point as the stored listing. Otherwise the row is skipped and nothing is
 * written. Scans without item-3 evidence are excluded. Evidence recorded: 'artifact_reread'.
 *
 * No real fetcher ships in this repository: the network read is an injected function (`run(db, { fetcher })`).
 * The command line refuses until an owner-supplied fetcher module is named with --fetcher <path>, which must
 * export a function (request) => Promise<{ etag, rows } | null>.
 */
const path = require('node:path');
const { DataSource } = require('typeorm');
const {
  businessIdentityKeyFromEnv,
} = require('../apps/directory/src/business-identity');
const {
  rereadAnchors,
} = require('../apps/directory/src/business-identity-reread');

const databaseName = (url) =>
  decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
const option = (argv, name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};

/** Counts only: no id, key, hash or row is printed. */
async function run(db, { fetcher, key, apply = false }) {
  return {
    mode: apply ? 'apply' : 'check',
    counts: await rereadAnchors(db, { key, fetcher, apply }),
  };
}

async function main(argv) {
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  if (!argv.includes('--allow-network'))
    throw Error('The re-read reads the network and needs --allow-network');
  if (!option(argv, '--confirm-database'))
    throw Error('The re-read needs --confirm-database <name>');
  if (option(argv, '--confirm-database') !== databaseName(url))
    throw Error('--confirm-database does not match the target database');
  const fetcherPath = option(argv, '--fetcher');
  if (!fetcherPath)
    throw Error(
      '--fetcher <module> is required; no network fetcher ships with this script'
    );
  const fetcher = require(path.resolve(fetcherPath));
  if (typeof fetcher !== 'function')
    throw Error('The fetcher module must export a function');
  const key = businessIdentityKeyFromEnv();
  if (!key) throw Error('DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY is required');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    console.log(
      JSON.stringify({
        database: databaseName(url),
        ...(await run(db, { fetcher, key, apply: argv.includes('--apply') })),
      })
    );
  } finally {
    await db.destroy();
  }
}

module.exports = { run, main };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(
      error instanceof Error
        ? error.message
        : 'business identity re-read failed'
    );
    process.exit(1);
  });
}
