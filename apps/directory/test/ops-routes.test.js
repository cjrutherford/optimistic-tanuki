const test = require('node:test'),
  assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { randomUUID } = require('node:crypto');
const { handleOpsRoute, parseControlUpdate } = require('../src/ops-routes');
const { toPrometheus, spendAlertCents } = require('../src/ops-metrics');

const secret = 's9-local-secret-0123456789012345678901234';
const actor = randomUUID();

const control = (over = {}) => ({
  key: 'export_worker',
  paused: true,
  reason: 'maintenance',
  version: 2,
  updatedBy: actor,
  updatedAt: '2026-11-17T00:00:00.000Z',
  ...over,
});
const metrics = (over = {}) => ({
  generatedAt: '2026-11-17T12:00:00.000Z',
  infrastructure: {
    database: 'ok',
    postgis: true,
    migrationsApplied: 47,
    latestMigration: 'DirectoryOperatingControls1794971660195',
    exportStorage: 'configured',
  },
  towns: { total: 3, onboarded: 2, byStatus: { ready: 2, pending: 1 } },
  coverage: { townsWithListings: 2, publishedListings: 40 },
  freshness: {
    refreshDueListings: 5,
    staleListings: 1,
    unknownFreshnessListings: 2,
    oldestListingAgeDays: 130,
  },
  policy: {
    activePolicies: 1,
    revokedPolicies: 0,
    publicationPaused: false,
    openRightsCases: 2,
    openTaxonomyCases: 3,
  },
  spend: {
    period: '2026-11',
    reservedCents: 2100,
    limitCents: 2500,
    alertCents: 2000,
    alert: true,
    exhausted: false,
  },
  queues: {
    export: { queued: 1, running: 0, failedLast24h: 0, oldestQueuedSeconds: 9 },
    taxonomy: {
      queued: 0,
      running: 1,
      failedLast24h: 2,
      oldestQueuedSeconds: null,
    },
    withdrawal: {
      queued: 0,
      running: 0,
      failedLast24h: 0,
      oldestQueuedSeconds: null,
    },
  },
  controls: [control({ paused: false, reason: null })],
  errors: [],
  ...over,
});

