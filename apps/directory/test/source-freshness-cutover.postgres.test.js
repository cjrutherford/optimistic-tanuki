const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { copySourceEvidence } = require('../src/source-evidence-store');
const { evidenceHash, evidenceHashMatches } = require('../src/source-freshness');

// Two disposable databases at migration head: live (DIRECTORY_TEST_DATABASE_URL) and stage.
const liveUrl = process.env.DIRECTORY_TEST_DATABASE_URL, stageUrl = process.env.SOURCE_EVIDENCE_STAGE_TEST_DATABASE_URL;
const scans = ['1', '2', '3'].map(c => c.repeat(64));
const core = (scanId, over = {}) => ({ scanId, evidenceVersion: 1, kind: 'captured', releaseId: '2026-10-21.0', artifactUrl: 'https://example.invalid/a.parquet', artifactEtag: 'abc', artifactBytes: '10', upstreamLastModified: new Date('2026-10-21T12:00:00Z'), observedAt: new Date('2026-11-16T00:00:00Z'), recorder: 'test', inventorySha256: 'b'.repeat(64), ...over });
const insert = (db, c, recordedAt, hash) => db.query('INSERT INTO directory_overture_source_evidence ("scanId","evidenceVersion","kind","releaseId","artifactUrl","artifactEtag","artifactBytes","upstreamLastModified","observedAt","recordedAt","recorder","inventorySha256","evidenceSha256") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)', [c.scanId, c.evidenceVersion, c.kind, c.releaseId, c.artifactUrl, c.artifactEtag, c.artifactBytes, c.upstreamLastModified, c.observedAt, recordedAt, c.recorder, c.inventorySha256, hash]);

test('cutover copies verified evidence, drops tampered rows, leaves absent ones absent', { skip: !liveUrl || !stageUrl }, async () => {
  const live = new DataSource({ type: 'postgres', url: liveUrl }), stage = new DataSource({ type: 'postgres', url: stageUrl });
  await live.initialize(); await stage.initialize();
  try {
    for (const db of [live, stage]) await db.query('TRUNCATE directory_overture_source_evidence');
    const good = core(scans[0]), tampered = core(scans[1]);
    const recordedAt = new Date('2026-11-16T00:00:05Z');
    await insert(stage, good, recordedAt, evidenceHash(good));
    await insert(stage, tampered, recordedAt, evidenceHash({ ...tampered, artifactEtag: 'zzz' }));
    const result = await live.transaction(manager => copySourceEvidence(stage, manager, scans));
    assert.deepEqual(result, { copied: [scans[0]], rejected: [scans[1]], absent: [scans[2]] });
    const rows = await live.query('SELECT * FROM directory_overture_source_evidence');
    assert.equal(rows.length, 1); assert.equal(rows[0].scanId, scans[0]);
    assert.equal(evidenceHashMatches(rows[0]), true);
    const [stored] = await stage.query('SELECT * FROM directory_overture_source_evidence WHERE "scanId"=$1', [scans[0]]);
    assert.deepEqual(rows[0], stored, 'copied equal, recordedAt included');
    await assert.rejects(live.transaction(manager => copySourceEvidence(stage, manager, scans)), /duplicate key/);
    assert.equal((await live.query('SELECT 1 FROM directory_overture_source_evidence')).length, 1, 'failed copy rolls back');
  } finally { await live.destroy(); await stage.destroy(); }
});
