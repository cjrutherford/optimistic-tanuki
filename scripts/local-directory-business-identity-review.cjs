#!/usr/bin/env node
/**
 * Operator tool for business identity after a carry (S5-item1-business-identity-design.md, slices 5, 6 and 8).
 *
 *   queue  --town <id> [--list]         counts of carries that need a person; --list also prints ids
 *   links  --town <id> [--apply]        stage owner-link carries, derive corroboration, restore what is allowed
 *   decide <confirm|retire|merge|split> --town <id> --business <id> --reason <text> [--other <id>]
 *          [--row <scanId>:<row> ...] [--actor <account-or-profile-id>] [--decision-id <uuid>]
 *
 * Writes need --confirm-database <name>, equal to the database in DIRECTORY_DATABASE_URL. `links` without --apply
 * and `queue` are read-only (links without --apply only reports the plan counts). No key is read or printed;
 * the HMAC key is not needed because no hash is computed here. A link is never moved without corroboration, the
 * owner, or a reviewer's confirm; merge and split are refused while an owner link is attached.
 */
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { listIdentityReviewQueue, businessIdentityHealth } = require('../apps/directory/src/business-identity-review');
const { stageLinkCarries, reconcileLinkCarries } = require('../apps/directory/src/business-link-carry');
const { decideBusinessIdentity } = require('../apps/directory/src/business-identity-decision');

const databaseName = (url) => decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
const option = (argv, name) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : undefined; };
const options = (argv, name) => argv.flatMap((v, i) => (v === name ? [argv[i + 1]] : []));

async function run(db, argv) {
  const [command, action] = argv;
  const town = option(argv, '--town');
  if (!town) throw Error('--town is required');
  if (command === 'queue') {
    const queue = await listIdentityReviewQueue(db, town);
    const out = { command, health: await businessIdentityHealth(db), counts: { carriedUnbound: queue.carriedUnbound.length, unresolved: queue.unresolved.length, awaitingOwner: queue.awaitingOwner.length } };
    return argv.includes('--list') ? { ...out, queue } : out;
  }
  if (command === 'links') {
    if (!argv.includes('--apply')) {
      const queue = await listIdentityReviewQueue(db, town);
      return { command, mode: 'check', awaitingOwner: queue.awaitingOwner.length };
    }
    const staged = await stageLinkCarries(db, { townId: town });
    const reconciled = await reconcileLinkCarries(db, { townId: town });
    return { command, mode: 'apply', staged, reconciled };
  }
  if (command === 'decide') {
    const rows = options(argv, '--row').map((value) => { const at = value.lastIndexOf(':'); return { scanId: value.slice(0, at), sourceFileRowNumber: value.slice(at + 1) }; });
    const actorId = option(argv, '--actor');
    const result = await decideBusinessIdentity(db, {
      decisionId: option(argv, '--decision-id') || randomUUID(), townId: town, action, businessId: option(argv, '--business'),
      otherBusinessId: option(argv, '--other'), rows: action === 'split' ? rows : undefined,
      actor: actorId ? { id: actorId, domain: 'account' } : { id: null, domain: 'system' }, reason: option(argv, '--reason') || '',
    });
    return { command, action, replayed: result.replayed, businesses: result.businessIds.length, restoredLinks: result.restoredLinks };
  }
  throw Error('usage: queue | links | decide <confirm|retire|merge|split>');
}

async function main(argv) {
  const url = process.env.DIRECTORY_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_DATABASE_URL is required');
  const writes = argv[0] === 'decide' || (argv[0] === 'links' && argv.includes('--apply'));
  if (writes && option(argv, '--confirm-database') !== databaseName(url)) throw Error('writes require --confirm-database <name> matching the target database');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    console.log(JSON.stringify({ database: databaseName(url), ...(await run(db, argv)) }));
  } finally {
    await db.destroy();
  }
}

module.exports = { run };

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : 'business identity review failed');
    process.exit(1);
  });
}
