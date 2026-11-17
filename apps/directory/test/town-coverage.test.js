const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  deriveCoverage,
  townCoverage,
  WITHHELD_CAP,
} = require('../src/town-coverage');
const {
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');

const id = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const town = '00000000-0000-4000-8000-000000000005';
const secret = 'local-listing-secret-123456789012345';
const cursorSecret = 'local-cursor-test-secret-123456789012345';
const none = {
  served: false,
  completedLive: false,
  acquiring: false,
  anyTarget: false,
  withheldReviewedDetails: 0,
};
const authorityRow = (patch = {}) => ({
  ...id,
  authorityEpoch: id.recoveryEpoch,
  protocol: 'register-pending-v1',
  phase: 'reg-running',
  cursor: null,
  eligible: true,
  dbNow: new Date('2026-01-01T00:10:00Z'),
  registerRequest: {
    ...id,
    sweep: { generation: '1' },
    lastCompletedSweep: {
      generation: '1',
      completedAt: '2026-01-01T00:00:00Z',
    },
  },
  ...patch,
});
const snapshot = {
  id: town,
  name: 'Town',
  slug: null,
  adminArea: null,
  appScope: 'local-hub',
  isPrivate: false,
  localityType: 'town',
};
const source = () => ({
  scan: async () => [],
  current: async () => ({ status: 'current', changeToken: town, snapshot }),
});
const listing = {
  name: 'Bakery',
  category: 'bakery',
  location: { type: 'Point', coordinates: [-83, 31] },
  attribution: ['Example'],
  notices: [],
  termsUrls: [],
};
/** Routes each statement by what it reads; coverage rows and authority are configurable per test. */
const stubDb = ({ authority = {}, coverage, evidence = [], rows = [] }) => {
  const seen = [];
  return {
    seen,
    query: async (sql, params) => {
      seen.push({ sql, params });
      if (sql.includes('directory_census_progress'))
        return [authorityRow(authority)];
      if (sql.includes('directory_town_scan_target')) {
        if (coverage instanceof Error) throw coverage;
        return [coverage];
      }
      if (sql.includes('directory_overture_source_evidence')) return evidence;
      if (sql.includes('directory_overture_private_row'))
        return rows.map((r, i) => ({
          listing,
          scanId: 'a'.repeat(64),
          sourceFileRowNumber: String(i + 1),
          ...r,
        }));
      return [];
    },
  };
};
const facts = (over) => ({
  served: false,
  completedLive: false,
  acquiring: false,
  anyTarget: false,
  withheld: 0,
  ...over,
});

test('coverage derives each of the six states from persisted facts', () => {
  const state = (patch) => deriveCoverage({ ...none, ...patch });
  assert.deepEqual(state({ served: true, anyTarget: true }), {
    state: 'available',
    withheldReviewedDetails: 0,
  });
  assert.equal(state({ served: true }).state, 'available');
  assert.equal(state({ served: true, acquiring: true }).state, 'partial');
  assert.equal(
    state({ served: true, completedLive: true, acquiring: true }).state,
    'partial'
  );
  assert.equal(state({ completedLive: true, anyTarget: true }).state, 'empty');
  assert.equal(
    state({ completedLive: true, acquiring: true }).state,
    'empty',
    'a finished scan outranks one still running when nothing is served'
  );
  assert.equal(state({ acquiring: true, anyTarget: true }).state, 'acquiring');
  assert.deepEqual(state({ anyTarget: true }), {
    state: 'blocked',
    reason: 'policy-withdrawn',
    withheldReviewedDetails: 0,
  });
  assert.deepEqual(state({}), { state: 'unknown', withheldReviewedDetails: 0 });
  for (const c of [
    state({ served: true }),
    state({ completedLive: true }),
    state({ acquiring: true }),
    state({}),
  ])
    assert.equal('reason' in c, false);
});

test('withheld reviewed details are a capped, non-negative count', () => {
  assert.equal(
    deriveCoverage({ ...none, served: true, withheldReviewedDetails: 7 })
      .withheldReviewedDetails,
    7
  );
  assert.equal(
    deriveCoverage({ ...none, withheldReviewedDetails: 5_000_000 })
      .withheldReviewedDetails,
    WITHHELD_CAP
  );
  assert.equal(
    deriveCoverage({ ...none, withheldReviewedDetails: -3 })
      .withheldReviewedDetails,
    0
  );
  assert.equal(
    deriveCoverage({ ...none, withheldReviewedDetails: NaN })
      .withheldReviewedDetails,
    0
  );
});

test('townCoverage reads one town-level statement that no page filter can reach', async () => {
  const db = stubDb({
    coverage: facts({ completedLive: true, anyTarget: true }),
  });
  const coverage = await townCoverage(db, town, town);
  assert.equal(coverage.state, 'empty');
  const [{ sql, params }] = db.seen;
  // Only the town and its assignment token: no search, category, bounds, cursor or adult parameter exists.
  assert.deepEqual(params, [town, town]);
  assert.doesNotMatch(sql, /\$[3-9]/);
  assert.doesNotMatch(sql, /listing->'adult'/);
  assert.doesNotMatch(sql, /directory_overture_source_evidence/);
  assert.match(sql, /directory_overture_private_revocation/);
  assert.match(sql, /directory_overture_private_row_revocation/);
  assert.match(sql, /directory_business_assertion/);
  assert.match(sql, /reviewed/);
  assert.match(sql, /LIMIT 1000000/);
});

test('townCoverage uses a read-only transaction with the listing statement timeout', async () => {
  const log = [];
  const manager = {
    query: async (sql) => {
      log.push(sql);
      return sql.startsWith('SELECT') ? [facts({ served: true })] : [];
    },
  };
  const result = await townCoverage(
    { query: manager.query, transaction: async (_l, f) => f(manager) },
    town,
    town
  );
  assert.equal(result.state, 'available');
  assert.deepEqual(log.slice(0, 2), [
    'SET TRANSACTION READ ONLY',
    "SET LOCAL statement_timeout='2s'",
  ]);
});

test('a filtered page with no rows does not become empty', async () => {
  const db = stubDb({
    coverage: facts({ served: true, withheld: 2 }),
    rows: [],
  });
  const checks = pendingChecks(db, source(), id, cursorSecret);
  const page = await checks.localListings(
    town,
    0,
    'no such shop',
    false,
    'bakery',
    true,
    '',
    undefined
  );
  assert.deepEqual(page.listings, []);
  assert.deepEqual(page.coverage, {
    state: 'available',
    withheldReviewedDetails: 2,
  });
  const coverageCalls = db.seen.filter((c) =>
    c.sql.includes('directory_town_scan_target')
  );
  assert.equal(coverageCalls.length, 1);
  assert.deepEqual(coverageCalls[0].params, [town, town]);
});

test('freshness never changes coverage', async () => {
  const stale = {
    scanId: 'a'.repeat(64),
    evidenceVersion: 1,
    kind: 'captured',
    releaseId: '2020-01-01.0',
    artifactUrl: 'https://example.test/a',
    artifactEtag: '"x"',
    artifactBytes: '1',
    upstreamLastModified: new Date('2020-01-01T00:00:00Z'),
    observedAt: null,
    recordedAt: new Date('2020-01-02T00:00:00Z'),
    recorder: 'test',
    inventorySha256: 'b'.repeat(64),
    evidenceSha256: 'c'.repeat(64),
  };
  const pages = [];
  for (const evidence of [[], [stale]]) {
    const db = stubDb({
      coverage: facts({ completedLive: true, anyTarget: true }),
      evidence,
    });
    pages.push(await pendingChecks(db, source(), id).localListings(town));
  }
  assert.equal(pages[0].coverage.state, 'empty');
  assert.deepEqual(pages[0].coverage, pages[1].coverage);
  assert.notEqual(pages[0].sourceFreshness.state, undefined);
});

test('coverage appears in offset and cursor pages and a failure omits it', async () => {
  const partial = facts({ served: true, acquiring: true, withheld: 1 });
  const offset = await pendingChecks(
    stubDb({ coverage: partial, rows: [{}] }),
    source(),
    id,
    cursorSecret
  ).localListings(town);
  assert.equal(offset.coverage.state, 'partial');
  const checks = pendingChecks(
    stubDb({ coverage: partial }),
    source(),
    id,
    cursorSecret
  );
  const cursor = await checks.localListings(town, 0, '', false, '', true, '');
  assert.equal(cursor.coverage.state, 'partial');
  assert.equal(cursor.nextCursor, null);
  const failing = stubDb({
    coverage: new Error('statement timeout'),
    rows: [{}],
  });
  const page = await pendingChecks(failing, source(), id).localListings(town);
  assert.equal(page.listings.length, 1);
  assert.equal('coverage' in page, false);
});

test('town-ineligible is told apart from a global authority failure, and fails closed', async () => {
  const kind = async (authority) => {
    try {
      await pendingChecks(stubDb({ authority }), source(), id).localListings(
        town
      );
    } catch (error) {
      return error.kind;
    }
  };
  assert.equal(await kind({ eligible: false }), 'town-ineligible');
  assert.equal(
    await kind({ eligible: false, phase: 'reg-directory' }),
    'global'
  );
  assert.equal(await kind({ phase: 'reg-directory' }), 'global');
  assert.equal(await kind({ eligible: null }), 'global');
  assert.equal(await kind({ eligible: undefined }), 'global');
  assert.equal(
    await kind({
      eligible: false,
      registerRequest: {
        ...authorityRow().registerRequest,
        lastCompletedSweep: {
          generation: '1',
          completedAt: '2025-12-31T23:00:00Z',
        },
      },
    }),
    'global'
  );
});

const serve = async (db, run) => {
  const server = pendingServer(
    pendingChecks(db, source(), id, cursorSecret),
    undefined,
    undefined,
    undefined,
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${
    server.address().port
  }/internal/local-evaluation/towns/${town}/listings`;
  try {
    await run((query = '') =>
      fetch(url + query, { headers: { authorization: `Bearer ${secret}` } })
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

test('an ineligible town answers 200 blocked; a global failure stays 503', async () => {
  await serve(stubDb({ authority: { eligible: false } }), async (get) => {
    const offset = await get();
    assert.equal(offset.status, 200);
    assert.equal(offset.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await offset.json(), {
      listings: [],
      hasMore: false,
      coverage: {
        state: 'blocked',
        reason: 'town-ineligible',
        withheldReviewedDetails: 0,
      },
    });
    const cursor = await get('?pagination=cursor');
    assert.equal(cursor.status, 200);
    assert.equal(cursor.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await cursor.json(), {
      listings: [],
      hasMore: false,
      nextCursor: null,
      coverage: {
        state: 'blocked',
        reason: 'town-ineligible',
        withheldReviewedDetails: 0,
      },
    });
  });
  for (const authority of [
    { phase: 'reg-directory' },
    { eligible: false, phase: 'reg-directory' },
    { eligible: null },
  ])
    await serve(stubDb({ authority }), async (get) => {
      const res = await get();
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(await res.text(), '');
    });
});

test('listing responses are never cacheable', async () => {
  await serve(
    stubDb({ coverage: facts({ served: true }), rows: [{}] }),
    async (get) => {
      for (const query of ['', '?q=bakery']) {
        const res = await get(query);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('cache-control'), 'no-store');
        assert.equal((await res.json()).coverage.state, 'available');
      }
    }
  );
  await serve(stubDb({ coverage: facts({ served: true }) }), async (get) => {
    const res = await get('?pagination=cursor');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal((await res.json()).coverage.state, 'available');
    assert.equal((await get('?adult=0')).status, 400);
    assert.equal(
      (await get('?adult=0')).headers.get('cache-control'),
      'no-store'
    );
  });
  await serve(stubDb({ authority: { phase: 'x' } }), async (get) => {
    assert.equal((await get()).headers.get('cache-control'), 'no-store');
  });
});

test('other routes keep their behaviour for an ineligible town', async () => {
  const checks = pendingChecks(
    stubDb({ authority: { eligible: false } }),
    source(),
    id
  );
  await assert.rejects(checks.status(town), /authority unavailable/i);
});
