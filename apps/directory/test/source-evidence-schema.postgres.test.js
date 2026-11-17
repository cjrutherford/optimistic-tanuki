const test = require('node:test');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const hex = c => c.repeat(64);
const row = (over = {}) => ({
  scanId: hex('a'), evidenceVersion: 1, kind: 'captured', releaseId: '2026-10-21.0',
  artifactUrl: 'https://example.invalid/a.parquet', artifactEtag: 'abc-2', artifactBytes: '10',
  upstreamLastModified: '2026-10-21T12:00:00Z', observedAt: '2026-11-16T00:00:00Z', recordedAt: '2026-11-16T00:00:01Z',
  recorder: 'test', inventorySha256: hex('b'), evidenceSha256: hex('c'), ...over,
});
const insert = (db, r) => { const keys = Object.keys(r); return db.query(`INSERT INTO directory_overture_source_evidence (${keys.map(k => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`, keys.map(k => r[k])); };

test('source evidence schema constraints', { skip: !url }, async t => {
  const db = new DataSource({ type: 'postgres', url }); await db.initialize();
  try {
    await db.query('TRUNCATE directory_overture_source_evidence');
    await t.test('accepts a captured row and an attached_verified row without observedAt', async () => {
      await insert(db, row());
      await insert(db, row({ scanId: hex('d'), kind: 'attached_verified', observedAt: null }));
      await db.query('TRUNCATE directory_overture_source_evidence');
    });
    await t.test('rejects bad release id, future Last-Modified, bad kind, attached with observedAt, far-future observedAt', async () => {
      await assert.rejects(insert(db, row({ releaseId: '2026-10-21' })), /CHK_directory_source_evidence_release/);
      await assert.rejects(insert(db, row({ releaseId: 'x2026-10-21.0' })), /CHK_directory_source_evidence_release/);
      await assert.rejects(insert(db, row({ upstreamLastModified: '2026-11-17T00:00:00Z' })), /CHK_directory_source_evidence_modified/);
      await assert.rejects(insert(db, row({ kind: 'inferred', observedAt: null })), /CHK_directory_source_evidence_kind/);
      await assert.rejects(insert(db, row({ kind: 'attached_verified' })), /CHK_directory_source_evidence_attached/);
      await assert.rejects(insert(db, row({ observedAt: '2026-11-16T01:00:00Z' })), /CHK_directory_source_evidence_observed/);
    });
    await t.test('allows a null upstream date and the primary key blocks a second row per scan', async () => {
      await insert(db, row({ upstreamLastModified: null }));
      await assert.rejects(insert(db, row()), /duplicate key|pkey/i);
      await db.query('TRUNCATE directory_overture_source_evidence');
    });
  } finally { await db.destroy(); }
});
