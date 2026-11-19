const nodeTest = require('node:test').test;
const assert = require('node:assert/strict');
const { DirectoryQueue } = require('../src/queue');
const { consumeOnce } = require('../src/worker');

const url = process.env.DIRECTORY_TEST_REDIS_URL;
const urlB = process.env.DIRECTORY_TEST_REDIS_URL_B;
const required = [
  'DIRECTORY_TEST_REDIS_URL',
  'DIRECTORY_TEST_REDIS_URL_B',
  'DIRECTORY_TEST_REDIS_ADMIN_URL',
];
const missing = required.filter((name) => !process.env[name]);
// These tests need disposable Redis instances. Without them (CI has none) they
// are skipped with the reason, like the Postgres suites, instead of crashing
// the whole directory-worker test run.
const skip = missing.length
  ? `disposable Redis test configuration required: ${missing.join(', ')}`
  : false;
const test = (name, fn) => nodeTest(name, { skip }, fn);
for (const command of [
  'eval',
  'hget',
  'hlen',
  'hexists',
  'hgetall',
  'hset',
  'hdel',
]) {
  test(`readiness detects denied ${command} and recovers without changing jobs`, async () => {
    const { createClient } = require('redis');
    const admin = createClient({
      url: process.env.DIRECTORY_TEST_REDIS_ADMIN_URL,
    });
    await admin.connect();
    const suffix = `${process.pid}-${Date.now()}-${command}`;
    const prefix = `s1-acl-${suffix}`;
    const user = `s1-acl-${suffix}`;
    const key = `${prefix}:jobs-v3`;
    const userUrl = new URL(process.env.DIRECTORY_TEST_REDIS_ADMIN_URL);
    userUrl.username = user;
    userUrl.password = 'isolated-test-password';
    let q;
    try {
      await admin.sendCommand([
        'ACL',
        'SETUSER',
        user,
        'on',
        '>isolated-test-password',
        `~${key}`,
        '+eval',
        '+hget',
        '+hlen',
        '+hexists',
        '+hgetall',
        '+hset',
        '+hdel',
      ]);
      q = await DirectoryQueue.connect(userUrl.toString(), prefix);
      await q.enqueue('preserved', 's1.check', { marker: command });
      assert.equal(await q.ready(), true);
      const before = await admin.hGetAll(key);
      await admin.sendCommand(['ACL', 'SETUSER', user, `-${command}`]);
      assert.equal(await q.ready(), false);
      assert.deepEqual(await admin.hGetAll(key), before);
      await admin.sendCommand(['ACL', 'SETUSER', user, `+${command}`]);
      assert.equal(await q.ready(), true);
      assert.deepEqual(await admin.hGetAll(key), before);
      assert.deepEqual((await q.get('preserved')).data, { marker: command });
    } finally {
      if (q) await q.close();
      await admin.sendCommand(['ACL', 'DELUSER', user]);
      await admin.del(key);
      await admin.close();
    }
  });
}
test('Redis queue consumes once per identity, retries failures, recovers leases and isolates prefixes', async () => {
  assert.ok(url && urlB, 'Both test Redis URLs are required');
  const suffix = `${process.pid}-${Date.now()}`;
  const a = await DirectoryQueue.connect(url, `s1test-a-${suffix}`);
  const b = await DirectoryQueue.connect(urlB, `s1test-b-${suffix}`);
  const denied = await DirectoryQueue.connect(url, `s1test-b-${suffix}`);
  try {
    assert.equal(await a.enqueue('same', 's1.check', { x: 1 }, 2), true);
    assert.equal(await a.enqueue('same', 's1.check', { x: 2 }, 2), false);
    assert.equal(await b.claim(1000), null);
    await assert.rejects(denied.claim(1000), /NOPERM/);
    let job = await a.claim(1000);
    assert.deepEqual(job.data, { x: 1 });
    await a.fail(job, 'temporary');
    job = await a.claim(1000);
    assert.equal(job.attempt, 2);
    await a.complete(job);
    assert.equal((await a.get('same')).status, 'completed');
    assert.equal(await a.enqueue('same', 's1.check', {}, 2), false);
    await a.enqueue('fail', 's1.check', {}, 2);
    await a.fail(await a.claim(1000), 'first');
    await a.fail(await a.claim(1000), 'last');
    assert.equal((await a.get('fail')).status, 'failed');
    assert.equal(await a.claim(1000), null);
    await a.enqueue('lease', 's1.check', {}, 2);
    const stale = await a.claim(20);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const recovered = await a.claim(1000);
    assert.equal(recovered.attempt, 2);
    assert.equal(await a.complete(stale), false);
    assert.equal(await a.complete(recovered), true);
    await b.enqueue('same', 's1.check', { other: true }, 1);
    assert.equal(await consumeOnce(b), true);
    assert.equal((await b.get('same')).status, 'completed');
    await b.enqueue('unsupported', 'unknown', {}, 1);
    assert.equal(await consumeOnce(b), true);
    assert.equal((await b.get('unsupported')).status, 'failed');
  } finally {
    await a.close();
    await b.close();
    await denied.close();
  }
});

