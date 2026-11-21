require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const {
  appendFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const {
  createExportJob,
  getExportJob,
  listExportJobs,
  openExportArtifact,
  retryExportJob,
  runExportPass,
} = require('../src/export-job');
const { handleExportRoute } = require('../src/export-routes');
const {
  createWithdrawal,
  runWithdrawalPass,
} = require('../src/withdrawal-request');
const { validateLine } = require('./export-schema-validate');

// Disposable, loopback-only database named s8_scratch_*. Data is committed there; the caller drops the database.
const url = process.env.S8_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1', '::1'].includes(u.hostname) ||
    !/^\/s8_scratch_[a-z0-9_]+$/.test(u.pathname) ||
    process.env.S8_DISPOSABLE !== 'yes'
  )
    throw Error('Disposable s8_scratch_* database required');
}
const hex = () => randomBytes(32).toString('hex');
const ALL = [
  'name',
  'basic_category',
  'primary',
  'hierarchy',
  'geometry',
  'address',
  'phone',
  'website',
];
const POINTERS = [
  '/properties/names/primary',
  '/basic_category',
  '/taxonomy/primary',
  '/taxonomy/hierarchy',
  '/geometry',
  '/properties/addresses',
  '/properties/phones',
  '/properties/websites',
];
const sources = (omit = [], extra = []) =>
  POINTERS.filter((p) => !omit.includes(p))
    .map((property) => ({ property, dataset: 'meta', license: 'CDLA' }))
    .concat(extra);
const listingOf = (name, over = {}) => ({
  name,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83, 31] },
  address: { line1: `${name} street` },
  phone: '555-0100',
  website: 'https://example.org',
  attribution: ['Example'],
  notices: [],
  termsUrls: [],
  assignmentChangeToken: 'change-token-must-not-leak',
  sources: sources(),
  ...over,
});
const policy = (releaseId, exportOn = true, perms = ALL) => ({
  releaseId,
  operations: { export: exportOn },
  terms: [
    {
      dataset: 'meta',
      license: 'CDLA',
      attribution: 'Overture Maps Foundation',
      termsUrl: 'https://overturemaps.org/terms',
      notice: 'Contains Overture data',
      permissions: { export: perms },
    },
  ],
});
const POLICIES = {
  'rel-1': policy('rel-1'),
  'rel-off': policy('rel-off', false),
  'rel-nothing': policy('rel-nothing', true, []),
};
const policyFor = (releaseId) => POLICIES[releaseId];
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

