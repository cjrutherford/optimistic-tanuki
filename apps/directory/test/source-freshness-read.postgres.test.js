const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { pendingChecks } = require('../src/register-pending-runtime');
const { evidenceHash } = require('../src/source-freshness');
const { reconcile } = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');

// Needs a migrated disposable database (DIRECTORY_TEST_DATABASE_URL).
const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const identity = { sourceEpoch: '00000000-0000-4000-8000-000000000001', recoveryEpoch: '00000000-0000-4000-8000-000000000002', owner: '00000000-0000-4000-8000-000000000003', activationId: '00000000-0000-4000-8000-000000000004', socialGeneration: '1', directoryGeneration: '2' };
const town = randomUUID(), otherTown = randomUUID(), changeToken = randomUUID();
const scanId = 'a'.repeat(64), otherScan = 'd'.repeat(64), policyId = 'b'.repeat(64), secret = 'cursor-postgres-fixture-secret-32-bytes';
const snapshot = { id: town, name: 'Fixture Town', slug: null, adminArea: 'GA', appScope: 'local-hub', isPrivate: false, localityType: 'town' };
const bounds = '-84,30,-82,32', hex = c => c.repeat(64), DAY = 86400000;
const listing = name => ({ name, category: 'restaurant', location: { type: 'Point', coordinates: [-83, 31] }, attribution: ['Fixture source'], notices: [], termsUrls: ['https://example.test/terms'], assignmentChangeToken: changeToken, reviewed: { address: `${name} street`, website: 'https://fixture.example.test/', phone: '+19125550100', attribution: ['Reviewed credit'], notices: ['Reviewed notice'], termsUrls: ['https://example.test/license'], evidenceUrl: 'https://fixture.example.test/evidence' } });
const checksFor = db => pendingChecks(db, { scan: async () => [], current: async () => ({ status: 'current', changeToken, snapshot }) }, identity, secret);

async function setup(db) {
  await db.query('TRUNCATE directory_overture_source_evidence, directory_overture_private_row_revocation, directory_reviewed_binding_event, directory_reviewed_binding, directory_overture_private_row, directory_overture_private_completion, directory_overture_private_membership, directory_reviewed_spatial, directory_reviewed_spatial_state');
  const request = { ...identity, sweep: { generation: '1' }, lastCompletedSweep: { generation: '1', completedAt: new Date().toISOString() } };
  await db.query(`INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`, [identity.recoveryEpoch]);
  await db.query(`INSERT INTO directory_census_progress (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration") VALUES ('recovery','reg-running',NULL,'register-pending-v1',$1::jsonb,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET phase=EXCLUDED.phase,cursor=NULL,protocol=EXCLUDED.protocol,"registerRequest"=EXCLUDED."registerRequest","sourceEpoch"=EXCLUDED."sourceEpoch","recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,"activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","directoryGeneration"=EXCLUDED."directoryGeneration"`,
    [JSON.stringify(request), identity.sourceEpoch, identity.recoveryEpoch, identity.owner, identity.activationId, identity.socialGeneration, identity.directoryGeneration]);
  await db.query(`INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'Fixture Town',true) ON CONFLICT ("communityId") DO UPDATE SET eligible=true`, [town]);
  await db.query('INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO UPDATE SET revoked=false', [policyId]);
  for (const scan of [scanId, otherScan]) {
    await db.query('INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)', [scan, policyId]);
    await db.query('INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)', [scan]);
  }
  for (let row = 1; row <= 3; row++) {
    await db.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)', [scanId, row, town, JSON.stringify(listing(`Place ${row}`))]);
    await db.query(`INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageScanId","stageSourceFileRowNumber","stagePolicyId","stageContentHash","reviewedHash",state,"verifiedUntil") VALUES ($1,$2,$3,$4,$5,'contact_stage',$6,$7,$8,$9,$10,'active',now()+interval '1 hour')`, [randomUUID(), randomUUID(), town, scanId, row, hex('c'), row, hex('d'), hex('1'), hex('2')]);
  }
  // A scan that has rows only in another town must not influence this town.
  await db.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)', [otherScan, otherTown, JSON.stringify(listing('Elsewhere'))]);
  await reconcile(db, { apply: true });
}
async function evidence(db, scan, ageDays, release = '2026-10-21.0', over = {}) {
  const core = { scanId: scan, evidenceVersion: 1, kind: 'captured', releaseId: release, artifactUrl: 'https://example.invalid/a', artifactEtag: 'abc', artifactBytes: '10', upstreamLastModified: new Date(Date.now() - ageDays * DAY), observedAt: new Date(), recorder: 'test', inventorySha256: hex('e'), ...over };
  await db.query('DELETE FROM directory_overture_source_evidence WHERE "scanId"=$1', [scan]);
  await db.query('INSERT INTO directory_overture_source_evidence ("scanId","evidenceVersion",kind,"releaseId","artifactUrl","artifactEtag","artifactBytes","upstreamLastModified","observedAt","recordedAt",recorder,"inventorySha256","evidenceSha256") VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$10,$11)', [scan, core.kind, release, core.artifactUrl, core.artifactEtag, core.artifactBytes, core.upstreamLastModified, core.observedAt, core.recorder, core.inventorySha256, evidenceHash(core)]);
}
const pages = async checks => ({ plain: await checks.localListings(town), bounded: await checks.localListings(town, 0, '', false, '', true, '', undefined, bounds) });
// `reference` is a randomized sealed token, so it is excluded from content equality.
const content = ({ listings, hasMore, nextCursor }) => JSON.stringify({ listings: listings.map(({ reference, ...rest }) => ({ ...rest, hasReference: typeof reference === 'string' })), hasMore, nextCursor: nextCursor ?? null });

