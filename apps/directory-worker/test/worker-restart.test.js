// Opt in: DIRECTORY_WORKER_RESTART_TEST=1; requires local Redis and PostGIS images.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DirectoryQueue } = require('../src/queue');
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(label, fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
test('worker startup remains fenced until restore protocol is available', async () => {
  const {
    assertRestoreProtocolAvailable,
  } = require('../../directory/src/restore-fence');
  assert.throws(
    () => assertRestoreProtocolAvailable(),
    /restore fencing is not implemented/
  );
  const result = require('node:child_process').spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register/transpile-only',
      '-r',
      'tsconfig-paths/register',
      'apps/directory-worker/src/main.ts',
    ],
    {
      env: {
        ...process.env,
        TS_NODE_PROJECT: 'apps/directory-worker/tsconfig.json',
      },
      encoding: 'utf8',
      timeout: 15000,
    }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Directory worker failed to start/);
});

test(
  'running worker reconnects after Redis restart (requires operational v2)',
  { skip: process.env.DIRECTORY_WORKER_RESTART_TEST !== '1', timeout: 110000 },
  async () => {
    const suffix = randomUUID().slice(0, 8),
      redis = `s1-worker-redis-${suffix}`,
      db = `s1-worker-db-${suffix}`;
    const prefix = `s1-worker-${suffix}`,
      redisPort = await freePort(),
      httpPort = await freePort();
    const dir = mkdtempSync(join(tmpdir(), 's1-worker-acl-'));
    const password = randomUUID(),
      acl = join(dir, 'users.acl');
    writeFileSync(
      acl,
      `user default off\nuser candidate on >${password} ~${prefix}:jobs-v3 +ping +client|setinfo +eval +hget +hlen +hexists +hgetall +hset +hdel\n`,
      { mode: 0o644 }
    );
    let worker,
      queue,
      redisCreated = false,
      dbCreated = false,
      output = '';
    try {
      docker(
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        redis,
        '-p',
        `127.0.0.1:${redisPort}:6379`,
        '-v',
        `${acl}:/tmp/users.acl:ro`,
        'redis:alpine',
        'redis-server',
        '--aclfile',
        '/tmp/users.acl'
      );
      redisCreated = true;
      docker(
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        db,
        '-e',
        'POSTGRES_PASSWORD=localtest',
        '-p',
        '127.0.0.1::5432',
        'postgis/postgis:17-3.5'
      );
      dbCreated = true;
      await until('PostGIS', () =>
        docker(
          'exec',
          db,
          'pg_isready',
          '-h',
          '127.0.0.1',
          '-U',
          'postgres'
        ).includes('accepting')
      );
      docker(
        'exec',
        db,
        'psql',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-c',
        "CREATE EXTENSION IF NOT EXISTS postgis; CREATE TABLE directory_installation (id integer); CREATE ROLE worker_probe LOGIN PASSWORD 'probe-only'; REVOKE CONNECT ON DATABASE postgres FROM PUBLIC; GRANT CONNECT ON DATABASE postgres TO worker_probe;"
      );
      const dbPort = Number(docker('port', db, '5432/tcp').split(':').pop());
      const url = `redis://candidate:${password}@127.0.0.1:${redisPort}`;
      await until(
        'Redis',
        () =>
          docker(
            'exec',
            redis,
            'redis-cli',
            '--user',
            'candidate',
            '-a',
            password,
            'ping'
          ) === 'PONG'
      );
      worker = spawn(
        process.execPath,
        [
          '-r',
          'ts-node/register/transpile-only',
          '-r',
          'tsconfig-paths/register',
          'apps/directory-worker/src/main.ts',
        ],
        {
          env: {
            ...process.env,
            TS_NODE_PROJECT: 'apps/directory-worker/tsconfig.json',
            DIRECTORY_REDIS_URL: url,
            DIRECTORY_QUEUE_PREFIX: prefix,
            DIRECTORY_DATABASE_URL: `postgres://worker_probe:probe-only@127.0.0.1:${dbPort}/postgres`,
            DIRECTORY_WORKER_PORT: String(httpPort),
            SOCIAL_HOST: '127.0.0.1',
            DIRECTORY_SOCIAL_SECRET: 'disposable-test-secret',
            DIRECTORY_SERVICE_SECRET:
              'disposable-test-secret-at-least-32-bytes',
            DIRECTORY_RECEIPT_URL: 'http://127.0.0.1:1/receipt',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      worker.stdout.on('data', (data) => {
        output = (output + data).slice(-4000);
      });
      worker.stderr.on('data', (data) => {
        output = (output + data).slice(-4000);
      });
      const endpoint = `http://127.0.0.1:${httpPort}/health/ready`;
      const status = async () =>
        (await fetch(endpoint, { signal: AbortSignal.timeout(3500) })).status;
      try {
        await until('initial readiness 200', async () => {
          if (worker.exitCode !== null) throw new Error('worker exited');
          return (await status()) === 200;
        });
      } catch (error) {
        throw new Error(
          `${error.message}; worker exit ${worker.exitCode}; output: ${output}`
        );
      }
      const pid = worker.pid;
      docker('stop', '-t', '2', redis);
      await until(
        'outage readiness 503',
        async () => (await status()) === 503,
        10000
      );
      assert.equal(
        worker.exitCode,
        null,
        `worker exited during outage: ${output}`
      );
      docker('start', redis);
      await until(
        'Redis restart',
        () =>
          docker(
            'exec',
            redis,
            'redis-cli',
            '--user',
            'candidate',
            '-a',
            password,
            'ping'
          ) === 'PONG'
      );
      await until(
        'recovered readiness 200',
        async () => (await status()) === 200
      );
      assert.equal(worker.pid, pid);
      assert.equal(worker.exitCode, null, `worker exited: ${output}`);
      queue = await DirectoryQueue.connect(url, prefix);
      assert.equal(
        await queue.enqueue('after-restart', 's1.check', {}, 1),
        true
      );
      await until(
        'job completion',
        async () => (await queue.get('after-restart'))?.status === 'completed'
      );
      assert.equal(worker.exitCode, null);
    } finally {
      if (queue) await queue.close().catch(() => {});
      if (worker && worker.exitCode === null) {
        worker.kill('SIGKILL');
        await new Promise((resolve) => worker.once('exit', resolve));
      }
      if (redisCreated) docker('rm', '-f', redis);
      if (dbCreated) docker('rm', '-f', db);
      rmSync(dir, { recursive: true, force: true });
    }
  }
);
