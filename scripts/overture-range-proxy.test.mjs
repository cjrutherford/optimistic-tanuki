import test from 'node:test';
import assert from 'node:assert/strict';
import { openPinnedRangeProxy } from './overture-range-proxy.mjs';
const openTestProxy = (options) =>
  openPinnedRangeProxy({
    ...options,
    reserveAttempt: async (attempt) => ({
      state: 'reserved',
      attemptId: attempt.attemptId,
      period: new Date().toISOString().slice(0, 7),
    }),
  });

test('only proxies a single pinned object using conditional range requests', async () => {
  const observed = [];
  const proxy = await openTestProxy({
    asset:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet',
    etag: 'abc-2',
    upstream: async (url, options) => {
      observed.push({ url, options });
      return new Response(options.method === 'HEAD' ? null : 'data', {
        status: options.method === 'HEAD' ? 200 : 206,
        headers: {
          etag: '"abc-2"',
          'content-length': '4',
          'content-range': 'bytes 0-3/4',
          'accept-ranges': 'bytes',
        },
      });
    },
  });
  try {
    const head = await fetch(proxy.url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    const result = await fetch(proxy.url, { headers: { Range: 'bytes=0-3' } });
    assert.equal(await result.text(), 'data');
    assert.ok(
      observed.every((x) => x.options.headers['If-Match'] === '"abc-2"')
    );
    assert.equal(observed[1].options.headers.Range, 'bytes=0-3');
    assert.equal((await fetch(proxy.url)).status, 400);
    assert.equal(
      (await fetch(proxy.url.replace('/object', '/other'), { method: 'HEAD' }))
        .status,
      404
    );
  } finally {
    await proxy.close();
  }
});
test('rejects mismatched upstream object identity and unexpected ranges', async () => {
  const proxy = await openTestProxy({
    asset:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet',
    etag: 'abc',
    upstream: async () =>
      new Response('bad', { status: 206, headers: { etag: '"other"' } }),
  });
  try {
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-3' } })).status,
      502
    );
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-3,4-5' } })).status,
      400
    );
  } finally {
    await proxy.close();
  }
});
test('rejects upstream responses for a different byte range', async () => {
  const proxy = await openTestProxy({
    asset:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet',
    etag: 'abc',
    upstream: async () =>
      new Response('xx', {
        status: 206,
        headers: {
          etag: '"abc"',
          'content-range': 'bytes 2-3/4',
          'content-length': '2',
        },
      }),
  });
  try {
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-1' } })).status,
      502
    );
  } finally {
    await proxy.close();
  }
});
test('rejects arbitrary upstream hosts and invalid object identities', async () => {
  await assert.rejects(
    openTestProxy({
      asset:
        'https://example.test/release/2026-10-21.0/theme=places/type=place/a.parquet',
      etag: 'abc',
    })
  );
  await assert.rejects(
    openTestProxy({
      asset:
        'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/a.parquet',
      etag: 'bad"etag',
    })
  );
});
test('fails closed when the conditional response exceeds the scan transfer budget', async () => {
  const proxy = await openTestProxy({
    asset:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet',
    etag: 'abc',
    maxBytes: 3,
    upstream: async () =>
      new Response('data', {
        status: 206,
        headers: {
          etag: '"abc"',
          'content-range': 'bytes 0-3/4',
          'content-length': '4',
        },
      }),
  });
  try {
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-3' } })).status,
      429
    );
  } finally {
    await proxy.close();
  }
});
test('counts cumulative bytes across range responses', async () => {
  const proxy = await openTestProxy({
    asset:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet',
    etag: 'abc',
    maxBytes: 3,
    upstream: async () =>
      new Response('da', {
        status: 206,
        headers: {
          etag: '"abc"',
          'content-range': 'bytes 0-1/4',
          'content-length': '2',
        },
      }),
  });
  try {
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-1' } })).status,
      206
    );
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-1' } })).status,
      429
    );
  } finally {
    await proxy.close();
  }
});
test('requires a new budget reservation before every upstream attempt', async () => {
  const asset =
    'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
  const without = await openPinnedRangeProxy({
    asset,
    etag: 'abc',
    upstream: async () => new Response(),
  }).then(
    async (p) => {
      await p.close();
      return 'opened without reservation';
    },
    (error) => error.message
  );
  assert.match(without, /reservation/i);
  const attempts = [],
    calls = [];
  const proxy = await openPinnedRangeProxy({
    asset,
    etag: 'abc',
    reserveAttempt: async (attempt) => {
      attempts.push(attempt);
      return {
        state: attempts.length === 2 ? 'replay' : 'reserved',
        attemptId: attempts.length === 4 ? 'wrong' : attempt.attemptId,
        period:
          attempts.length === 3
            ? '1900-01'
            : new Date().toISOString().slice(0, 7),
      };
    },
    upstream: async (_url, options) => {
      calls.push(options.method);
      return new Response(null, {
        status: 200,
        headers: { etag: '"abc"', 'content-length': '4' },
      });
    },
  });
  try {
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 429);
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 429);
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 429);
    assert.equal(calls.length, 1);
    assert.equal(attempts.length, 4);
    assert.notEqual(attempts[0].attemptId, attempts[1].attemptId);
  } finally {
    await proxy.close();
  }
});
test('rejects an already over-budget explicit range before reservation or upstream request', async () => {
  const asset =
    'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
  let reservations = 0,
    calls = 0;
  const proxy = await openPinnedRangeProxy({
    asset,
    etag: 'abc',
    maxBytes: 3,
    reserveAttempt: async (attempt) => {
      reservations++;
      return {
        state: 'reserved',
        attemptId: attempt.attemptId,
        period: new Date().toISOString().slice(0, 7),
      };
    },
    upstream: async () => {
      calls++;
      return new Response('data', {
        status: 206,
        headers: {
          etag: '"abc"',
          'content-range': 'bytes 0-3/4',
          'content-length': '4',
        },
      });
    },
  });
  try {
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-3' } })).status,
      429
    );
    assert.equal(reservations, 0);
    assert.equal(calls, 0);
  } finally {
    await proxy.close();
  }
});
test('a free authorization cannot be used with an injected upstream transport', async () => {
  const asset =
    'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
  let calls = 0;
  const proxy = await openPinnedRangeProxy({
    asset,
    etag: 'abc',
    reserveAttempt: async (a) => ({
      state: 'authorized-free',
      attemptId: a.attemptId,
      period: new Date().toISOString().slice(0, 7),
    }),
    upstream: async () => {
      calls++;
      return new Response(null, { status: 200 });
    },
  });
  try {
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 429);
    assert.equal(calls, 0);
  } finally {
    await proxy.close();
  }
});
test('a validated free authorization permits only the anonymous default transport', async () => {
  const actualFetch = globalThis.fetch,
    asset =
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
  let calls = 0,
    options;
  globalThis.fetch = async (_url, opts) => {
    calls++;
    options = opts;
    return new Response(null, {
      status: 200,
      headers: { etag: '"abc"', 'content-length': '0' },
    });
  };
  try {
    const { openPinnedRangeProxy: open } = await import(
      './overture-range-proxy.mjs?anonymous-test'
    );
    const proxy = await open({
      asset,
      etag: 'abc',
      reserveAttempt: async (a) => ({
        state: 'authorized-free',
        attemptId: a.attemptId,
        period: new Date().toISOString().slice(0, 7),
      }),
    });
    try {
      assert.equal(
        (await actualFetch(proxy.url, { method: 'HEAD' })).status,
        200
      );
      assert.equal(calls, 1);
      assert.equal(options.credentials, 'omit');
      assert.equal(options.headers.Authorization, undefined);
    } finally {
      await proxy.close();
    }
  } finally {
    globalThis.fetch = actualFetch;
  }
});

