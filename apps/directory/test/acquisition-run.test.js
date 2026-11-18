const test = require('node:test'),
  assert = require('node:assert/strict');
const {
  classifyStageError,
  redactError,
  resumeCommand,
} = require('../src/acquisition-run');
const { handleAcquisitionRoute } = require('../src/acquisition-routes');
const { ReviewConflictError } = require('../src/review-version');

const A = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const D = '33333333-3333-4333-8333-333333333333';
const TOKEN = 'a'.repeat(64);

test('errors are redacted of urls, hosts, paths and long tokens', () => {
  const out = redactError(
    Error(
      'fetch https://example.com/a?key=1 failed on 10.0.0.1:5432 db.internal:5432 at /home/u/x/y.js with abcdefghijklmnopqrstuvwxyz012345'
    )
  );
  assert.doesNotMatch(out, /example|10\.0|internal|\/home|abcdefghijkl/);
  assert.equal(redactError(undefined), 'Failed');
  assert.ok(redactError(Error('x'.repeat(1000))).length <= 200);
});

test('stage errors map to a blocked reason or a failure class', () => {
  const c = (m) => classifyStageError(Error(m));
  assert.equal(
    c('Monthly provider budget exhausted').blockedReason,
    'budget_exhausted'
  );
  assert.equal(
    c('Private policy unavailable or revoked').blockedReason,
    'policy_blocked'
  );
  assert.equal(
    c('POC region checksum mismatch').blockedReason,
    'invalid_geometry'
  );
  assert.equal(
    c('Refusing non-local databases').blockedReason,
    'acquisition_unauthorized'
  );
  assert.equal(c('quota exceeded').blockedReason, 'quota_exhausted');
  assert.equal(c('Release inventory changed').status, 'failed_permanent');
  assert.equal(c('socket hang up').status, 'failed_retryable');
});

test('resume command names the script and run id only', () => {
  assert.equal(
    resumeCommand('overture-stage', ID),
    `DIRECTORY_LOCAL_EVALUATION=true node scripts/local-directory-overture-stage.cjs --stage-local --resume ${ID}`
  );
  assert.equal(resumeCommand('historical', ID), null);
  assert.equal(resumeCommand('overture-stage', 'bad'), null);
});

function harness(method, url, body, over = {}) {
  const calls = [];
  const checks = new Proxy(
    {},
    {
      get:
        (_t, name) =>
        async (...a) => {
          calls.push([name, ...a]);
          if (over[name]) throw over[name];
          return name === 'acquisitionRun' ? null : { ok: true };
        },
    }
  );
  const res = {
    status: 0,
    headers: {},
    body: undefined,
    writeHead(s, h) {
      this.status = s;
      this.headers = h;
      return this;
    },
    end(b) {
      this.body = b;
    },
  };
  const req = (async function* () {
    if (body !== undefined) yield Buffer.from(JSON.stringify(body));
  })();
  req.method = method;
  req.url = url;
  req.headers = { authorization: `Bearer ${'s'.repeat(40)}` };
  return {
    calls,
    res,
    run: (secret = 's'.repeat(40)) =>
      handleAcquisitionRoute(req, res, checks, secret),
  };
}
const act = (extra = {}) => ({
  actorId: A,
  decisionId: D,
  reason: 'because',
  expectedVersionToken: TOKEN,
  confirm: 'CANCEL',
  ...extra,
});

