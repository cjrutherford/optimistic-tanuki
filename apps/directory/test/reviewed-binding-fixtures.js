// Shared fixtures for the two-database revalidation tests: one database stands in
// for the live Directory, the other for the contact stage.
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { stageContentHash, reviewedHash } = require('../src/reviewed-binding');

const key = 'revalidate-test-hmac-key-0123456789abcdef';
const town = '11111111-1111-4111-8111-111111111111';
const hex = (c) => c.repeat(64);
const liveScan = hex('a');
const livePolicy = hex('b');
const stageScan = hex('e');
const stagePolicy = hex('f');
const otherStageScan = hex('9');

function connectionUrls() {
  const live = process.env.S5_BINDING_LIVE_TEST_DATABASE_URL;
  const stage = process.env.S5_BINDING_STAGE_TEST_DATABASE_URL;
  if (!live || !stage) return null;
  for (const [value, pattern] of [
    [live, /^\/directory_binding_reval_live_[a-z0-9_]+$/i],
    [stage, /^\/directory_binding_reval_stage_[a-z0-9_]+$/i],
  ]) {
    const parsed = new URL(value);
    if (
      !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
      !pattern.test(parsed.pathname)
    ) {
      throw Error(
        'Dedicated loopback directory_binding_reval_live_* and directory_binding_reval_stage_* databases are required'
      );
    }
  }
  return { live, stage };
}

async function connect() {
  const urls = connectionUrls();
  const live = new DataSource({ type: 'postgres', url: urls.live });
  const stage = new DataSource({ type: 'postgres', url: urls.stage });
  await live.initialize();
  await stage.initialize();
  return {
    live,
    stage,
    close: async () => {
      await live.destroy();
      await stage.destroy();
    },
  };
}

const stageListing = (n, over = {}) => ({
  name: `Place ${n}`,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83, 31] },
  addresses: [{ freeform: `${n} Main St` }],
  websites: ['https://place.example.test/'],
  phones: ['+19125550100'],
  sources: [{ dataset: 'fixture' }],
  ...over,
});
const reviewedFor = (n) => ({
  address: `${n} Main St`,
  website: 'https://place.example.test/',
  phone: '+19125550100',
  attribution: ['Fixture'],
  notices: [],
  termsUrls: ['https://example.test/terms'],
});

async function scanSetup(db, scanId, policyId) {
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

async function reset(live, stage) {
  const tables =
    'directory_reviewed_spatial, directory_reviewed_binding_event, directory_reviewed_binding, directory_address_review_decision, directory_address_review_candidate, directory_overture_private_row, directory_overture_private_membership, directory_overture_private_policy, directory_overture_private_scan_lock, directory_overture_private_completion, directory_overture_private_revocation, directory_overture_private_row_revocation';
  await live.query(`TRUNCATE ${tables}`);
  await stage.query(`TRUNCATE ${tables}`);
  await scanSetup(live, liveScan, livePolicy);
  await scanSetup(stage, stageScan, stagePolicy);
}

/** Seeds one published row on both sides plus its binding; returns the ids. */
async function seedRow(live, stage, n, options = {}) {
  const {
    state = 'pending',
    provenance = 'contact_stage',
    suspendedAt = null,
    until = null,
    stageRow = true,
  } = options;
  const listing = stageListing(n);
  if (stageRow) {
    await stage.query(
      'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)',
      [stageScan, n, town, JSON.stringify(listing)]
    );
  }
  const reviewed = reviewedFor(n);
  await live.query(
    'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)',
    [
      liveScan,
      n,
      town,
      JSON.stringify({
        name: listing.name,
        category: listing.category,
        location: listing.location,
        reviewed,
      }),
    ]
  );
  const [candidate] = await live.query(
    `INSERT INTO directory_address_review_candidate ("communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","verdict","reasons","checks","policyVersion","status")
     VALUES ($1,$2,$3,$4,'restaurant','{"lat":31,"lng":-83}'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'eligible','{"residential":false,"sensitive":false,"adult":false}'::jsonb,'auto_approve','[]'::jsonb,'{}'::jsonb,'fixture-v1','published') RETURNING "id"`,
    [town, liveScan, n, listing.name]
  );
  const [decision] = await live.query(
    `INSERT INTO directory_address_review_decision ("candidateId","actorKind","decision","checks","policyVersion","appliedAt") VALUES ($1,'auto','approve','{}'::jsonb,'fixture-v1',now()) RETURNING "id"`,
    [candidate.id]
  );
  const contact = provenance === 'contact_stage';
  const legacy = provenance === 'unknown_legacy';
  const [binding] = await live.query(
    `INSERT INTO directory_reviewed_binding ("candidateId","decisionId","communityId","scanId","sourceFileRowNumber","livePolicyId",provenance,"stageInstallationId","stageScanId","stageSourceFileRowNumber","stagePolicyId","stageContentHash","reviewedHash",state,"stateCause","verifiedAt","verifiedUntil","suspendedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING "id"`,
    [
      candidate.id,
      legacy ? null : decision.id,
      town,
      liveScan,
      n,
      livePolicy,
      provenance,
      contact ? 'stage-a' : null,
      contact ? stageScan : null,
      contact ? n : null,
      contact ? stagePolicy : null,
      legacy ? null : stageContentHash(key, listing),
      legacy ? null : reviewedHash(key, reviewed),
      state,
      legacy ? 'legacy_no_provenance' : 'published',
      until ? new Date() : null,
      until,
      suspendedAt,
    ]
  );
  return { candidateId: candidate.id, bindingId: binding.id, row: n, listing };
}

const bindingState = async (live, id) =>
  (
    await live.query(
      'SELECT state,"stateCause","verifiedUntil","suspendedAt" FROM directory_reviewed_binding WHERE id=$1',
      [id]
    )
  )[0];
const events = (live, id) =>
  live.query(
    'SELECT kind,cause FROM directory_reviewed_binding_event WHERE "bindingId"=$1 ORDER BY "createdAt","id"',
    [id]
  );
const liveReviewed = async (live, n) =>
  (
    await live.query(
      'SELECT listing ? \'reviewed\' AS has FROM directory_overture_private_row WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2',
      [liveScan, n]
    )
  )[0]?.has;

module.exports = {
  key,
  town,
  hex,
  liveScan,
  livePolicy,
  stageScan,
  stagePolicy,
  otherStageScan,
  connectionUrls,
  connect,
  reset,
  seedRow,
  stageListing,
  reviewedFor,
  scanSetup,
  bindingState,
  events,
  liveReviewed,
};
