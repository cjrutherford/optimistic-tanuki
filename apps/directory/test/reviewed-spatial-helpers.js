// Shared fixtures for the reviewed-spatial reconcile, bounds and concurrency tests. One database; rows are
// written in bulk SQL so thousands of bindings seed in milliseconds. Production writers are exercised by
// reviewed-spatial-lifecycle.postgres.test.js; here the projection rows are written the way projectBinding
// writes them, and the reconcile command is what proves they agree.
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');

const DAY = 86_400_000;
const identity = {
  sourceEpoch: '00000000-0000-4000-8000-000000000001',
  recoveryEpoch: '00000000-0000-4000-8000-000000000002',
  owner: '00000000-0000-4000-8000-000000000003',
  activationId: '00000000-0000-4000-8000-000000000004',
  socialGeneration: '1',
  directoryGeneration: '2',
};
const secret = 'spatial-postgres-fixture-secret-32-bytes';
const token = '99999999-9999-4999-8999-999999999999';
const policy = (c) => c.repeat(64);

/** Accepts only dedicated loopback databases. */
function databaseUrl(variable, pattern) {
  const url = process.env[variable];
  if (!url) return null;
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !pattern.test(parsed.pathname)
  ) {
    throw Error(`${variable} must name a dedicated loopback test database`);
  }
  return url;
}

const TABLES = [
  'directory_reviewed_spatial',
  'directory_reviewed_spatial_state',
  'directory_reviewed_binding_event',
  'directory_reviewed_binding',
  'directory_address_review_decision',
  'directory_address_review_candidate',
  'directory_overture_private_row_revocation',
  'directory_overture_private_revocation',
  'directory_overture_private_row',
  'directory_overture_private_membership',
  'directory_overture_private_completion',
  'directory_overture_private_policy',
  'directory_overture_private_scan_lock',
];

async function connect(url, max = 10) {
  const db = new DataSource({ type: 'postgres', url, extra: { max } });
  await db.initialize();
  return db;
}

/** Empties the tables, then creates the recovery authority and eligible towns the runtime needs. */
async function reset(db, towns) {
  await db.query(`TRUNCATE ${TABLES.join(',')}`);
  const request = {
    ...identity,
    sweep: { generation: '1' },
    lastCompletedSweep: {
      generation: '1',
      completedAt: new Date().toISOString(),
    },
  };
  await db.query(
    `INSERT INTO directory_installation (id,"recoveryEpoch") VALUES ('recovery-authority',$1) ON CONFLICT (id) DO UPDATE SET "recoveryEpoch"=EXCLUDED."recoveryEpoch"`,
    [identity.recoveryEpoch]
  );
  await db.query(
    `INSERT INTO directory_census_progress (id,phase,cursor,protocol,"registerRequest","sourceEpoch","recoveryEpoch",owner,"activationId","socialGeneration","directoryGeneration")
     VALUES ('recovery','reg-running',NULL,'register-pending-v1',$1::jsonb,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET phase=EXCLUDED.phase,cursor=NULL,protocol=EXCLUDED.protocol,"registerRequest"=EXCLUDED."registerRequest","sourceEpoch"=EXCLUDED."sourceEpoch","recoveryEpoch"=EXCLUDED."recoveryEpoch",owner=EXCLUDED.owner,"activationId"=EXCLUDED."activationId","socialGeneration"=EXCLUDED."socialGeneration","directoryGeneration"=EXCLUDED."directoryGeneration"`,
    [
      JSON.stringify(request),
      identity.sourceEpoch,
      identity.recoveryEpoch,
      identity.owner,
      identity.activationId,
      identity.socialGeneration,
      identity.directoryGeneration,
    ]
  );
  for (const town of towns) {
    await db.query(
      `INSERT INTO directory_town ("communityId",name,eligible) VALUES ($1,'Fixture Town',true) ON CONFLICT ("communityId") DO UPDATE SET eligible=true`,
      [town]
    );
  }
}

/** A scan with a live policy and a completion; the unit that rows hang off. */
async function scan(db, scanId, policyId) {
  await db.query(
    'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false) ON CONFLICT ("policyId") DO UPDATE SET revoked=false',
    [policyId]
  );
  await db.query(
    'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
    [scanId]
  );
  await db.query(
    'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
    [scanId, policyId]
  );
  await db.query(
    'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1) ON CONFLICT DO NOTHING',
    [scanId]
  );
}

