const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { pendingChecks } = require('../src/register-pending-runtime');

const url = process.env.S5_BINDING_READ_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/directory_binding_read_test_[a-z0-9_]+$/i.test(parsed.pathname)
  ) {
    throw Error(
      'A dedicated loopback directory_binding_read_test_* database is required'
    );
  }
}

const identity = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const town = randomUUID();
const changeToken = randomUUID();
const scanId = 'a'.repeat(64);
const policyId = 'b'.repeat(64);
const secret = 'cursor-postgres-fixture-secret-32-bytes';
const snapshot = {
  id: town,
  name: 'Fixture Town',
  slug: null,
  adminArea: 'GA',
  appScope: 'local-hub',
  isPrivate: false,
  localityType: 'town',
};
const bounds = '-84,30,-82,32';
const hex = (c) => c.repeat(64);

const listing = (name) => ({
  name,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83, 31] },
  attribution: ['Fixture source'],
  notices: [],
  termsUrls: ['https://example.test/terms'],
  assignmentChangeToken: changeToken,
  reviewed: {
    address: `${name} street`,
    website: 'https://fixture.example.test/',
    phone: '+19125550100',
    attribution: ['Reviewed credit'],
    notices: ['Reviewed notice'],
    termsUrls: ['https://example.test/license'],
    evidenceUrl: 'https://fixture.example.test/evidence',
  },
});

async function setup(db) {
  await db.query(
    'TRUNCATE directory_reviewed_binding_event, directory_reviewed_binding, directory_overture_private_row, directory_reviewed_spatial, directory_reviewed_spatial_state'
  );
  const request = {
    ...identity,
    sweep: { generation: '1' },
    lastCompletedSweep: {
      generation: '1',
      completedAt: new Date().toISOString(),
    },
  };
  await db.query(
    `INSERT INTO directory_installation (id, "recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`,
    [identity.recoveryEpoch]
  );
  await db.query(
    `INSERT INTO directory_census_progress (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration")
     VALUES ('recovery','reg-running',NULL,'register-pending-v1',$1::jsonb,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET phase=EXCLUDED.phase,cursor=NULL,protocol=EXCLUDED.protocol,"registerRequest"=EXCLUDED."registerRequest","sourceEpoch"=EXCLUDED."sourceEpoch","recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,"activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","directoryGeneration"=EXCLUDED."directoryGeneration"`,
    [
      JSON.stringify(request),
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
      identity.socialGeneration,
      identity.directoryGeneration,
    ]
  );
  await db.query(
    `INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'Fixture Town',true) ON CONFLICT ("communityId") DO UPDATE SET eligible=true`,
    [town]
  );
  await db.query(
    'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO UPDATE SET revoked=false',
    [policyId]
  );
  await db.query(
    'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2) ON CONFLICT ("scanId") DO UPDATE SET "policyId"=EXCLUDED."policyId"',
    [scanId, policyId]
  );
  await db.query(
    'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
    [scanId]
  );
}

const addRow = (db, row, name) =>
  db.query(
    'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)',
    [scanId, row, town, JSON.stringify(listing(name))]
  );

function addBinding(
  db,
  row,
  { state, provenance = 'contact_stage', until = null }
) {
  const legacy = provenance === 'unknown_legacy';
  return db.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber",provenance,"stageScanId","stageSourceFileRowNumber","stagePolicyId","stageContentHash","reviewedHash",state,"verifiedUntil")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      randomUUID(),
      legacy ? null : randomUUID(),
      town,
      scanId,
      row,
      provenance,
      legacy ? null : hex('c'),
      legacy ? null : row,
      legacy ? null : hex('d'),
      legacy ? null : hex('1'),
      legacy ? null : hex('2'),
      state,
      until,
    ]
  );
}

const {
  reconcile,
} = require('../../../scripts/local-directory-reviewed-spatial-reconcile.cjs');
const project = (db) => reconcile(db, { apply: true });

const checksFor = (db) =>
  pendingChecks(
    db,
    {
      scan: async () => [],
      current: async () => ({ status: 'current', changeToken, snapshot }),
    },
    identity,
    secret
  );
const future = () => new Date(Date.now() + 3_600_000);
const past = () => new Date(Date.now() - 3_600_000);

