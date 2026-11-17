const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const f = require('./reviewed-binding-fixtures');
const {
  accountLegacy,
} = require('../../../scripts/local-directory-reviewed-binding-legacy.cjs');

const enabled = Boolean(f.connectionUrls());

async function withWorld(run) {
  const world = await f.connect();
  try {
    await f.reset(world.live, world.stage);
    return await run(world.live);
  } finally {
    await world.close();
  }
}

// Candidates that were published before bindings existed: no binding row at all.
async function legacyCandidate(live, n, status = 'published') {
  const seeded = await f.seedRow(live, live, n, { stageRow: false });
  await live.query('DELETE FROM directory_reviewed_binding WHERE id=$1', [
    seeded.bindingId,
  ]);
  if (status !== 'published')
    await live.query(
      'UPDATE directory_address_review_candidate SET status=$2 WHERE id=$1',
      [seeded.candidateId, status]
    );
  return seeded;
}

test('a dry run counts but writes nothing', { skip: !enabled }, () =>
  withWorld(async (live) => {
    await legacyCandidate(live, 1);
    const result = await accountLegacy(live);
    assert.deepEqual(result, {
      apply: false,
      publishedWithoutBinding: 1,
      inserted: 0,
    });
    assert.equal(
      (await live.query('SELECT 1 FROM directory_reviewed_binding')).length,
      0
    );
  })
);

test(
  'legacy accounting is idempotent, never active, and invents no provenance',
  { skip: !enabled },
  () =>
    withWorld(async (live) => {
      for (let n = 1; n <= 5; n += 1) await legacyCandidate(live, n);
      await legacyCandidate(live, 6, 'revoked');
      const bound = await f.seedRow(live, live, 7, {
        stageRow: false,
        state: 'active',
        until: new Date(Date.now() + 3_600_000),
      });

      const first = await accountLegacy(live, { apply: true });
      assert.deepEqual(first, {
        apply: true,
        publishedWithoutBinding: 5,
        inserted: 5,
      });
      const again = await accountLegacy(live, { apply: true });
      assert.deepEqual(again, {
        apply: true,
        publishedWithoutBinding: 0,
        inserted: 0,
      });

      const rows = await live.query(
        `SELECT * FROM directory_reviewed_binding WHERE provenance='unknown_legacy'`
      );
      assert.equal(rows.length, 5);
      for (const row of rows) {
        assert.equal(row.state, 'suspended');
        assert.equal(row.stateCause, 'legacy_no_provenance');
        for (const column of [
          'decisionId',
          'stageInstallationId',
          'stageScanId',
          'stageSourceFileRowNumber',
          'stagePolicyId',
          'stageContentHash',
          'reviewedHash',
          'fieldHashes',
          'livePolicyId',
          'verifiedUntil',
        ]) {
          assert.equal(row[column], null, column);
        }
      }
      assert.equal(
        (
          await live.query(
            `SELECT 1 FROM directory_reviewed_binding_event WHERE kind='suspended' AND cause='legacy_no_provenance'`
          )
        ).length,
        5
      );
      assert.equal(
        (await f.bindingState(live, bound.bindingId)).state,
        'active'
      );
      await assert.rejects(
        live.query(
          `UPDATE directory_reviewed_binding SET state='active',"verifiedUntil"=now() + interval '1 hour' WHERE id=$1`,
          [rows[0].id]
        ),
        /CHK_directory_reviewed_binding_legacy_hidden/
      );
    })
);

test(
  'the script refuses --apply without a matching --confirm-database',
  { skip: !enabled },
  () => {
    const env = {
      ...process.env,
      DIRECTORY_DATABASE_URL: process.env.S5_BINDING_LIVE_TEST_DATABASE_URL,
      TS_NODE_PROJECT: 'apps/directory/tsconfig.json',
    };
    const run = (...args) =>
      execFileSync(
        'node',
        [
          '-r',
          'ts-node/register/transpile-only',
          'scripts/local-directory-reviewed-binding-legacy.cjs',
          ...args,
        ],
        { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
    assert.throws(() => run('--apply'), /confirm-database/);
    assert.throws(
      () => run('--apply', '--confirm-database', 'something_else'),
      /confirm-database/
    );
    const dry = JSON.parse(run());
    assert.equal(dry.apply, false);
    const ok = JSON.parse(
      run(
        '--apply',
        '--confirm-database',
        new URL(process.env.S5_BINDING_LIVE_TEST_DATABASE_URL).pathname.slice(1)
      )
    );
    assert.equal(ok.apply, true);
  }
);