test('queue writes fail safely and readiness recovers when Redis permissions or key type recover', async () => {
  const { createClient } = require('redis');
  assert.ok(
    process.env.DIRECTORY_TEST_REDIS_ADMIN_URL,
    'Disposable test Redis admin URL is required'
  );
  const admin = createClient({
    url: process.env.DIRECTORY_TEST_REDIS_ADMIN_URL,
  });
  await admin.connect();
  const prefix = `s1test-a-fault-${process.pid}-${Date.now()}`;
  const key = `${prefix}:jobs-v3`;
  const q = await DirectoryQueue.connect(url, prefix);
  const user = decodeURIComponent(new URL(url).username);
  assert.ok(user, 'A named disposable Redis ACL user is required');
  const permissions = (...args) =>
    admin.sendCommand(['ACL', 'SETUSER', user, ...args]);
  try {
    assert.equal(await q.ready(), true);
    await permissions('-hdel');
    assert.equal(await q.ready(), false);
    await permissions('+hdel');
    await permissions('-hset');
    assert.equal(await q.ready(), false);
    await assert.rejects(
      q.enqueue('job', 's1.check', {}),
      /ACL failure|NOPERM/
    );
    await permissions('+hset');
    assert.equal(await q.ready(), true);
    assert.equal(await q.get('job'), null);
    assert.equal(await q.enqueue('job', 's1.check', {}, 3), true);
    await permissions('-hset');
    await assert.rejects(q.claim(1000), /ACL failure|NOPERM/);
    await permissions('+hset');
    assert.equal((await q.get('job')).attempt, 0);
    const job = await q.claim(1000);
    await permissions('-hset');
    await assert.rejects(q.complete(job), /ACL failure|NOPERM/);
    await permissions('+hset');
    assert.equal((await q.get('job')).status, 'active');
    assert.equal(await q.complete(job), true);
    await admin.del(key);
    await admin.set(key, 'wrong type');
    assert.equal(await q.ready(), false);
    await assert.rejects(q.enqueue('other', 's1.check', {}), /WRONGTYPE/);
    await admin.del(key);
    assert.equal(await q.ready(), true);
    assert.equal(await q.enqueue('other', 's1.check', {}), true);
  } finally {
    await permissions('+hset', '+hdel');
    await admin.del(key);
    await q.close();
    await admin.close();
  }
});

test('bounded queue applies backpressure and only removes expired terminal jobs', async () => {
  const prefix = `s1test-a-bound-${process.pid}-${Date.now()}`;
  const q = await DirectoryQueue.connect(url, prefix, {
    maxJobs: 2,
    retentionMs: 40,
  });
  const mismatch = await DirectoryQueue.connect(url, prefix, {
    maxJobs: 3,
    retentionMs: 40,
  });
  try {
    assert.equal(await q.enqueue('active', 's1.check', {}), true);
    await assert.rejects(
      mismatch.enqueue('other', 's1.check', {}),
      /configuration mismatch/i
    );
    assert.equal(await mismatch.ready(), false);
    const active = await q.claim(1000);
    assert.equal(await q.enqueue('terminal', 's1.check', {}), true);
    const terminal = await q.claim(1000);
    assert.equal(await q.complete(terminal), true);
    assert.equal(await q.enqueue('terminal', 's1.check', {}), false);
    await assert.rejects(q.enqueue('overflow', 's1.check', {}), /queue.*full/i);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await q.claim(1000); // bounded cleanup of one expired terminal record
    assert.equal(await q.get('terminal'), null);
    assert.equal((await q.get('active')).status, 'active');
    assert.equal(await q.enqueue('terminal', 's1.check', {}), true);
    await assert.rejects(
      q.enqueue('large', 's1.check', { value: 'x'.repeat(17000) }),
      /large/i
    );
    assert.equal(await q.complete(active), true);
  } finally {
    await q.close();
    await mismatch.close();
  }
});