test('routes: auth, strict bodies, confirmations and no-store', async () => {
  let h = harness('GET', '/internal/acquisition/budget');
  assert.equal(await h.run('x'.repeat(40)), true);
  assert.equal(h.res.status, 401);
  assert.equal(h.res.headers['cache-control'], 'no-store');

  h = harness('GET', '/internal/other');
  assert.equal(await h.run(), false);

  h = harness('GET', '/internal/acquisition/runs?bogus=1');
  await h.run();
  assert.equal(h.res.status, 400);
  h = harness('GET', '/internal/acquisition/runs?status=partial&limit=5');
  await h.run();
  assert.equal(h.res.status, 200);
  assert.deepEqual(h.calls[0], [
    'acquisitionRuns',
    { status: 'partial', limit: 5 },
  ]);
  h = harness('GET', `/internal/acquisition/runs/${ID}`);
  await h.run();
  assert.equal(h.res.status, 404);
  h = harness('GET', '/internal/acquisition/runs/latest');
  await h.run();
  assert.equal(h.calls[0][0], 'acquisitionLatest');

  // Cancel needs its own confirmation word; retry needs a unit key and only retry may carry one.
  h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/cancel`,
    act({ confirm: 'RESUME' })
  );
  await h.run();
  assert.equal(h.res.status, 400);
  h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/cancel`,
    act({ unitKey: 'a' })
  );
  await h.run();
  assert.equal(h.res.status, 400);
  h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/retry`,
    act({ confirm: 'RETRY' })
  );
  await h.run();
  assert.equal(h.res.status, 400);
  h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/retry`,
    act({ confirm: 'RETRY', unitKey: '../x' })
  );
  await h.run();
  assert.equal(h.res.status, 400);
  h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/cancel`,
    act({ extra: 1 })
  );
  await h.run();
  assert.equal(h.res.status, 400);
  assert.equal(h.calls.length, 0);

  h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/resume`,
    act({ confirm: 'RESUME' })
  );
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.calls[0][0], 'acquisitionAction');
  assert.equal(h.calls[0][1], 'resume');
  assert.equal(h.calls[0][3].confirm, undefined);

  h = harness('POST', '/internal/acquisition/history/import', {
    actorId: A,
    decisionId: D,
    reason: 'seed',
  });
  await h.run();
  assert.equal(h.res.status, 200);
  h = harness('POST', '/internal/acquisition/history/import', {
    actorId: A,
    reason: 'seed',
  });
  await h.run();
  assert.equal(h.res.status, 400);
});

test('routes: conflicts carry only a code and a blocked reason', async () => {
  let h = harness(
    'POST',
    `/internal/acquisition/runs/${ID}/resume`,
    act({ confirm: 'RESUME' }),
    {
      acquisitionAction: new ReviewConflictError(
        'run_blocked',
        'run_blocked',
        'budget_exhausted'
      ),
    }
  );
  await h.run();
  assert.equal(h.res.status, 409);
  assert.deepEqual(JSON.parse(h.res.body), {
    code: 'run_blocked',
    reason: 'budget_exhausted',
  });
  h = harness('POST', `/internal/acquisition/runs/${ID}/cancel`, act(), {
    acquisitionAction: new ReviewConflictError('stale_decision'),
  });
  await h.run();
  assert.deepEqual(JSON.parse(h.res.body), { code: 'stale_decision' });
  h = harness('POST', `/internal/acquisition/runs/${ID}/cancel`, act(), {
    acquisitionAction: Error('connect ECONNREFUSED 10.0.0.1'),
  });
  await h.run();
  assert.equal(h.res.status, 503);
  assert.equal(h.res.body, undefined);
  h = harness('POST', `/internal/acquisition/runs/${ID}/cancel`, act(), {
    acquisitionAction: Error('Run not found'),
  });
  await h.run();
  assert.equal(h.res.status, 404);
});

test('routes: run-this-town-now needs the secret, a confirmation and ids', async () => {
  const path = `/internal/acquisition/towns/${ID}/run`;
  const body = {
    actorId: A,
    decisionId: D,
    reason: 'owner asked',
    confirm: 'RUN',
  };
  let h = harness('POST', path, body);
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.calls[0][0], 'acquisitionTownRun');
  assert.equal(h.calls[0][1], ID);
  assert.equal(h.calls[0][2].confirm, undefined);
  assert.equal(h.calls[0][2].reason, 'owner asked');

  for (const bad of [
    { ...body, confirm: 'no' },
    { ...body, decisionId: undefined },
    { ...body, reason: '' },
    { ...body, extra: 1 },
  ]) {
    h = harness('POST', path, bad);
    await h.run();
    assert.equal(h.res.status, 400);
    assert.equal(h.calls.length, 0);
  }
  h = harness('POST', path, body);
  await h.run('x'.repeat(40));
  assert.notEqual(h.res.status, 200);
  assert.equal(h.calls.length, 0);
  h = harness('GET', path, undefined);
  await h.run();
  assert.equal(h.res.status, 405);
  h = harness('POST', path, body, {
    acquisitionTownRun: Error('Town not found'),
  });
  await h.run();
  assert.equal(h.res.status, 404);
});
