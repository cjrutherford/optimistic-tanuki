// Shared seed helpers for the business identity carry and read tests. Rows are written in plain SQL; the carry
// engine and the read path are the code under test.
const { upstreamKeyHash, businessNameHash } = require('../src/business-identity');

const KEY = 'business-identity-test-key-0123456789abcdef';
const hex = (c) => c.repeat(64);
const hash = (id) => upstreamKeyHash(KEY, id);

const TABLES = ['directory_business_event', 'directory_business_assertion', 'directory_business_carry_state', 'directory_business', 'directory_overture_source_key',
  'directory_overture_source_evidence', 'directory_listing_identity', 'directory_overture_private_row_revocation', 'directory_overture_private_revocation',
  'directory_overture_private_row', 'directory_overture_private_completion', 'directory_overture_private_membership', 'directory_overture_private_scan_lock',
  'directory_overture_private_policy'];

const clear = (db) => db.query(`TRUNCATE ${TABLES.join(',')} CASCADE`);

/**
 * One cohort: a policy and its scans. `scans` is `{ scan, rows: [{ n, id, name, withdrawn }] }`, where `id` is the
 * upstream id (omit it for a keyless row). Evidence is written when `release` is given.
 */
async function cohort(db, { policy, town, release, scans }) {
  await db.query('INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO NOTHING', [policy]);
  for (const { scan, rows } of scans) {
    await db.query('INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING', [scan]);
    await db.query('INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)', [scan, policy]);
    await db.query('INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING', [scan]);
    if (release) {
      await db.query(
        `INSERT INTO directory_overture_source_evidence ("scanId","evidenceVersion",kind,"releaseId","artifactUrl","artifactEtag","inventorySha256","evidenceSha256",recorder)
         VALUES ($1,1,'captured',$2,'https://example.test/artifact','etag',$3,$4,'test')`, [scan, release, hex('1'), hex('2')]);
    }
    for (const row of rows) {
      const listing = { name: row.name ?? `Place ${row.n}`, category: 'restaurant', location: { type: 'Point', coordinates: [-83, 31] }, attribution: ['Fixture'], notices: [], termsUrls: ['https://example.test/terms'] };
      await db.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)', [scan, row.n, town, JSON.stringify(listing)]);
      if (row.id !== undefined) {
        await db.query('INSERT INTO directory_overture_source_key ("scanId","sourceFileRowNumber","upstreamKeyHash","keyVersion") VALUES ($1,$2,$3,1)', [scan, row.n, hash(row.id)]);
      }
      if (row.withdrawn) await db.query('INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,$2)', [scan, row.n]);
    }
  }
}

const counts = async (db) => {
  const out = {};
  for (const t of ['directory_business', 'directory_business_assertion', 'directory_business_event', 'directory_business_carry_state']) {
    out[t] = (await db.query(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) AS h, count(*)::int AS n FROM ${t} x`))[0];
  }
  return out;
};

const assertions = (db, policy) => db.query(
  `SELECT a."scanId", a."sourceFileRowNumber"::text AS row, a."businessId", a.state, a.confidence FROM directory_business_assertion a WHERE a."policyId"=$1 ORDER BY a."scanId", a."sourceFileRowNumber"`, [policy]);

module.exports = { KEY, hex, hash, nameHash: (name) => businessNameHash(KEY, name), cohort, clear, counts, assertions };
