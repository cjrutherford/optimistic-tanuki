require('reflect-metadata');
const test = require('node:test'),
  assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { existsSync, mkdtempSync, readdirSync, rmSync } = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { DataSource } = require('typeorm');
const {
  createExportJob,
  getExportJob,
  openExportArtifact,
  revokeExportsForExclusion,
  runExportPass,
} = require('../src/export-job');
const { buildPublicExport } = require('../src/public-export');
const { handlePublicExportRoute } = require('../src/export-routes');
const { decideRightsCase } = require('../src/rights-case');
const { versionToken } = require('../src/review-version');

// Disposable, loopback-only database named s8_scratch_*. The caller drops it.
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
const RELEASE = '2026-10-21.0';
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
const sources = (extra = []) =>
  POINTERS.map((property) => ({
    property,
    dataset: 'meta',
    license: 'CDLA',
  })).concat(extra);
const listingOf = (name, over = {}) => ({
  name,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83.5, 31.25] },
  address: '1 Main St',
  phone: '+15555550100',
  website: 'https://example.org',
  attribution: ['Example'],
  assignmentChangeToken: 'tok-secret-123',
  sources: sources(),
  ...over,
});
const policyOf = (over = {}) => ({
  releaseId: RELEASE,
  operations: { export: true, ...over.operations },
  terms: [
    {
      dataset: 'meta',
      license: 'CDLA',
      attribution: 'Overture Maps Foundation',
      termsUrl: 'https://overturemaps.org/terms',
      notice: 'Contains Overture data',
      permissions: { export: ALL, ...over.permissions },
    },
  ],
});

async function seed(ds, { community, scanId, policyId }) {
  await ds.query(
    'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false)',
    [policyId]
  );
  await ds.query(
    'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
    [scanId, policyId]
  );
  await ds.query(
    'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
    [scanId]
  );
  await ds.query(
    'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
    [scanId]
  );
  await ds.query(
    `INSERT INTO directory_town_scan_target ("communityId","scanId","provenance") VALUES ($1,$2,'recorded')`,
    [community, scanId]
  );
  await ds.query(
    `INSERT INTO directory_overture_source_evidence ("scanId","evidenceVersion",kind,"releaseId","artifactUrl","artifactEtag","inventorySha256","evidenceSha256",recorder)
     VALUES ($1,1,'attached_verified',$2,'https://example.org/a','e',$3,$4,'test')`,
    [scanId, RELEASE, hex(), hex()]
  );
}
const insertRow = (ds, scanId, n, listing, region) =>
  ds.query(
    'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
    [scanId, n, region, JSON.stringify(listing)]
  );
const TRUNCATE = `TRUNCATE directory_export_job, directory_export_download, directory_rights_event, directory_rights_case, directory_listing_suppression, directory_overture_source_evidence, directory_town_scan_target, directory_overture_private_row, directory_overture_private_row_revocation, directory_overture_private_revocation, directory_overture_private_scan_lock, directory_overture_private_membership, directory_overture_private_completion, directory_overture_private_policy CASCADE`;

