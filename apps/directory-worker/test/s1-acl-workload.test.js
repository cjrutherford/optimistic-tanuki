const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { randomBytes } = require('node:crypto');
const { createClient } = require('redis');
const { DirectoryQueue } = require('../src/queue');
const { consumeOnce } = require('../src/worker');
const { createReadinessCheck, createReadinessServer } = require('../../directory/src/server');

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', timeout: 15000 }).trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('candidate ACL permits queue workload and fails readiness on Redis loss', { skip: process.env.DIRECTORY_ACL_WORKLOAD_TEST !== '1', timeout: 60000 }, async () => {
  const suffix = randomBytes(6).toString('hex');
  const name = `s1acl-${suffix}`, prefix = `s1acl-${suffix}`, password = randomBytes(18).toString('hex');
  const dir = mkdtempSync(join(tmpdir(), 's1acl-'));
  const acl = join(dir, 'users.acl');
  writeFileSync(acl, `user default off\nuser candidate on >${password} ~${prefix}:jobs-v3 +ping +client|setinfo +eval +hget +hlen +hexists +hgetall +hset +hdel\n`, { mode: 0o644 });
  let queue, recovered, client, server, created = false;
  try {
    docker('run', '-d', '--pull', 'never', '--name', name, '-p', '127.0.0.1::6379', '-v', `${acl}:/tmp/users.acl:ro`, 'redis:alpine', 'redis-server', '--aclfile', '/tmp/users.acl', '--appendonly', 'yes', '--appendfsync', 'always');
    created = true;
    const port = Number(docker('port', name, '6379/tcp').split(':').pop());
    const url = `redis://candidate:${password}@127.0.0.1:${port}`;
    for (let i = 0; i < 40; i++) {
      try { queue = await DirectoryQueue.connect(url, prefix); break; } catch { await delay(100); }
    }
    assert.ok(queue, 'Redis started');
    client = createClient({ url }); client.on('error', () => {}); await client.connect();
    assert.equal(await client.ping(), 'PONG');
    await assert.rejects(client.hGet('foreign:jobs-v3', 'x'), /NOPERM/);
    await assert.rejects(client.configGet('dir'), /NOPERM/);
    await assert.rejects(client.get(`${prefix}:jobs-v3`), /NOPERM/);
    assert.equal(await queue.ready(), true);
    assert.equal(await queue.enqueue('retry', 's1.check', { check: true }, 2), true);
    let job = await queue.claim(1000); assert.equal(job.attempt, 1);
    assert.equal(await queue.fail(job, 'transient'), true);
    job = await queue.claim(1000); assert.equal(job.attempt, 2);
    assert.equal(await queue.complete(job), true);
    assert.equal((await queue.get('retry')).status, 'completed');
    assert.equal(await queue.enqueue('worker', 's1.check', {}, 1), true);
    assert.equal(await consumeOnce(queue), true);
    assert.equal((await queue.get('worker')).status, 'completed');
    let activeQueue = queue;
    server = createReadinessServer(createReadinessCheck([() => activeQueue.ready()]));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/health/ready`;
    assert.equal((await fetch(endpoint)).status, 200);
    await client.close(); client = null;
    docker('stop', '-t', '2', name);
    assert.equal((await fetch(endpoint)).status, 503);
    docker('start', name);
    const restartedPort = Number(docker('port', name, '6379/tcp').split(':').pop());
    const restartedUrl = `redis://candidate:${password}@127.0.0.1:${restartedPort}`;
    for (let i = 0; i < 40; i++) {
      try { recovered = await DirectoryQueue.connect(restartedUrl, prefix); break; } catch { await delay(100); }
    }
    assert.ok(recovered, 'fresh connection after Redis restart');
    activeQueue = recovered;
    assert.equal((await fetch(endpoint)).status, 200);
    assert.equal((await activeQueue.get('retry')).status, 'completed');
    assert.equal(await activeQueue.enqueue('after-restart', 's1.check', {}, 1), true);
    assert.equal(await consumeOnce(activeQueue), true);
    assert.equal((await activeQueue.get('after-restart')).status, 'completed');
  } finally {
    if (recovered) await recovered.close().catch(() => {});
    if (server) await new Promise(resolve => server.close(resolve));
    if (client?.isOpen) await client.close();
    if (queue) await queue.close().catch(() => {});
    if (created) docker('rm', '-f', name);
    rmSync(dir, { recursive: true, force: true });
  }
});
