#!/usr/bin/env node
// User-authorized local archival. Existing candidates and decisions are retained.
// Dry-run by default; all 23 records are processed in one transaction.
const { DataSource } = require('typeorm');
const { archiveUnanchoredAddressReviewCandidate } = require('../apps/directory/src/address-review-store');
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!databaseUrl) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
const parsed = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/ot_directory') throw Error('Only the local ot_directory database is allowed');
const apply = process.argv.includes('--apply');
(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  const runner = db.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction('SERIALIZABLE');
    const candidates = await runner.query(`SELECT c.id,c.status FROM directory_address_review_candidate c LEFT JOIN directory_overture_private_row r ON r."scanId"=c."scanId" AND r."sourceFileRowNumber"=c."sourceFileRowNumber" WHERE r."scanId" IS NULL AND c.status<>'archived' ORDER BY c.id FOR UPDATE OF c`);
    if (candidates.length !== 23 || candidates.some(c => !['needs_human', 'rejected'].includes(c.status))) throw Error('Unresolved candidate frame changed; inspect before archival');
    for (const candidate of candidates) await archiveUnanchoredAddressReviewCandidate(db, candidate.id, runner.manager);
    if (apply) await runner.commitTransaction(); else await runner.rollbackTransaction();
    console.log(JSON.stringify({ mode: apply ? 'applied' : 'dry-run', archived: candidates.length }));
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally { await runner.release(); await db.destroy(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
