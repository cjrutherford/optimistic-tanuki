const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  pendingRuntimeConfig,
  pendingChecks,
  pendingServer,
} = require('../src/register-pending-runtime');
const { identityVersionTokens } = require('../src/business-identity-undo');
const { ReviewConflictError } = require('../src/review-version');
const id = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const town = '00000000-0000-4000-8000-000000000005';
const row = () => ({
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
});
const snapshot = {
  id: town,
  name: 'Secret name',
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
const identityDb = (db) => ({
  query: async (sql, params) => {
    if (
      /directory_business(_assertion)?\b/.test(sql) &&
      !sql.includes('directory_overture_private_row')
    )
      return [];
    if (sql.includes('INSERT INTO directory_listing_identity'))
      return params[1].map((scanId, i) => ({
        id: `00000000-0000-4000-8000-${String(
          Number(params[2][i]) + 100
        ).padStart(12, '0')}`,
        scanId,
        sourceFileRowNumber: params[2][i],
      }));
    if (
      sql.includes('FROM directory_listing_identity') &&
      !sql.includes('directory_overture_private_row')
    )
      return params[1] === '00000000-0000-4000-8000-000000000101'
        ? [{ scanId: 'a'.repeat(64), sourceFileRowNumber: '1' }]
        : [];
    return db.query(sql, params);
  },
});
test('requires independently supplied complete identity and explicit fence', () => {
  const env = {
    DIRECTORY_DATABASE_URL: 'postgres://localhost/db',
    SOCIAL_HOST: 'localhost',
    SOCIAL_PORT: '3003',
    DIRECTORY_REGISTER_READ_SECRET: 'a'.repeat(32),
    DIRECTORY_EXTERNAL_FENCE_ASSERTION: 'fenced',
    DIRECTORY_REGISTER_RUNTIME_IDENTITY: JSON.stringify(id),
  };
  assert.deepEqual(pendingRuntimeConfig(env).identity, id);
  assert.equal(
    pendingRuntimeConfig({ ...env, DIRECTORY_BOUNDARY_REVIEW_SECRET: '' })
      .reviewSecret,
    undefined
  );
  assert.throws(() =>
    pendingRuntimeConfig({ ...env, DIRECTORY_BOUNDARY_REVIEW_SECRET: 'short' })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_BUSINESS_LINK_SECRET: 's'.repeat(32),
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_LOCAL_EVALUATION: 'true',
      DIRECTORY_LOCAL_EVALUATION_SECRET: 'x'.repeat(32),
      DIRECTORY_BUSINESS_LINK_SECRET: 'x'.repeat(32),
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_BOUNDARY_REVIEW_SECRET: env.DIRECTORY_REGISTER_READ_SECRET,
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({ ...env, DIRECTORY_CONTAINMENT_READ_SECRET: 'short' })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_CONTAINMENT_READ_SECRET: env.DIRECTORY_REGISTER_READ_SECRET,
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_CONTAINMENT_READ_SECRET: 'x'.repeat(32),
      DIRECTORY_PENDING_READ_SECRET: 'x'.repeat(32),
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_BOUNDARY_DECISION_SECRET: 'short',
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_BOUNDARY_DECISION_SECRET: env.DIRECTORY_REGISTER_READ_SECRET,
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_BOUNDARY_DECISION_SECRET: 'x'.repeat(32),
      DIRECTORY_BOUNDARY_REVIEW_SECRET: 'x'.repeat(32),
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({ ...env, DIRECTORY_PENDING_READ_SECRET: 'short' })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_PENDING_READ_SECRET: env.DIRECTORY_REGISTER_READ_SECRET,
    })
  );
  assert.throws(() =>
    pendingRuntimeConfig({
      ...env,
      DIRECTORY_PENDING_READ_SECRET: 'x'.repeat(32),
      DIRECTORY_BOUNDARY_REVIEW_SECRET: 'x'.repeat(32),
    })
  );
  for (const patch of [
    { DIRECTORY_EXTERNAL_FENCE_ASSERTION: '' },
    {
      DIRECTORY_REGISTER_RUNTIME_IDENTITY: JSON.stringify({
        ...id,
        owner: undefined,
      }),
    },
    {
      DIRECTORY_REGISTER_RUNTIME_IDENTITY: JSON.stringify({ ...id, extra: 1 }),
    },
  ])
    assert.throws(() => pendingRuntimeConfig({ ...env, ...patch }));
});
test('requires current Social eligibility and fresh pinned authority', async () => {
  for (const mutate of [
    (r) => (r.phase = 'reg-directory'),
    (r) => (r.recoveryEpoch = town),
    (r) => (r.eligible = false),
    (r) =>
      (r.registerRequest.lastCompletedSweep.completedAt =
        '2025-12-31T23:54:59Z'),
    (r) => delete r.registerRequest.lastCompletedSweep,
  ]) {
    const r = row();
    mutate(r);
    await assert.rejects(
      pendingChecks({ query: async () => [r] }, source(), id).status(town)
    );
  }
  for (const response of [
    { status: 'absent' },
    {
      status: 'current',
      changeToken: town,
      snapshot: { ...snapshot, isPrivate: true },
    },
    { status: 'current', changeToken: town, snapshot: null },
  ]) {
    const s = source();
    s.current = async () => response;
    await assert.rejects(
      pendingChecks({ query: async () => [row()] }, s, id).status(town)
    );
  }
  let calls = 0;
  const db = {
    query: async () => {
      const r = row();
      if (++calls === 2) r.authorityEpoch = town;
      return [r];
    },
  };
  await assert.rejects(pendingChecks(db, source(), id).status(town));
});
test('HTTP returns only pending or unavailable', async () => {
  const s = source(),
    server = pendingServer(
      pendingChecks({ query: async () => [row()] }, s, id)
    );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/towns/${town}/status`;
    let response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'pending' });
    s.current = async () => ({ status: 'absent' });
    response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: 'unavailable' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('private boundary candidate requires its independent service credential', async () => {
  const secret = 'boundary-review-test-secret-1234567890';
  let calls = 0;
  const server = pendingServer(
    {
      ready: async () => {},
      status: async () => {},
      candidate: async () => {
        calls++;
        return { geoid: '1323872' };
      },
    },
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/towns/${town}/boundary-candidate`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { authorization: 'Bearer wrong' } })).status,
      401
    );
    assert.equal(calls, 0);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${secret}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      candidate: { geoid: '1323872' },
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('register status reads an eligible Social point and never invents a boundary', async () => {
  const s = source();
  s.geography = async () => ({
    status: 'current',
    changeToken: town,
    geography: { communityId: town, referencePoint: [-82.5, 31.5] },
  });
  const checks = pendingChecks({ query: async () => [row()] }, s, id);
  assert.deepEqual(await checks.approximate(town), {
    status: 'pending',
    approximateLocation: {
      coordinates: [-82.5, 31.5],
      label: 'Approximate town location; verified boundary unavailable.',
    },
  });
  s.geography = async () => ({
    status: 'current',
    changeToken: town,
    geography: { communityId: town, referencePoint: null },
  });
  assert.deepEqual(await checks.approximate(town), {
    status: 'pending',
    approximateLocation: null,
  });
  s.geography = async () => ({
    status: 'current',
    changeToken: town,
    geography: null,
  });
  await assert.rejects(checks.approximate(town), /Town unavailable/);
  let reads = 0;
  s.geography = async () =>
    ++reads === 1
      ? {
          status: 'current',
          changeToken: town,
          geography: { communityId: town, referencePoint: [-82.5, 31.5] },
        }
      : { status: 'current', changeToken: town, geography: null };
  await assert.rejects(checks.approximate(town), /Town unavailable/);
  s.geography = async () => ({
    status: 'current',
    changeToken: town,
    geography: { communityId: town, referencePoint: [181, 0] },
  });
  await assert.rejects(checks.approximate(town));
  let queries = 0;
  const fencedDb = {
    query: async () => {
      const r = row();
      if (++queries === 3) r.authorityEpoch = town;
      return [r];
    },
  };
  s.geography = async () => ({
    status: 'current',
    changeToken: town,
    geography: { communityId: town, referencePoint: [-82.5, 31.5] },
  });
  await assert.rejects(
    pendingChecks(fencedDb, s, id).approximate(town),
    /authority/
  );
});
test('register status requires its separate gateway credential', async () => {
  const secret = 'pending-status-test-secret-1234567890';
  let calls = 0;
  const server = pendingServer(
    {
      ready: async () => {},
      status: async () => {},
      candidate: async () => null,
      approximate: async () => {
        calls++;
        return { status: 'pending', approximateLocation: null };
      },
    },
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/register-towns/${town}/status`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(calls, 0);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${secret}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: 'pending',
      approximateLocation: null,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('boundary decision writes require a distinct credential and a bounded JSON body', async () => {
  const readSecret = 'boundary-review-read-secret-123456789',
    writeSecret = 'boundary-review-write-secret-12345678';
  let calls = 0,
    received;
  const server = pendingServer(
    {
      ready: async () => {},
      status: async () => {},
      candidate: async () => null,
      approximate: async () => null,
      decision: async (id, value) => {
        calls++;
        received = { id, value };
      },
    },
    readSecret,
    undefined,
    writeSecret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/towns/${town}/boundary-decisions`;
    const send = (token, body) =>
      fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body,
      });
    assert.equal((await send(readSecret, '{}')).status, 401);
    assert.equal(calls, 0);
    assert.equal((await send(writeSecret, '{')).status, 400);
    assert.equal(calls, 0);
    assert.equal((await send(writeSecret, 'x'.repeat(9000))).status, 413);
    assert.equal(calls, 0);
    assert.equal(
      (await send(writeSecret, JSON.stringify({ requestId: town }))).status,
      204
    );
    assert.equal(calls, 1);
    assert.equal(received.id, town);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('containment requires its own credential and validates coordinates', async () => {
  const secret = 'containment-read-secret-12345678901234567890';
  let calls = 0;
  const checks = {
    ready: async () => {},
    status: async () => {},
    candidate: async () => null,
    approximate: async () => null,
    decision: async () => {},
    containment: async (townId, longitude, latitude) => {
      calls++;
      assert.equal(townId, town);
      assert.equal(longitude, -82.5);
      assert.equal(latitude, 31.5);
      return { status: 'ready', covers: true };
    },
  };
  const server = pendingServer(checks, undefined, undefined, undefined, secret);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/towns/${town}/containment`;
    assert.equal(
      (await fetch(`${url}?longitude=-82.5&latitude=31.5`)).status,
      401
    );
    assert.equal(
      (
        await fetch(`${url}?longitude=181&latitude=31.5`, {
          headers: { authorization: `Bearer ${secret}` },
        })
      ).status,
      400
    );
    const result = await fetch(`${url}?longitude=-82.5&latitude=31.5`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { status: 'ready', covers: true });
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('boundary geometry requires the separate containment credential', async () => {
  const secret = 'containment-read-secret-12345678901234567890';
  const geometry = {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ],
  };
  let calls = 0;
  const checks = {
    ready: async () => {},
    status: async () => {},
    candidate: async () => null,
    approximate: async () => null,
    decision: async () => {},
    containment: async () => ({ status: 'pending' }),
    boundary: async () => {
      calls++;
      return { status: 'ready', geometry };
    },
  };
  const server = pendingServer(checks, undefined, undefined, undefined, secret);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/towns/${town}/boundary`;
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${secret}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ready', geometry });
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('local listing reads require a current eligible town before and after the bounded query', async () => {
  const listing = {
    name: 'Bakery',
    category: 'bakery',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Example'],
    notices: [],
    termsUrls: ['https://example.test/terms'],
  };
  let reads = 0;
  const s = source();
  s.current = async () => {
    reads++;
    return { status: 'current', changeToken: town, snapshot };
  };
  const db = {
    query: async (sql) =>
      sql.includes('directory_overture_private_row') &&
      !sql.includes('directory_town_scan_target') &&
      !sql.includes('directory_overture_source_evidence')
        ? [{ listing }]
        : [row()],
  };
  const checks = pendingChecks(db, s, id);
  {
    const { sourceFreshness, coverage, ...page } = await checks.localListings(
      town
    );
    assert.equal(sourceFreshness.state, 'unknown');
    assert.equal(coverage.state, 'unknown');
    assert.deepEqual(page, { listings: [listing], hasMore: false });
  }
  await assert.rejects(checks.localListings(town, -1), /offset/i);
  assert.equal(reads, 2);
  let n = 0;
  s.current = async () => ({
    status: 'current',
    changeToken: ++n === 1 ? town : '00000000-0000-4000-8000-000000000006',
    snapshot,
  });
  await assert.rejects(checks.localListings(town), /changed/i);
});
test('local listing endpoint is disabled without its dedicated credential', async () => {
  let calls = 0,
    lastAdult;
  const secret = 'local-listing-secret-123456789012345';
  const server = pendingServer(
    {
      ready: async () => {},
      status: async () => {},
      localListings: async (_town, _offset, _search, adult) => {
        calls++;
        lastAdult = adult;
        return { listings: [] };
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/local-evaluation/towns/${town}/listings`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(calls, 0);
    assert.equal(
      (await fetch(url, { headers: { authorization: `Bearer ${secret}` } }))
        .status,
      200
    );
    assert.equal(calls, 1);
    assert.equal(lastAdult, false);
    assert.equal(
      (
        await fetch(`${url}?adult=1`, {
          headers: { authorization: `Bearer ${secret}` },
        })
      ).status,
      200
    );
    assert.equal(lastAdult, true);
    assert.equal(
      (
        await fetch(`${url}?adult=0`, {
          headers: { authorization: `Bearer ${secret}` },
        })
      ).status,
      400
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('local endpoint accepts cursor mode and rejects malformed pagination', async () => {
  const secret = 'local-listing-secret-123456789012345';
  let received;
  const server = pendingServer(
    {
      ready: async () => {},
      status: async () => {},
      localListings: async (...args) => {
        received = args;
        return { listings: [], hasMore: false, nextCursor: null };
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
        server.address().port
      }/internal/local-evaluation/towns/${town}/listings`,
      headers = { authorization: `Bearer ${secret}` };
    assert.equal(
      (await fetch(`${url}?pagination=cursor&cursor=abc`, { headers })).status,
      200
    );
    assert.equal(received[5], true);
    assert.equal(received[6], 'abc');
    for (const query of [
      '?cursor=abc',
      '?pagination=cursor&offset=1',
      '?pagination=cursor&cursor=bad%20value',
      '?pagination=cursor&pagination=cursor',
    ])
      assert.equal((await fetch(url + query, { headers })).status, 400);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('local detail endpoint requires the credential and hides missing or invalid references', async () => {
  const secret = 'local-listing-secret-123456789012345';
  const server = pendingServer(
    {
      ready: async () => {},
      status: async () => {},
      localDetail: async (_town, reference) => {
        if (reference === 'invalid') throw Error('Invalid reference');
        return reference === 'missing' ? null : { name: 'Cafe' };
      },
    },
    undefined,
    undefined,
    undefined,
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
        server.address().port
      }/internal/local-evaluation/towns/${town}/listings`,
      headers = { authorization: `Bearer ${secret}` };
    assert.equal((await fetch(`${url}/valid`)).status, 401);
    assert.equal((await fetch(`${url}/valid`, { headers })).status, 200);
    assert.equal((await fetch(`${url}/missing`, { headers })).status, 404);
    assert.equal((await fetch(`${url}/invalid`, { headers })).status, 404);
    assert.equal(
      (await fetch(`${url}/valid?adult=0`, { headers })).status,
      400
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
test('local listing reads expose a next page instead of silently truncating results', async () => {
  const item = {
    name: 'Bakery',
    category: 'bakery',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Example'],
    notices: [],
    termsUrls: ['https://example.test/terms'],
  };
  const db = {
    query: async (sql, params) =>
      sql.includes('directory_overture_private_row') &&
      !sql.includes('directory_town_scan_target') &&
      !sql.includes('directory_overture_source_evidence')
        ? params[1] === 0
          ? Array.from({ length: 26 }, () => ({ listing: item }))
          : [{ listing: item }]
        : [row()],
  };
  const checks = pendingChecks(db, source(), id),
    first = await checks.localListings(town, 0),
    second = await checks.localListings(town, 25);
  assert.equal(first.listings.length, 25);
  assert.equal(first.hasMore, true);
  assert.equal(second.listings.length, 1);
  assert.equal(second.hasMore, false);
});
test('adult listings require an explicit visitor choice', async () => {
  let query;
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) return [];
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      ) {
        query = { sql, params };
        return [];
      }
      return [row()];
    },
  };
  const checks = pendingChecks(db, source(), id);
  await checks.localListings(town);
  assert.equal(query.params[3], false);
  assert.match(query.sql, /adult/);
  await checks.localListings(town, 0, '', true);
  assert.equal(query.params[3], true);
  await assert.rejects(checks.localListings(town, 0, '', 'true'), /adult/i);
});
test('category facet uses public serving predicates and ignores page filters', async () => {
  let facet;
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) {
        facet = { sql, params };
        return [{ category: 'legacy_shop' }, { category: 'restaurant' }];
      }
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      )
        return [];
      return [row()];
    },
  };
  const page = await pendingChecks(db, source(), id).localListings(
    town,
    0,
    'search',
    false,
    'restaurant'
  );
  assert.deepEqual(page.categories, ['legacy_shop', 'restaurant']);
  assert.deepEqual(facet.params, [town, town, false]);
  for (const part of [
    'directory_listing_suppression',
    'directory_overture_private_revocation',
    'directory_overture_private_row_revocation',
    'revoked=false',
    'excluded',
    'assignmentChangeToken',
    "r.listing->'adult'",
  ])
    assert.ok(facet.sql.includes(part), part);
  assert.ok(!facet.sql.includes('position(lower'));
});
test('directory category filtering uses an exact category and validates input', async () => {
  let query;
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) return [];
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      ) {
        query = { sql, params };
        return [];
      }
      return [row()];
    },
  };
  const checks = pendingChecks(db, source(), id);
  await checks.localListings(town, 0, '', false, 'restaurant');
  assert.match(query.sql, /listing->>'category'/);
  assert.equal(query.params[5], 'restaurant');
  await assert.rejects(
    checks.localListings(town, 0, '', false, 'restaurant\ninvalid'),
    /category/i
  );
});
test('cursor pagination binds the next page to the same town and filters', async () => {
  const secret = 'local-cursor-test-secret-123456789012345';
  let query;
  const item = {
    name: 'Cafe',
    category: 'restaurant',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
  };
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) return [];
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      ) {
        query = { sql, params };
        return Array.from({ length: 26 }, (_, i) => ({
          listing: item,
          scanId: 'a'.repeat(64),
          sourceFileRowNumber: String(i + 1),
        }));
      }
      return [row()];
    },
  };
  const checks = pendingChecks(identityDb(db), source(), id, secret),
    first = await checks.localListings(
      town,
      0,
      'cafe',
      false,
      'restaurant',
      true
    );
  assert.equal(first.listings.length, 25);
  assert.equal(typeof first.nextCursor, 'string');
  await checks.localListings(
    town,
    0,
    'cafe',
    false,
    'restaurant',
    true,
    first.nextCursor
  );
  assert.equal(query.params[6], 'a'.repeat(64));
  assert.equal(query.params[7], '25');
  await assert.rejects(
    checks.localListings(
      town,
      0,
      'other',
      false,
      'restaurant',
      true,
      first.nextCursor
    ),
    /cursor/i
  );
  await assert.rejects(
    checks.localListings(town, 1, '', false, '', true),
    /cursor/i
  );
});
test('offset listings can request stable identities without changing their order', async () => {
  const item = {
    name: 'Cafe',
    category: 'restaurant',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
  };
  const db = {
    query: async (sql) =>
      sql.includes('directory_overture_private_row') &&
      !sql.includes('directory_town_scan_target') &&
      !sql.includes('directory_overture_source_evidence')
        ? [{ listing: item, scanId: 'a'.repeat(64), sourceFileRowNumber: '1' }]
        : [row()],
  };
  const checks = pendingChecks(
    identityDb(db),
    source(),
    id,
    'local-identity-test-secret-123456789012345'
  );
  const page = await checks.localListings(
    town,
    0,
    '',
    false,
    '',
    false,
    '',
    undefined,
    '',
    true
  );
  assert.equal(page.listings[0].id, '00000000-0000-4000-8000-000000000101');
});
test('detail references enforce town, visitor choice and current visibility', async () => {
  const secret = 'local-detail-test-secret-123456789012345';
  let visible = true;
  const item = {
    name: 'Cafe',
    category: 'restaurant',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
  };
  const db = {
    query: async (sql) =>
      sql.includes('directory_overture_private_row') &&
      !sql.includes('directory_town_scan_target') &&
      !sql.includes('directory_overture_source_evidence')
        ? visible
          ? [
              {
                listing: item,
                scanId: 'a'.repeat(64),
                sourceFileRowNumber: '1',
              },
            ]
          : []
        : [row()],
  };
  const checks = pendingChecks(identityDb(db), source(), id, secret),
    page = await checks.localListings(town, 0, '', false, '', true),
    reference = page.listings[0].reference;
  assert.equal(typeof reference, 'string');
  assert.equal(page.listings[0].id, '00000000-0000-4000-8000-000000000101');
  assert.equal(
    (await checks.localDetail(town, page.listings[0].id, false)).name,
    'Cafe'
  );
  assert.equal((await checks.localDetail(town, reference, false)).name, 'Cafe');
  await assert.rejects(checks.localDetail(town, reference, true), /reference/i);
  visible = false;
  assert.equal(await checks.localDetail(town, reference, false), null);
  assert.equal(
    await checks.localDetail(town, page.listings[0].id, false),
    null
  );
});
test('unverified Census assignments are bound to the current town change token', async () => {
  let query;
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) return [];
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      ) {
        query = { sql, params };
        return [];
      }
      return [row()];
    },
  };
  const checks = pendingChecks(db, source(), id);
  await checks.localListings(town);
  assert.match(query.sql, /assignmentChangeToken/);
  assert.equal(query.params[4], (await source().current(id, town)).changeToken);
});
test('local listing read includes only reviewed valid contact fields and their notices', async () => {
  const listing = {
    name: 'Bakery',
    category: 'bakery',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Base'],
    notices: [],
    termsUrls: ['https://example.test/terms'],
    reviewed: {
      website: 'https://example.test/',
      phone: '+19125550100',
      address: '10 Main St',
      attribution: ['Contact credit'],
      notices: ['Contact notice'],
      termsUrls: ['https://example.test/license'],
      evidenceUrl: 'https://example.test/private-evidence',
      secret: 'do not return',
    },
  };
  const db = {
    query: async (sql) =>
      sql.includes('directory_overture_private_row') &&
      !sql.includes('directory_town_scan_target') &&
      !sql.includes('directory_overture_source_evidence')
        ? [{ listing, reviewedActive: true }]
        : [row()],
  };
  const result = await pendingChecks(db, source(), id).localListings(town);
  const ungated = await pendingChecks(
    {
      query: async (sql) =>
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
          ? [{ listing, reviewedActive: false }]
          : [row()],
    },
    source(),
    id
  ).localListings(town);
  assert.equal(ungated.listings[0].website, undefined);
  assert.equal(ungated.listings[0].address, undefined);
  assert.equal(ungated.listings[0].phone, undefined);
  assert.deepEqual(ungated.listings[0].notices, []);
  assert.equal(result.listings[0].website, 'https://example.test/');
  assert.equal(result.listings[0].phone, '+19125550100');
  assert.equal(result.listings[0].address, '10 Main St');
  assert.ok(result.listings[0].notices.includes('Contact notice'));
  assert.equal(result.listings[0].evidenceUrl, undefined);
});
test('local directory search passes a bounded literal term to the database', async () => {
  let query;
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) return [];
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      ) {
        query = { sql, params };
        return [];
      }
      return [row()];
    },
  };
  const checks = pendingChecks(db, source(), id);
  await checks.localListings(town, 0, 'Cafe');
  assert.equal(query.params[2], 'Cafe');
  await assert.rejects(
    checks.localListings(town, 0, 'x'.repeat(101)),
    /search/i
  );
});
test('bounded map search pages from the projection, binds cursors to the area, and fails closed', async () => {
  const secret = 'local-bounds-test-secret-123456789012345';
  const item = {
    name: 'Cafe',
    category: 'restaurant',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
  };
  const reviewed = {
    address: '10 Main St',
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
    evidenceUrl: 'https://example.test/evidence',
  };
  const entries = Array.from({ length: 26 }, (_, i) => ({
    listing: { ...item, reviewed },
    reviewedActive: true,
    scanId: 'a'.repeat(64),
    sourceFileRowNumber: String(i + 1),
  }));
  let state = { validatorVersion: 1, rebuildCompletedAt: new Date() },
    missing = 0,
    served = entries,
    boundsCalls = [];
  const db = {
    query: async (sql, params) => {
      if (sql.includes('directory_reviewed_spatial_state'))
        return state ? [state] : [];
      if (sql.includes('AS n')) return [{ n: missing }];
      if (sql.includes('directory_reviewed_spatial sp')) {
        boundsCalls.push({ sql, params });
        return served;
      }
      return sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
        ? []
        : [row()];
    },
  };
  const checks = pendingChecks(identityDb(db), source(), id, secret),
    first = await checks.localListings(
      town,
      0,
      '',
      false,
      '',
      true,
      '',
      undefined,
      '-84,30,-82,32'
    );
  assert.equal(first.listings.length, 25);
  assert.equal(first.hasMore, true);
  assert.ok(
    boundsCalls[0].sql.includes('LIMIT 26') &&
      !boundsCalls[0].sql.includes('5001')
  );
  assert.deepEqual(boundsCalls[0].params.slice(2, 6), [-84, 30, -82, 32]);
  await assert.rejects(
    checks.localListings(
      town,
      0,
      '',
      false,
      '',
      true,
      first.nextCursor,
      undefined,
      '-83.5,30,-82,32'
    ),
    /cursor/i
  );
  await assert.rejects(
    checks.localListings(
      town,
      0,
      '',
      false,
      '',
      false,
      '',
      undefined,
      '-84,30,-82,32'
    ),
    /bounds/i
  );
  // SQL has already validated every row. A row that disagrees with the shared validator or the box fails the request instead of being dropped after LIMIT.
  served = [
    {
      ...entries[0],
      listing: {
        ...entries[0].listing,
        reviewed: { ...reviewed, evidenceUrl: 'http://127.0.0.1/' },
      },
    },
  ];
  await assert.rejects(
    checks.localListings(
      town,
      0,
      '',
      false,
      '',
      true,
      '',
      undefined,
      '-84,30,-82,32'
    ),
    /disagrees/
  );
  served = entries.slice(0, 1);
  await assert.rejects(
    checks.localListings(
      town,
      0,
      '',
      false,
      '',
      true,
      '',
      undefined,
      '-82,30,-81,32'
    ),
    /disagrees/
  );
  // Not ready, a probe failure, or a validator mismatch is a refusal; the plain listing is unaffected.
  for (const broken of [
    () => {
      state = null;
    },
    () => {
      state = { validatorVersion: 0, rebuildCompletedAt: new Date() };
    },
    () => {
      state = { validatorVersion: 1, rebuildCompletedAt: null };
    },
    () => {
      state = { validatorVersion: 1, rebuildCompletedAt: new Date() };
      missing = 1;
    },
  ]) {
    broken();
    const c = pendingChecks(identityDb(db), source(), id, secret);
    await assert.rejects(
      c.localListings(
        town,
        0,
        '',
        false,
        '',
        true,
        '',
        undefined,
        '-84,30,-82,32'
      ),
      /Spatial index unavailable/
    );
    assert.equal((await c.localListings(town, 0)).listings.length, 0);
  }
  state = { validatorVersion: 1, rebuildCompletedAt: new Date() };
  missing = 0;
  const healthy = await pendingChecks(db, source(), id).spatialHealth();
  assert.deepEqual(
    {
      ready: healthy.ready,
      missing: healthy.missing,
      validatorVersion: healthy.validatorVersion,
    },
    { ready: true, missing: 0, validatorVersion: 1 }
  );
  state = null;
  await assert.rejects(
    pendingChecks(
      {
        query: async () => {
          throw Error('down');
        },
      },
      source(),
      id
    ).spatialHealth(),
    /down/
  );
});
test('readiness reports spatial health without failing overall readiness', async () => {
  const server = pendingServer(
    {
      ready: async () => {},
      spatialHealth: async () => ({
        ready: false,
        missing: 2,
        validatorVersion: 1,
        rebuildCompletedAt: null,
      }),
    },
    undefined
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health/ready`
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ready: true,
      reviewedSpatial: {
        ready: false,
        missing: 2,
        validatorVersion: 1,
        rebuildCompletedAt: null,
      },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const failing = pendingServer(
    {
      ready: async () => {},
      spatialHealth: async () => {
        throw Error('x');
      },
    },
    undefined
  );
  await new Promise((resolve) => failing.listen(0, '127.0.0.1', resolve));
  try {
    const body = await (
      await fetch(`http://127.0.0.1:${failing.address().port}/health/ready`)
    ).json();
    assert.deepEqual(body, { ready: true, reviewedSpatial: { ready: false } });
  } finally {
    await new Promise((resolve) => failing.close(resolve));
  }
});
test('readiness reports source freshness counts and never fails because of them', async () => {
  const counts = {
    fresh: 0,
    due: 0,
    stale: 0,
    unknown: 16,
    oldestPublishedAt: null,
    evaluatedAt: '2026-11-16T00:00:00.000Z',
  };
  const server = pendingServer(
    { ready: async () => {}, sourceFreshnessHealth: async () => counts },
    undefined
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/health/ready`
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ready: true,
      sourceFreshness: counts,
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const failing = pendingServer(
    {
      ready: async () => {},
      sourceFreshnessHealth: async () => {
        throw Error('x');
      },
    },
    undefined
  );
  await new Promise((resolve) => failing.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${failing.address().port}/health/ready`
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ready: true });
  } finally {
    await new Promise((resolve) => failing.close(resolve));
  }
});
test('business-link internal transport requires its own credential and rejects malformed bodies', async () => {
  const linkSecret = 'business-link-secret-123456789012345678';
  let calls = 0;
  const server = pendingServer(
    {
      localLinkAction: async () => {
        calls++;
      },
      localLinkRead: async () => ({ businessCommunityId: town, ownerId: town }),
      localLinkRequests: async () => [],
      localTownLinkRequests: async () => ({ requests: [], nextCursor: null }),
      localOwnerLinks: async () => [],
    },
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    linkSecret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
        server.address().port
      }/internal/local-evaluation/towns/${town}/business-links`,
      headers = {
        authorization: `Bearer ${linkSecret}`,
        'content-type': 'application/json',
      };
    assert.equal(
      (await fetch(url, { method: 'POST', body: '{}' })).status,
      401
    );
    assert.equal(
      (await fetch(url, { method: 'POST', headers, body: '{' })).status,
      400
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'bad' }),
        })
      ).status,
      400
    );
    assert.equal(
      (
        await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'request', value: {} }),
        })
      ).status,
      204
    );
    assert.equal(calls, 1);
    const read = `${url}/00000000-0000-4000-8000-000000000101`;
    assert.equal((await fetch(read)).status, 401);
    assert.equal((await fetch(read, { headers })).status, 200);
    assert.equal((await fetch(read + '?adult=0', { headers })).status, 400);
    assert.equal((await fetch(read + '/requests')).status, 401);
    assert.deepEqual(
      await (await fetch(read + '/requests', { headers })).json(),
      { requests: [] }
    );
    const townQueue = `http://127.0.0.1:${
      server.address().port
    }/internal/local-evaluation/towns/${town}/business-link-requests`;
    assert.equal((await fetch(townQueue)).status, 401);
    assert.deepEqual(await (await fetch(townQueue, { headers })).json(), {
      requests: [],
      nextCursor: null,
    });
    const ownerRead = read + '/owner/' + town;
    assert.equal((await fetch(ownerRead)).status, 401);
    assert.deepEqual(await (await fetch(ownerRead, { headers })).json(), {
      requests: [],
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('business identity review transport is credentialed, validated, and maps refusal to 409', async () => {
  const localSecret = 'local-evaluation-secret-1234567890123456';
  const calls = [];
  let mode = 'ok';
  const checks = {
    identityReviewQueue: async (t) => ({
      health: {
        unresolved: 0,
        absent: 0,
        awaitingOwner: 0,
        carryIncomplete: 0,
        carriedUnbound: 0,
      },
      queue: { carriedUnbound: [], unresolved: [], awaitingOwner: [], town: t },
    }),
    identityReviewDecision: async (t, v) => {
      calls.push([t, v]);
      if (mode === 'refuse') throw Error('Invalid business identity decision');
      if (mode === 'fail') throw Error('boom');
      return { replayed: false, businesses: 1, restoredLinks: 0 };
    },
  };
  const server = pendingServer(
    checks,
    undefined,
    undefined,
    undefined,
    undefined,
    localSecret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${
        server.address().port
      }/internal/local-evaluation/towns/${town}/business-identity-review`,
      headers = {
        authorization: `Bearer ${localSecret}`,
        'content-type': 'application/json',
      };
    const u = '00000000-0000-4000-8000-0000000000a1',
      b = '00000000-0000-4000-8000-0000000000b1',
      o = '00000000-0000-4000-8000-0000000000b2';
    const ok = {
      decisionId: u,
      actorId: u,
      action: 'confirm',
      businessId: b,
      reason: 'looks right',
      expectedVersionToken: 'a'.repeat(64),
    };
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers })).status, 200);
    assert.equal((await fetch(base + '?x=1', { headers })).status, 400);
    const post = (body) =>
      fetch(base + '/decisions', {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    assert.equal(
      (await fetch(base + '/decisions', { method: 'POST', body: '{}' })).status,
      401
    );
    assert.equal((await post('{')).status, 400);
    for (const bad of [
      { ...ok, action: 'x' },
      { ...ok, reason: '   ' },
      { ...ok, reason: 'a'.repeat(1025) },
      { ...ok, actorId: 'nope' },
      { ...ok, expectedVersionToken: undefined },
      { ...ok, expectedVersionToken: 'short' },
      { ...ok, otherBusinessId: o },
      { ...ok, rows: [] },
      { ...ok, action: 'merge' },
      { ...ok, action: 'split' },
      {
        ...ok,
        action: 'split',
        rows: [{ scanId: 's', sourceFileRowNumber: 'x' }],
      },
    ])
      assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
    assert.equal(calls.length, 0);
    const res = await post(ok);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      replayed: false,
      businesses: 1,
      restoredLinks: 0,
    });
    assert.equal(
      (await post({ ...ok, action: 'merge', otherBusinessId: o })).status,
      200
    );
    assert.equal(
      (
        await post({
          ...ok,
          action: 'split',
          rows: [{ scanId: 'scan-1', sourceFileRowNumber: '12' }],
        })
      ).status,
      200
    );
    assert.equal(calls.length, 3);
    mode = 'refuse';
    assert.equal((await post(ok)).status, 409);
    mode = 'fail';
    assert.equal((await post(ok)).status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('business identity decisions are recorded as a profile actor behind authority checks', async () => {
  const b = '00000000-0000-4000-8000-0000000000b1',
    u = '00000000-0000-4000-8000-0000000000a1';
  let inserted = null;
  const tx = {
    query: async (sql, params) => {
      if (sql.includes('FROM directory_business WHERE id = ANY'))
        return [{ id: b, state: 'active' }];
      if (sql.includes('FROM directory_business b WHERE b.id=ANY'))
        return [
          {
            id: b,
            state: 'active',
            successorId: null,
            stateCause: null,
            retiredAt: null,
            latest: null,
            decisions: 0,
            assertions: '',
          },
        ];
      if (sql.includes('INSERT INTO directory_business_identity_decision'))
        inserted = params;
      return [];
    },
  };
  const db = {
    query: async () => [row()],
    transaction: async (work) => work(tx),
  };
  const checks = pendingChecks(db, source(), id);
  await assert.rejects(
    () => checks.identityReviewDecision('bad', {}),
    /unavailable/
  );
  const expectedVersionToken = (await identityVersionTokens(tx, town, [b])).get(
    b
  );
  await assert.rejects(
    () =>
      checks.identityReviewDecision(town, {
        decisionId: u,
        action: 'confirm',
        businessId: b,
        actorId: u,
        reason: 'ok',
        expectedVersionToken,
      }),
    /Invalid business identity decision/
  );
  assert.equal(inserted[5], u);
  assert.equal(inserted[6], 'profile');
});
test('review detail and undo routes are credentialed, validated, and map conflicts to 409 with a code', async () => {
  const localSecret = 'local-evaluation-secret-1234567890123456';
  const calls = [];
  let mode = 'ok';
  const detail = (kind) => async (t, id) => {
    calls.push([kind, t, id]);
    return mode === 'missing' ? null : { id, versionToken: 'a'.repeat(64) };
  };
  const undo = (kind) => async (t, id, v) => {
    calls.push([kind, t, id, v]);
    if (mode === 'stale') throw new ReviewConflictError('stale_decision');
    if (mode === 'late') throw new ReviewConflictError('not_latest');
    if (mode === 'fail') throw Error('boom');
    return { replayed: false };
  };
  const checks = {
    addressReviewDetail: detail('address'),
    identityReviewDetail: detail('identity'),
    addressReviewUndo: undo('address'),
    identityReviewUndo: undo('identity'),
  };
  const server = pendingServer(
    checks,
    undefined,
    undefined,
    undefined,
    undefined,
    localSecret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const root = `http://127.0.0.1:${
      server.address().port
    }/internal/local-evaluation/towns/${town}`;
    const headers = {
      authorization: `Bearer ${localSecret}`,
      'content-type': 'application/json',
    };
    const item = '00000000-0000-4000-8000-0000000000b1';
    const u = '00000000-0000-4000-8000-0000000000a1';
    const body = {
      decisionId: u,
      undoOf: u,
      actorId: u,
      reason: 'wrong call',
      expectedVersionToken: 'a'.repeat(64),
    };
    for (const kind of [
      'address-review-candidates',
      'business-identity-review',
    ]) {
      const url = `${root}/${kind}/${item}`;
      assert.equal((await fetch(url)).status, 401);
      mode = 'ok';
      const got = await fetch(url, { headers });
      assert.equal(got.status, 200);
      assert.equal((await got.json()).versionToken, 'a'.repeat(64));
      mode = 'missing';
      assert.equal((await fetch(url, { headers })).status, 404);
      const post = (b) =>
        fetch(`${url}/undo`, {
          method: 'POST',
          headers,
          body: JSON.stringify(b),
        });
      assert.equal(
        (await fetch(`${url}/undo`, { method: 'POST', body: '{}' })).status,
        401
      );
      for (const bad of [
        { ...body, expectedVersionToken: undefined },
        { ...body, undoOf: 'nope' },
        { ...body, decisionId: undefined },
        { ...body, reason: ' ' },
        { ...body, actorId: 'x' },
      ])
        assert.equal((await post(bad)).status, 400, JSON.stringify(bad));
      mode = 'ok';
      assert.equal((await post(body)).status, 200);
      mode = 'stale';
      const stale = await post(body);
      assert.equal(stale.status, 409);
      assert.deepEqual(await stale.json(), { code: 'stale_decision' });
      mode = 'late';
      assert.deepEqual(await (await post(body)).json(), { code: 'not_latest' });
      mode = 'fail';
      assert.equal((await post(body)).status, 503);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
const S = {
  review: 'review-secret-0123456789012345678901',
  pending: 'pending-secret-012345678901234567890',
  decision: 'decision-secret-01234567890123456789',
  containment: 'containment-secret-012345678901234567',
  local: 'local-secret-0123456789012345678901234',
  link: 'link-secret-0123456789012345678901234',
};
const L = `/internal/local-evaluation/towns/${town}`;
const ref = '00000000-0000-4000-8000-000000000101';
const routes = [
  ['GET', `/internal/register-towns/${town}/status`, 'pending'],
  ['GET', `/internal/towns/${town}/containment`, 'containment'],
  ['GET', `/internal/towns/${town}/boundary`, 'containment'],
  ['POST', `/internal/towns/${town}/boundary-decisions`, 'decision'],
  ['GET', `/internal/towns/${town}/boundary-candidate`, 'review'],
  ['GET', `${L}/listings`, 'local'],
  ['GET', `${L}/listings/${ref}`, 'local'],
  ['GET', `${L}/address-review-candidates`, 'local'],
  ['POST', `${L}/address-review-candidates/${ref}/decisions`, 'local'],
  ['GET', `${L}/address-review-candidates/${ref}`, 'local'],
  ['POST', `${L}/address-review-candidates/${ref}/undo`, 'local'],
  ['GET', `${L}/business-identity-review/${ref}`, 'local'],
  ['POST', `${L}/business-identity-review/${ref}/undo`, 'local'],
  ['GET', `${L}/business-identity-review`, 'local'],
  ['POST', `${L}/business-identity-review/decisions`, 'local'],
  ['GET', `${L}/listing-suppressions`, 'local'],
  ['POST', `${L}/listing-suppressions`, 'local'],
  ['POST', `${L}/listing-suppressions/${ref}/lift`, 'local'],
  ['POST', `${L}/business-links`, 'link'],
  ['GET', `${L}/business-links/${ref}`, 'link'],
  ['GET', `${L}/business-links/${ref}/requests`, 'link'],
  ['GET', `${L}/business-link-requests`, 'link'],
  ['GET', `${L}/business-links/${ref}/owner/${town}`, 'link'],
];
test('every internal route sets cache-control no-store on every error path', async () => {
  const boom = new Proxy(
    {},
    {
      get: () => async () => {
        throw new Error('boom');
      },
    }
  );
  const start = async (secrets) => {
    const server = pendingServer(
      boom,
      secrets.review,
      secrets.pending,
      secrets.decision,
      secrets.containment,
      secrets.local,
      secrets.link
    );
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    return server;
  };
  const checked = [];
  const hit = async (server, method, path, init = {}) => {
    const res = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        method,
        ...init,
      }
    );
    await res.text();
    assert.ok(res.status >= 400, `${method} ${path} -> ${res.status}`);
    assert.equal(
      res.headers.get('cache-control'),
      'no-store',
      `${method} ${path} -> ${res.status} lacks no-store`
    );
    checked.push(res.status);
    return res.status;
  };
  const configured = await start(S),
    unconfigured = await start({});
  try {
    for (const [method, path, key] of routes) {
      const auth = { authorization: `Bearer ${S[key]}` };
      assert.equal(await hit(unconfigured, method, path), 503);
      assert.equal(await hit(configured, method, path), 401);
      assert.equal(
        await hit(configured, method, path, {
          headers: { authorization: `Bearer ${'x'.repeat(S[key].length)}` },
        }),
        401
      );
      // authenticated but checks throw, or request invalid
      const bad = await hit(configured, method, path, {
        headers: { ...auth, 'content-type': 'application/json' },
        ...(method === 'POST' ? { body: '{' } : {}),
      });
      assert.ok([400, 404, 503].includes(bad), `${path} -> ${bad}`);
      assert.ok(
        [400, 404].includes(
          await hit(configured, method, `${path}?zz=1&zz=2`, {
            headers: auth,
            ...(method === 'POST' ? { body: '{}' } : {}),
          })
        ),
        `${method} ${path} junk query`
      );
      if (method === 'POST')
        assert.equal(
          await hit(configured, method, path, {
            headers: { ...auth, 'content-type': 'application/json' },
            body: JSON.stringify({ pad: 'x'.repeat(70000) }),
          }),
          413,
          `${path} oversize`
        );
    }
    assert.equal(await hit(configured, 'GET', '/nope'), 404);
    assert.equal(await hit(configured, 'GET', `${L}/listings/`), 404);
    assert.equal(await hit(configured, 'DELETE', `${L}/business-links`), 404);
    // the throwing checks surface as 503, never a stack trace
    for (const [path, key] of [
      [`${L}/listings`, 'local'],
      [`${L}/listings/${ref}`, 'local'],
      [`${L}/business-links/${ref}`, 'link'],
      [`${L}/business-link-requests`, 'link'],
    ]) {
      const res = await fetch(
        `http://127.0.0.1:${configured.address().port}${path}`,
        { headers: { authorization: `Bearer ${S[key]}` } }
      );
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(await res.text(), '');
    }
  } finally {
    await new Promise((resolve) => configured.close(resolve));
    await new Promise((resolve) => unconfigured.close(resolve));
  }
  assert.ok(checked.length > 80);
  assert.ok([400, 401, 404, 413, 503].every((s) => checked.includes(s)));
});
test('cursors and references minted for one town and query never replay elsewhere, over HTTP', async () => {
  const secret = 'local-replay-test-secret-123456789012345';
  const townB = '00000000-0000-4000-8000-0000000000b5';
  const item = {
    name: 'Cafe',
    category: 'restaurant',
    location: { type: 'Point', coordinates: [-83, 31] },
    attribution: ['Source'],
    notices: [],
    termsUrls: [],
  };
  const pageSizes = [];
  const db = {
    query: async (sql, params) => {
      if (sql.includes('SELECT DISTINCT')) return [];
      if (
        sql.includes('directory_overture_private_row') &&
        !sql.includes('directory_town_scan_target') &&
        !sql.includes('directory_overture_source_evidence')
      ) {
        pageSizes.push(params);
        return Array.from({ length: 26 }, (_, i) => ({
          listing: item,
          scanId: 'a'.repeat(64),
          sourceFileRowNumber: String(i + 1),
        }));
      }
      return [row()];
    },
  };
  const s = {
    scan: async () => [],
    current: async (_id, townId) => ({
      status: 'current',
      changeToken: townId,
      snapshot: { ...snapshot, id: townId },
    }),
  };
  const idDb = identityDb(db);
  // Real SQL scopes identity lookups by town (params[0]); mirror that in the fake.
  const townScoped = {
    query: async (sql, params) =>
      sql.includes('FROM directory_listing_identity') && params[0] !== town
        ? []
        : idDb.query(sql, params),
  };
  const checks = pendingChecks(townScoped, s, id, secret);
  const server = pendingServer(
    checks,
    undefined,
    undefined,
    undefined,
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`,
    headers = { authorization: `Bearer ${secret}` },
    get = async (path) => {
      const res = await fetch(base + path, { headers });
      return {
        status: res.status,
        cc: res.headers.get('cache-control'),
        body: await res.text(),
      };
    };
  try {
    const q = '&q=cafe&category=restaurant';
    const first = await get(
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor${q}`
    );
    assert.equal(first.status, 200);
    const page = JSON.parse(first.body);
    assert.equal(page.listings.length, 25);
    const cursor = page.nextCursor;
    const same = await get(
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&cursor=${cursor}${q}`
    );
    assert.equal(same.status, 200);
    const replays = [
      // another town
      `/internal/local-evaluation/towns/${townB}/listings?pagination=cursor&cursor=${cursor}${q}`,
      // another query / category / bounds / adult choice
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&cursor=${cursor}&q=bakery&category=restaurant`,
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&cursor=${cursor}&q=cafe&category=bakery`,
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&cursor=${cursor}${q}&bounds=-84,30,-82,32`,
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&cursor=${cursor}${q}&adult=1`,
      `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&cursor=${cursor}`,
    ];
    for (const path of replays) {
      const res = await get(path);
      assert.equal(res.status, 400, path);
      assert.equal(res.cc, 'no-store');
      assert.equal(res.body, '');
    }
    // page size is fixed: limit is not a recognised parameter and is rejected
    for (const limit of ['1', '100', '0', '-1', '26'])
      assert.equal(
        (
          await get(
            `/internal/local-evaluation/towns/${town}/listings?pagination=cursor&limit=${limit}`
          )
        ).status,
        400
      );
    assert.ok(pageSizes.length > 0);
    // wrong-town reference or listing id is indistinguishable from a missing one
    const id1 = page.listings[0].id,
      reference = page.listings[0].reference;
    for (const r of [id1, reference]) {
      const ok = await get(
        `/internal/local-evaluation/towns/${town}/listings/${r}`
      );
      assert.equal(ok.status, 200);
      const wrong = await get(
        `/internal/local-evaluation/towns/${townB}/listings/${r}`
      );
      assert.equal(wrong.status, 404);
      assert.equal(wrong.cc, 'no-store');
      assert.equal(wrong.body, '');
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
