#!/usr/bin/env node
// One-time, local-only correction authorized in the S7 handoff. Dry-run by default.
const { Client } = require('pg');
const targets = [
  ['Valdosta, GA', 'Advance Auto Parts', '512 E Screven St'],
  ['Valdosta, GA', 'Food Lion', '1207 W. Screven St.'],
  ['Valdosta, GA', 'Western Motel of Quitman', '1603 W Screven St'],
  ['Greer, SC', 'Pizza Hut Express', '6025 Wade Hampton Blvd'],
  ['Kill Devil Hills, NC', 'Nags Head Florist', '319 Truxton St'],
];
const dbUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!dbUrl) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
const parsed = new URL(dbUrl);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/ot_directory') throw Error('Only the local ot_directory database is allowed');
const apply = process.argv.includes('--apply');
(async () => {
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    await db.query('BEGIN');
    for (const [town, name, address] of targets) {
      const candidates = await db.query(`SELECT c.* FROM directory_address_review_candidate c JOIN directory_town t ON t."communityId"=c."communityId" WHERE t.name=$1 AND c.name=$2 AND c.status='published' FOR UPDATE OF c`, [town, name]);
      if (candidates.rowCount !== 1) throw Error(`Expected one published candidate: ${town} / ${name}`);
      const c = candidates.rows[0];
      const rows = await db.query(`SELECT DISTINCT r."scanId",r."sourceFileRowNumber",r.listing FROM directory_overture_private_row r JOIN directory_overture_private_membership m ON m."scanId"=r."scanId" JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND NOT p.revoked JOIN directory_overture_private_completion d ON d."scanId"=r."scanId" WHERE r."regionId"=$1 AND btrim(r.listing->>'name')=$2 AND r.listing->>'category'=$3 AND abs((r.listing->'location'->'coordinates'->>0)::float8-$4)<0.000001 AND abs((r.listing->'location'->'coordinates'->>1)::float8-$5)<0.000001 AND r.listing->'reviewed'->>'address' ILIKE $6 AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId") AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")`, [c.communityId, c.name, c.category, c.point.lng, c.point.lat, `${address}%`]);
      if (rows.rowCount !== 1) throw Error(`Expected one matching reviewed row: ${town} / ${name}`);
      const r = rows.rows[0];
      const conflict = await db.query('SELECT id FROM directory_address_review_candidate WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND id<>$3', [r.scanId, r.sourceFileRowNumber, c.id]);
      if (conflict.rowCount) throw Error(`Source key already owned: ${town} / ${name}`);
      const removed = await db.query('UPDATE directory_overture_private_row SET listing=listing-\'reviewed\' WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND listing=$3::jsonb', [r.scanId, r.sourceFileRowNumber, JSON.stringify(r.listing)]);
      if (removed.rowCount !== 1) throw Error('Reviewed row changed during correction');
      await db.query('DELETE FROM directory_reviewed_spatial WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2', [r.scanId, r.sourceFileRowNumber]);
      await db.query('UPDATE directory_address_review_candidate SET "scanId"=$2,"sourceFileRowNumber"=$3,status=\'revoked\',"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1', [c.id, r.scanId, r.sourceFileRowNumber]);
      await db.query(`INSERT INTO directory_address_review_decision ("candidateId","actorKind",decision,reason,checks,"policyVersion","appliedAt") VALUES ($1,'system','revoke',$2,$3::jsonb,'local-wrong-town-correction-v1',CURRENT_TIMESTAMP)`, [c.id, 'User-authorized local correction: address is outside the assigned town', JSON.stringify({ oldSource: { scanId: c.scanId, row: c.sourceFileRowNumber }, matchedSource: { scanId: r.scanId, row: r.sourceFileRowNumber }, previousReviewed: r.listing.reviewed })]);
      console.log(`${apply ? 'withdraw' : 'would withdraw'}: ${town} / ${name}`);
    }
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(apply ? 'Committed five corrections.' : 'Dry-run rolled back; no data changed.');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { await db.end(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
