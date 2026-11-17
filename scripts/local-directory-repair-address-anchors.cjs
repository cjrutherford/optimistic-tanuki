#!/usr/bin/env node
// Re-key uniquely matched local candidates, retaining old keys in audit decisions.
// Ambiguous, conflicting and unmatched candidates are left untouched. Dry-run by default.
const { Client } = require('pg');
const url = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!url) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
const parsed = new URL(url);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || parsed.pathname !== '/ot_directory') throw Error('Only the local ot_directory database is allowed');
const apply = process.argv.includes('--apply');
(async () => {
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    const candidates = await db.query(`SELECT c.* FROM directory_address_review_candidate c LEFT JOIN directory_overture_private_row r ON r."scanId"=c."scanId" AND r."sourceFileRowNumber"=c."sourceFileRowNumber" WHERE r."scanId" IS NULL ORDER BY c.id FOR UPDATE OF c`);
    const proposals = [];
    for (const c of candidates.rows) {
      const found = await db.query(`SELECT DISTINCT r."scanId",r."sourceFileRowNumber",r.listing FROM directory_overture_private_row r JOIN directory_overture_private_membership m ON m."scanId"=r."scanId" JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND NOT p.revoked JOIN directory_overture_private_completion d ON d."scanId"=r."scanId" WHERE r."regionId"=$1 AND btrim(r.listing->>'name')=$2 AND r.listing->>'category'=$3 AND abs((r.listing->'location'->'coordinates'->>0)::float8-$4)<0.000001 AND abs((r.listing->'location'->'coordinates'->>1)::float8-$5)<0.000001 AND NOT EXISTS(SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=r."scanId") AND NOT EXISTS(SELECT 1 FROM directory_overture_private_row_revocation x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")`, [c.communityId,c.name,c.category,c.point?.lng,c.point?.lat]);
      if (found.rowCount === 1 && (c.status !== 'published' || found.rows[0].listing.reviewed)) proposals.push({ candidate:c, row:found.rows[0] });
    }
    const frequencies = new Map();
    for (const {row} of proposals) { const key = `${row.scanId}:${row.sourceFileRowNumber}`; frequencies.set(key, (frequencies.get(key) || 0) + 1); }
    let repaired = 0;
    for (const {candidate:c,row:r} of proposals) {
      const key = `${r.scanId}:${r.sourceFileRowNumber}`;
      if (frequencies.get(key) !== 1) continue;
      const occupied = await db.query('SELECT 1 FROM directory_address_review_candidate WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND id<>$3', [r.scanId,r.sourceFileRowNumber,c.id]);
      if (occupied.rowCount) continue;
      await db.query('UPDATE directory_address_review_candidate SET "scanId"=$2,"sourceFileRowNumber"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE id=$1', [c.id,r.scanId,r.sourceFileRowNumber]);
      await db.query(`INSERT INTO directory_address_review_decision ("candidateId","actorKind",decision,reason,checks,"policyVersion","appliedAt") VALUES ($1,'system','rekey','Local source-key repair after unique active-row match',$2::jsonb,'local-source-key-repair-v1',CURRENT_TIMESTAMP)`, [c.id,JSON.stringify({oldSource:{scanId:c.scanId,row:c.sourceFileRowNumber},newSource:{scanId:r.scanId,row:r.sourceFileRowNumber}})]);
      repaired++;
    }
    await db.query(apply ? 'COMMIT' : 'ROLLBACK');
    console.log(JSON.stringify({mode:apply?'applied':'dry-run',unanchored:candidates.rowCount,uniquelyMatched:proposals.length,repaired,unresolved:candidates.rowCount-repaired}));
  } catch (error) { await db.query('ROLLBACK').catch(()=>{}); throw error; }
  finally { await db.end(); }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
