const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const db = require('../src/data-source').default;
const {
  beginRegisterRecovery,
  advanceRegisterRecovery,
} = require('../src/register-recovery-authority');
const {
  readRegisterSweep,
  beginRegisterSweep,
  advanceRegisterSweep,
} = require('../src/register-sweep-authority');
const url = process.env.DIRECTORY_RECOVERY_TEST_DATABASE_URL;

test(
  'durable sweeps reject stale generations and preserve recovery retries and fencing',
  { skip: !url },
  async () => {
    db.setOptions({ url });
    await db.initialize();
    const request = {
      sourceEpoch: randomUUID(),
      activationId: randomUUID(),
      socialGeneration: '1',
      owner: randomUUID(),
      expectedPrevious: null,
      externalFence: true,
    };
    const checkpoint = (phase, cursor = null) => ({ phase, cursor });
    try {
      const identity = await beginRegisterRecovery(db, request);
      await advanceRegisterRecovery(
        db,
        identity,
        checkpoint('blocked'),
        checkpoint('reg-source')
      );
      await advanceRegisterRecovery(
        db,
        identity,
        checkpoint('reg-source'),
        checkpoint('reg-directory')
      );
      await advanceRegisterRecovery(
        db,
        identity,
        checkpoint('reg-directory'),
        checkpoint('reg-running')
      );
      assert.equal(await readRegisterSweep(db, identity), null);
      const census = await beginRegisterSweep(db, identity, null);
      assert.deepEqual(census, {
        generation: '1',
        phase: 'census',
        cursor: null,
      });
      const first = { ...census, phase: 'source' };
      await advanceRegisterSweep(db, identity, census, first);
      assert.equal(
        (await beginRegisterRecovery(db, request)).phase,
        'reg-running'
      );
      const id = '10000000-0000-4000-8000-000000000001';
      const page = { ...first, cursor: id };
      const concurrent = await Promise.all([
        advanceRegisterSweep(db, identity, first, page),
        advanceRegisterSweep(db, identity, first, page),
      ]);
      assert.deepEqual(concurrent, [page, page]);
      assert.deepEqual(
        await advanceRegisterSweep(db, identity, first, page),
        page
      );
      assert.deepEqual(await beginRegisterSweep(db, identity, null), page);
      await assert.rejects(
        advanceRegisterSweep(db, identity, first, {
          ...first,
          phase: 'directory',
        }),
        /changed/
      );
      const competing = [
        '20000000-0000-4000-8000-000000000001',
        '30000000-0000-4000-8000-000000000001',
      ].map((cursor) => ({ ...page, cursor }));
      const outcomes = await Promise.allSettled(
        competing.map((next) => advanceRegisterSweep(db, identity, page, next))
      );
      assert.equal(
        outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
        1
      );
      assert.equal(
        outcomes.filter(
          (outcome) =>
            outcome.status === 'rejected' &&
            /changed/.test(outcome.reason.message)
        ).length,
        1
      );
      const winning = outcomes.find(
        (outcome) => outcome.status === 'fulfilled'
      ).value;
      const directory = { ...first, phase: 'directory' };
      await advanceRegisterSweep(db, identity, winning, directory);
      const complete = { ...first, phase: 'complete' };
      await advanceRegisterSweep(db, identity, directory, complete);
      const [{ registerRequest: completedRequest }] = await db.query(
        'SELECT "registerRequest" FROM directory_census_progress WHERE id=\'recovery\''
      );
      assert.equal(completedRequest.lastCompletedSweep.generation, '1');
      assert.ok(
        Number.isFinite(
          Date.parse(completedRequest.lastCompletedSweep.completedAt)
        )
      );
      assert.equal(
        (await beginRegisterRecovery(db, request)).phase,
        'reg-running'
      );
      const second = await beginRegisterSweep(db, identity, '1');
      assert.deepEqual(second, {
        generation: '2',
        phase: 'census',
        cursor: null,
      });
      await assert.rejects(
        advanceRegisterSweep(db, identity, first, page),
        /changed/
      );
      await assert.rejects(beginRegisterSweep(db, identity, null), /changed/);
      const [{ registerRequest }] = await db.query(
        'SELECT "registerRequest" FROM directory_census_progress WHERE id=\'recovery\''
      );
      await db.query(
        'UPDATE directory_census_progress SET "registerRequest"=NULL WHERE id=\'recovery\''
      );
      await assert.rejects(readRegisterSweep(db, identity), /authority/);
      await db.query(
        'UPDATE directory_census_progress SET "registerRequest"=$1::jsonb WHERE id=\'recovery\'',
        [JSON.stringify(registerRequest)]
      );
      const previous = Object.fromEntries(
        [
          'sourceEpoch',
          'activationId',
          'socialGeneration',
          'recoveryEpoch',
          'owner',
          'directoryGeneration',
        ].map((k) => [k, identity[k]])
      );
      await beginRegisterRecovery(db, {
        ...request,
        expectedPrevious: previous,
      });
      await assert.rejects(readRegisterSweep(db, identity), /authority/);
      await assert.rejects(
        advanceRegisterSweep(db, identity, second, {
          ...second,
          phase: 'source',
        }),
        /authority/
      );
    } finally {
      await db.destroy();
    }
  }
);
