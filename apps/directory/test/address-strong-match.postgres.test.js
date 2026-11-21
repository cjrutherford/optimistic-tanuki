const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const { decideAddressReview } = require('../src/address-review');
const { storeAddressReviewCandidate } = require('../src/address-review-store');
const { D11_POLICY } = require('../src/address-strong-match');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const town = '00000000-0000-4000-8000-000000000001';
const reviewerId = '00000000-0000-4000-8000-000000000002';
const scanId = 'a'.repeat(64);
const now = new Date('2026-11-10T12:00:00.000Z');
const boundaryRequest = '00000000-0000-4000-8000-000000000015';
const boundaryToken = '00000000-0000-4000-8000-000000000013';
const boundaryEpoch = '00000000-0000-4000-8000-000000000011';
const boundaryActivation = '00000000-0000-4000-8000-000000000012';
const recoveryEpoch = '00000000-0000-4000-8000-000000000016';

async function seedVerifiedBoundary(db) {
  await db.query(
    'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
    [town]
  );
  await db.query(
    'DELETE FROM directory_boundary_decision WHERE "communityId"=$1',
    [town]
  );
  await db.query(
    'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',
    [town]
  );
  await db.query('DELETE FROM directory_town_geometry WHERE "communityId"=$1', [
    town,
  ]);
  await db.query(
    `INSERT INTO directory_town ("communityId",name,eligible,"geometryStatus","geometryVersion") VALUES ($1,'Fixture',true,'ready',1) ON CONFLICT ("communityId") DO UPDATE SET eligible=true,"geometryStatus"='ready',"geometryVersion"=1`,
    [town]
  );
  await db.query(
    `INSERT INTO directory_town_geometry ("communityId",version,boundary,source,vintage,rights) VALUES ($1,1,ST_GeomFromText('POLYGON((-84 30,-82 30,-82 32,-84 32,-84 30))',4326),'fixture','2026','fixture')`,
    [town]
  );
  await db.query(
    `INSERT INTO directory_boundary_candidate ("communityId","sourceEpoch","activationId","socialGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,1,$4,'1300001','place','2026','13',$5,$6)`,
    [
      town,
      boundaryEpoch,
      boundaryActivation,
      boundaryToken,
      'e'.repeat(64),
      'f'.repeat(64),
    ]
  );
  await db.query(
    `INSERT INTO directory_boundary_decision ("requestId","communityId","reviewerId",decision,"sourceUrl","sourceEpoch","activationId","socialGeneration","recoveryEpoch","directoryGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,'verified','https://example.test',$4,$5,1,$6,1,$7,'1300001','place','2026','13',$8,$9)`,
    [
      boundaryRequest,
      town,
      reviewerId,
      boundaryEpoch,
      boundaryActivation,
      recoveryEpoch,
      boundaryToken,
      'e'.repeat(64),
      'f'.repeat(64),
    ]
  );
  await db.query(
    `INSERT INTO directory_reviewed_geometry ("communityId","requestId",version,"changeToken","geographyHash","geometryHash","recoveryEpoch","directoryGeneration") VALUES ($1,$2,1,$3,$4,$5,$6,1)`,
    [
      town,
      boundaryRequest,
      boundaryToken,
      'f'.repeat(64),
      'a'.repeat(64),
      recoveryEpoch,
    ]
  );
  const [geometry] = await db.query(
    `SELECT encode(ST_AsEWKB(boundary,'XDR'),'hex') AS value FROM directory_town_geometry WHERE "communityId"=$1 AND version=1`,
    [town]
  );
  await db.query(
    'UPDATE directory_reviewed_geometry SET "geometryHash"=$2 WHERE "communityId"=$1',
    [
      town,
      crypto
        .createHash('sha256')
        .update(Buffer.from(geometry.value, 'hex'))
        .digest('hex'),
    ]
  );
}

const candidate = (overrides = {}) => ({
  communityId: town,
  scanId,
  sourceRow: 42,
  name: 'Fixture Bakery',
  category: 'bakery',
  point: { lat: 31, lng: -83 },
  addresses: ['10 Main St'],
  websites: ['https://fixture.example.test'],
  phones: ['+19125550100'],
  rights: 'eligible',
  residential: false,
  sensitive: false,
  adult: false,
  risk: { residential: false, sensitive: false, adult: false },
  ...overrides,
});
const official = (over = {}) => ({
  url: 'https://fixture.example.test/locations/main-st',
  status: 'fetched',
  nameMatch: true,
  addressMatch: true,
  phoneMatch: true,
  websiteMatch: true,
  fetchedAt: now.toISOString(),
  evidenceHash: 'b'.repeat(64),
  ...over,
});
const geocode = (lat = 31.0002, lng = -83.0002) => ({
  status: 'match',
  normalizedAddress: '10 MAIN ST',
  coordinates: { lat, lng },
  precision: 'rooftop',
  distanceMeters: 30,
  provider: 'census',
  checkedAt: now.toISOString(),
});

// Stores a candidate the classifier approves, then reads back the outcome.
async function run(db, { point, geo, evidence, boundary = true }) {
  await db.query(
    'TRUNCATE "directory_address_review_decision", "directory_address_review_candidate"'
  );
  if (boundary) await seedVerifiedBoundary(db);
  else {
    await db.query(
      'DELETE FROM directory_reviewed_geometry WHERE "communityId"=$1',
      [town]
    );
  }
  const base = candidate(point ? { point } : {});
  const decision = decideAddressReview({
    candidate: base,
    geocode: geo,
    official: evidence,
    now,
  });
  const stored = await storeAddressReviewCandidate(db, {
    ...base,
    officialEvidence: evidence,
    geocode: geo,
    decision,
  });
  const rows = await db.query(
    'SELECT "actorKind","decision","reason" FROM "directory_address_review_decision" WHERE "candidateId"=$1',
    [stored.id]
  );
  return { classified: decision.verdict, stored, rows };
}

async function withDatabase(fn) {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    await fn(db);
  } finally {
    await db.destroy();
  }
}

test(
  'D11 approves a strong match and the audit event names the policy',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const out = await run(db, { geo: geocode(), evidence: official() });
      assert.equal(out.classified, 'auto_approve');
      assert.equal(out.stored.status, 'auto_approved');
      assert.equal(out.rows[0].actorKind, 'auto');
      assert.equal(out.rows[0].reason, D11_POLICY);
    });
  }
);

test(
  'D11 holds when the source point is outside the verified boundary',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const out = await run(db, {
        point: { lat: 40, lng: -70 },
        geo: geocode(),
        evidence: official(),
      });
      assert.equal(out.stored.status, 'needs_human');
      assert.notEqual(out.rows[0].reason, D11_POLICY);
    });
  }
);

test(
  'D11 holds when the geocode lands outside the verified boundary',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const out = await run(db, {
        geo: geocode(31.0002, -70),
        evidence: official(),
      });
      assert.equal(out.stored.status, 'needs_human');
    });
  }
);

test(
  'D11 holds when the evidence sources disagree',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const out = await run(db, {
        geo: geocode(),
        evidence: official({ addressMatch: false }),
      });
      assert.notEqual(out.classified, 'auto_approve');
      assert.equal(out.stored.status, 'needs_human');
    });
  }
);

test(
  'D11 holds when the town boundary is not verified',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const out = await run(db, {
        geo: geocode(),
        evidence: official(),
        boundary: false,
      });
      assert.equal(out.classified, 'auto_approve');
      assert.equal(out.stored.status, 'needs_human');
      assert.notEqual(out.rows[0].reason, D11_POLICY);
    });
  }
);
