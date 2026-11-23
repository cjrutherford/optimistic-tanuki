const test = require('node:test'),
  assert = require('node:assert/strict');
const { handleDirectoryAdminRoute } = require('../src/directory-admin-routes');
const { handleTaxonomyRoute } = require('../src/taxonomy-routes');
const { deactivateTaxonomyMapping } = require('../src/taxonomy-mapping');
const { ReviewConflictError } = require('../src/review-version');
const { DirectoryJobs, JOB_RETENTION } = require('../src/directory-jobs');
const {
  encodeCursor,
  decodeCursor,
  revalidateOne,
  stageRevalidator,
  RevalidationUnavailableError,
} = require('../src/reviewed-binding-admin');

const SECRET = 's'.repeat(40);
const A = '11111111-1111-4111-8111-111111111111';
const TOWN = '22222222-2222-4222-8222-222222222222';
const JOB = '33333333-3333-4333-8333-333333333333';

function harness(handler, method, url, body, secret = SECRET, checks) {
  const calls = [];
  const proxy =
    checks ??
    new Proxy(
      {},
      {
        get:
          (_t, name) =>
          async (...a) => (calls.push([name, ...a]), { ok: true }),
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
      this.body = b ? JSON.parse(b) : undefined;
    },
  };
  const req = (async function* () {
    if (body !== undefined) yield Buffer.from(JSON.stringify(body));
  })();
  req.method = method;
  req.url = url;
  req.headers = { authorization: `Bearer ${secret}` };
  return { calls, res, run: () => handler(req, res, proxy, 's'.repeat(40)) };
}
const admin = (...a) => harness(handleDirectoryAdminRoute, ...a);
const tax = (...a) => harness(handleTaxonomyRoute, ...a);

test('admin routes: auth, no-store, and unrelated paths are not claimed', async () => {
  let h = admin(
    'GET',
    '/internal/reviewed-bindings',
    undefined,
    'x'.repeat(40)
  );
  assert.equal(await h.run(), true);
  assert.equal(h.res.status, 401);
  assert.equal(h.res.headers['cache-control'], 'no-store');
  h = admin('GET', '/internal/other');
  assert.equal(await h.run(), false);
  h = admin('GET', '/internal/reviewed-bindings?state=suspended');
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.res.headers['cache-control'], 'no-store');
});

test('admin routes: suspended binding list validates its query and forwards it', async () => {
  let h = admin(
    'GET',
    `/internal/reviewed-bindings?state=suspended&townId=${TOWN}&limit=20&cursor=abc`
  );
  await h.run();
  assert.equal(h.res.status, 200);
  assert.deepEqual(h.calls[0], [
    'suspendedBindings',
    { townId: TOWN, limit: 20, cursor: 'abc' },
  ]);
  for (const q of [
    '?state=active',
    '?townId=nope',
    '?limit=0',
    '?limit=101',
    '?limit=1.5',
    '?extra=1',
  ]) {
    h = admin('GET', `/internal/reviewed-bindings${q}`);
    await h.run();
    assert.equal(h.res.status, 400, q);
    assert.equal(h.calls.length, 0);
  }
});

test('admin routes: revalidate and boundary lock/unlock take strict bodies', async () => {
  let h = admin('POST', `/internal/reviewed-bindings/${JOB}/revalidate`, {
    actorId: A,
  });
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.calls[0][0], 'bindingRevalidate');
  h = admin('POST', `/internal/reviewed-bindings/${JOB}/revalidate`, {
    actorId: A,
    extra: 1,
  });
  await h.run();
  assert.equal(h.res.status, 400);

  for (const sub of ['boundary-lock', 'boundary-unlock']) {
    h = admin('POST', `/internal/towns/${TOWN}/${sub}`, {
      actorId: A,
      reason: ' because ',
    });
    await h.run();
    assert.equal(h.res.status, 200, sub);
    assert.equal(
      h.calls[0][0],
      sub === 'boundary-lock' ? 'boundaryLock' : 'boundaryUnlock'
    );
    for (const bad of [
      { actorId: A },
      { actorId: A, reason: ' ' },
      { actorId: 'nope', reason: 'r' },
      { actorId: A, reason: 'r', extra: 1 },
    ]) {
      h = admin('POST', `/internal/towns/${TOWN}/${sub}`, bad);
      await h.run();
      assert.equal(h.res.status, 400, JSON.stringify(bad));
      assert.equal(h.calls.length, 0);
    }
  }
  h = admin('GET', `/internal/towns/${TOWN}/boundary-lock`);
  await h.run();
  assert.equal(h.calls[0][0], 'boundaryLockRead');
  h = admin('GET', `/internal/towns/${TOWN}/boundary-unlock`);
  await h.run();
  assert.equal(h.res.status, 405);
});