async function withServer(checks, fn) {
  const server = createServer(async (req, res) => {
    if (!(await handleOpsRoute(req, res, checks, secret))) {
      res.writeHead(404).end();
    }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, init = {}) =>
    fetch(base + path, {
      ...init,
      headers: { authorization: `Bearer ${secret}`, ...(init.headers || {}) },
    });
  try {
    await fn(call, base);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const post = (body) => ({ method: 'POST', body: JSON.stringify(body) });
const checksWith = (over = {}) => {
  const calls = [];
  return {
    calls,
    opsMetrics: async () => metrics(),
    opsControls: async () => [control()],
    opsSetControl: async (v) => {
      calls.push(v);
      return { ok: true, control: control({ key: v.key, paused: v.paused }) };
    },
    ...over,
  };
};

test('ops routes: auth, metrics formats and query validation, no-store everywhere', async () => {
  await withServer(checksWith(), async (call, base) => {
    assert.equal((await fetch(`${base}/internal/ops/metrics`)).status, 401);
    const json = await call('/internal/ops/metrics');
    assert.equal(json.status, 200);
    assert.equal(json.headers.get('cache-control'), 'no-store');
    assert.match(json.headers.get('content-type'), /application\/json/);
    assert.equal((await json.json()).towns.total, 3);
    const prom = await call('/internal/ops/metrics?format=prometheus');
    assert.equal(prom.status, 200);
    assert.equal(prom.headers.get('cache-control'), 'no-store');
    assert.equal(
      prom.headers.get('content-type'),
      'text/plain; version=0.0.4; charset=utf-8'
    );
    assert.match(await prom.text(), /^# HELP directory_/);
    for (const q of [
      '?format=json',
      '?x=1',
      '?format=prometheus&x=1',
      '?format=prometheus&format=prometheus',
    ])
      assert.equal((await call(`/internal/ops/metrics${q}`)).status, 400, q);
    assert.equal(
      (await call('/internal/ops/metrics', { method: 'POST' })).status,
      405
    );
    const list = await call('/internal/ops/controls');
    assert.equal(list.status, 200);
    assert.equal(list.headers.get('cache-control'), 'no-store');
    assert.equal((await list.json()).controls.length, 1);
    assert.equal((await call('/internal/ops/controls?x=1')).status, 400);
  });
});

test('ops routes: control update validation, unknown key, conflict, success', async () => {
  const checks = checksWith();
  await withServer(checks, async (call) => {
    const ok = {
      paused: true,
      reason: ' maintenance ',
      actorId: actor,
      expectedVersion: 1,
    };
    const res = await call('/internal/ops/controls/export_worker', post(ok));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(checks.calls[0].reason, 'maintenance');
    assert.equal(
      (await call('/internal/ops/controls/withdrawal_worker', post(ok))).status,
      404
    );
    assert.equal(
      (await call('/internal/ops/controls/export_worker')).status,
      405
    );
    const bad = [
      { ...ok, paused: 'yes' },
      { ...ok, reason: '' },
      { ...ok, reason: undefined },
      { ...ok, reason: 'x'.repeat(501) },
      { ...ok, actorId: 'nope' },
      { ...ok, expectedVersion: -1 },
      { ...ok, expectedVersion: 1.5 },
      { ...ok, extra: 1 },
    ];
    for (const body of bad)
      assert.equal(
        (await call('/internal/ops/controls/export_worker', post(body))).status,
        400,
        JSON.stringify(body)
      );
    assert.equal(
      (
        await call('/internal/ops/controls/export_worker', {
          method: 'POST',
          body: '[]',
        })
      ).status,
      400
    );
    assert.equal(checks.calls.length, 1);
    // Resuming needs no reason.
    assert.equal(
      (
        await call(
          '/internal/ops/controls/export_worker',
          post({ ...ok, paused: false, reason: undefined })
        )
      ).status,
      200
    );
  });
  await withServer(
    checksWith({
      opsSetControl: async () => ({ ok: false, code: 'stale_version' }),
    }),
    async (call) => {
      const res = await call(
        '/internal/ops/controls/taxonomy_worker',
        post({ paused: false, actorId: actor, expectedVersion: 0 })
      );
      assert.equal(res.status, 409);
      assert.deepEqual(await res.json(), { code: 'stale_version' });
    }
  );
  await withServer(
    checksWith({
      opsMetrics: async () => {
        throw Error('db down');
      },
    }),
    async (call) => {
      const res = await call('/internal/ops/metrics');
      assert.equal(res.status, 503);
      assert.equal(res.headers.get('cache-control'), 'no-store');
    }
  );
});

test('parseControlUpdate normalises the reason', () => {
  assert.deepEqual(
    parseControlUpdate({ paused: false, actorId: actor, expectedVersion: 0 }),
    { paused: false, reason: null, actorId: actor, expectedVersion: 0 }
  );
  assert.equal(parseControlUpdate(null), null);
});

test('prometheus exposition: gauges only, fixed labels, nulls omitted', () => {
  const text = toPrometheus(metrics());
  assert.match(
    text,
    /# TYPE directory_towns_total gauge\ndirectory_towns_total 3\n/
  );
  assert.match(text, /directory_queue_queued\{queue="export"\} 1\n/);
  assert.match(text, /directory_control_paused\{key="export_worker"\} 0\n/);
  assert.match(text, /directory_spend_alert 1\n/);
  assert.doesNotMatch(
    text,
    /directory_queue_oldest_queued_seconds\{queue="taxonomy"\}/
  );
  assert.match(
    text,
    /directory_queue_oldest_queued_seconds\{queue="export"\} 9\n/
  );
  for (const line of text.trim().split('\n'))
    assert.match(
      line,
      /^(# (HELP|TYPE) directory_\w+ .+|directory_\w+(\{[a-z_]+="[a-z0-9_]+"(,[a-z_]+="[a-z0-9_]+")*\})? -?\d+)$/
    );
  // Unsafe label values (free text) never reach the output.
  const hostile = toPrometheus(
    metrics({
      towns: { total: 1, onboarded: 0, byStatus: { 'x"} 1\n# evil': 1 } },
    })
  );
  assert.doesNotMatch(hostile, /evil/);
  // A failed section drops its gauges and is flagged.
  const failed = toPrometheus(metrics({ spend: null, errors: ['spend'] }));
  assert.doesNotMatch(failed, /directory_spend_reserved_cents/);
  assert.match(failed, /directory_ops_section_failed\{section="spend"\} 1\n/);
  assert.match(failed, /directory_ops_section_failed\{section="towns"\} 0\n/);
});

test('spend alert threshold: integer 1..2500 else 2000', () => {
  const env = (v) => ({ DIRECTORY_SPEND_ALERT_CENTS: v });
  assert.equal(spendAlertCents({}), 2000);
  assert.equal(spendAlertCents(env('1500')), 1500);
  assert.equal(spendAlertCents(env('2500')), 2500);
  for (const bad of ['0', '2501', '-5', '12.5', 'abc', '', '1e3'])
    assert.equal(spendAlertCents(env(bad)), 2000, bad);
});
