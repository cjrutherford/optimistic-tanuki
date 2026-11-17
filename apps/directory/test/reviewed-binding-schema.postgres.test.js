const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const hex = (c) => c.repeat(64);

const contactStage = (overrides = {}) => ({
  candidateId: randomUUID(), decisionId: randomUUID(), communityId: randomUUID(),
  scanId: hex('a'), sourceFileRowNumber: '1', provenance: 'contact_stage',
  stageScanId: hex('c'), stageSourceFileRowNumber: '9', stagePolicyId: hex('d'),
  stageContentHash: hex('1'), reviewedHash: hex('2'), state: 'pending', verifiedUntil: null,
  ...overrides,
});

async function insert(db, row) {
  const keys = Object.keys(row);
  const [created] = await db.query(
    `INSERT INTO directory_reviewed_binding (${keys.map((k) => `"${k}"`).join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`,
    keys.map((k) => row[k]),
  );
  return created.id;
}

test('reviewed binding schema constraints', { skip: !url }, async (t) => {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  const rejects = (promise, pattern) => assert.rejects(promise, pattern);
  try {
    await db.query('TRUNCATE directory_reviewed_binding_event, directory_reviewed_binding');

    await t.test('only one non-retired binding per served row', async () => {
      const first = await insert(db, contactStage());
      await rejects(insert(db, contactStage()), /UQ_directory_reviewed_binding_live_row/);
      await db.query(`UPDATE directory_reviewed_binding SET state='retired',"retiredAt"=now() WHERE id=$1`, [first]);
      await insert(db, contactStage());
      await insert(db, contactStage({ sourceFileRowNumber: '2' }));
      await db.query('TRUNCATE directory_reviewed_binding');
    });

    await t.test('unknown_legacy can never be active or pending', async () => {
      const legacy = { candidateId: randomUUID(), communityId: randomUUID(), scanId: hex('b'), sourceFileRowNumber: '1', provenance: 'unknown_legacy' };
      const id = await insert(db, { ...legacy, state: 'suspended' });
      await rejects(db.query(`UPDATE directory_reviewed_binding SET state='active',"verifiedUntil"=now()+interval '1 day' WHERE id=$1`, [id]), /CHK_directory_reviewed_binding_legacy_hidden/);
      await rejects(insert(db, { ...legacy, sourceFileRowNumber: '2', state: 'pending' }), /CHK_directory_reviewed_binding_legacy_hidden/);
      await rejects(insert(db, { ...legacy, sourceFileRowNumber: '3', state: 'active', verifiedUntil: new Date(Date.now() + 1000) }), /CHK_directory_reviewed_binding_legacy_hidden/);
      await db.query('TRUNCATE directory_reviewed_binding');
    });

    await t.test('contact_stage requires stage ids, hashes and a decision', async () => {
      for (const missing of ['stageScanId', 'stagePolicyId', 'stageContentHash', 'reviewedHash', 'decisionId']) {
        await rejects(insert(db, contactStage({ [missing]: null })), /CHK_directory_reviewed_binding_contact_stage/, missing);
      }
      await insert(db, contactStage());
      await db.query('TRUNCATE directory_reviewed_binding');
    });

    await t.test('source_file needs hashes and a decision but not stage ids', async () => {
      const file = (o = {}) => contactStage({ provenance: 'source_file', stageScanId: null, stagePolicyId: null, stageSourceFileRowNumber: null, ...o });
      await insert(db, file());
      await rejects(insert(db, file({ sourceFileRowNumber: '2', reviewedHash: null })), /CHK_directory_reviewed_binding_source_file/);
      await rejects(insert(db, file({ sourceFileRowNumber: '3', decisionId: null })), /CHK_directory_reviewed_binding_source_file/);
      await db.query('TRUNCATE directory_reviewed_binding');
    });

    await t.test('active requires a lease; unknown states and provenance are refused', async () => {
      await rejects(insert(db, contactStage({ state: 'active' })), /CHK_directory_reviewed_binding_active_lease/);
      await insert(db, contactStage({ state: 'active', verifiedUntil: new Date(Date.now() + 60_000) }));
      await rejects(insert(db, contactStage({ sourceFileRowNumber: '5', state: 'visible' })), /CHK_directory_reviewed_binding_state/);
      await rejects(insert(db, contactStage({ sourceFileRowNumber: '6', provenance: 'guessed' })), /CHK_directory_reviewed_binding_provenance/);
      await db.query('TRUNCATE directory_reviewed_binding');
    });

    await t.test('a binding transition event is recorded once per cause', async () => {
      const bindingId = randomUUID();
      const event = (kind, cause) => db.query('INSERT INTO directory_reviewed_binding_event ("bindingId",kind,cause) VALUES ($1,$2,$3)', [bindingId, kind, cause]);
      await event('published', 'publication');
      await rejects(event('published', 'publication'), /UQ_directory_reviewed_binding_event_transition/);
      await event('retired', 'stage_scan_revoked');
      await event('retired', 'stage_policy_revoked');
      await rejects(event('archived', 'x'), /CHK_directory_reviewed_binding_event_kind/);
      await db.query('TRUNCATE directory_reviewed_binding_event');
    });

    await t.test('reviewed spatial projection schema', async () => {
      const [{ spatial, state }] = await db.query(`SELECT to_regclass('directory_reviewed_spatial') AS spatial, to_regclass('directory_reviewed_spatial_state') AS state`);
      assert.ok(spatial && state);
      const indexes = await db.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='directory_reviewed_spatial'`);
      const named = Object.fromEntries(indexes.map((i) => [i.indexname, i.indexdef]));
      assert.match(named.IDX_directory_reviewed_spatial_point, /USING gist/i);
      assert.match(named.UQ_directory_reviewed_spatial_binding, /UNIQUE/);
      assert.ok(named.IDX_directory_reviewed_spatial_town_keyset);
      assert.ok(named.directory_reviewed_spatial_pkey || Object.keys(named).some((n) => /^PK_/.test(n)));
      const [{ type }] = await db.query(`SELECT format_type(atttypid, atttypmod) AS type FROM pg_attribute WHERE attrelid='directory_reviewed_spatial'::regclass AND attname='point'`);
      assert.equal(type, 'geometry(Point,4326)');
      const [{ nullable }] = await db.query(`SELECT NOT attnotnull AS nullable FROM pg_attribute WHERE attrelid='directory_reviewed_spatial'::regclass AND attname='point'`);
      assert.equal(nullable, true);
      const row = [hex('a'), '1', randomUUID(), randomUUID(), hex('d').slice(0, 32), 1];
      await db.query(`INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","point","listingDigest","validatorVersion") VALUES ($1,$2,$3,$4,ST_SetSRID(ST_MakePoint(-83,31),4326),$5,$6)`, row);
      await rejects(db.query(`INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","listingDigest","validatorVersion") VALUES ($1,$2,$3,$4,$5,$6)`, [hex('a'), '1', randomUUID(), row[3], row[4], 1]), /duplicate key/);
      await rejects(db.query(`INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","listingDigest","validatorVersion") VALUES ($1,$2,$3,$4,$5,$6)`, [hex('a'), '2', row[2], row[3], row[4], 1]), /UQ_directory_reviewed_spatial_binding/);
      await db.query(`INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","listingDigest","validatorVersion") VALUES ($1,$2,$3,$4,$5,$6)`, [hex('a'), '3', randomUUID(), row[3], row[4], 1]);
      await db.query('TRUNCATE directory_reviewed_spatial');
      await db.query(`INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion") VALUES ('current',1)`);
      await rejects(db.query(`INSERT INTO directory_reviewed_spatial_state (id,"validatorVersion") VALUES ('other',1)`), /CHK_directory_reviewed_spatial_state_singleton/);
      await db.query('TRUNCATE directory_reviewed_spatial_state');
    });
  } finally {
    await db.destroy();
  }
});