test('admin routes: job start defaults to a dry run, a real run needs a reason, status 404s when unknown', async () => {
  let h = admin('POST', '/internal/jobs/renormalize', { actorId: A });
  await h.run();
  assert.equal(h.res.status, 202);
  h = admin('POST', '/internal/jobs/renormalize', {
    actorId: A,
    townId: TOWN,
    dryRun: false,
    reason: 'go',
  });
  await h.run();
  assert.equal(h.res.status, 202);
  for (const bad of [
    { actorId: A, dryRun: false },
    { actorId: A, dryRun: 'no' },
    { actorId: A, townId: 'x' },
    { actorId: A, extra: 1 },
  ]) {
    h = admin('POST', '/internal/jobs/renormalize', bad);
    await h.run();
    assert.equal(h.res.status, 400, JSON.stringify(bad));
    assert.equal(h.calls.length, 0);
  }
  const none = { jobGet: async () => null };
  h = harness(
    handleDirectoryAdminRoute,
    'GET',
    `/internal/jobs/${JOB}`,
    undefined,
    SECRET,
    none
  );
  await h.run();
  assert.equal(h.res.status, 404);
});

test('admin routes: conflicts, unavailable revalidation and missing rows map to statuses', async () => {
  const fail = (error) =>
    harness(
      handleDirectoryAdminRoute,
      'POST',
      `/internal/towns/${TOWN}/boundary-lock`,
      { actorId: A, reason: 'r' },
      SECRET,
      {
        boundaryLock: async () => {
          throw error;
        },
      }
    );
  let h = fail(
    new ReviewConflictError('invalid_state', undefined, 'already_locked')
  );
  await h.run();
  assert.equal(h.res.status, 409);
  assert.deepEqual(h.res.body, {
    code: 'invalid_state',
    detail: 'already_locked',
  });
  h = fail(Error('Town not found'));
  await h.run();
  assert.equal(h.res.status, 404);
  h = fail(Error('Revalidation unavailable'));
  await h.run();
  assert.equal(h.res.status, 503);
  h = fail(Error('A job is already running'));
  await h.run();
  assert.deepEqual(h.res.body, {
    code: 'invalid_state',
    detail: 'job_running',
  });
});

test('taxonomy routes: deactivate needs a reason; activate reason is optional; GET on a version is 405', async () => {
  let h = tax('POST', '/internal/taxonomy/mappings/v1.2/deactivate', {
    actorId: A,
    reason: 'rolled back',
  });
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.calls[0][0], 'taxonomyDeactivate');
  assert.equal(h.calls[0][1], 'v1.2');
  for (const bad of [
    { actorId: A },
    { actorId: A, reason: ' ' },
    { actorId: A, reason: 'r', x: 1 },
  ]) {
    h = tax('POST', '/internal/taxonomy/mappings/v1.2/deactivate', bad);
    await h.run();
    assert.equal(h.res.status, 400);
    assert.equal(h.calls.length, 0);
  }
  h = tax('POST', '/internal/taxonomy/mappings/v1.2/activate', { actorId: A });
  await h.run();
  assert.equal(h.res.status, 200);
  assert.equal(h.calls[0][0], 'taxonomyActivate');
  h = tax('GET', '/internal/taxonomy/mappings/v1.2/activate');
  await h.run();
  assert.equal(h.res.status, 405);
  h = tax('POST', '/internal/taxonomy/mappings/v1.2/deactivate', {
    actorId: A,
    reason: 'r',
  });
  h = harness(
    handleTaxonomyRoute,
    'POST',
    '/internal/taxonomy/mappings/v1.2/deactivate',
    { actorId: A, reason: 'r' },
    SECRET,
    {
      taxonomyDeactivate: async () => {
        throw new ReviewConflictError(
          'invalid_state',
          undefined,
          'unmapped_policy_excludes'
        );
      },
    }
  );
  await h.run();
  assert.equal(h.res.status, 409);
  assert.equal(h.res.body.detail, 'unmapped_policy_excludes');
});