test(
  'only an active binding with a current lease serves reviewed fields',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await setup(db);
      const cases = [
        ['no binding', null],
        ['pending', { state: 'pending' }],
        ['suspended', { state: 'suspended' }],
        ['retired', { state: 'retired' }],
        ['legacy', { state: 'suspended', provenance: 'unknown_legacy' }],
        ['expired lease', { state: 'active', until: past() }],
        ['active', { state: 'active', until: future() }],
      ];
      for (const [index, [name, binding]] of cases.entries()) {
        await addRow(db, index + 1, name);
        if (binding) await addBinding(db, index + 1, binding);
      }
      await project(db);
      const checks = checksFor(db);
      const plain = await checks.localListings(town);
      assert.equal(plain.listings.length, cases.length);
      for (const item of plain.listings) {
        const served = item.name === 'active';
        assert.equal(item.address !== undefined, served, item.name);
        assert.equal(item.website !== undefined, served, item.name);
        assert.equal(item.phone !== undefined, served, item.name);
        assert.equal(
          item.notices.includes('Reviewed notice'),
          served,
          item.name
        );
      }
      assert.equal(
        plain.listings[0].name,
        'active',
        'reviewed-first ordering uses the gate'
      );

      const bounded = await checks.localListings(
        town,
        0,
        '',
        false,
        '',
        true,
        '',
        undefined,
        bounds
      );
      assert.deepEqual(
        bounded.listings.map((item) => item.name),
        ['active']
      );
      assert.equal(bounded.hasMore, false);

      await db.query(
        `UPDATE directory_reviewed_binding SET state='suspended',"stateCause"='stage_content_changed' WHERE state='active'`
      );
      assert.equal(
        (
          await checks.localListings(
            town,
            0,
            '',
            false,
            '',
            true,
            '',
            undefined,
            bounds
          )
        ).listings.length,
        0
      );
      await db.query(
        `UPDATE directory_reviewed_binding SET state='active',"verifiedUntil"=now()+interval '1 hour',"stateCause"=NULL WHERE "sourceFileRowNumber"=7`
      );
      assert.equal(
        (
          await checks.localListings(
            town,
            0,
            '',
            false,
            '',
            true,
            '',
            undefined,
            bounds
          )
        ).listings.length,
        1
      );
      await db.query(
        `UPDATE directory_reviewed_binding SET "verifiedUntil"=now()-interval '1 second' WHERE state='active'`
      );
      assert.equal(
        (
          await checks.localListings(
            town,
            0,
            '',
            false,
            '',
            true,
            '',
            undefined,
            bounds
          )
        ).listings.length,
        0
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'hasMore is computed after the gate and a binding suspended between pages disappears',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await setup(db);
      for (let row = 1; row <= 5; row++)
        await addRow(db, row, `Ungated ${row}`);
      for (let row = 6; row <= 30; row++) {
        await addRow(db, row, `Active ${row}`);
        await addBinding(db, row, { state: 'active', until: future() });
      }
      await project(db);
      const checks = checksFor(db);
      const exact = await checks.localListings(
        town,
        0,
        '',
        false,
        '',
        true,
        '',
        undefined,
        bounds
      );
      assert.equal(exact.listings.length, 25);
      assert.equal(
        exact.hasMore,
        false,
        'ungated rows must not count toward hasMore'
      );
      assert.equal(exact.nextCursor, null);

      await addRow(db, 31, 'Active 31');
      await addBinding(db, 31, { state: 'active', until: future() });
      await project(db);
      const first = await checks.localListings(
        town,
        0,
        '',
        false,
        '',
        true,
        '',
        undefined,
        bounds
      );
      assert.equal(first.listings.length, 25);
      assert.equal(first.hasMore, true);
      await db.query(
        `UPDATE directory_reviewed_binding SET state='suspended' WHERE "sourceFileRowNumber"=31`
      );
      const second = await checks.localListings(
        town,
        0,
        '',
        false,
        '',
        true,
        first.nextCursor,
        undefined,
        bounds
      );
      assert.equal(second.listings.length, 0);
      assert.equal(second.hasMore, false);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'readiness health counts expired leases and suspended bindings without failing',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      await setup(db);
      await addRow(db, 1, 'A');
      await addBinding(db, 1, { state: 'active', until: future() });
      await addRow(db, 2, 'B');
      await addBinding(db, 2, { state: 'active', until: past() });
      await addRow(db, 3, 'C');
      await addBinding(db, 3, { state: 'suspended' });
      await addRow(db, 4, 'D');
      await addBinding(db, 4, { state: 'pending' });
      assert.deepEqual(await checksFor(db).bindingHealth(), {
        expiredLeases: 1,
        suspended: 1,
        pending: 1,
        active: 1,
      });
    } finally {
      await db.destroy();
    }
  }
);