test('pages carry a freshness label that never changes their content', { skip: !url }, async () => {
  const db = new DataSource({ type: 'postgres', url }); await db.initialize();
  try {
    await setup(db);
    const unknown = await pages(checksFor(db));
    for (const page of Object.values(unknown)) assert.deepEqual([page.sourceFreshness.state, page.sourceFreshness.releaseId, page.sourceFreshness.sourcePublishedAt, page.sourceFreshness.acquiredAt], ['unknown', null, null, null]);
    assert.equal(unknown.bounded.listings.length, 3);
    const baseline = { plain: content(unknown.plain), bounded: content(unknown.bounded) };

    await evidence(db, scanId, 10);
    const fresh = await pages(checksFor(db));
    assert.equal(fresh.plain.sourceFreshness.state, 'fresh'); assert.equal(fresh.bounded.sourceFreshness.state, 'fresh');
    assert.equal(fresh.plain.sourceFreshness.releaseId, '2026-10-21.0');
    assert.deepEqual(fresh.plain.sourceFreshness.thresholds, { freshDays: 90, staleDays: 120 });
    assert.ok(fresh.plain.sourceFreshness.acquiredAt);

    await evidence(db, scanId, 100, '2026-08-07.0');
    assert.equal((await pages(checksFor(db))).plain.sourceFreshness.state, 'due');
    await evidence(db, scanId, 200, '2026-04-30.0');
    const stale = await pages(checksFor(db));
    assert.equal(stale.plain.sourceFreshness.state, 'stale'); assert.equal(stale.plain.sourceFreshness.releaseId, '2026-04-30.0');
    for (const [name, page] of Object.entries(stale)) assert.equal(content(page), baseline[name], `${name} results unchanged between unknown, fresh and stale`);

    // A tampered row is unknown, never a claim.
    await db.query(`UPDATE directory_overture_source_evidence SET "releaseId"='2026-04-29.0' WHERE "scanId"=$1`, [scanId]);
    assert.equal((await pages(checksFor(db))).plain.sourceFreshness.state, 'unknown');
  } finally { await db.destroy(); }
});

test('only scans serving the town count, and unknown dominates', { skip: !url }, async () => {
  const db = new DataSource({ type: 'postgres', url }); await db.initialize();
  try {
    await setup(db);
    await evidence(db, scanId, 10);
    // otherScan has no evidence but serves only another town: this town stays fresh.
    assert.equal((await checksFor(db).localListings(town)).sourceFreshness.state, 'fresh');
    // Give the town a second, evidence-less scan: unknown dominates.
    await db.query('INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,2,$2,$3::jsonb)', [otherScan, town, JSON.stringify(listing('Second'))]);
    const page = await checksFor(db).localListings(town);
    assert.equal(page.sourceFreshness.state, 'unknown'); assert.equal(page.sourceFreshness.releaseId, null);
    // A withdrawn row no longer ties the scan to the town.
    await db.query('INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,2)', [otherScan]);
    assert.equal((await checksFor(db).localListings(town)).sourceFreshness.state, 'fresh');
  } finally { await db.destroy(); }
});

test('readiness counts every completed live scan by state', { skip: !url }, async () => {
  const db = new DataSource({ type: 'postgres', url }); await db.initialize();
  try {
    await setup(db);
    assert.deepEqual(await (async () => { const { evaluatedAt, ...rest } = await checksFor(db).sourceFreshnessHealth(); assert.ok(evaluatedAt); return rest; })(), { fresh: 0, due: 0, stale: 0, unknown: 2, oldestPublishedAt: null });
    await evidence(db, scanId, 10); await evidence(db, otherScan, 130, '2026-07-08.0');
    const counts = await checksFor(db).sourceFreshnessHealth();
    assert.deepEqual([counts.fresh, counts.due, counts.stale, counts.unknown], [1, 0, 1, 0]);
    assert.ok(counts.oldestPublishedAt);
    await db.query('UPDATE directory_overture_private_policy SET revoked=true WHERE "policyId"=$1', [policyId]);
    assert.equal((await checksFor(db).sourceFreshnessHealth()).unknown + (await checksFor(db).sourceFreshnessHealth()).fresh, 0, 'revoked policy scans are not counted');
  } finally { await db.destroy(); }
});