function scriptedDb(row) {
  const sql = [];
  const q = {
    sql,
    async query(text, params) {
      sql.push([text, params]);
      if (/SELECT id,"unmappedPolicy",active/.test(text))
        return row ? [row] : [];
      if (/directory_taxonomy_mapping_version v|WHERE v.id/.test(text))
        return [{ id: 'v1', active: false }];
      return [];
    },
  };
  q.transaction = (work) => work(q);
  return q;
}

test('deactivate: refused when the active version excludes unmapped listings; allowed under keep_legacy and audited', async () => {
  const input = { version: 'v1', actorId: A, reason: 'rolled back' };
  const refused = scriptedDb({
    id: 'v1',
    unmappedPolicy: 'exclude',
    active: true,
  });
  await assert.rejects(
    () => deactivateTaxonomyMapping(refused, input),
    (e) =>
      e instanceof ReviewConflictError &&
      e.detail === 'unmapped_policy_excludes'
  );
  assert.equal(
    refused.sql.some(([s]) => /INSERT INTO directory_operator_event/.test(s)),
    false
  );
  assert.equal(
    refused.sql.some(([s]) => /SET active=false/.test(s)),
    false
  );

  const ok = scriptedDb({
    id: 'v1',
    unmappedPolicy: 'keep_legacy',
    active: true,
  });
  await deactivateTaxonomyMapping(ok, input);
  assert.ok(ok.sql.some(([s]) => /SET active=false/.test(s)));
  const audit = ok.sql.find(([s]) =>
    /INSERT INTO directory_operator_event/.test(s)
  );
  assert.equal(audit[1][0], 'taxonomy_mapping');
  assert.equal(audit[1][2], 'deactivate');
  assert.equal(audit[1][4], 'rolled back');

  const replay = scriptedDb({
    id: 'v1',
    unmappedPolicy: 'exclude',
    active: false,
  });
  assert.equal((await deactivateTaxonomyMapping(replay, input)).replayed, true);
  await assert.rejects(
    () => deactivateTaxonomyMapping(scriptedDb(null), input),
    /Mapping not found/
  );
  await assert.rejects(
    () => deactivateTaxonomyMapping(ok, { ...input, reason: ' ' }),
    /Invalid/
  );
});

function jobDb() {
  const events = [];
  return {
    events,
    async query(text, params) {
      if (/INSERT INTO directory_operator_event/.test(text))
        events.push(params);
      return [];
    },
  };
}
const SCAN_A = 'a'.repeat(64);

test('jobs: a dry run walks the scans, reports counts and audits start and finish', async () => {
  const db = jobDb();
  const seen = [];
  const jobs = new DirectoryJobs(db, {
    scans: async (town) => (seen.push(town), ['s1', 's2']),
    run: async (id, o) => (
      seen.push([id, o.dryRun]), { scanned: 10, updated: 3, skipped: 7 }
    ),
  });
  const job = await jobs.startRenormalize({ actorId: A, townId: TOWN });
  assert.equal(job.status, 'running');
  assert.equal(job.dryRun, true);
  await jobs.settled(job.id);
  const done = jobs.get(job.id);
  assert.equal(done.status, 'succeeded');
  assert.deepEqual(done.counts, {
    scansTotal: 2,
    scansDone: 2,
    scanned: 20,
    updated: 6,
    skipped: 14,
  });
  assert.ok(done.finishedAt);
  assert.deepEqual(seen[0], TOWN);
  assert.deepEqual(seen[1], ['s1', true]);
  assert.deepEqual(
    db.events.map((p) => p[2]),
    ['start', 'finish']
  );
  assert.equal(jobs.get('nope'), null);
});

