require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const run = require('../src/acquisition-run');
const {
  StageStopped,
  ledgerSink,
  openLedger,
  parseLedgerArgs,
} = require('../../../scripts/local-directory-run-ledger.cjs');

// Disposable, loopback-only database named s7e_scratch_*. Only a fake sink is used: no stage script, provider or live
// database is touched.
const url = process.env.S7E_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s7e_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S7E_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s7e_scratch_* database required');
}
const actor = randomUUID();
const quiet =
  (fn) =>
  async (...args) => {
    const log = console.log;
    console.log = () => undefined;
    try {
      return await fn(...args);
    } finally {
      console.log = log;
    }
  };
const rows = (n, status = 'eligible') =>
  Array.from({ length: n }, () => ({ outcome: { status } }));
const fakeSink = () => {
  const committed = [];
  return {
    committed,
    note: 'kept',
    async commit(batch, checkpoint) {
      committed.push([batch.length, checkpoint]);
      return batch.length;
    },
    other() {
      return this === undefined ? 'unbound' : 'bound';
    },
  };
};

test('ledger flags: --no-ledger, --resume and their conflicts', () => {
  const id = randomUUID();
  assert.deepEqual(parseLedgerArgs(['--x', '1']), {
    rest: ['--x', '1'],
    resume: null,
    enabled: true,
  });
  assert.deepEqual(parseLedgerArgs(['--no-ledger', 'a']), {
    rest: ['a'],
    resume: null,
    enabled: false,
  });
  assert.equal(parseLedgerArgs(['--resume', id]).resume, id);
  assert.throws(() => parseLedgerArgs(['--resume', 'nope']), /Invalid run/);
  assert.throws(() => parseLedgerArgs(['--resume']), /Invalid run/);
  assert.throws(
    () => parseLedgerArgs(['--no-ledger', '--resume', id]),
    /Invalid run/
  );
});

test('a disabled ledger records nothing and never stops the stage', async () => {
  const ledger = await openLedger(null, { enabled: false });
  assert.equal(ledger.id, null);
  assert.equal(ledger.units, null);
  const sink = ledgerSink(fakeSink(), ledger, 'a');
  assert.equal(await sink.commit(rows(2), { scanId: 's' }), 2);
  assert.equal(await ledger.shouldStop(), false);
});

async function withDb(fn) {
  const ds = new DataSource({ type: 'postgres', url });
  await ds.initialize();
  try {
    await ds.query(
      'TRUNCATE directory_acquisition_run, directory_acquisition_run_job, directory_acquisition_run_event'
    );
    await fn(ds);
  } finally {
    await ds.destroy();
  }
}
const open = (ds, extra = {}) =>
  quiet(openLedger)(ds, {
    enabled: true,
    resume: null,
    kind: 'overture-stage',
    provider: 'overture',
    release: '2026-10-21.0',
    townIds: [],
    reason: 'fixture',
    ...extra,
  });

test(
  'the sink wrapper records counts and checkpoints per batch and passes everything else through',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const ledger = await open(ds);
      await ledger.job('asset-1');
      const inner = fakeSink();
      const sink = ledgerSink(inner, ledger, 'asset-1');
      assert.equal(sink.note, 'kept');
      assert.equal(sink.other(), 'bound');
      await sink.commit([...rows(3), ...rows(1, 'rejected')], {
        scanId: 'scan-1',
        sourceFileRowNumber: 4,
        secret: 'not recorded',
      });
      await sink.commit(rows(2), { scanId: 'scan-1', sourceFileRowNumber: 6 });
      assert.equal(inner.committed.length, 2);
      await ledger.finishJob('asset-1', { status: 'succeeded' });
      await ledger.finish();
      const detail = await run.getAcquisitionRun(ds, ledger.id);
      assert.equal(detail.status, 'succeeded');
      assert.deepEqual(
        [detail.observed, detail.accepted, detail.rejected],
        [6, 5, 1]
      );
      const [job] = detail.jobs;
      assert.deepEqual(job.checkpoint, {
        scanId: 'scan-1',
        sourceFileRowNumber: 6,
      });
      assert.equal(JSON.stringify(detail).includes('not recorded'), false);
    });
  }
);

test(
  'an operator cancel stops the stage after the committed batch, then a resume runs only the queued unit',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      const ledger = await open(ds);
      await ledger.job('asset-1');
      const inner = fakeSink();
      const sink = ledgerSink(inner, ledger, 'asset-1');
      await sink.commit(rows(2), { scanId: 's', sourceFileRowNumber: 2 });
      const token = (await run.getAcquisitionRun(ds, ledger.id)).versionToken;
      await run.cancelAcquisitionRun(ds, {
        id: ledger.id,
        decisionId: randomUUID(),
        actorId: actor,
        reason: 'stop it',
        expectedVersionToken: token,
      });
      await assert.rejects(
        sink.commit(rows(2), { scanId: 's', sourceFileRowNumber: 4 }),
        StageStopped
      );
      // The batch that tripped the stop is durable, so the checkpoint advanced.
      assert.equal(inner.committed.length, 2);
      await ledger.finishJob('asset-1', { status: 'cancelled' });
      await ledger.finish();
      let detail = await run.getAcquisitionRun(ds, ledger.id);
      assert.equal(detail.status, 'cancelled');
      assert.deepEqual(detail.jobs[0].checkpoint, {
        scanId: 's',
        sourceFileRowNumber: 4,
      });

      await run.resumeAcquisitionRun(ds, {
        id: ledger.id,
        decisionId: randomUUID(),
        actorId: actor,
        reason: 'continue',
        expectedVersionToken: detail.versionToken,
      });
      const resumed = await open(ds, { resume: ledger.id });
      assert.equal(resumed.id, ledger.id);
      assert.deepEqual(resumed.units, ['asset-1']);
      const again = await resumed.job('asset-1');
      assert.deepEqual(again.checkpoint, {
        scanId: 's',
        sourceFileRowNumber: 4,
      });
      assert.equal(again.attempt, 2);
      await resumed.finishJob('asset-1', { status: 'succeeded' });
      await resumed.finish();
      detail = await run.getAcquisitionRun(ds, ledger.id);
      assert.equal(detail.status, 'succeeded');
    });
  }
);

test(
  'a resume of the wrong kind or an unknown run is refused, and a failure is recorded redacted',
  { skip: !url },
  async () => {
    await withDb(async (ds) => {
      await assert.rejects(
        open(ds, { resume: randomUUID() }),
        /Run not found|Invalid/
      );
      const ledger = await open(ds);
      await ledger.job('asset-1');
      await ledger.fail(
        new Error('boom at https://secret.example/a?k=1 /home/me/file'),
        'asset-1'
      );
      const detail = await run.getAcquisitionRun(ds, ledger.id);
      assert.ok(
        ['failed_retryable', 'failed_permanent'].includes(detail.status)
      );
      assert.equal(
        /secret\.example|\/home\/me/.test(JSON.stringify(detail)),
        false
      );
      await assert.rejects(
        open(ds, { resume: ledger.id, kind: 'census-stage' }),
        /Invalid|not|resum/i
      );
    });
  }
);
