#!/usr/bin/env node
/**
 * Report which Directory rows would block an account erase.
 *
 * Usage:
 *   DIRECTORY_REVIEW_DATABASE_URL=... node scripts/local-directory-account-lifecycle-blocked.cjs \
 *     --account <uuid> [--profile <uuid>]... [--legacy <uuid>]...
 *
 * Read-only: runs in a READ ONLY transaction that is always rolled back, so it
 * does not install a deletion fence. Prints counts per table and column only,
 * never row contents, identifiers or connection details. The matching rules
 * mirror apps/directory/src/account-lifecycle.ts (`inspect`); the postgres
 * test compares the totals with that function's readback.
 */
const { DataSource } = require('typeorm');

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UUID_ANY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseArgs(argv) {
  const out = { account: '', profiles: [], legacy: [] };
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (typeof value !== 'string') throw Error('Missing value for ' + flag);
    if (flag === '--account' && !out.account) out.account = value;
    else if (flag === '--profile') out.profiles.push(value);
    else if (flag === '--legacy') out.legacy.push(value);
    else throw Error('Unknown or repeated argument ' + flag);
  }
  if (!UUID.test(out.account)) throw Error('--account must be a UUID');
  if (
    out.profiles.some((id) => !UUID.test(id)) ||
    new Set(out.profiles).size !== out.profiles.length ||
    out.profiles.includes(out.account)
  ) {
    throw Error('--profile must be distinct UUIDs other than the account');
  }
  const legacy = [
    ...new Set(
      out.legacy.filter((id) => UUID_ANY.test(id)).map((id) => id.toLowerCase())
    ),
  ].filter((id) => id !== out.account && !out.profiles.includes(id));
  const all = [out.account, ...out.profiles, ...legacy];
  if (out.profiles.length + legacy.length > 999)
    throw Error('Too many identifiers');
  return { account: out.account, profiles: out.profiles, legacy, all };
}

// Columns and the exact domain in which each is erased; everything else matched is blocking.
const COLUMNS = [
  {
    table: 'directory_business_link_request',
    column: 'ownerId',
    exact: '"ownerId"=$2::uuid',
    domain: null,
  },
  {
    table: 'directory_business_link_event',
    column: 'actorId',
    exact: `(("actorDomain"='account' AND "actorId"=$2::uuid) OR ("actorDomain"='profile' AND "actorId"=ANY($3::uuid[])))`,
    domain: '"actorDomain"',
  },
  {
    table: 'directory_boundary_decision',
    column: 'reviewerId',
    exact: '"reviewerId"=ANY($3::uuid[])',
    domain: null,
  },
  {
    table: 'directory_address_review_decision',
    column: 'actorId',
    exact: '"actorId"=ANY($3::uuid[])',
    domain: null,
  },
];

async function report(runner, s) {
  const params = [s.all, s.account, s.profiles];
  // Every query names all three parameters so Postgres can type them.
  const typed =
    ' AND $1::uuid[] IS NOT NULL AND $2::uuid IS NOT NULL AND $3::uuid[] IS NOT NULL';
  const tables = [];
  for (const c of COLUMNS) {
    const col = `"${c.column}"`;
    const kind = `CASE WHEN ${col}=$2::uuid THEN 'account' WHEN ${col}=ANY($3::uuid[]) THEN 'profile' ELSE 'legacy' END`;
    const domain = c.domain ? `COALESCE(${c.domain}::text,'unset')` : `'n/a'`;
    // A NULL legacy domain makes the exact test NULL, so the blocking test is IS NOT TRUE.
    const blocking = await runner.query(
      `SELECT ${kind} AS "matchedAs", ${domain} AS "rowDomain", count(*)::text AS n FROM ${c.table} WHERE ${col}=ANY($1::uuid[]) AND (${c.exact}) IS NOT TRUE${typed} GROUP BY 1,2 ORDER BY 1,2`,
      params
    );
    const erasable = await runner.query(
      `SELECT count(*)::text AS n FROM ${c.table} WHERE ${c.exact}${typed}`,
      params
    );
    tables.push({
      table: c.table,
      column: c.column,
      erasable: Number(erasable[0].n),
      blocking: blocking.map((r) => ({
        matchedAs: r.matchedAs,
        rowDomain: r.rowDomain,
        count: Number(r.n),
      })),
      blockingTotal: blocking.reduce((a, r) => a + Number(r.n), 0),
    });
  }
  return {
    tables,
    blocked: tables.reduce((a, t) => a + t.blockingTotal, 0),
    remaining: tables.reduce((a, t) => a + t.erasable, 0),
  };
}

async function main() {
  const url = process.env.DIRECTORY_REVIEW_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
  const scope = parseArgs(process.argv.slice(2));
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('BEGIN TRANSACTION READ ONLY');
    await runner.query("SET LOCAL statement_timeout='12s'");
    const result = await report(runner, scope);
    console.log(
      JSON.stringify({ identifiers: scope.all.length, ...result }, null, 2)
    );
  } finally {
    try {
      await runner.query('ROLLBACK');
    } catch {
      /* connection already closed */
    }
    await runner.release();
    await db.destroy();
  }
}

main().catch((error) => {
  // Never print the stack: driver errors can embed connection details.
  console.error(
    'Report failed: ' +
      (error && error.code
        ? error.code
        : error && error.message
        ? String(error.message).split('\n')[0].slice(0, 120)
        : 'error')
  );
  process.exit(1);
});