test('jobs: one at a time, a real run needs a reason, failures are recorded without leaking detail', async () => {
  const db = jobDb();
  let release;
  const gate = new Promise((r) => (release = r));
  const jobs = new DirectoryJobs(db, {
    scans: async () => ['s1'],
    run: async () => (await gate, { scanned: 1, updated: 0, skipped: 1 }),
  });
  await assert.rejects(
    () => jobs.startRenormalize({ actorId: A, dryRun: false }),
    /Invalid job/
  );
  const first = await jobs.startRenormalize({
    actorId: A,
    dryRun: false,
    reason: 'cutover',
  });
  await assert.rejects(
    () => jobs.startRenormalize({ actorId: A }),
    /already running/
  );
  release();
  await jobs.settled(first.id);
  assert.equal(jobs.get(first.id).status, 'succeeded');

  const bad = new DirectoryJobs(jobDb(), {
    scans: async () => ['s1'],
    run: async () => {
      throw Error('connection string postgres://secret');
    },
  });
  const failed = await bad.startRenormalize({ actorId: A });
  await bad.settled(failed.id);
  const got = bad.get(failed.id);
  assert.equal(got.status, 'failed');
  assert.doesNotMatch(got.error, /secret/);
});

test('jobs: finished jobs are trimmed to the retention limit', async () => {
  const jobs = new DirectoryJobs(jobDb(), {
    scans: async () => [],
    run: async () => ({ scanned: 0, updated: 0, skipped: 0 }),
  });
  for (let i = 0; i < JOB_RETENTION + 5; i++) {
    const j = await jobs.startRenormalize({ actorId: A });
    await jobs.settled(j.id);
  }
  assert.ok(jobs.list(1000).length <= JOB_RETENTION + 1);
});

test('bindings: cursor round-trips, revalidate refuses without a stage and audits when it runs', async () => {
  assert.deepEqual(
    decodeCursor(encodeCursor('2026-11-01T00:00:00.000Z', JOB)),
    ['2026-11-01T00:00:00.000Z', JOB]
  );
  assert.throws(() => decodeCursor('garbage'), /Invalid/);
  const events = [];
  let ran = false;
  const db = {
    async query(sql, params) {
      if (/INSERT INTO directory_operator_event/.test(sql))
        return events.push(params), [];
      if (/WHERE id=\$1/.test(sql))
        return [{ state: ran ? 'active' : 'suspended', stateCause: null }];
      return [];
    },
  };
  await assert.rejects(
    () => revalidateOne({ db, run: null }, JOB, A),
    RevalidationUnavailableError
  );
  const out = await revalidateOne(
    { db, run: async () => ((ran = true), { outcome: 'confirmed' }) },
    JOB,
    A
  );
  assert.equal(out.state, 'active');
  assert.equal(events[0][2], 'revalidate');
  assert.equal(
    stageRevalidator({}, {}, () => null),
    null
  );
  assert.equal(
    stageRevalidator(
      {},
      {
        DIRECTORY_CONTACT_STAGE_DATABASE_URL: 'x',
        DIRECTORY_CONTACT_STAGE_LABEL: 'l',
        DIRECTORY_REVIEWED_BINDING_HMAC_KEY: 'short',
      },
      () => null
    ),
    null
  );
  assert.equal(
    typeof stageRevalidator(
      {},
      {
        DIRECTORY_CONTACT_STAGE_DATABASE_URL: 'x',
        DIRECTORY_CONTACT_STAGE_LABEL: 'l',
        DIRECTORY_REVIEWED_BINDING_HMAC_KEY: 'k'.repeat(32),
      },
      () => null
    ),
    'function'
  );
});
