const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { census } = require('../../../scripts/local-directory-business-identity-census.cjs');
const h = require('./reviewed-spatial-helpers');

const url = h.databaseUrl('S5_IDENTITY_TEST_DATABASE_URL', /^\/s5_identity_test_[a-z0-9_]+$/i);
const town = '33333333-3333-4333-8333-333333333333';
const scanId = h.unique();

const TABLES = ['directory_overture_private_row', 'directory_overture_private_membership', 'directory_overture_private_completion',
  'directory_overture_private_policy', 'directory_listing_identity', 'directory_business_link_request', 'directory_business_link_active',
  'directory_reviewed_binding', 'directory_address_review_candidate', 'directory_reviewed_spatial'];
const checksum = async (db) => {
  const out = [];
  for (const t of TABLES) out.push((await db.query(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) AS h FROM ${t} x`))[0].h);
  return out.join(':');
};

test('census counts rows, identities, links and bindings, and writes nothing', { skip: !url }, async () => {
  const db = await h.connect(url);
  try {
    await h.reset(db, [town]);
    await db.query('TRUNCATE directory_listing_identity, directory_business_link_request, directory_business_link_active');
    await h.scan(db, scanId, h.policy('c'));
    await h.bulk(db, { scan: scanId, town, from: 1, count: 3 });
    await h.bulk(db, { scan: scanId, town, from: 4, count: 1, state: 'suspended' });
    await db.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber") VALUES ($1,5)', [scanId]);
    const [{ id: withRow }] = await db.query('INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,1) RETURNING id', [town, scanId]);
    await db.query('INSERT INTO directory_listing_identity ("communityId","scanId","sourceFileRowNumber") VALUES ($1,$2,99)', [town, scanId]);
    await db.query(`INSERT INTO directory_business_link_request ("requestId","townId","listingId","businessCommunityId",status) VALUES (gen_random_uuid(),$1,$2,$1,'pending')`, [town, withRow]);

    const before = await checksum(db);
    const result = await census(db);
    assert.equal(await checksum(db), before);

    assert.equal(result.mode, 'check');
    assert.deepEqual({ total: result.rows.total, eligible: result.rows.eligible, quarantined: result.rows.quarantined }, { total: 5, eligible: 4, quarantined: 1 });
    assert.equal(result.cohorts.length, 1);
    assert.deepEqual({ scans: result.cohorts[0].scans, completedScans: result.cohorts[0].completedScans, towns: result.cohorts[0].towns }, { scans: 1, completedScans: 1, towns: 1 });
    assert.deepEqual(result.listingIdentities, { total: 2, withRow: 1, withoutRow: 1, withLinkRequest: 1, withActiveLink: 0 });
    assert.deepEqual(result.linkRequestsByStatus, { pending: 1 });
    assert.deepEqual(result.bindingsByState, { 'active/contact_stage': 3, 'suspended/contact_stage': 1 });
    assert.deepEqual(result.candidatesByStatus, { published: 4 });
    assert.equal(result.repeatedRegionRowKeysAcrossCompletedScans, 0);
    // No name, address, row content or credential in the report.
    assert.ok(!JSON.stringify(result).includes('Place '));
  } finally {
    await db.destroy();
  }
});

test('census refuses anything but --check and never prints credentials', { skip: !url }, () => {
  const run = (...args) => spawnSync(process.execPath, ['scripts/local-directory-business-identity-census.cjs', ...args], { encoding: 'utf8', env: { ...process.env, DIRECTORY_DATABASE_URL: url } });
  for (const args of [[], ['--apply'], ['--check', '--apply']]) {
    const r = run(...args);
    assert.notEqual(r.status, 0);
    assert.ok(!(r.stdout + r.stderr).includes(new URL(url).password || '\u0000'));
  }
  assert.equal(run('--check').status, 0);
});
