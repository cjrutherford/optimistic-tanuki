const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  bindingSweepConfig,
  BindingSweepStatus,
  runBindingSweepLoop,
} = require('../src/binding-sweep');
const { retryUntilReady } = require('../src/startup-retry');

const full = () => ({
  DIRECTORY_DATABASE_URL: 'postgres://u:pw@h/live',
  DIRECTORY_CONTACT_STAGE_DATABASE_URL: 'postgres://u:pw@h/stage',
  DIRECTORY_CONTACT_STAGE_LABEL: 'stage-1',
  DIRECTORY_REVIEWED_BINDING_HMAC_KEY: 'k'.repeat(40),
});
const ok = { status: 'ok', examined: 2, counts: { extended: 2 } };

test('sweep is disabled unless all four settings are present', () => {
  assert.equal(bindingSweepConfig({}), null);
  for (const name of Object.keys(full())) {
    const env = full();
    delete env[name];
    assert.equal(bindingSweepConfig(env), null, name);
  }
  const config = bindingSweepConfig(full());
  assert.equal(config.intervalMs, 3_600_000);
  assert.equal(config.leaseMs, 24 * 3_600_000);
  assert.equal(config.suspensionTimeoutMs, 30 * 86_400_000);
  assert.equal(
    bindingSweepConfig({
      ...full(),
      DIRECTORY_BINDING_SWEEP_INTERVAL_MS: '5000',
    }).intervalMs,
    5000
  );
  assert.throws(
    () =>
      bindingSweepConfig({
        ...full(),
        DIRECTORY_BINDING_SWEEP_INTERVAL_MS: '5',
      }),
    /interval/
  );
});

test('loop runs on the configured interval, records status and stops on abort', async () => {
  const controller = new AbortController(),
    status = new BindingSweepStatus(true),
    pauses = [];
  let runs = 0;
  await runBindingSweepLoop({
    signal: controller.signal,
    intervalMs: 777,
    status,
    run: async () => {
      runs++;
      return ok;
    },
    pause: async (ms) => {
      pauses.push(ms);
      if (runs === 3) controller.abort();
    },
  });
  assert.equal(runs, 3);
  assert.deepEqual(pauses, [777, 777, 777]);
  const snap = status.snapshot();
  assert.equal(snap.lastStatus, 'ok');
  assert.equal(snap.examined, 2);
  assert.deepEqual(snap.counts, { extended: 2 });
});

test('runs never overlap even when a run is slow', async () => {
  const controller = new AbortController(),
    status = new BindingSweepStatus(true);
  let active = 0,
    peak = 0,
    runs = 0;
  await runBindingSweepLoop({
    signal: controller.signal,
    intervalMs: 1,
    status,
    run: async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 15));
      active--;
      if (++runs === 3) controller.abort();
      return ok;
    },
    pause: async () => {},
  });
  assert.equal(peak, 1);
});

test('errors are logged without detail, recorded, and never stop the loop', async () => {
  const controller = new AbortController(),
    status = new BindingSweepStatus(true),
    logs = [];
  let runs = 0;
  await runBindingSweepLoop({
    signal: controller.signal,
    intervalMs: 1,
    status,
    log: (m) => logs.push(m),
    run: async () => {
      if (++runs === 1) throw Error('postgres://u:SECRET@h/db');
      if (runs === 2)
        return { status: 'stage-unreachable', examined: 0, counts: {} };
      controller.abort();
      return ok;
    },
    pause: async () => {},
  });
  assert.equal(runs, 3);
  assert.ok(!logs.join('\n').includes('SECRET'));
  assert.equal(status.snapshot().lastStatus, 'ok');
  assert.equal(logs.length, 2);
});

test('error status is visible in the snapshot', async () => {
  const controller = new AbortController(),
    status = new BindingSweepStatus(true);
  await runBindingSweepLoop({
    signal: controller.signal,
    intervalMs: 1,
    status,
    log: () => {},
    run: async () => {
      controller.abort();
      throw Error('x');
    },
    pause: async () => {},
  });
  assert.equal(status.snapshot().lastStatus, 'error');
  assert.equal(new BindingSweepStatus(false).snapshot().enabled, false);
});

test('startup retries with capped exponential backoff until ready', async () => {
  const waits = [];
  let tries = 0;
  const result = await retryUntilReady(
    async () => {
      if (++tries < 6) throw Error('not ready');
      return 'up';
    },
    {
      signal: new AbortController().signal,
      initialMs: 1000,
      maxMs: 4000,
      log: () => {},
      pause: async (ms) => {
        waits.push(ms);
      },
    }
  );
  assert.equal(result, 'up');
  assert.deepEqual(waits, [1000, 2000, 4000, 4000, 4000]);
});

test('startup gives up with the last error after the timeout', async () => {
  let clock = 0,
    tries = 0;
  await assert.rejects(
    retryUntilReady(
      async () => {
        throw Error(`fail ${++tries}`);
      },
      {
        signal: new AbortController().signal,
        timeoutMs: 5000,
        initialMs: 1000,
        maxMs: 2000,
        log: () => {},
        now: () => clock,
        pause: async (ms) => {
          clock += ms;
        },
      }
    ),
    /fail \d/
  );
  assert.ok(tries >= 3 && tries < 10);
});

test('startup does not retry once aborted', async () => {
  const controller = new AbortController();
  let tries = 0;
  await assert.rejects(
    retryUntilReady(
      async () => {
        tries++;
        controller.abort();
        throw Error('x');
      },
      { signal: controller.signal, log: () => {}, pause: async () => {} }
    )
  );
  assert.equal(tries, 1);
});