test(
  'operator export: queue to artifact, idempotency, failure and retry, retention, withdrawal, integrity and audit',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const dir = mkdtempSync(join(tmpdir(), 's8-exports-'));
    const secret = 's8-local-secret-0123456789012345678901234';
    const actor = randomUUID();
    const scanA = hex(),
      scanB = hex(),
      policyA = hex(),
      policyB = hex(),
      community = randomUUID();
    const base = { dir, pageSize: 2, policyFor };
    const pass = (extra = {}) => runExportPass(ds, { ...base, ...extra });
    const files = () => readdirSync(dir).sort();
    const outcomes = async (jobId) =>
      (
        await ds.query(
          'SELECT outcome FROM directory_export_download WHERE "jobId"=$1 ORDER BY "createdAt"',
          [jobId]
        )
      ).map((r) => r.outcome);
    const newJob = async (over = {}) =>
      (
        await createExportJob(ds, {
          id: randomUUID(),
          actorId: actor,
          releaseId: 'rel-1',
          ...over,
        })
      ).job;
    const checks = {
      exportCreate: async (v) => (await createExportJob(ds, v)).job,
      exportList: (o) => listExportJobs(ds, o),
      exportGet: (id) => getExportJob(ds, id),
      exportRetry: (id, v) => retryExportJob(ds, { id, actorId: v.actorId }),
      exportArtifact: (v) => openExportArtifact(ds, { ...v, dir }),
    };
    const server = createServer((req, res) =>
      handleExportRoute(req, res, checks, secret).then((h) => {
        if (!h) res.writeHead(404).end();
      })
    );
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const call = async (method, path, body, token = secret) => {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      let json;
      try {
        json = JSON.parse(buf.toString('utf8'));
      } catch {
        json = undefined;
      }
      return { status: res.status, headers: res.headers, buf, json };
    };
    try {
      await ds.query(
        `TRUNCATE directory_export_job, directory_export_download, directory_withdrawal_request, directory_rights_event, directory_rights_case, directory_reviewed_spatial, directory_reviewed_binding, directory_address_review_candidate, directory_town_scan_target, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_revocation, directory_overture_private_scan_lock, directory_overture_private_membership, directory_overture_private_completion, directory_overture_private_policy CASCADE`
      );
      for (const [p, s] of [
        [policyA, scanA],
        [policyB, scanB],
      ]) {
        await ds.query(
          'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
          [p]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
          [s, p]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
          [s]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
          [s]
        );
      }
      await ds.query(
        `INSERT INTO directory_town_scan_target ("communityId","scanId","provenance") VALUES ($1,$2,'recorded')`,
        [community, scanB]
      );
      const insert = (scan, n, listing) =>
        ds.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber",listing) VALUES ($1,$2,$3)',
          [scan, n, JSON.stringify(listing)]
        );
      // Scan A: 2 exportable, 1 adult, 1 without geometry rights, 1 revoked row (silently absent).
      await insert(scanA, 1, listingOf('A One'));
      await insert(scanA, 2, listingOf('A Two'));
      await insert(scanA, 3, listingOf('A Adult', { adult: true }));
      await insert(
        scanA,
        4,
        listingOf('A No Geometry', { sources: sources(['/geometry']) })
      );
      await insert(scanA, 5, listingOf('A Revoked'));
      await ds.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,5)',
        [scanA]
      );
      // Scan B: a merged phone lineage that includes a non-exportable provider.
      await insert(scanB, 1, listingOf('B One'));
      await insert(
        scanB,
        2,
        listingOf('B Two', {
          sources: sources(
            [],
            [
              {
                property: '/properties/phones',
                dataset: 'meta',
                license: 'CDLA',
                provider: 'Geoapify',
              },
            ]
          ),
        })
      );

      // --- queue to artifact, idempotency, route validation -------------------------------------------------
      const id = randomUUID();
      const request = { id, actorId: actor, releaseId: 'rel-1' };
      assert.equal(
        (await call('POST', '/internal/exports', request, null)).status,
        401
      );
      assert.equal(
        (await call('POST', '/internal/exports', { ...request, extra: 1 }))
          .status,
        400
      );
      assert.equal(
        (
          await call('POST', '/internal/exports', {
            ...request,
            releaseId: '../x',
          })
        ).status,
        400
      );
      const created = await call('POST', '/internal/exports', request);
      assert.equal(created.status, 200);
      assert.equal(created.json.status, 'queued');
      assert.equal(created.headers.get('cache-control'), 'no-store');
      const replay = await call('POST', '/internal/exports', request);
      assert.equal(replay.status, 200);
      assert.equal(replay.json.createdAt, created.json.createdAt);
      const mismatch = await call('POST', '/internal/exports', {
        ...request,
        releaseId: 'rel-off',
      });
      assert.equal(mismatch.status, 409);
      assert.equal(mismatch.json.code, 'idempotency_mismatch');
      assert.equal(
        (
          await ds.query('SELECT count(*)::int AS n FROM directory_export_job')
        )[0].n,
        1
      );

      // Download before completion.
      const early = await call(
        'GET',
        `/internal/exports/${id}/artifact?actorId=${actor}`
      );
      assert.equal(early.status, 409);
      assert.equal(early.json.code, 'not_ready');
      assert.equal(
        (await call('GET', `/internal/exports/${id}/artifact`)).status,
        400
      );
      assert.equal(
        (
          await call(
            'GET',
            `/internal/exports/${randomUUID()}/artifact?actorId=${actor}`
          )
        ).status,
        404
      );

      assert.equal(await pass(), 1);
      const done = (await call('GET', `/internal/exports/${id}`)).json;
      assert.equal(done.status, 'complete');
      assert.equal(done.rowCount, 4);
      assert.equal(done.excludedRows, 2);
      assert.equal(done.scanCount, 2);
      assert.ok(done.expiresAt && done.completedAt);
      assert.ok(
        !JSON.stringify(done).includes(dir) &&
          !('artifactName' in done) &&
          !('leaseToken' in done)
      );
      assert.deepEqual(files(), [`${id}.jsonl`]);
      const file = readFileSync(join(dir, `${id}.jsonl`));
      assert.equal(done.sha256, sha(file));
      assert.equal(done.byteCount, file.length);
      // Optional: keep the synthetic artifact as the sanitized human-review sample.
      if (process.env.S8_SAMPLE_OUT)
        require('node:fs').writeFileSync(process.env.S8_SAMPLE_OUT, file);
      const lines = file
        .toString('utf8')
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l));
      for (const line of lines)
        assert.deepEqual(validateLine(line), [], JSON.stringify(line));
      assert.equal(lines.length, 6);
      assert.equal(lines[0].type, 'header');
      assert.deepEqual(lines[0].attributions, ['Overture Maps Foundation']);
      assert.deepEqual(lines[0].notices, ['Contains Overture data']);
      assert.deepEqual(lines.at(-1), {
        type: 'trailer',
        rowCount: 4,
        excludedRows: 2,
      });
      const rows = lines.slice(1, -1);
      assert.deepEqual(rows.map((r) => r.name).sort(), [
        'A One',
        'A Two',
        'B One',
        'B Two',
      ]);
      assert.equal(new Set(rows.map((r) => r.key)).size, 4);
      const bTwo = rows.find((r) => r.name === 'B Two');
      assert.ok(
        !('phone' in bTwo) && !('phone' in bTwo.provenance),
        'Geoapify lineage denies the merged phone field'
      );
      assert.ok('website' in bTwo);
      assert.deepEqual(rows[0].provenance.name.datasets, [
        { dataset: 'meta', license: 'CDLA' },
      ]);
      const text = file.toString('utf8');
      assert.ok(
        !text.includes('change-token-must-not-leak') &&
          !text.includes('assignmentChangeToken') &&
          !text.includes('"sources"')
      );
      assert.ok(
        !text.includes('A Adult') &&
          !text.includes('A No Geometry') &&
          !text.includes('A Revoked')
      );

      // --- streaming download through the route -------------------------------------------------------------
      const dl = await call(
        'GET',
        `/internal/exports/${id}/artifact?actorId=${actor}`
      );
      assert.equal(dl.status, 200);
      assert.equal(dl.headers.get('content-type'), 'application/x-ndjson');
      assert.equal(dl.headers.get('x-content-sha256'), done.sha256);
      assert.equal(
        dl.headers.get('content-disposition'),
        `attachment; filename="directory-export-${id}.jsonl"`
      );
      assert.equal(sha(dl.buf), done.sha256);
      assert.deepEqual(await outcomes(id), ['not_ready', 'served']);
      const listed = (
        await call('GET', '/internal/exports?status=complete&limit=10')
      ).json;
      assert.equal(listed.total, 1);
      assert.equal(listed.items[0].id, id);
      assert.equal(
        (await call('GET', '/internal/exports?bogus=1')).status,
        400
      );
      assert.equal(
        (await call('GET', '/internal/exports?status=nope')).status,
        400
      );

      // --- failure injection, retry, then success ----------------------------------------------------------
      const flaky = await newJob();
      const blocker = join(dir, 'not-a-directory');
      writeFileSync(blocker, 'x');
      for (let i = 0; i < 3; i++) assert.equal(await pass({ dir: blocker }), 1);
      const failed = await getExportJob(ds, flaky.id);
      assert.equal(failed.status, 'failed');
      assert.equal(failed.errorCode, 'io_error');
      assert.equal(failed.attempts, 3);
      assert.ok(!JSON.stringify(failed).includes(dir));
      assert.equal(await pass(), 0);
      assert.equal(
        (
          await call('POST', `/internal/exports/${id}/retry`, {
            actorId: actor,
          })
        ).json.code,
        'invalid_state'
      );
      assert.equal(
        (
          await call('POST', `/internal/exports/${randomUUID()}/retry`, {
            actorId: actor,
          })
        ).status,
        404
      );
      const retried = (
        await call('POST', `/internal/exports/${flaky.id}/retry`, {
          actorId: actor,
        })
      ).json;
      assert.equal(retried.status, 'queued');
      assert.equal(retried.attempts, 0);
      assert.equal(await pass(), 1);
      assert.equal((await getExportJob(ds, flaky.id)).status, 'complete');
      rmSync(blocker);

      // --- not granted, and nothing eligible: terminal failures with no file ------------------------------
      const before = files();
      const off = await newJob({ releaseId: 'rel-off' });
      const none = await newJob({ releaseId: 'no-policy-at-all' });
      const empty = await newJob({ releaseId: 'rel-nothing' });
      assert.equal(await pass(), 3);
      for (const [job, code] of [
        [off, 'export_not_granted'],
        [none, 'export_not_granted'],
        [empty, 'no_eligible_rows'],
      ]) {
        const got = await getExportJob(ds, job.id);
        assert.equal(got.status, 'failed');
        assert.equal(got.errorCode, code);
        assert.equal(got.attempts, 1);
      }
      assert.deepEqual(files(), before);

      // --- scoped to one town: only that town's scan -------------------------------------------------------
      const town = await newJob({ communityId: community });
      assert.equal(await pass(), 1);
      const townDone = await getExportJob(ds, town.id);
      assert.equal(townDone.rowCount, 2);
      assert.deepEqual(townDone.scope, { communityId: community });

      // --- tampered file ------------------------------------------------------------------------------------
      const tampered = await newJob();
      assert.equal(await pass(), 1);
      appendFileSync(join(dir, `${tampered.id}.jsonl`), ' ');
      const bad = await call(
        'GET',
        `/internal/exports/${tampered.id}/artifact?actorId=${actor}`
      );
      assert.equal(bad.status, 503);
      assert.equal(bad.json.code, 'integrity_failed');
      assert.deepEqual(await outcomes(tampered.id), ['integrity_failed']);

      // --- withdrawal of scan A withdraws jobs holding A, not the town-B-only job -------------------------
      const wid = randomUUID();
      await createWithdrawal(ds, {
        id: wid,
        kind: 'scan',
        target: scanA,
        reason: 'rights holder request',
        actorId: actor,
        confirm: 'WITHDRAW',
      });
      await runWithdrawalPass(ds, { exportDir: dir });
      assert.equal(
        (
          await ds.query(
            'SELECT status FROM directory_withdrawal_request WHERE id=$1',
            [wid]
          )
        )[0].status,
        'complete'
      );
      for (const jobId of [id, flaky.id, tampered.id]) {
        const got = await getExportJob(ds, jobId);
        assert.equal(got.status, 'withdrawn', jobId);
        assert.ok(got.completedAt);
        assert.ok(!existsSync(join(dir, `${jobId}.jsonl`)));
        const res = await call(
          'GET',
          `/internal/exports/${jobId}/artifact?actorId=${actor}`
        );
        assert.equal(res.status, 410);
        assert.equal(res.json.code, 'withdrawn');
      }
      assert.equal((await getExportJob(ds, town.id)).status, 'complete');
      assert.ok(existsSync(join(dir, `${town.id}.jsonl`)));
      assert.deepEqual(await outcomes(id), [
        'not_ready',
        'served',
        'withdrawn',
      ]);

      // New exports no longer see the withdrawn scan.
      const afterWithdrawal = await newJob();
      assert.equal(await pass(), 1);
      assert.equal((await getExportJob(ds, afterWithdrawal.id)).rowCount, 2);

      // --- retention: the sweep expires the artifact and deletes the file ----------------------------------
      const later = () => new Date(Date.now() + 25 * 3_600_000);
      await pass({ now: later });
      const expired = await getExportJob(ds, town.id);
      assert.equal(expired.status, 'expired');
      assert.ok(!existsSync(join(dir, `${town.id}.jsonl`)));
      const gone = await call(
        'GET',
        `/internal/exports/${town.id}/artifact?actorId=${actor}`
      );
      assert.equal(gone.status, 410);
      assert.equal(gone.json.code, 'expired');
      assert.deepEqual(await outcomes(town.id), ['expired']);
      assert.equal(
        (await getExportJob(ds, afterWithdrawal.id)).status,
        'expired'
      );
      assert.deepEqual(files(), []);
    } finally {
      await new Promise((r) => server.close(r));
      rmSync(dir, { recursive: true, force: true });
      await ds.destroy();
    }
  }
);
