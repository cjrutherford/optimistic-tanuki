const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  duplicateSweepConfig,
  createDuplicateSweepRunner,
  runDuplicateSweepLoop,
  DuplicateSweepStatus,
} = require('../src/duplicate-sweep');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const TOKEN = '33333333-3333-4333-8333-333333333333';

const fakeDb = (towns, paused = false) => {
  const tx = { query: async () => [] };
  return {
    query: async (sql) =>
      /directory_operating_control/.test(sql)
        ? paused
          ? [{ paused: true }]
          : []
        : towns,
    transaction: async (work) => work(tx),
  };
};

test('duplicate sweep is on by default, off only when explicitly off, bounded', () => {
  const c = duplicateSweepConfig({});
  assert.equal(c.limit, 5);
  assert.equal(
    duplicateSweepConfig({ DIRECTORY_AUTO_DUPLICATES: 'off' }),
    null
  );
  assert.throws(() => duplicateSweepConfig({ DIRECTORY_AUTO_DUPLICATES: 'x' }));
  assert.throws(() =>
    duplicateSweepConfig({ DIRECTORY_AUTO_DUPLICATES_LIMIT: '0' })
  );
});

test('a paused provider_acquisition control stops the sweep before any town is read', async () => {
  let asked = 0;
  const run = createDuplicateSweepRunner(
    duplicateSweepConfig({}),
    () => fakeDb([{ town: A, scans: 's1' }], true),
    {
      changeToken: async () => {
        asked++;
        return TOKEN;
      },
    },
    () => undefined
  );
  const out = await run();
  assert.equal(out.status, 'paused');
  assert.equal(asked, 0);
});

test('a town is examined once, again when its scans change or the recheck interval passes, bounded per run', async () => {
  let clock = 0;
  const towns = [
    { town: A, scans: 's1' },
    { town: B, scans: 's1' },
  ];
  const seen = [];
  const run = createDuplicateSweepRunner(
    { ...duplicateSweepConfig({}), limit: 1, recheckMs: 60_000 },
    () => fakeDb(towns),
    {
      changeToken: async (t) => {
        seen.push(t);
        return t === B ? null : TOKEN;
      },
    },
    () => undefined,
    () => clock
  );
  assert.equal((await run()).examined, 1); // limit 1: A
  assert.equal((await run()).examined, 1); // B (no token, failed)
  assert.deepEqual(seen, [A, B]);
  clock = 1;
  assert.equal((await run()).examined, 1); // B is unseen again (failure is not recorded)
  assert.equal((await run()).examined, 1);
  towns[0].scans = 's1,s2';
  seen.length = 0;
  await run();
  assert.ok(seen.includes(A));
  clock = 120_000;
  assert.equal((await run()).examined, 1);
});

test('the loop records status and never throws', async () => {
  const status = new DuplicateSweepStatus(true);
  const controller = new AbortController();
  await runDuplicateSweepLoop({
    signal: controller.signal,
    intervalMs: 1000,
    limit: 5,
    status,
    log: () => undefined,
    run: async () => {
      throw Error('boom');
    },
    pause: async () => controller.abort(),
  });
  assert.equal(status.snapshot().lastStatus, 'error');
});
