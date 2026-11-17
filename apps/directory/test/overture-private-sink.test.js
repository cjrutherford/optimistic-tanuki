const test = require('node:test');
const assert = require('node:assert/strict');
const { OverturePrivateSink } = require('../src/overture-private-sink');

test('preserves the adult visibility marker without copying arbitrary source fields', async () => {
  const writes = [];
  const manager = {
    async query(sql, args) {
      if (sql.startsWith('SELECT revoked')) return [{ revoked: false }];
      if (
        sql.startsWith(
          'SELECT "policyId" FROM directory_overture_private_membership'
        )
      )
        return [{ policyId: '1'.repeat(64) }];
      if (sql.startsWith('SELECT')) return [];
      writes.push({ sql, args });
      return [];
    },
  };
  const sink = new OverturePrivateSink({
      query: async () => [],
      transaction: async (f) => f(manager),
    }),
    scanId = 'a'.repeat(64);
  await sink.load(scanId, '1'.repeat(64));
  const listing = {
    name: 'Fixture',
    category: 'adult_entertainment_venue',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
    adult: true,
    assignmentChangeToken: '00000000-0000-4000-8000-000000000005',
    privateField: 'hidden',
  };
  await sink.commit(
    [
      {
        sourceFileRowNumber: 1,
        regionId: 'town',
        outcome: { status: 'eligible', listing },
      },
    ],
    { scanId, sourceFileRowNumber: 1 }
  );
  const inserted = writes.find((x) =>
    x.sql.startsWith('INSERT INTO directory_overture_private_row (')
  );
  const saved = JSON.parse(inserted.args[3]);
  assert.equal(saved.adult, true);
  assert.equal(saved.assignmentChangeToken, listing.assignmentChangeToken);
  assert.equal(saved.privateField, undefined);
});

test('retains approved contact fields only when the capture opts in', async () => {
  const writes = [];
  const manager = {
    async query(sql, args) {
      if (sql.startsWith('SELECT revoked')) return [{ revoked: false }];
      if (
        sql.startsWith(
          'SELECT "policyId" FROM directory_overture_private_membership'
        )
      )
        return [{ policyId: '1'.repeat(64) }];
      if (sql.startsWith('SELECT')) return [];
      writes.push({ sql, args });
      return [];
    },
  };
  const scanId = 'a'.repeat(64),
    listing = {
      name: 'Fixture',
      category: 'restaurant',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Source'],
      notices: [],
      termsUrls: [],
      addresses: ['10 Main St'],
      websites: ['https://example.test'],
      phones: ['+19125550100'],
      privateField: 'hidden',
    };
  for (const includeContactFields of [true, false]) {
    writes.length = 0;
    const sink = new OverturePrivateSink(
      { query: async () => [], transaction: async (f) => f(manager) },
      { includeContactFields }
    );
    await sink.load(scanId, '1'.repeat(64));
    await sink.commit(
      [
        {
          sourceFileRowNumber: 1,
          regionId: 'town',
          outcome: { status: 'eligible', listing },
        },
      ],
      { scanId, sourceFileRowNumber: 1 }
    );
    const inserted = writes.find((x) =>
      x.sql.startsWith('INSERT INTO directory_overture_private_row (')
    );
    const saved = JSON.parse(inserted.args[3]);
    assert.equal(saved.privateField, undefined);
    if (includeContactFields) {
      assert.deepEqual(saved.addresses, ['10 Main St']);
      assert.deepEqual(saved.websites, ['https://example.test']);
      assert.deepEqual(saved.phones, ['+19125550100']);
    } else {
      assert.equal(saved.addresses, undefined);
      assert.equal(saved.websites, undefined);
      assert.equal(saved.phones, undefined);
    }
  }
});

test('rejects malformed contact fields when the capture opts in', async () => {
  const manager = {
    async query(sql) {
      if (sql.startsWith('SELECT revoked')) return [{ revoked: false }];
      if (
        sql.startsWith(
          'SELECT "policyId" FROM directory_overture_private_membership'
        )
      )
        return [{ policyId: '1'.repeat(64) }];
      if (sql.startsWith('SELECT')) return [];
      return [];
    },
  };
  const sink = new OverturePrivateSink(
    { query: async () => [], transaction: async (f) => f(manager) },
    { includeContactFields: true }
  );
  const scanId = 'a'.repeat(64);
  await sink.load(scanId, '1'.repeat(64));
  const listing = {
    name: 'Fixture',
    category: 'restaurant',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
    addresses: ['10 Main St', 42],
  };
  await assert.rejects(
    sink.commit(
      [
        {
          sourceFileRowNumber: 1,
          regionId: 'town',
          outcome: { status: 'eligible', listing },
        },
      ],
      { scanId, sourceFileRowNumber: 1 }
    ),
    /Invalid private contact fields/
  );
});

