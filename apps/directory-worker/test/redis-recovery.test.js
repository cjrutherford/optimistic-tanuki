// Opt in: DIRECTORY_RECOVERY_TEST=1 (requires a local redis:alpine image and Docker).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const net = require('node:net');
const { randomUUID } = require('node:crypto');
const { DirectoryQueue } = require('../src/queue');
const { consumeOnce } = require('../src/worker');

const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 15000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function ready(name) {
  for (let i = 0; i < 100; i++) {
    try {
      if (docker('exec', name, 'redis-cli', 'ping') === 'PONG') return;
    } catch {}
    await delay(100);
  }
  throw new Error('Disposable Redis did not become ready');
}

// Discard exactly one server reply, then close the connection: the client cannot
// distinguish a committed command from a command that never reached Redis.
async function lossyProxy(port) {
  let drop = false;
  const sockets = new Set();
  const server = net.createServer((client) => {
    const upstream = net.connect(port, '127.0.0.1');
    sockets.add(client);
    sockets.add(upstream);
    client.on('close', () => {
      sockets.delete(client);
      upstream.destroy();
    });
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    client.on('error', () => {});
    upstream.on('error', () => {});
    client.pipe(upstream);
    upstream.on('data', (data) => {
      if (drop) {
        drop = false;
        client.destroy();
        upstream.destroy();
      } else client.write(data);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    dropNext: () => {
      drop = true;
    },
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

test(
  'AOF restart, process crash, leases and lost replies',
  { skip: process.env.DIRECTORY_RECOVERY_TEST !== '1', timeout: 90000 },
  async () => {
    const name = `s1-recovery-${process.pid}-${randomUUID().slice(0, 8)}`;
    let created = false,
      proxy,
      direct,
      lossy;
    const close = async (q) => {
      if (q) {
        try {
          await q.close();
        } catch {}
      }
    };
    try {
      docker(
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        name,
        '--network',
        'bridge',
        '-p',
        '127.0.0.1::6379',
        'redis:alpine',
        'redis-server',
        '--appendonly',
        'yes',
        '--appendfsync',
        'always',
        '--save',
        ''
      );
      created = true;
      await ready(name);
      let port = Number(docker('port', name, '6379/tcp').split(':').pop());
      let url = `redis://127.0.0.1:${port}`;
      const prefix = `s1-recovery-${randomUUID()}`;
      direct = await DirectoryQueue.connect(url, prefix);
      assert.equal(
        await direct.enqueue('restart', 's1.check', { original: true }),
        true
      );
      const stale = await direct.claim(300);
      assert.equal(stale.attempt, 1);
      await close(direct);
      direct = null;
      docker('stop', '--time', '5', name);
      docker('start', name);
      await ready(name);
      port = Number(docker('port', name, '6379/tcp').split(':').pop());
      url = `redis://127.0.0.1:${port}`;
      direct = await DirectoryQueue.connect(url, prefix);
      assert.equal((await direct.get('restart')).status, 'active');
      assert.equal(
        await direct.enqueue('restart', 's1.check', { replacement: true }),
        false
      );
      await delay(Math.max(0, stale.due - Date.now() + 30));
      const recovered = await direct.claim(1000);
      assert.equal(recovered.attempt, 2);
      assert.deepEqual(recovered.data, { original: true });
      assert.equal(await direct.complete(stale), false);
      assert.equal(await direct.complete(recovered), true);

      proxy = await lossyProxy(port);
      lossy = await DirectoryQueue.connect(
        `redis://127.0.0.1:${proxy.port}`,
        prefix
      );
      proxy.dropNext();
      await assert.rejects(
        lossy.enqueue('lost-enqueue', 's1.check', { original: true })
      );
      assert.equal((await direct.get('lost-enqueue')).status, 'waiting');
      assert.equal(
        await direct.enqueue('lost-enqueue', 's1.check', { replacement: true }),
        false
      );
      await close(lossy);
      lossy = await DirectoryQueue.connect(
        `redis://127.0.0.1:${proxy.port}`,
        prefix
      );
      proxy.dropNext();
      await assert.rejects(lossy.claim(200));
      const lostClaim = await direct.get('lost-enqueue');
      assert.equal(lostClaim.status, 'active');
      assert.equal(lostClaim.attempt, 1);
      await close(lossy);
      lossy = null;
      await close(direct);
      direct = null;
      docker('kill', '--signal', 'KILL', name);
      docker('start', name);
      await ready(name);
      port = Number(docker('port', name, '6379/tcp').split(':').pop());
      url = `redis://127.0.0.1:${port}`;
      direct = await DirectoryQueue.connect(url, prefix);
      await proxy.close();
      proxy = await lossyProxy(port);
      const afterCrash = await direct.get('lost-enqueue');
      assert.equal(afterCrash.status, 'active');
      assert.deepEqual(afterCrash.data, { original: true });
      await delay(Math.max(0, afterCrash.due - Date.now() + 30));
      const retry = await direct.claim(1000);
      assert.equal(retry.attempt, 2);
      assert.equal(await direct.complete(lostClaim), false);
      lossy = await DirectoryQueue.connect(
        `redis://127.0.0.1:${proxy.port}`,
        prefix
      );
      proxy.dropNext();
      await assert.rejects(lossy.complete(retry));
      assert.equal((await direct.get('lost-enqueue')).status, 'completed');
      assert.equal(await direct.complete(retry), false);
      assert.equal(await direct.enqueue('lost-enqueue', 's1.check', {}), false);
      assert.equal(await direct.enqueue('worker', 's1.check', {}), true);
      assert.equal(await consumeOnce(direct), true);
      assert.equal((await direct.get('worker')).status, 'completed');
    } finally {
      await close(lossy);
      await close(direct);
      if (proxy) await proxy.close();
      if (created) docker('rm', '-f', name);
    }
  }
);