const evidenceAsset =
  'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/example.parquet';
test('captures the first verified response only, including its Last-Modified', async () => {
  const seen = [];
  let n = 0;
  const proxy = await openTestProxy({
    asset: evidenceAsset,
    etag: 'abc',
    onVerified: (e) => seen.push(e),
    upstream: async (_url, options) => {
      n++;
      return new Response(options.method === 'HEAD' ? null : 'data', {
        status: options.method === 'HEAD' ? 200 : 206,
        headers: {
          etag: '"abc"',
          'content-length': options.method === 'HEAD' ? '4' : '4',
          'content-range': 'bytes 0-3/4',
          'last-modified':
            n === 1
              ? 'Tue, 21 Oct 2026 12:00:00 GMT'
              : 'Wed, 22 Oct 2026 12:00:00 GMT',
        },
      });
    },
  });
  try {
    assert.equal(proxy.evidence(), null);
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 200);
    assert.equal(
      (await fetch(proxy.url, { headers: { Range: 'bytes=0-3' } })).status,
      206
    );
    const e = proxy.evidence();
    assert.equal(e.lastModified, 'Tue, 21 Oct 2026 12:00:00 GMT');
    assert.equal(e.etag, 'abc');
    assert.equal(e.contentRangeTotal, 4);
    assert.equal(e.asset, evidenceAsset);
    assert.equal(seen.length, 1);
    assert.ok(Number.isSafeInteger(e.at));
  } finally {
    await proxy.close();
  }
});
test('captures nothing from 412, 502, wrong ETag or wrong range responses', async () => {
  for (const make of [
    () => new Response(null, { status: 412 }),
    () =>
      new Response('x', {
        status: 200,
        headers: {
          etag: '"abc"',
          'last-modified': 'Tue, 21 Oct 2026 12:00:00 GMT',
        },
      }),
    () =>
      new Response('x', {
        status: 206,
        headers: {
          etag: '"other"',
          'last-modified': 'Tue, 21 Oct 2026 12:00:00 GMT',
          'content-range': 'bytes 0-3/4',
          'content-length': '4',
        },
      }),
    () =>
      new Response('xx', {
        status: 206,
        headers: {
          etag: '"abc"',
          'last-modified': 'Tue, 21 Oct 2026 12:00:00 GMT',
          'content-range': 'bytes 2-3/4',
          'content-length': '2',
        },
      }),
  ]) {
    const proxy = await openTestProxy({
      asset: evidenceAsset,
      etag: 'abc',
      upstream: async () => make(),
    });
    try {
      await fetch(proxy.url, { headers: { Range: 'bytes=0-3' } });
      assert.equal(proxy.evidence(), null);
    } finally {
      await proxy.close();
    }
  }
});
test('a verified response without Last-Modified records a null date and the first capture is kept', async () => {
  let n = 0;
  const proxy = await openTestProxy({
    asset: evidenceAsset,
    etag: 'abc',
    upstream: async () =>
      new Response(null, {
        status: 200,
        headers: {
          etag: '"abc"',
          'content-length': '4',
          ...(++n > 1
            ? { 'last-modified': 'Tue, 21 Oct 2026 12:00:00 GMT' }
            : {}),
        },
      }),
  });
  try {
    await fetch(proxy.url, { method: 'HEAD' });
    await fetch(proxy.url, { method: 'HEAD' });
    assert.equal(proxy.evidence().lastModified, null);
    assert.equal(proxy.evidence().contentRangeTotal, 4);
  } finally {
    await proxy.close();
  }
});
test('a throwing onVerified callback never breaks the response', async () => {
  const proxy = await openTestProxy({
    asset: evidenceAsset,
    etag: 'abc',
    onVerified: () => {
      throw Error('x');
    },
    upstream: async () =>
      new Response(null, {
        status: 200,
        headers: { etag: '"abc"', 'content-length': '4' },
      }),
  });
  try {
    assert.equal((await fetch(proxy.url, { method: 'HEAD' })).status, 200);
    assert.ok(proxy.evidence());
  } finally {
    await proxy.close();
  }
});
