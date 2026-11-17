const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createReadinessServer,
  createReadinessCheck,
} = require('../src/server');

async function withServer(ready, run) {
  const server = createReadinessServer(ready);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('HTTP readiness reports healthy, failed and unknown routes', async () => {
  for (const [result, status] of [
    [true, 200],
    [false, 503],
  ]) {
    await withServer(
      async () => result,
      async (url) => {
        const response = await fetch(`${url}/health/ready`);
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), { ready: result });
        assert.equal((await fetch(`${url}/other`)).status, 404);
        assert.equal(
          (await fetch(`${url}/health/ready`, { method: 'POST' })).status,
          404
        );
      }
    );
  }
});

test('HTTP readiness catches rejected and synchronous handler errors', async () => {
  for (const ready of [
    async () => {
      throw Error('offline');
    },
    () => {
      throw Error('offline');
    },
  ]) {
    await withServer(ready, async (url) => {
      const response = await fetch(`${url}/health/ready`);
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ready: false });
    });
  }
});

test('stalled dependency returns 503 by deadline without accumulating probes', async () => {
  let calls = 0;
  const ready = createReadinessCheck(
    [
      () => {
        calls++;
        return new Promise(() => {});
      },
      async () => true,
    ],
    30
  );
  await withServer(ready, async (url) => {
    for (let i = 0; i < 2; i++) {
      const response = await fetch(`${url}/health/ready`, {
        signal: AbortSignal.timeout(1000),
      });
      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), { ready: false });
    }
    assert.equal(calls, 1);
  });
});

test('a failed dependency can recover on a later request', async () => {
  let healthy = false;
  const ready = createReadinessCheck([async () => healthy], 30);
  await withServer(ready, async (url) => {
    assert.equal((await fetch(`${url}/health/ready`)).status, 503);
    healthy = true;
    assert.equal((await fetch(`${url}/health/ready`)).status, 200);
  });
});

test('a rejection alongside a stalled probe does not spawn repeated probes', async () => {
  let calls = 0;
  const ready = createReadinessCheck(
    [
      async () => {
        throw Error('offline');
      },
      () => {
        calls++;
        return new Promise(() => {});
      },
    ],
    20
  );
  await withServer(ready, async (url) => {
    for (let i = 0; i < 2; i++)
      assert.equal((await fetch(`${url}/health/ready`)).status, 503);
    assert.equal(calls, 1);
  });
});

test('HTTP readiness checks initialization, PostGIS/table result and Redis ping', async () => {
  const { createDependencyChecks } = require('../src/server');
  let installed = true;
  let pong = 'PONG';
  const db = {
    isInitialized: false,
    async initialize() {
      this.isInitialized = true;
    },
    async query(sql) {
      assert.match(sql, /pg_extension/);
      assert.match(sql, /directory_installation/);
      return [{ installed }];
    },
  };
  const redis = {
    isOpen: false,
    async connect() {
      this.isOpen = true;
    },
    async ping() {
      return pong;
    },
  };
  await withServer(
    createReadinessCheck(createDependencyChecks(db, redis), 50),
    async (url) => {
      assert.equal((await fetch(`${url}/health/ready`)).status, 200);
      assert.equal(db.isInitialized, true);
      assert.equal(redis.isOpen, true);
      installed = false;
      assert.equal((await fetch(`${url}/health/ready`)).status, 503);
      installed = true;
      pong = 'NO';
      assert.equal((await fetch(`${url}/health/ready`)).status, 503);
      db.query = async () => {
        throw Error('database offline');
      };
      assert.equal((await fetch(`${url}/health/ready`)).status, 503);
    }
  );
});

test('internal town status fails closed and never serves stored geometry', async () => {
  const id = '11111111-1111-4111-8111-111111111111';
  let unavailable = false;
  const server = createReadinessServer(
    async () => true,
    async () => {
      if (unavailable) throw Error('offline');
    }
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${
      server.address().port
    }/internal/towns/${id}/status`;
    const response = await fetch(url);
    assert.deepEqual(await response.json(), { status: 'pending' });
    assert.equal((await fetch(url, { method: 'POST' })).status, 404);
    unavailable = true;
    assert.equal((await fetch(url)).status, 503);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