test(
  'rights revocation: exclude_field and policy changes revoke existing export artifacts, idempotently',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const dir = mkdtempSync(join(tmpdir(), 's8-revoke-'));
    const actor = randomUUID();
    const community = randomUUID();
    const scanId = hex();
    try {
      await ds.query(TRUNCATE);
      await seed(ds, { community, scanId, policyId: hex() });
      await insertRow(ds, scanId, 1, listingOf('One'), community);
      await insertRow(ds, scanId, 2, listingOf('Two'), community);
      let current = policyOf();
      const policyFor = (rel) =>
        rel === RELEASE || rel === 'rel-2'
          ? { ...current, releaseId: rel }
          : undefined;
      const pass = () => runExportPass(ds, { dir, policyFor });
      const job = async (releaseId = RELEASE) =>
        (
          await createExportJob(ds, {
            id: randomUUID(),
            actorId: actor,
            releaseId,
          })
        ).job;
      const [a, b, other] = [await job(), await job(), await job('rel-2')];
      // rel-2 rows are the same scan's rows: the job reads by scan, the policy is keyed by the job's release.
      assert.equal(await pass(), 3);
      for (const j of [a, b, other])
        assert.equal((await getExportJob(ds, j.id)).status, 'complete');
      const sourcesOf = async (id) =>
        (
          await ds.query(
            'SELECT "exportedSources" FROM directory_export_job WHERE id=$1',
            [id]
          )
        )[0].exportedSources;
      assert.deepEqual((await sourcesOf(a.id))[0].fields.sort(), [
        'address',
        'category',
        'location',
        'name',
        'phone',
        'website',
      ]);

      // A different source or release does not match.
      assert.equal(
        await revokeExportsForExclusion(ds, {
          releaseId: RELEASE,
          field: 'phone',
          dataset: 'other-dataset',
          license: 'CDLA',
        }),
        0
      );
      assert.equal(
        await revokeExportsForExclusion(ds, {
          releaseId: RELEASE,
          field: 'alternate',
          dataset: 'meta',
          license: 'CDLA',
        }),
        0
      );

      // An exclude_field decision revokes the artifacts of that release that carry the field.
      const caseId = randomUUID();
      await ds.query(
        `INSERT INTO directory_rights_case (id,scope,"subjectKey",provider,"releaseId",field,dataset,license,"sourcePointer",ambiguous,reasons,"observedRows",status)
         VALUES ($1,'field',$2,'overture',$3,'phone','meta','CDLA','/properties/phones',false,'[]'::jsonb,2,'review')`,
        [caseId, `field|${RELEASE}|phone|meta|CDLA`, RELEASE]
      );
      const decision = {
        decisionId: randomUUID(),
        caseId,
        action: 'exclude_field',
        actorId: actor,
        reason: 'terms do not allow redistribution of phone numbers',
        expectedVersionToken: versionToken([
          'rights-case',
          caseId,
          'review',
          null,
          0,
        ]),
      };
      assert.deepEqual(await decideRightsCase(ds, decision), {
        replayed: false,
        status: 'excluded',
      });
      for (const j of [a, b]) {
        const row = await getExportJob(ds, j.id);
        assert.equal(row.status, 'revoked');
        assert.equal(row.errorCode, 'rights_field_excluded');
        assert.ok(row.revokedAt);
        assert.deepEqual(
          await openExportArtifact(ds, { id: j.id, actorId: actor, dir }),
          { ok: false, code: 'revoked' }
        );
      }
      assert.equal((await getExportJob(ds, other.id)).status, 'complete');
      assert.deepEqual(
        (
          await ds.query(
            `SELECT outcome FROM directory_export_download WHERE "jobId"=$1`,
            [a.id]
          )
        ).map((r) => r.outcome),
        ['revoked']
      );
      // Replay is idempotent, and the sweep deletes the files of revoked jobs.
      assert.equal((await decideRightsCase(ds, decision)).replayed, true);
      assert.equal(
        await revokeExportsForExclusion(ds, {
          releaseId: RELEASE,
          field: 'phone',
          dataset: 'meta',
          license: 'CDLA',
        }),
        0
      );
      await pass();
      assert.equal(existsSync(join(dir, `${a.id}.jsonl`)), false);
      assert.equal(existsSync(join(dir, `${b.id}.jsonl`)), false);
      assert.equal((await getExportJob(ds, a.id)).status, 'revoked');
      // The still-complete rel-2 job is also caught by the sweep? No: the exclusion names RELEASE only.
      assert.equal((await getExportJob(ds, other.id)).status, 'complete');

      // A new export of the same release no longer carries the excluded field and stays complete.
      const fresh = await job();
      await pass();
      assert.equal((await getExportJob(ds, fresh.id)).status, 'complete');
      const text = require('node:fs').readFileSync(
        join(dir, `${fresh.id}.jsonl`),
        'utf8'
      );
      const freshRows = text
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l))
        .filter((l) => l.type === 'row');
      assert.ok(
        freshRows.length === 2 &&
          freshRows.every(
            (l) =>
              !('phone' in l) && !('provenance' in l && 'phone' in l.provenance)
          )
      );
      assert.ok(text.includes('"website"'));
      await pass();
      assert.equal((await getExportJob(ds, fresh.id)).status, 'complete');

      // A source term change that drops a field revokes artifacts that carry it.
      current = policyOf({
        permissions: { export: ALL.filter((f) => f !== 'website') },
      });
      await pass();
      const lost = await getExportJob(ds, other.id);
      assert.equal(lost.status, 'revoked');
      assert.equal(lost.errorCode, 'policy_revoked');
      assert.equal((await getExportJob(ds, fresh.id)).status, 'revoked');
      assert.equal(
        (
          await ds.query(
            `SELECT count(*)::int n FROM directory_export_job WHERE status='revoked'`
          )
        )[0].n,
        4
      );
      assert.deepEqual(readdirSync(dir), []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await ds.destroy();
    }
  }
);