function checks(pendingChecks, db, town, changeToken = token) {
  const snapshot = {
    id: town,
    name: 'Fixture Town',
    slug: null,
    adminArea: 'GA',
    appScope: 'local-hub',
    isPrivate: false,
    localityType: 'town',
  };
  const source = {
    scan: async () => [],
    current: async () => ({ status: 'current', changeToken, snapshot }),
  };
  return pendingChecks(db, source, identity, secret);
}

/**
 * Bulk-seeds `count` rows numbered from `from` in one scan and town: live row, candidate, decision, binding
 * and, for active bindings, the projection row. Coordinates step across `cols` columns so a box can select a part.
 * Options choose the binding state and lease, whether a reviewed address exists, adult, token, category.
 */
async function bulk(db, o) {
  const {
    scan: scanId,
    town,
    from,
    count,
    lng = -83,
    lat = 31,
    step = 0.0001,
    cols = 100,
    state = 'active',
    until = new Date(Date.now() + DAY),
    address = true,
    adult = null,
    assignment = token,
    category = 'restaurant',
    project = true,
    tokenOnBinding = assignment,
  } = o;
  const to = from + count - 1;
  const listing = `jsonb_build_object('name','Place '||n,'category',$5::text,
      'location',jsonb_build_object('type','Point','coordinates',jsonb_build_array(($6::float8)+((n-$3)%$8)*($7::float8),($9::float8)+(((n-$3)/$8)*($7::float8)))),
      'attribution','["Overture"]'::jsonb,'notices','[]'::jsonb,'termsUrls','["https://example.test/terms"]'::jsonb)
    || CASE WHEN $10::text IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('assignmentChangeToken',$10::text) END
    || CASE WHEN $11::boolean IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('adult',$11::boolean) END
    || jsonb_build_object('reviewed',
         (CASE WHEN $12::boolean THEN jsonb_build_object('address',n||' Main St') ELSE '{}'::jsonb END)
         || jsonb_build_object('website','https://place.example.test/','phone','+19125550100','attribution','["Fixture"]'::jsonb,'notices','[]'::jsonb,'termsUrls','["https://example.test/terms"]'::jsonb,'evidenceUrl','https://example.test/evidence'))`;
  const args = [
    scanId,
    town,
    from,
    to,
    category,
    lng,
    step,
    cols,
    lat,
    assignment,
    adult,
    address,
  ];
  await db.query(
    `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) SELECT $1,n,$2,${listing} FROM generate_series($3::bigint,$4::bigint) n`,
    args
  );
  await db.query(
    `INSERT INTO directory_address_review_candidate ("communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","verdict","reasons","checks","policyVersion","status")
     SELECT $2::uuid,$1,n,'Place '||n,'restaurant','{"lat":31,"lng":-83}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'eligible','{"residential":false,"sensitive":false,"adult":false}'::jsonb,'auto_approve','[]'::jsonb,'{}'::jsonb,'fixture-v1','published' FROM generate_series($3::bigint,$4::bigint) n`,
    [scanId, town, from, to]
  );
  await db.query(
    `INSERT INTO directory_address_review_decision ("candidateId","actorKind","decision","checks","policyVersion","appliedAt")
     SELECT c.id,'auto','approve','{}'::jsonb,'fixture-v1',now() FROM directory_address_review_candidate c WHERE c."scanId"=$1 AND c."sourceFileRowNumber" BETWEEN $2 AND $3`,
    [scanId, from, to]
  );
  await db.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber","livePolicyId",provenance,"stageInstallationId","stageScanId","stageSourceFileRowNumber","stagePolicyId","stageContentHash","reviewedHash","assignmentChangeToken",state,"stateCause","verifiedAt","verifiedUntil")
     SELECT c.id,d.id,c."communityId",c."scanId",c."sourceFileRowNumber",$4,'contact_stage','stage-a',$5,c."sourceFileRowNumber",$6,$7,$7,$9::uuid,$8::varchar,'published',CASE WHEN $8::varchar='active' THEN now() END,CASE WHEN $8::varchar='active' THEN $10::timestamptz END
     FROM directory_address_review_candidate c JOIN directory_address_review_decision d ON d."candidateId"=c.id
     WHERE c."scanId"=$1 AND c."sourceFileRowNumber" BETWEEN $2 AND $3`,
    [
      scanId,
      from,
      to,
      policy('b'),
      policy('e'),
      policy('f'),
      policy('d'),
      state,
      tokenOnBinding,
      until,
    ]
  );
  if (project && state === 'active')
    await db.query(projectionSql(), [scanId, from, to]);
}

/** Writes the projection exactly as projectBinding does: digest in SQL, point NULL without an address. */
const projectionSql =
  () => `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","point","listingDigest","validatorVersion")
  SELECT b."scanId",b."sourceFileRowNumber",b.id,b."communityId",
         CASE WHEN r.listing#>>'{reviewed,address}' IS NOT NULL THEN ST_SetSRID(ST_MakePoint((r.listing#>>'{location,coordinates,0}')::float8,(r.listing#>>'{location,coordinates,1}')::float8),4326) END,
         md5(r.listing::text),1
  FROM directory_reviewed_binding b JOIN directory_overture_private_row r ON r."scanId"=b."scanId" AND r."sourceFileRowNumber"=b."sourceFileRowNumber"
  WHERE b."scanId"=$1 AND b."sourceFileRowNumber" BETWEEN $2 AND $3 AND b.state='active' ON CONFLICT DO NOTHING`;

const bindingOf = async (db, scanId, row) =>
  (
    await db.query(
      'SELECT id FROM directory_reviewed_binding WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [scanId, row]
    )
  )[0].id;
const unique = () => 'a'.repeat(32) + randomBytes(16).toString('hex');

/** Pages a bounds query to exhaustion; returns every listing name and the page count. */
async function traverse(c, town, box, { adult = false, limit = 100000 } = {}) {
  const names = [];
  let cursor = '',
    pages = 0;
  for (;;) {
    const page = await c.localListings(
      town,
      0,
      '',
      adult,
      '',
      true,
      cursor,
      undefined,
      box
    );
    pages += 1;
    names.push(...page.listings.map((x) => x.name));
    if (!page.hasMore) return { names, pages, last: page };
    cursor = page.nextCursor;
    if (pages > limit) throw Error('runaway traversal');
  }
}

module.exports = {
  DAY,
  identity,
  secret,
  token,
  policy,
  databaseUrl,
  connect,
  reset,
  scan,
  checks,
  bulk,
  projectionSql,
  bindingOf,
  unique,
  traverse,
  randomUUID,
};

/** Plain imported rows: no candidate, no binding, no projection. They must never appear in a bounds result. */
async function plain(
  db,
  {
    scan: scanId,
    town,
    from,
    count,
    lng = -83,
    lat = 31,
    step = 0.0001,
    cols = 100,
    assignment = token,
  }
) {
  await db.query(
    `INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing)
     SELECT $1,n,$2,jsonb_build_object('name','Plain '||n,'category','restaurant','location',jsonb_build_object('type','Point','coordinates',jsonb_build_array(($5::float8)+((n-$3)%$7)*($6::float8),($8::float8)+(((n-$3)/$7)*($6::float8)))),
       'attribution','["Overture"]'::jsonb,'notices','[]'::jsonb,'termsUrls','["https://example.test/terms"]'::jsonb,'assignmentChangeToken',$9::text)
     FROM generate_series($3::bigint,$4::bigint) n`,
    [scanId, town, from, from + count - 1, lng, step, cols, lat, assignment]
  );
}
module.exports.plain = plain;

/** The writers' effect on the projection, in one transaction, as the lifecycle transitions do it. */
const suspend = (db, scanId, row) =>
  db.transaction(async (m) => {
    await m.query(
      `UPDATE directory_reviewed_binding SET state='suspended',"stateCause"='lease_expired',"suspendedAt"=now(),"verifiedUntil"=NULL WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
      [scanId, row]
    );
    await m.query(
      'DELETE FROM directory_reviewed_spatial WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [scanId, row]
    );
  });
const confirm = (db, scanId, row) =>
  db.transaction(async (m) => {
    await m.query(
      `UPDATE directory_reviewed_binding SET state='active',"stateCause"='published',"suspendedAt"=NULL,"verifiedAt"=now(),"verifiedUntil"=now()+interval '1 day' WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2`,
      [scanId, row]
    );
    await m.query(projectionSql(), [scanId, row, row]);
  });
module.exports.suspend = suspend;
module.exports.confirm = confirm;