test('retains validated source provenance only when the capture opts in', async () => {
  const writes = [];
  const manager = {
    async query(sql, args) {
      if (sql.startsWith('SELECT revoked')) return [{ revoked: false }];
      if (
        sql.startsWith(
          'SELECT "policyId" FROM directory_overture_private_membership'
        )
      )
        return [{ policyId: '1'.repeat(64) }];
      if (sql.startsWith('SELECT')) return [];
      writes.push({ sql, args });
      return [];
    },
  };
  const scanId = 'a'.repeat(64),
    listing = {
      name: 'Fixture',
      category: 'restaurant',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Source'],
      notices: [],
      termsUrls: [],
      sources: [
        {
          dataset: 'meta',
          license: 'CDLA-Permissive-2.0',
          property: '/properties/addresses',
          secret: 'hidden',
        },
      ],
    };
  const sink = new OverturePrivateSink(
    { query: async () => [], transaction: async (f) => f(manager) },
    { includeSourceProvenance: true }
  );
  await sink.load(scanId, '1'.repeat(64));
  await sink.commit(
    [
      {
        sourceFileRowNumber: 1,
        regionId: 'town',
        outcome: { status: 'eligible', listing },
      },
    ],
    { scanId, sourceFileRowNumber: 1 }
  );
  const saved = JSON.parse(
    writes.find((x) =>
      x.sql.startsWith('INSERT INTO directory_overture_private_row (')
    ).args[3]
  );
  assert.deepEqual(saved.sources, [
    {
      property: '/properties/addresses',
      dataset: 'meta',
      license: 'CDLA-Permissive-2.0',
    },
  ]);
});

test('commits the validated checkpoint even when the caller mutates its object during the lock wait', async () => {
  let release, locked;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const waiting = new Promise((resolve) => {
    locked = resolve;
  });
  const writes = [];
  let loading = true;
  const manager = {
    async query(sql, args) {
      if (sql.startsWith('SELECT revoked')) return [{ revoked: false }];
      if (
        sql.startsWith(
          'SELECT "policyId" FROM directory_overture_private_membership'
        )
      )
        return [{ policyId: '1'.repeat(64) }];
      if (
        !loading &&
        sql.includes('directory_overture_private_scan_lock') &&
        sql.includes('FOR UPDATE')
      ) {
        locked();
        await gate;
        return [];
      }
      if (sql.includes('SELECT "scanId"')) return [];
      writes.push({ sql, args });
      return [];
    },
  };
  const sink = new OverturePrivateSink({
    query: async () => [],
    transaction: async (f) => f(manager),
  });
  await sink.load('a'.repeat(64), '1'.repeat(64));
  loading = false;
  const next = { scanId: 'a'.repeat(64), sourceFileRowNumber: 1 };
  const pending = sink.commit(
    [
      {
        sourceFileRowNumber: 1,
        regionId: 'town',
        outcome: { status: 'quarantined' },
      },
    ],
    next
  );
  await waiting;
  next.scanId = 'b'.repeat(64);
  next.sourceFileRowNumber = 99;
  release();
  await pending;
  const row = writes.find((x) =>
    x.sql.includes('INSERT INTO directory_overture_private_row')
  );
  const checkpoint = writes.find((x) =>
    x.sql.includes('INSERT INTO directory_overture_private_checkpoint')
  );
  assert.equal(row.args[0], 'a'.repeat(64));
  assert.deepEqual(checkpoint.args, ['a'.repeat(64), 1]);
});

test('skips a revoked row while committing the rest of its batch and checkpoint', async () => {
  const writes = [];
  const manager = {
    async query(sql, args) {
      if (sql.startsWith('SELECT revoked')) return [{ revoked: false }];
      if (
        sql.startsWith(
          'SELECT "policyId" FROM directory_overture_private_membership'
        )
      )
        return [{ policyId: '1'.repeat(64) }];
      if (
        sql.startsWith(
          'SELECT 1 FROM directory_overture_private_row_revocation'
        )
      )
        return args[1] === 2 ? [{}] : [];
      if (sql.startsWith('SELECT')) return [];
      writes.push({ sql, args });
      return [];
    },
  };
  const sink = new OverturePrivateSink({
    query: async () => [],
    transaction: async (f) => f(manager),
  });
  const scanId = 'a'.repeat(64);
  await sink.load(scanId, '1'.repeat(64));
  await sink.commit(
    [2, 3].map((sourceFileRowNumber) => ({
      sourceFileRowNumber,
      regionId: 'town',
      outcome: { status: 'quarantined' },
    })),
    { scanId, sourceFileRowNumber: 3 }
  );
  const rows = writes.filter((x) =>
    x.sql.startsWith('INSERT INTO directory_overture_private_row (')
  );
  assert.deepEqual(
    rows.map((x) => x.args[1]),
    [3]
  );
  assert.deepEqual(
    writes.find((x) =>
      x.sql.startsWith('INSERT INTO directory_overture_private_checkpoint')
    ).args,
    [scanId, 3]
  );
});