test(
  'public export: only publicExport fields, per town, attribution, caps, immediate withdrawal and revocation',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const community = randomUUID();
    const otherTown = randomUUID();
    const scanId = hex();
    const secret = 's8-local-secret-0123456789012345678901234';
    try {
      await ds.query(TRUNCATE);
      await seed(ds, { community, scanId, policyId: hex() });
      await insertRow(ds, scanId, 1, listingOf('Cafe One'), community);
      await insertRow(
        ds,
        scanId,
        2,
        listingOf('=HYPERLINK("http://evil")', { phone: '+15555550101' }),
        community
      );
      await insertRow(
        ds,
        scanId,
        3,
        listingOf('Adult Shop', { adult: true }),
        community
      );
      await insertRow(ds, scanId, 4, listingOf('Row Revoked'), community);
      await insertRow(ds, scanId, 5, listingOf('Suppressed'), community);
      await insertRow(ds, scanId, 6, listingOf('Elsewhere'), otherTown);
      await insertRow(
        ds,
        scanId,
        7,
        listingOf('Geo Phone', {
          sources: sources([
            {
              property: '/properties/phones',
              dataset: 'meta',
              license: 'CDLA',
              provider: 'Geoapify',
            },
          ]),
        }),
        community
      );
      await insertRow(
        ds,
        scanId,
        8,
        listingOf('Stale Token', { assignmentChangeToken: 'old' }),
        community
      );
      await ds.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,4)',
        [scanId]
      );
      await ds.query(
        `INSERT INTO directory_listing_suppression (id,"communityId","listingId","scanId","sourceFileRowNumber","reasonCode") VALUES ($1,$2,$3,$4,5,'safety')`,
        [randomUUID(), community, randomUUID(), scanId]
      );
      const publicOn = {
        operations: { publicExport: true },
        permissions: { publicExport: ALL },
      };
      let current = policyOf(publicOn);
      const policyFor = (rel) => (rel === RELEASE ? current : undefined);
      const build = (format = 'jsonl', extra = {}, town = community) =>
        buildPublicExport(ds, {
          town,
          format,
          changeToken: 'tok-secret-123',
          policyFor,
          ...extra,
        });
      const parse = (r) =>
        r.body
          .trimEnd()
          .split('\n')
          .map((l) => JSON.parse(l));

      // Default off: an operator export grant alone exposes nothing.
      current = policyOf();
      assert.deepEqual(await build(), { ok: false, code: 'no_public_export' });
      current = policyOf({
        operations: { publicExport: false },
        permissions: { publicExport: ALL },
      });
      assert.deepEqual(await build(), { ok: false, code: 'no_public_export' });
      // Operations opted in but no field granted: nothing leaves.
      current = policyOf({ operations: { publicExport: true } });
      assert.deepEqual(await build(), { ok: false, code: 'no_public_export' });

      current = policyOf(publicOn);
      const result = await build();
      assert.equal(result.ok, true);
      assert.match(result.contentType, /ndjson/);
      const lines = parse(result);
      const names = lines.filter((l) => l.type === 'row').map((l) => l.name);
      assert.deepEqual(names.sort(), [
        '=HYPERLINK("http://evil")',
        'Cafe One',
        'Geo Phone',
      ]);
      assert.equal(lines[0].schema, 'town-square-public-export/v1');
      assert.deepEqual(lines[0].attributions, ['Overture Maps Foundation']);
      assert.deepEqual(lines[0].sources, [
        { dataset: 'meta', license: 'CDLA' },
      ]);
      assert.deepEqual(lines[0].termsUrls, ['https://overturemaps.org/terms']);
      assert.equal(lines.at(-1).rowCount, 3);
      const geo = lines.find((l) => l.name === 'Geo Phone');
      assert.ok(!('phone' in geo), 'Geoapify-derived phone denied');
      assert.ok('website' in geo);
      const text = result.body;
      for (const leak of [
        'tok-secret-123',
        'assignmentChangeToken',
        '"property"',
        scanId,
        'Adult Shop',
        'Row Revoked',
        'Stale Token',
        'Suppressed',
        'Elsewhere',
      ])
        assert.ok(!text.includes(leak), leak);
      assert.deepEqual(await build('jsonl', {}, otherTown), {
        ok: false,
        code: 'no_public_export',
      });

      // Only fields the term grants publicly leave.
      current = policyOf({
        ...publicOn,
        permissions: {
          publicExport: ALL.filter((f) => f !== 'phone' && f !== 'address'),
        },
      });
      const narrow = parse(await build());
      assert.ok(
        narrow
          .filter((l) => l.type === 'row')
          .every((l) => !('phone' in l) && !('address' in l) && 'website' in l)
      );
      assert.ok(!narrow[0].fields.includes('phone'));

      // CSV: provenance comments, neutralised formulas, no ids.
      current = policyOf(publicOn);
      const csv = await build('csv');
      assert.match(csv.contentType, /text\/csv/);
      const csvLines = csv.body.split('\r\n');
      assert.ok(
        csvLines.some((l) => l === '# Attribution: Overture Maps Foundation')
      );
      assert.ok(csvLines.some((l) => l === '# Source: meta, licence CDLA'));
      assert.ok(
        csvLines.some((l) => l === '# Terms: https://overturemaps.org/terms')
      );
      const header = csvLines.find((l) => l.startsWith('name,'));
      assert.equal(
        header,
        'name,category,latitude,longitude,address,phone,website'
      );
      assert.ok(csv.body.includes(`"'=HYPERLINK(""http://evil"")"`));
      assert.ok(!csv.body.includes(scanId));

      // Hard row cap.
      const capped = await build('jsonl', { rowCap: 2 });
      assert.equal(capped.rowCount, 2);
      assert.equal(capped.truncated, true);
      assert.equal(parse(capped)[0].truncated, true);

      // Rights exclusion applies at once.
      const caseId = randomUUID();
      await ds.query(
        `INSERT INTO directory_rights_case (id,scope,"subjectKey",provider,"releaseId",field,dataset,license,"sourcePointer",ambiguous,reasons,"observedRows",status)
         VALUES ($1,'field',$2,'overture',$3,'website','meta','CDLA','/properties/websites',false,'[]'::jsonb,2,'excluded')`,
        [caseId, `field|${RELEASE}|website|meta|CDLA`, RELEASE]
      );
      assert.ok(
        parse(await build())
          .filter((l) => l.type === 'row')
          .every((l) => !('website' in l))
      );
      await ds.query('DELETE FROM directory_rights_case');

      // Withdrawal of the scan applies at once.
      const route = createServer((req, res) =>
        handlePublicExportRoute(
          req,
          res,
          { publicExport: (v) => build(v.format, {}, v.town) },
          secret
        ).then((h) => {
          if (!h) res.writeHead(404).end();
        })
      );
      await new Promise((r) => route.listen(0, '127.0.0.1', r));
      const base = `http://127.0.0.1:${
        route.address().port
      }/internal/public-export`;
      const get = (path, token = secret) =>
        fetch(`${base}/${path}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
      try {
        assert.equal((await get(`${community}?format=csv`, null)).status, 401);
        assert.equal((await get(`${community}?format=xml`)).status, 400);
        assert.equal((await get(`not-a-uuid?format=csv`)).status, 404);
        const ok = await get(`${community}?format=csv`);
        assert.equal(ok.status, 200);
        assert.equal(ok.headers.get('cache-control'), 'no-store');
        assert.match(
          ok.headers.get('content-disposition'),
          /^attachment; filename="town-square-listings-\d{4}-\d{2}-\d{2}\.csv"$/
        );
        assert.equal(ok.headers.get('x-row-count'), '3');
        await ds.query(
          'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)',
          [scanId]
        );
        const gone = await get(`${community}?format=jsonl`);
        assert.equal(gone.status, 404);
        assert.deepEqual(await gone.json(), { code: 'no_public_export' });
      } finally {
        await new Promise((r) => route.close(r));
      }
    } finally {
      await ds.destroy();
    }
  }
);
