#!/usr/bin/env node
/**
 * Return auto-approved candidates to `auto_approved` after a cohort cutover retired their binding.
 *
 * The binding sweep retires a binding whose live row was withdrawn (cause `live_row_withdrawn`) and marks its
 * candidate `revoked`. When the same business has a current row in the new cohort, the owner's rule still
 * holds, so the candidate may be published again. Only candidates whose latest decision is that automatic
 * revoke qualify; a human revoke is never touched. Each change writes an `approve` decision for the audit trail.
 *
 * Dry run unless --apply is given.
 *   DIRECTORY_REVIEW_DATABASE_URL=... node scripts/local-directory-address-review-rerelease.cjs [--apply]
 */
const { DataSource } = require('typeorm');

const REASON = 'D12 re-release after census cohort cutover (owner 2026-11-20)';

const ELIGIBLE = `
  FROM "directory_address_review_candidate" c
  JOIN LATERAL (SELECT d."actorKind",d."decision",d."checks" FROM "directory_address_review_decision" d
                 WHERE d."candidateId"=c."id" ORDER BY d."createdAt" DESC,d."id" DESC LIMIT 1) d ON true
 WHERE c."status"='revoked' AND d."actorKind"='auto' AND d."decision"='revoke'
   AND d."checks"->>'cause'='live_row_withdrawn'`;

async function main() {
  const url = process.env.DIRECTORY_REVIEW_DATABASE_URL;
  if (!url) throw Error('DIRECTORY_REVIEW_DATABASE_URL is required');
  const apply = process.argv.includes('--apply');
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    const [{ n }] = await db.query(`SELECT count(*)::int AS n ${ELIGIBLE}`);
    if (!apply) return console.log(JSON.stringify({ apply, eligible: n }));
    const done = await db.transaction(async (manager) => {
      // TypeORM returns [rows, affectedCount] for UPDATE ... RETURNING.
      const [rows] = await manager.query(
        `UPDATE "directory_address_review_candidate" u SET "status"='auto_approved',"updatedAt"=CURRENT_TIMESTAMP
           FROM (SELECT c."id",c."checks",c."policyVersion" ${ELIGIBLE}) e WHERE u."id"=e."id"
         RETURNING u."id",e."checks",e."policyVersion"`
      );
      for (let i = 0; i < rows.length; i += 1000) {
        await manager.query(
          `INSERT INTO "directory_address_review_decision" ("candidateId","actorKind","actorId","decision","reason","checks","policyVersion","appliedAt")
           SELECT x."id",'auto',NULL,'approve',$2,x."checks",x."policyVersion",NULL
             FROM jsonb_to_recordset($1::jsonb) AS x("id" uuid,"checks" jsonb,"policyVersion" text)`,
          [JSON.stringify(rows.slice(i, i + 1000)), REASON]
        );
      }
      return rows.length;
    });
    console.log(JSON.stringify({ apply, released: done }));
  } finally {
    await db.destroy();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
