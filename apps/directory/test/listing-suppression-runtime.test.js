const test = require('node:test'),
  assert = require('node:assert/strict');
const { pendingServer } = require('../src/register-pending-runtime');

const town = '00000000-0000-4000-8000-000000000001';
const u = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const secret = 'local-evaluation-secret-1234567890123456';

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
  const base = `http://127.0.0.1:${
    server.address().port
  }/internal/local-evaluation/towns/${town}/listing-suppressions`;
  const headers = {
    authorization: `Bearer ${secret}`,
    'content-type': 'application/json',
  };
  return {
    base,
    headers,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('listing suppression transport is credentialed, strict, no-store and maps refusals', async () => {
  const calls = [];
  let mode = 'ok';
  const checks = {
    suppressionList: async (t) => ({ suppressions: [], town: t }),
    suppressionCreate: async (t, v) => {
      calls.push(['create', t, v]);
      if (mode === 'conflict') throw Error('Invalid listing suppression');
      if (mode === 'missing') throw Error('Listing unavailable');
      if (mode === 'fail') throw Error('boom');
      return {
        replayed: false,
        suppressionId: v.suppressionId,
        reasonCode: v.reasonCode,
        sentToReview: 0,
      };
    },
    suppressionLift: async (t, id, v) => {
      calls.push(['lift', t, id, v]);
      if (mode === 'conflict') throw Error('Invalid listing suppression');
      return {
        replayed: false,
        suppressionId: id,
        liftReasonCode: v.reasonCode,
      };
    },
  };
  const h = await harness(checks);
  try {
    const ok = {
      suppressionId: u(10),
      listingId: u(11),
      reasonCode: 'rights-request',
      actorId: u(12),
    };
    const post = (body, headers = h.headers) =>
      fetch(h.base, {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    const nostore = (res) =>
      assert.equal(res.headers.get('cache-control'), 'no-store');

    // auth
    for (const res of [
      await fetch(h.base),
      await post(ok, { 'content-type': 'application/json' }),
      await post(ok, { authorization: 'Bearer wrong' }),
    ]) {
      assert.equal(res.status, 401);
      nostore(res);
    }
    // list
    const list = await fetch(h.base, { headers: h.headers });
    assert.equal(list.status, 200);
    nostore(list);
    assert.deepEqual((await list.json()).suppressions, []);
    const junk = await fetch(h.base + '?x=1', { headers: h.headers });
    assert.equal(junk.status, 400);
    nostore(junk);

    // 400s
    for (const bad of [
      '{',
      '[]',
      { ...ok, reasonCode: 'nope' },
      { ...ok, reasonCode: undefined },
      { ...ok, suppressionId: 'x' },
      { ...ok, listingId: 'x' },
      { ...ok, actorId: 'x' },
      { ...ok, note: '   ' },
      { ...ok, note: 'a'.repeat(1025) },
      { ...ok, note: 5 },
      { ...ok, extra: true },
    ]) {
      const res = await post(bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
      nostore(res);
    }
    assert.equal(calls.length, 0);

    // success: a note is optional and forwarded only when given
    const done = await post(ok);
    assert.equal(done.status, 200);
    nostore(done);
    assert.equal((await done.json()).suppressionId, ok.suppressionId);
    await post({ ...ok, note: 'owner emailed us' });
    assert.deepEqual(calls[0], ['create', town, ok]);
    assert.equal(calls[1][2].note, 'owner emailed us');

    // refusals
    mode = 'conflict';
    const conflict = await post(ok);
    assert.equal(conflict.status, 409);
    nostore(conflict);
    mode = 'missing';
    assert.equal((await post(ok)).status, 404);
    mode = 'fail';
    const fail = await post(ok);
    assert.equal(fail.status, 503);
    nostore(fail);
    assert.equal(await fail.text(), '');

    // lift
    mode = 'ok';
    const liftUrl = `${h.base}/${u(10)}/lift`;
    const lift = (body, headers = h.headers) =>
      fetch(liftUrl, {
        method: 'POST',
        headers,
        body: typeof body === 'string' ? body : JSON.stringify(body),
      });
    assert.equal(
      (await lift({ reasonCode: 'resolved', actorId: u(12) }, {})).status,
      401
    );
    for (const bad of [
      '{',
      {},
      { reasonCode: 'rights-request', actorId: u(12) },
      { reasonCode: 'resolved', actorId: 'x' },
      { reasonCode: 'resolved', actorId: u(12), listingId: u(1) },
    ]) {
      const res = await lift(bad);
      assert.equal(res.status, 400, JSON.stringify(bad));
      nostore(res);
    }
    const lifted = await lift({ reasonCode: 'resolved', actorId: u(12) });
    assert.equal(lifted.status, 200);
    nostore(lifted);
    assert.deepEqual(calls.at(-1), [
      'lift',
      town,
      u(10),
      { reasonCode: 'resolved', actorId: u(12) },
    ]);
    mode = 'conflict';
    assert.equal(
      (await lift({ reasonCode: 'resolved', actorId: u(12) })).status,
      409
    );
    // only POST on the lift path, only GET/POST on the collection
    assert.equal((await fetch(liftUrl, { headers: h.headers })).status, 404);
    assert.equal(
      (await fetch(h.base, { method: 'DELETE', headers: h.headers })).status,
      404
    );
  } finally {
    await h.close();
  }
});

test('listing suppression idempotency is the id: replay returns the check result unchanged', async () => {
  const seen = new Map();
  const checks = {
    suppressionCreate: async (t, v) => {
      const prior = seen.get(v.suppressionId);
      if (prior && JSON.stringify(prior) !== JSON.stringify(v))
        throw Error('Invalid listing suppression');
      seen.set(v.suppressionId, v);
      return {
        replayed: !!prior,
        suppressionId: v.suppressionId,
        reasonCode: v.reasonCode,
        sentToReview: 0,
      };
    },
  };
  const h = await harness(checks);
  try {
    const body = {
      suppressionId: u(20),
      listingId: u(21),
      reasonCode: 'safety',
      actorId: u(22),
    };
    const send = (b) =>
      fetch(h.base, {
        method: 'POST',
        headers: h.headers,
        body: JSON.stringify(b),
      });
    const first = await (await send(body)).json();
    const again = await send(body);
    assert.equal(again.status, 200);
    assert.deepEqual(await again.json(), { ...first, replayed: true });
    assert.equal(
      (await send({ ...body, reasonCode: 'duplicate' })).status,
      409
    );
  } finally {
    await h.close();
  }
});
