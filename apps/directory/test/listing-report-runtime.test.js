const test = require('node:test'),
  assert = require('node:assert/strict');
const { pendingServer } = require('../src/register-pending-runtime');
const {
  validateReport,
  normalizeEmail,
  contactKeyFrom,
  receiptHash,
  createReport,
  lookupReceipt,
  transitionReport,
  PRIORITY_REASONS,
  TOWN_HOURLY_CAP,
} = require('../src/listing-report');

const town = '00000000-0000-4000-8000-000000000001';
const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const secret = 'local-evaluation-secret-1234567890123456';
const receipt = 'A'.repeat(32);

async function harness(checks) {
  const server = pendingServer(
    checks,
    undefined,
    undefined,
    undefined,
    undefined,
    secret
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const root = `http://127.0.0.1:${
    server.address().port
  }/internal/local-evaluation`;
  const headers = {
    authorization: `Bearer ${secret}`,
    'content-type': 'application/json',
  };
  return {
    root,
    headers,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('report transport is credentialed, strict, no-store and maps refusals', async () => {
  const calls = [];
  let mode = 'ok';
  const fail = () => {
    if (mode === 'invalid') throw Error('Invalid listing report');
    if (mode === 'conflict') throw Error('Report refused');
    if (mode === 'missing') throw Error('Report unavailable');
    if (mode === 'fail') throw Error('connection string leaked');
  };
  const checks = {
    reportCreate: async (t, v) => {
      calls.push(['create', t, v]);
      fail();
      return { receipt };
    },
    reportLookup: async (token) => {
      calls.push(['lookup', token]);
      fail();
      return { status: 'received', reasonCode: 'other', createdAt: 'x' };
    },
    reportList: async (t, status) => {
      calls.push(['list', t, status]);
      fail();
      return { reports: [] };
    },
    reportTransition: async (t, id, v) => {
      calls.push(['transition', t, id, v]);
      fail();
      return { replayed: false, reportId: id, status: 'under_review' };
    },
  };
  const h = await harness(checks);
  try {
    const base = `${h.root}/towns/${town}/listing-reports`;
    const post = (url, body, headers = h.headers) =>
      fetch(url, {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    const nostore = (res) =>
      assert.equal(res.headers.get('cache-control'), 'no-store');
    const ok = { listingId: u(11), reasonCode: 'safety' };

    for (const res of [
      await fetch(base),
      await post(base, ok, { 'content-type': 'application/json' }),
      await post(base, ok, { authorization: 'Bearer wrong' }),
      await fetch(`${h.root}/listing-reports/${receipt}`),
    ]) {
      assert.equal(res.status, 401);
      nostore(res);
    }

    for (const bad of [
      '{',
      '[]',
      { ...ok, reasonCode: 'nope' },
      { ...ok, listingId: 'x' },
      { ...ok, note: 5 },
      { ...ok, email: 5 },
      { ...ok, extra: true },
      { ...ok, actorId: u(1) },
    ]) {
      const res = await post(base, bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
      nostore(res);
    }
    assert.equal(calls.length, 0);

    const done = await post(base, { ...ok, note: 'n', email: 'a@b.co' });
    assert.equal(done.status, 200);
    nostore(done);
    assert.deepEqual(await done.json(), { receipt });
    assert.deepEqual(calls[0], [
      'create',
      town,
      { ...ok, note: 'n', email: 'a@b.co' },
    ]);

    const look = await fetch(`${h.root}/listing-reports/${receipt}`, {
      headers: h.headers,
    });
    assert.equal(look.status, 200);
    nostore(look);
    // A receipt that is not 32 URL-safe characters is not a route at all.
    assert.equal(
      (await fetch(`${h.root}/listing-reports/short`, { headers: h.headers }))
        .status,
      404
    );
    assert.equal(
      (await fetch(`${base}?status=open&status=x`, { headers: h.headers }))
        .status,
      400
    );
    assert.equal(
      (await fetch(`${base}?x=1`, { headers: h.headers })).status,
      400
    );
    await fetch(`${base}?status=declined`, { headers: h.headers });
    assert.deepEqual(calls.at(-1), ['list', town, 'declined']);

    const act = `${base}/${u(20)}`;
    for (const bad of [
      { actorId: 'x' },
      { actorId: u(1), note: 5 },
      { actorId: u(1), suppressionId: 'x' },
      { actorId: u(1), other: 1 },
    ])
      assert.equal(
        (await post(`${act}/review`, bad)).status,
        400,
        JSON.stringify(bad)
      );
    assert.equal(
      (await fetch(`${act}/review`, { headers: h.headers })).status,
      404,
      'GET on a transition is not a route'
    );
    assert.equal(
      (await post(`${act}/resolve`, { actorId: u(1), suppressionId: u(2) }))
        .status,
      200
    );
    assert.deepEqual(calls.at(-1), [
      'transition',
      town,
      u(20),
      { action: 'resolve', actorId: u(1), suppressionId: u(2) },
    ]);

    for (const [m, status] of [
      ['invalid', 400],
      ['conflict', 409],
      ['missing', 404],
      ['fail', 503],
    ]) {
      mode = m;
      for (const res of [
        await post(base, ok),
        await post(`${act}/review`, { actorId: u(1) }),
        await fetch(`${h.root}/listing-reports/${receipt}`, {
          headers: h.headers,
        }),
      ]) {
        assert.equal(
          res.status,
          m === 'invalid' || m === 'conflict'
            ? status
            : m === 'missing'
            ? 404
            : 503
        );
        nostore(res);
        assert.equal(await res.text(), '', 'no error detail in the body');
      }
    }
  } finally {
    await h.close();
  }
});

test('report validation, hashing and priority', () => {
  const good = { townId: town, listingId: u(1), reasonCode: 'other' };
  assert.doesNotThrow(() => validateReport(good));
  assert.doesNotThrow(() =>
    validateReport({ ...good, note: 'x'.repeat(1000), email: 'A@b.co' })
  );
  for (const bad of [
    { ...good, reasonCode: 'spam' },
    { ...good, note: 'x'.repeat(1001) },
    { ...good, note: '  ' },
    { ...good, email: 'a b@c.co' },
    { ...good, email: 'x'.repeat(260) + '@b.co' },
    { ...good, townId: 'x' },
  ])
    assert.throws(() => validateReport(bad), /Invalid listing report/);
  assert.equal(normalizeEmail('  Foo@Bar.COM '), 'foo@bar.com');
  assert.deepEqual([...PRIORITY_REASONS].sort(), ['rights-request', 'safety']);
  assert.notEqual(
    contactKeyFrom('a'.repeat(32)),
    contactKeyFrom('b'.repeat(32))
  );
  assert.match(receiptHash('t'), /^[0-9a-f]{64}$/);
});

function fakeDb() {
  const sql = [];
  const query = async (text, params) => {
    sql.push([text, params]);
    if (
      /count\(\*\)::int AS n FROM directory_listing_report WHERE "communityId"/.test(
        text
      )
    )
      return [{ n: fakeDb.recent }];
    return [];
  };
  return { sql, db: { query, transaction: (fn) => fn({ query }) } };
}

test('createReport stores only hashes, caps the town rate and never keeps the token or email', async () => {
  fakeDb.recent = 0;
  const { sql, db } = fakeDb();
  const key = contactKeyFrom(secret);
  const out = await createReport(db, key, {
    townId: town,
    listingId: u(1),
    reasonCode: 'safety',
    email: 'Me@Example.com',
    note: 'n',
  });
  assert.match(out.receipt, /^[A-Za-z0-9_-]{32}$/);
  const insert = sql.find(([t]) =>
    t.includes('INSERT INTO directory_listing_report')
  );
  const params = insert[1];
  assert.ok(!JSON.stringify(params).includes(out.receipt));
  assert.ok(!JSON.stringify(params).toLowerCase().includes('example.com'));
  assert.ok(params.includes(receiptHash(out.receipt)));
  assert.ok(params.includes(true), 'safety is priority');
  fakeDb.recent = TOWN_HOURLY_CAP;
  await assert.rejects(
    createReport(fakeDb().db, key, {
      townId: town,
      listingId: u(1),
      reasonCode: 'other',
    }),
    /Reports busy/
  );
  await assert.rejects(
    createReport(db, 'short', {
      townId: town,
      listingId: u(1),
      reasonCode: 'other',
    }),
    /Reports busy/
  );
});

test('lookup and transition input are validated before any query', async () => {
  const { sql, db } = fakeDb();
  for (const token of ['', 'short', 'x'.repeat(33), 5, `${'a'.repeat(31)}!`])
    await assert.rejects(lookupReceipt(db, token), /Report unavailable/);
  const base = { townId: town, reportId: u(1), actorId: u(2) };
  for (const bad of [
    { ...base, action: 'hide' },
    { ...base, action: 'decline' },
    { ...base, action: 'review', note: 'n' },
    { ...base, action: 'decline', note: 'n', suppressionId: u(3) },
    { ...base, action: 'resolve', suppressionId: 'x' },
    { ...base, action: 'resolve', note: 'x'.repeat(1001) },
  ])
    await assert.rejects(transitionReport(db, bad), /Invalid listing report/);
  assert.equal(sql.length, 0);
});
