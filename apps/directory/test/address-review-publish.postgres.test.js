const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  deletionIdentityKey,
} = require('../../../libs/storage/src/lib/account-deletion-write-fence');
const { OVERTURE_RIGHTS_FIELDS } = require('../src/overture-rights');
const {
  publishAddressReviewCandidate: publishWithBinding,
} = require('../src/address-review-publish');
const {
  stageContentHash,
  reviewedHash,
  documentHash,
} = require('../src/reviewed-binding');
const {
  recordHuman: recordHumanAddressReviewDecision,
  undoHuman,
} = require('./review-test-helpers');
const {
  addressVersionTokens,
  getAddressReviewCandidate,
} = require('../src/address-review-store');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const town = '00000000-0000-4000-8000-000000000001';
const reviewerId = '00000000-0000-4000-8000-000000000002';
const originalFetch = global.fetch;
const originalContainmentUrl = process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL;
test.before(() => {
  process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL = 'http://127.0.0.1:3000';
  global.fetch = async () =>
    new Response(
      JSON.stringify({ town: { id: town }, status: 'ready', covers: true }),
      { status: 200 }
    );
});
test.after(() => {
  global.fetch = originalFetch;
  if (originalContainmentUrl === undefined)
    delete process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL;
  else process.env.DIRECTORY_CONTAINMENT_GATEWAY_URL = originalContainmentUrl;
});
const scanId = 'a'.repeat(64);
const policyId = 'b'.repeat(64);
const bindingKey = 'k'.repeat(40);
const stageScanId = 'c'.repeat(64);
const stagePolicyId = 'd'.repeat(64);
const stageListing = {
  name: 'Fixture Bakery',
  category: 'bakery',
  location: { type: 'Point', coordinates: [-83, 31] },
  addresses: ['10 Main St'],
  websites: ['https://fixture.example.test'],
  phones: ['+19125550100'],
  sources: [{ property: '', dataset: 'Fixture', license: 'Fixture' }],
};
const sourceBinding = {
  provenance: 'contact_stage',
  key: bindingKey,
  stageInstallationId: 'fixture-stage',
  stage: {
    scanId: stageScanId,
    sourceFileRowNumber: '7',
    policyId: stagePolicyId,
    listing: stageListing,
  },
};
const publishAddressReviewCandidate = (db, input) =>
  publishWithBinding(db, { sourceBinding, ...input });
const fieldNames = Object.keys(OVERTURE_RIGHTS_FIELDS);
const permissions = Object.fromEntries(
  ['ingest', 'retain', 'privateDisplay', 'publicDisplay'].map((operation) => [
    operation,
    fieldNames,
  ])
);
const policy = {
  releaseId: 'fixture',
  operations: {
    ingest: true,
    retain: true,
    privateDisplay: true,
    publicDisplay: true,
  },
  terms: [
    {
      dataset: 'Fixture',
      license: 'Fixture',
      attribution: 'Fixture attribution',
      termsUrl: 'https://example.test/terms',
      notice: 'Fixture notice',
      permissions,
    },
  ],
};
const source = {
  releaseId: 'fixture',
  sources: [{ property: '', dataset: 'Fixture', license: 'Fixture' }],
  names: { primary: 'Fixture Bakery' },
  basic_category: 'bakery',
  taxonomy: { primary: 'bakery', hierarchy: ['food'] },
  geometry: { type: 'Point', coordinates: [-83, 31] },
  addresses: [{ freeform: '10 Main St' }],
  websites: ['https://fixture.example.test'],
  phones: ['+19125550100'],
};
const officialEvidence = {
  url: 'https://fixture.example.test',
  status: 'fetched',
  nameMatch: true,
  addressMatch: true,
  phoneMatch: true,
  websiteMatch: true,
  fetchedAt: new Date().toISOString(),
  evidenceHash: 'd'.repeat(64),
};
const listing = {
  name: 'Fixture Bakery',
  category: 'bakery',
  location: { type: 'Point', coordinates: [-83, 31] },
  attribution: ['Fixture attribution'],
  notices: ['Fixture notice'],
  termsUrls: ['https://example.test/terms'],
};
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

async function seed(db, status = 'approved') {
  await db.query(
    'TRUNCATE "directory_reviewed_spatial", "directory_reviewed_binding_event", "directory_reviewed_binding", "directory_address_review_decision", "directory_address_review_candidate", "directory_overture_private_row", "directory_overture_private_membership", "directory_overture_private_policy", "directory_overture_private_scan_lock", "directory_overture_private_completion", "directory_overture_private_row_revocation", "directory_overture_private_revocation"'
  );
  await seedVerifiedBoundary(db);
  await db.query(
    'INSERT INTO "directory_overture_private_policy" ("policyId") VALUES ($1)',
    [policyId]
  );
  await db.query(
    'INSERT INTO "directory_overture_private_scan_lock" ("scanId") VALUES ($1)',
    [scanId]
  );
  await db.query(
    'INSERT INTO "directory_overture_private_membership" ("scanId","policyId") VALUES ($1,$2)',
    [scanId, policyId]
  );
  await db.query(
    'INSERT INTO "directory_overture_private_completion" ("scanId") VALUES ($1)',
    [scanId]
  );
  await db.query(
    'INSERT INTO "directory_overture_private_row" ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,1,$2,$3::jsonb)',
    [scanId, town, JSON.stringify(listing)]
  );
  const rows = await db.query(
    `INSERT INTO "directory_address_review_candidate"
      ("communityId","scanId","sourceFileRowNumber","name","category","point","addresses","websites","phones","rights","risk","geocode","officialEvidence","verdict","reasons","checks","policyVersion","status")
     VALUES ($1,$2,1,'Fixture Bakery','bakery','{"lat":31,"lng":-83}'::jsonb,'["10 Main St"]'::jsonb,'["https://fixture.example.test"]'::jsonb,'["+19125550100"]'::jsonb,'eligible','{"residential":false,"sensitive":false,"adult":false}'::jsonb,'{"status":"match","coordinates":{"lat":31,"lng":-83}}'::jsonb,$3::jsonb,'auto_approve','[]'::jsonb,'{}'::jsonb,'address-review-v1',$4)
     RETURNING "id"`,
    [town, scanId, JSON.stringify(officialEvidence), status]
  );
  return rows[0].id;
}

test(
  'withholds a candidate whose geocode lies outside the town boundary',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            town: { id: town },
            status: 'ready',
            covers: false,
          }),
          { status: 200 }
        );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /boundary changed|outside.*town/i
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
    } finally {
      global.fetch = async () =>
        new Response(
          JSON.stringify({ town: { id: town }, status: 'ready', covers: true }),
          { status: 200 }
        );
      await db.destroy();
    }
  }
);

test(
  'rechecks the locked verified boundary if it changes after gateway validation',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      let calls = 0;
      global.fetch = async () => {
        if (++calls === 2)
          await db.query(
            `UPDATE directory_town_geometry SET boundary=ST_GeomFromText('POLYGON((-81 30,-80 30,-80 32,-81 32,-81 30))',4326) WHERE "communityId"=$1 AND version=1`,
            [town]
          );
        return new Response(
          JSON.stringify({ town: { id: town }, status: 'ready', covers: true }),
          { status: 200 }
        );
      };
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /boundary changed|outside.*town/i
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
    } finally {
      global.fetch = async () =>
        new Response(
          JSON.stringify({ town: { id: town }, status: 'ready', covers: true }),
          { status: 200 }
        );
      await db.destroy();
    }
  }
);

test(
  'uses an explicitly pinned current Census place candidate when no verified boundary exists',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 's5-census-'));
    const filename = path.join(temp, 'regions.json');
    const previousLocalEvaluation = process.env.DIRECTORY_LOCAL_EVALUATION;
    const previousManifestPath =
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_PATH;
    const previousManifestHash =
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256;
    const identity = {
      sourceEpoch: '00000000-0000-4000-8000-000000000011',
      activationId: '00000000-0000-4000-8000-000000000012',
      socialGeneration: '1',
    };
    const token = '00000000-0000-4000-8000-000000000013';
    const manifest = {
      version: 1,
      ...identity,
      regions: [
        {
          id: town,
          assignmentChangeToken: token,
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-84, 30],
                [-82, 30],
                [-82, 32],
                [-84, 32],
                [-84, 30],
              ],
            ],
          },
        },
      ],
    };
    const digest = crypto
      .createHash('sha256')
      .update(JSON.stringify(manifest))
      .digest('hex');
    try {
      const candidateId = await seed(db);
      await db.query(
        `INSERT INTO directory_boundary_candidate ("communityId","sourceEpoch","activationId","socialGeneration","changeToken",geoid,layer,vintage,"stateFips","archiveSha256","geographyHash") VALUES ($1,$2,$3,$4,$5,'1300001','place','2026','13',$6,$7) ON CONFLICT ("communityId") DO UPDATE SET "sourceEpoch"=$2,"activationId"=$3,"socialGeneration"=$4,"changeToken"=$5,layer='place'`,
        [
          town,
          identity.sourceEpoch,
          identity.activationId,
          identity.socialGeneration,
          token,
          'e'.repeat(64),
          'f'.repeat(64),
        ]
      );
      fs.writeFileSync(
        filename,
        JSON.stringify({ ...manifest, sha256: digest })
      );
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_PATH = filename;
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256 = digest;
      global.fetch = async () =>
        new Response(
          JSON.stringify({
            town: { id: town },
            status: 'ready',
            covers: false,
          }),
          { status: 200 }
        );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /outside.*town/i
      );
      global.fetch = async () =>
        new Response(
          JSON.stringify({ town: { id: town }, status: 'pending' }),
          { status: 200 }
        );
      delete process.env.DIRECTORY_LOCAL_EVALUATION;
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /local evaluation/
      );
      process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
      delete process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256;
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /boundary is unavailable/
      );
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256 = '0'.repeat(64);
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /manifest is invalid/
      );
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256 = digest;
      await db.query(
        'UPDATE directory_boundary_candidate SET "changeToken"=$2 WHERE "communityId"=$1',
        [town, '00000000-0000-4000-8000-000000000014']
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /stale or unavailable/
      );
      await db.query(
        'UPDATE directory_boundary_candidate SET "changeToken"=$2 WHERE "communityId"=$1',
        [town, token]
      );
      const outside = {
        ...manifest,
        regions: [
          {
            ...manifest.regions[0],
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-81, 30],
                  [-80, 30],
                  [-80, 32],
                  [-81, 32],
                  [-81, 30],
                ],
              ],
            },
          },
        ],
      };
      const outsideDigest = crypto
        .createHash('sha256')
        .update(JSON.stringify(outside))
        .digest('hex');
      fs.writeFileSync(
        filename,
        JSON.stringify({ ...outside, sha256: outsideDigest })
      );
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256 = outsideDigest;
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /outside.*town/i
      );
      fs.writeFileSync(
        filename,
        JSON.stringify({ ...manifest, sha256: digest })
      );
      process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256 = digest;
      await db.query(
        `UPDATE directory_address_review_candidate SET point='{"lat":31,"lng":-81}'::jsonb WHERE id=$1`,
        [candidateId]
      );
      await db.query(
        `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{location,coordinates}','[-81,31]'::jsonb) WHERE "scanId"=$1`,
        [scanId]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /outside.*town/i
      );
      await db.query(
        `UPDATE directory_address_review_candidate SET point='{"lat":31,"lng":-83}'::jsonb WHERE id=$1`,
        [candidateId]
      );
      await db.query(
        `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{location,coordinates}','[-83,31]'::jsonb) WHERE "scanId"=$1`,
        [scanId]
      );
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      assert.equal(result.status, 'published');
      const [event] = await db.query(
        'SELECT checks FROM directory_address_review_decision WHERE "candidateId"=$1',
        [candidateId]
      );
      assert.equal(event.checks.containment, 'census_place_candidate_local');
    } finally {
      if (previousManifestPath === undefined)
        delete process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_PATH;
      else
        process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_PATH = previousManifestPath;
      if (previousManifestHash === undefined)
        delete process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256;
      else
        process.env.DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256 =
          previousManifestHash;
      if (previousLocalEvaluation === undefined)
        delete process.env.DIRECTORY_LOCAL_EVALUATION;
      else process.env.DIRECTORY_LOCAL_EVALUATION = previousLocalEvaluation;
      global.fetch = async () =>
        new Response(
          JSON.stringify({ town: { id: town }, status: 'ready', covers: true }),
          { status: 200 }
        );
      await db.query(
        'DELETE FROM directory_boundary_candidate WHERE "communityId"=$1',
        [town]
      );
      fs.rmSync(temp, { recursive: true, force: true });
      await db.destroy();
    }
  }
);

test(
  'rejects a candidate whose source key points elsewhere',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        'UPDATE "directory_address_review_candidate" SET "sourceFileRowNumber"=2 WHERE "id"=$1',
        [candidateId]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /source key does not match/i
      );
      const rows = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(rows[0].listing.reviewed, undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publishes a candidate stored under a superseded scan when the active row is the same source row',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        'UPDATE "directory_address_review_candidate" SET "scanId"=$2 WHERE "id"=$1',
        [candidateId, 'f'.repeat(64)]
      );
      await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      const rows = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      assert.ok(rows[0].listing.reviewed);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses contact fields that differ from the reviewed candidate',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      const altered = {
        ...source,
        addresses: [{ freeform: '99 Neighbor St' }],
      };
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source: altered,
          policy,
          actorId: reviewerId,
        }),
        /reviewed contact/i
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source: { ...source, websites: ['https://other.example.test'] },
          policy,
          actorId: reviewerId,
        }),
        /reviewed contact/i
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source: { ...source, phones: ['+19125550101'] },
          policy,
          actorId: reviewerId,
        }),
        /reviewed contact/i
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
    } finally {
      await db.destroy();
    }
  }
);

async function withFence(db, id, run) {
  const key = deletionIdentityKey('profile', id);
  await db.query(
    'INSERT INTO account_deletion_write_fence ("key", kind, "operationId") VALUES ($1, \'profile\', $2)',
    [key, crypto.randomUUID()]
  );
  try {
    return await run();
  } finally {
    await db.query('DELETE FROM account_deletion_write_fence WHERE "key"=$1', [
      key,
    ]);
  }
}

test(
  'refuses publication by a publisher whose account is being deleted',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await withFence(db, reviewerId, () =>
        assert.rejects(
          publishAddressReviewCandidate(db, {
            candidateId,
            source,
            policy,
            actorId: reviewerId,
          }),
          /ACCOUNT_DELETION_FENCED/
        )
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_address_review_decision WHERE "candidateId"=$1 AND "actorId"=$2',
            [candidateId, reviewerId]
          )
        ).length,
        0
      );
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      assert.equal(result.status, 'published');
    } finally {
      await db.destroy();
    }
  }
);

test(
  'allows publication when an optional matched phone is absent from both records',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        `UPDATE directory_address_review_candidate SET phones='[]'::jsonb WHERE id=$1`,
        [candidateId]
      );
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source: { ...source, phones: [] },
        policy,
        actorId: reviewerId,
      });
      assert.equal(result.status, 'published');
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed.phone, undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses official-page evidence older than the review policy allows',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        `UPDATE directory_address_review_candidate SET "officialEvidence"=jsonb_set("officialEvidence",'{fetchedAt}',to_jsonb('2000-01-01T00:00:00.000Z'::text)) WHERE id=$1`,
        [candidateId]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /evidence.*stale/i
      );
      await db.query(
        `UPDATE directory_address_review_candidate SET "officialEvidence"=jsonb_set("officialEvidence",'{fetchedAt}',to_jsonb($2::text)) WHERE id=$1`,
        [candidateId, new Date(Date.now() + 86_400_000).toISOString()]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /evidence.*stale/i
      );
      await db.query(
        `UPDATE directory_address_review_candidate SET "officialEvidence"="officialEvidence"-'fetchedAt' WHERE id=$1`,
        [candidateId]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /evidence.*stale/i
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses publication under an obsolete review policy',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        'UPDATE directory_address_review_candidate SET "policyVersion"=$2 WHERE id=$1',
        [candidateId, 'obsolete-review-policy']
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /review policy/i
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'revoking a published candidate removes reviewed fields and records the decision',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      const result = await recordHumanAddressReviewDecision(db, {
        candidateId,
        actorId: reviewerId,
        decision: 'revoke',
        reason: 'Wrong town',
      });
      assert.equal(result.status, 'revoked');
      const [row] = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1 AND "sourceFileRowNumber"=1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
      const decisions = await db.query(
        'SELECT "actorId",decision,reason,"appliedAt" FROM "directory_address_review_decision" WHERE "candidateId"=$1 AND decision=\'revoke\'',
        [candidateId]
      );
      assert.equal(decisions.length, 1);
      assert.equal(decisions[0].actorId, reviewerId);
      assert.equal(decisions[0].reason, 'Wrong town');
      assert.ok(decisions[0].appliedAt);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses revocation when the published candidate is anchored to the wrong row',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      await db.query(
        'UPDATE "directory_address_review_candidate" SET "sourceFileRowNumber"=2 WHERE id=$1',
        [candidateId]
      );
      await assert.rejects(
        recordHumanAddressReviewDecision(db, {
          candidateId,
          actorId: reviewerId,
          decision: 'revoke',
        }),
        /does not match/
      );
      const [row] = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      const [candidate] = await db.query(
        'SELECT status FROM "directory_address_review_candidate" WHERE id=$1',
        [candidateId]
      );
      assert.ok(row.listing.reviewed);
      assert.equal(candidate.status, 'published');
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publication rolls back reviewed fields if recording the decision fails',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        `CREATE OR REPLACE FUNCTION test_fail_address_decision() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END; $$ LANGUAGE plpgsql`
      );
      await db.query(
        'CREATE TRIGGER test_fail_address_decision BEFORE INSERT ON directory_address_review_decision FOR EACH ROW EXECUTE FUNCTION test_fail_address_decision()'
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /test audit failure/
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      const [candidate] = await db.query(
        'SELECT status FROM directory_address_review_candidate WHERE id=$1',
        [candidateId]
      );
      assert.equal(row.listing.reviewed, undefined);
      assert.equal(candidate.status, 'approved');
    } finally {
      await db.query(
        'DROP TRIGGER IF EXISTS test_fail_address_decision ON directory_address_review_decision'
      );
      await db.query('DROP FUNCTION IF EXISTS test_fail_address_decision()');
      await db.destroy();
    }
  }
);

test(
  'publication refuses an approval revoked before the write transaction',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    const other = new DataSource({ type: 'postgres', url });
    await db.initialize();
    await other.initialize();
    try {
      const candidateId = await seed(db);
      const transaction = db.transaction.bind(db);
      let calls = 0;
      db.transaction = async (...args) => {
        if (++calls === 2) {
          await recordHumanAddressReviewDecision(other, {
            candidateId,
            actorId: reviewerId,
            decision: 'revoke',
          });
        }
        return transaction(...args);
      };
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /changed before publication/
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      const [candidate] = await db.query(
        'SELECT status FROM directory_address_review_candidate WHERE id=$1',
        [candidateId]
      );
      assert.equal(row.listing.reviewed, undefined);
      assert.equal(candidate.status, 'revoked');
    } finally {
      await other.destroy();
      await db.destroy();
    }
  }
);

test(
  'publication refuses a source row bound to a different town assignment',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{assignmentChangeToken}',to_jsonb('00000000-0000-4000-8000-000000000099'::text)) WHERE "scanId"=$1`,
        [scanId]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /assignment changed/
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publishes reviewed fields through the private sink',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
        actorKind: 'human',
      });
      assert.equal(result.status, 'published');

      const rows = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(rows[0].listing.reviewed.address, '10 Main St');
      assert.equal(rows[0].listing.assignmentChangeToken, boundaryToken);
      assert.equal(
        rows[0].listing.reviewed.website,
        'https://fixture.example.test/'
      );
      assert.equal(rows[0].listing.reviewed.phone, '+19125550100');
      assert.equal(
        rows[0].listing.reviewed.evidenceUrl,
        'https://fixture.example.test/'
      );

      const candidate = await db.query(
        'SELECT status FROM "directory_address_review_candidate" WHERE "id"=$1',
        [candidateId]
      );
      assert.equal(candidate[0].status, 'published');

      const decisions = await db.query(
        'SELECT "actorKind","actorId","decision","appliedAt","checks" FROM "directory_address_review_decision" WHERE "candidateId"=$1',
        [candidateId]
      );
      assert.equal(decisions.length, 1);
      assert.equal(decisions[0].actorKind, 'human');
      assert.equal(decisions[0].actorId, reviewerId);
      assert.equal(decisions[0].decision, 'approve');
      assert.equal(decisions[0].checks.assignmentChangeToken, boundaryToken);
      assert.ok(decisions[0].appliedAt);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publishes when the active name has surrounding whitespace',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        `UPDATE "directory_overture_private_row"
         SET listing=jsonb_set(listing,'{name}',to_jsonb('Fixture Bakery '::text))`
      );
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
        actorKind: 'human',
      });
      assert.equal(result.status, 'published');
      const rows = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(rows[0].listing.reviewed.address, '10 Main St');
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses to publish a candidate that is not approved',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db, 'needs_human');
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /not approved/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publishes reviewer-supplied evidence when automated evidence was blocked',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db, 'approved');
      await db.query(
        'UPDATE "directory_address_review_candidate" SET "officialEvidence"=\'null\'::jsonb WHERE "id"=$1',
        [candidateId]
      );
      const humanUrl = 'https://human.example.test/record';
      await db.query(
        `INSERT INTO "directory_address_review_decision"
          ("candidateId","actorKind","actorId","decision","evidenceUrl","evidenceHash","reason","checks","policyVersion")
         VALUES ($1,'human',$2,'approve',$3,NULL,'Checked the official record','{"reviewedFrom":"owner-console"}'::jsonb,'address-review-v1')`,
        [candidateId, reviewerId, humanUrl]
      );
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
        actorKind: 'human',
        humanEvidenceUrl: humanUrl,
      });
      assert.equal(result.status, 'published');
      const rows = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(rows[0].listing.reviewed.evidenceUrl, humanUrl);
      assert.equal(rows[0].listing.reviewed.address, '10 Main St');
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publishes a D12 geocode-only approval without official-page evidence',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db, 'auto_approved');
      await db.query(
        `UPDATE "directory_address_review_candidate" SET "officialEvidence"=NULL,
           "geocode"='{"status":"match","matchType":"exact","coordinates":{"lat":31,"lng":-83}}'::jsonb,
           "checks"='{"d12StrongMatch":"pass"}'::jsonb WHERE "id"=$1`,
        [candidateId]
      );
      const args = {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
        actorKind: 'auto',
      };
      // Without the D12 audit decision the candidate is not publishable.
      await assert.rejects(
        publishAddressReviewCandidate(db, args),
        /official-page evidence is required/i
      );
      await db.query(
        `INSERT INTO "directory_address_review_decision"
          ("candidateId","actorKind","actorId","decision","reason","checks","policyVersion")
         VALUES ($1,'auto',NULL,'approve','D12 geocode strong match (owner 2026-11-19)','{}'::jsonb,'address-review-v1')`,
        [candidateId]
      );
      const result = await publishAddressReviewCandidate(db, args);
      assert.equal(result.status, 'published');
      const rows = await db.query(
        'SELECT listing FROM "directory_overture_private_row" WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(rows[0].listing.reviewed.address, '10 Main St');
      assert.match(
        rows[0].listing.reviewed.evidenceUrl,
        /geocoding\.geo\.census\.gov/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses reviewer-supplied evidence without a matching human approval',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db, 'approved');
      await db.query(
        'UPDATE "directory_address_review_candidate" SET "officialEvidence"=\'null\'::jsonb WHERE "id"=$1',
        [candidateId]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
          actorKind: 'human',
          humanEvidenceUrl: 'https://human.example.test/record',
        }),
        /Human approval evidence is required/
      );
    } finally {
      await db.destroy();
    }
  }
);

test(
  'refuses to publish without a matching active private row',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        'UPDATE "directory_overture_private_row" SET listing=$1::jsonb',
        [JSON.stringify({ ...listing, name: 'Other Business' })]
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /No active private row/
      );
    } finally {
      await db.destroy();
    }
  }
);

const bindingRows = (db, candidateId) =>
  db.query(
    'SELECT * FROM directory_reviewed_binding WHERE "candidateId"=$1 ORDER BY "createdAt"',
    [candidateId]
  );

test(
  'publication records a pending binding that matches the stage row and written fields',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      const result = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      const [binding, ...extra] = await bindingRows(db, candidateId);
      assert.equal(extra.length, 0);
      assert.equal(binding.id, result.bindingId);
      assert.equal(binding.decisionId, result.decisionId);
      const [decision] = await db.query(
        'SELECT id FROM directory_address_review_decision WHERE "candidateId"=$1 AND decision=\'approve\'',
        [candidateId]
      );
      assert.equal(decision.id, result.decisionId);
      assert.deepEqual(
        [
          binding.state,
          binding.stateCause,
          binding.provenance,
          binding.verifiedUntil,
          binding.communityId,
          binding.scanId,
          binding.sourceFileRowNumber,
          binding.livePolicyId,
        ],
        [
          'pending',
          'published',
          'contact_stage',
          null,
          town,
          scanId,
          '1',
          policyId,
        ]
      );
      assert.deepEqual(
        [
          binding.stageInstallationId,
          binding.stageScanId,
          binding.stageSourceFileRowNumber,
          binding.stagePolicyId,
          binding.displayPolicyReleaseId,
        ],
        ['fixture-stage', stageScanId, '7', stagePolicyId, 'fixture']
      );
      assert.equal(binding.displayPolicyHash, documentHash(policy));
      assert.equal(
        binding.stageContentHash,
        stageContentHash(bindingKey, stageListing)
      );
      assert.equal(binding.assignmentChangeToken, boundaryToken);
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(
        binding.reviewedHash,
        reviewedHash(bindingKey, row.listing.reviewed)
      );
      assert.deepEqual(Object.keys(binding.fieldHashes).sort(), [
        'address',
        'attribution',
        'category',
        'name',
        'notices',
        'phone',
        'point',
        'termsUrls',
        'website',
      ]);
      assert.equal(binding.fieldHashes.name.origin, 'live_row');
      assert.doesNotMatch(
        JSON.stringify(binding),
        /10 Main St|fixture\.example|9125550100/
      );
      const events = await db.query(
        'SELECT kind,cause,"decisionId" FROM directory_reviewed_binding_event WHERE "bindingId"=$1',
        [binding.id]
      );
      assert.deepEqual(events, [
        {
          kind: 'published',
          cause: 'publication',
          decisionId: result.decisionId,
        },
      ]);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'publication requires a complete source binding',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      const base = { candidateId, source, policy, actorId: reviewerId };
      await assert.rejects(
        publishWithBinding(db, base),
        /Source binding is required/
      );
      await assert.rejects(
        publishWithBinding(db, {
          ...base,
          sourceBinding: { ...sourceBinding, stageInstallationId: '' },
        }),
        /incomplete/
      );
      await assert.rejects(
        publishWithBinding(db, {
          ...base,
          sourceBinding: {
            ...sourceBinding,
            stage: { ...sourceBinding.stage, scanId: 'x' },
          },
        }),
        /incomplete/
      );
      await assert.rejects(
        publishWithBinding(db, {
          ...base,
          sourceBinding: { ...sourceBinding, key: 'short' },
        }),
        /hash key/
      );
      assert.equal((await bindingRows(db, candidateId)).length, 0);
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);
    } finally {
      await db.destroy();
    }
  }
);

test(
  'a rolled-back publication leaves no binding',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      await db.query(
        `CREATE OR REPLACE FUNCTION test_fail_binding_insert() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test binding failure'; END; $$ LANGUAGE plpgsql`
      );
      await db.query(
        'CREATE TRIGGER test_fail_binding_insert BEFORE INSERT ON directory_reviewed_binding FOR EACH ROW EXECUTE FUNCTION test_fail_binding_insert()'
      );
      await assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /test binding failure/
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      const [candidate] = await db.query(
        'SELECT status FROM directory_address_review_candidate WHERE id=$1',
        [candidateId]
      );
      assert.equal(row.listing.reviewed, undefined);
      assert.equal(candidate.status, 'approved');
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_address_review_decision WHERE "candidateId"=$1',
            [candidateId]
          )
        ).length,
        0
      );
      assert.equal((await bindingRows(db, candidateId)).length, 0);
      assert.equal(
        (await db.query('SELECT 1 FROM directory_reviewed_binding_event'))
          .length,
        0
      );
    } finally {
      await db.query(
        'DROP TRIGGER IF EXISTS test_fail_binding_insert ON directory_reviewed_binding'
      );
      await db.query('DROP FUNCTION IF EXISTS test_fail_binding_insert()');
      await db.destroy();
    }
  }
);

test('a fenced publisher leaves no binding', { skip: !url }, async () => {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    const candidateId = await seed(db);
    await withFence(db, reviewerId, () =>
      assert.rejects(
        publishAddressReviewCandidate(db, {
          candidateId,
          source,
          policy,
          actorId: reviewerId,
        }),
        /ACCOUNT_DELETION_FENCED/
      )
    );
    assert.equal((await bindingRows(db, candidateId)).length, 0);
    assert.equal(
      (await db.query('SELECT 1 FROM directory_reviewed_binding_event')).length,
      0
    );
  } finally {
    await db.destroy();
  }
});

test(
  'revoking a published candidate retires its binding and strips reviewed fields atomically',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      const published = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      await recordHumanAddressReviewDecision(db, {
        candidateId,
        actorId: reviewerId,
        decision: 'revoke',
        reason: 'Wrong town',
      });
      const [binding] = await bindingRows(db, candidateId);
      assert.deepEqual(
        [binding.id, binding.state, binding.stateCause],
        [published.bindingId, 'retired', 'human_revoke']
      );
      assert.ok(binding.retiredAt);
      const [revoke] = await db.query(
        'SELECT id FROM directory_address_review_decision WHERE "candidateId"=$1 AND decision=\'revoke\'',
        [candidateId]
      );
      const events = await db.query(
        'SELECT kind,cause,"decisionId" FROM directory_reviewed_binding_event WHERE "bindingId"=$1 ORDER BY "createdAt","kind"',
        [binding.id]
      );
      assert.deepEqual(events.map((e) => [e.kind, e.cause]).sort(), [
        ['published', 'publication'],
        ['retired', 'human_revoke'],
      ]);
      assert.equal(
        events.find((e) => e.kind === 'retired').decisionId,
        revoke.id
      );
      const [row] = await db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
      assert.equal(row.listing.reviewed, undefined);

      // A failed revoke leaves both the binding and the fields alone.
      const second = await seed(db);
      await publishAddressReviewCandidate(db, {
        candidateId: second,
        source,
        policy,
        actorId: reviewerId,
      });
      await db.query(
        `UPDATE directory_overture_private_row SET listing=jsonb_set(listing,'{name}','"Other"')`
      );
      await assert.rejects(
        recordHumanAddressReviewDecision(db, {
          candidateId: second,
          actorId: reviewerId,
          decision: 'revoke',
          reason: 'x',
        }),
        /does not match/
      );
      const [kept] = await bindingRows(db, second);
      assert.equal(kept.state, 'pending');
    } finally {
      await db.destroy();
    }
  }
);

test(
  're-publication retires the earlier binding as replaced',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    try {
      const candidateId = await seed(db);
      const first = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      // Stand in for the row a confirmed binding would own; replacement must remove it with the retirement.
      await db.query(
        `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","listingDigest","validatorVersion")
       SELECT "scanId","sourceFileRowNumber",$2,"communityId",'digest',1 FROM directory_reviewed_binding WHERE id=$1 ON CONFLICT DO NOTHING`,
        [first.bindingId, first.bindingId]
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_reviewed_spatial WHERE "bindingId"=$1',
            [first.bindingId]
          )
        ).length,
        1
      );
      await db.query(
        `UPDATE directory_address_review_candidate SET status='approved' WHERE id=$1`,
        [candidateId]
      );
      const second = await publishAddressReviewCandidate(db, {
        candidateId,
        source,
        policy,
        actorId: reviewerId,
      });
      const bindings = await bindingRows(db, candidateId);
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_reviewed_spatial WHERE "bindingId"=$1',
            [first.bindingId]
          )
        ).length,
        0
      );
      assert.equal(bindings.length, 2);
      assert.deepEqual(
        bindings
          .map((b) => [b.id, b.state, b.stateCause])
          .sort((a, b) => a[1].localeCompare(b[1])),
        [
          [second.bindingId, 'pending', 'published'],
          [first.bindingId, 'retired', 'replaced'],
        ]
      );
    } finally {
      await db.destroy();
    }
  }
);

const withDb = (fn) => async () => {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    await fn(db);
  } finally {
    await db.destroy();
  }
};
const decide = (db, candidateId, decision, extra = {}) =>
  recordHumanAddressReviewDecision(db, {
    candidateId,
    actorId: reviewerId,
    decision,
    reason: `${decision} by hand`,
    ...(decision === 'approve'
      ? { evidenceUrl: 'https://official.example.test/listing' }
      : {}),
    ...extra,
  });
const candidateStatus = async (db, id) =>
  (
    await db.query(
      'SELECT status FROM directory_address_review_candidate WHERE id=$1',
      [id]
    )
  )[0].status;
const decisionCount = async (db) =>
  (
    await db.query(
      'SELECT count(*)::int n FROM directory_address_review_decision'
    )
  )[0].n;
const rejects409 = (code) => (e) => e && e.code === code;

test(
  'a stale token is a 409 stale_decision and writes nothing',
  { skip: !url },
  withDb(async (db) => {
    const id = await seed(db, 'needs_human');
    const seen = (await addressVersionTokens(db, [id])).get(id);
    await decide(db, id, 'needs_info');
    const before = await decisionCount(db);
    await assert.rejects(
      decide(db, id, 'reject', { expectedVersionToken: seen }),
      rejects409('stale_decision')
    );
    assert.equal(await decisionCount(db), before);
    assert.equal(await candidateStatus(db, id), 'needs_human');
  })
);

test(
  'an identical replay returns replayed and a changed payload under the same id is refused',
  { skip: !url },
  withDb(async (db) => {
    const id = await seed(db, 'needs_human');
    const decisionId = crypto.randomUUID();
    const first = await decide(db, id, 'reject', { decisionId });
    assert.equal(first.replayed, false);
    const again = await decide(db, id, 'reject', {
      decisionId,
      expectedVersionToken: 'a'.repeat(64),
    });
    assert.equal(again.replayed, true);
    await assert.rejects(
      decide(db, id, 'reject', { decisionId, reason: 'something else' }),
      rejects409('decision_conflict')
    );
    assert.equal(await decisionCount(db), 1);
  })
);

test(
  'approve, publish then undo removes the reviewed fields, the binding and the spatial row',
  { skip: !url },
  withDb(async (db) => {
    const id = await seed(db, 'needs_human');
    const approve = crypto.randomUUID();
    await decide(db, id, 'approve', { decisionId: approve });
    const published = await publishAddressReviewCandidate(db, {
      candidateId: id,
      source,
      policy,
      actorId: reviewerId,
    });
    await db.query(
      `INSERT INTO directory_reviewed_spatial ("scanId","sourceFileRowNumber","bindingId","communityId","listingDigest","validatorVersion")
       SELECT "scanId","sourceFileRowNumber",$1,"communityId",'digest',1 FROM directory_reviewed_binding WHERE id=$1 ON CONFLICT DO NOTHING`,
      [published.bindingId]
    );
    const read = () =>
      db.query(
        'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
        [scanId]
      );
    assert.ok((await read())[0].listing.reviewed);
    const item = await getAddressReviewCandidate(db, town, id);
    // Publication records its own approve decision; that is the latest and the one an undo targets.
    assert.equal(item.history.length, 2);
    assert.equal(item.history[0].decisionId, approve);
    assert.equal(item.history[0].reversible, false);
    const publishedDecision = item.history.at(-1).decisionId;
    assert.equal(item.history.at(-1).reversible, true);

    const undoId = crypto.randomUUID();
    const done = await undoHuman(db, {
      candidateId: id,
      actorId: reviewerId,
      undoOf: publishedDecision,
      decisionId: undoId,
      reason: 'wrong shop',
    });
    assert.equal(done.replayed, false);
    assert.equal((await read())[0].listing.reviewed, undefined);
    const [binding] = await bindingRows(db, id);
    assert.deepEqual(
      [binding.state, binding.stateCause],
      ['retired', 'human_undo']
    );
    assert.equal(
      (
        await db.query(
          'SELECT 1 FROM directory_reviewed_spatial WHERE "bindingId"=$1',
          [published.bindingId]
        )
      ).length,
      0
    );
    assert.equal(await candidateStatus(db, id), 'revoked');
    const after = await getAddressReviewCandidate(db, town, id);
    assert.equal(after.history[1].undoneBy, undoId);
    assert.ok(after.history.every((h) => !h.reversible));
    assert.equal(after.history.length, 3);
    // Replaying the undo is idempotent; the original row is not deleted.
    const replay = await undoHuman(db, {
      candidateId: id,
      actorId: reviewerId,
      undoOf: publishedDecision,
      decisionId: undoId,
      reason: 'wrong shop',
      expectedVersionToken: 'c'.repeat(64),
    });
    assert.equal(replay.replayed, true);
    assert.equal(await decisionCount(db), 3);
  })
);

test(
  'undo of reject, needs_info and revoke returns the candidate to needs_human without publishing',
  { skip: !url },
  withDb(async (db) => {
    for (const action of ['reject', 'needs_info']) {
      const id = await seed(db, 'needs_human');
      const d = crypto.randomUUID();
      await decide(db, id, action, { decisionId: d });
      await undoHuman(db, {
        candidateId: id,
        actorId: reviewerId,
        undoOf: d,
      });
      assert.equal(await candidateStatus(db, id), 'needs_human');
    }
    const id = await seed(db, 'needs_human');
    await decide(db, id, 'approve');
    const published = await publishAddressReviewCandidate(db, {
      candidateId: id,
      source,
      policy,
      actorId: reviewerId,
    });
    const revoke = crypto.randomUUID();
    await decide(db, id, 'revoke', { decisionId: revoke });
    assert.equal((await bindingRows(db, id))[0].stateCause, 'human_revoke');
    await undoHuman(db, {
      candidateId: id,
      actorId: reviewerId,
      undoOf: revoke,
    });
    assert.equal(await candidateStatus(db, id), 'needs_human');
    assert.equal((await bindingRows(db, id)).length, 1);
    assert.equal((await bindingRows(db, id))[0].id, published.bindingId);
    assert.equal((await bindingRows(db, id))[0].state, 'retired');
    const [row] = await db.query(
      'SELECT listing FROM directory_overture_private_row WHERE "scanId"=$1',
      [scanId]
    );
    assert.equal(row.listing.reviewed, undefined);
  })
);

test(
  'only the latest non-undone decision is undoable (not_latest)',
  { skip: !url },
  withDb(async (db) => {
    const id = await seed(db, 'needs_human');
    const first = crypto.randomUUID();
    await decide(db, id, 'needs_info', { decisionId: first });
    await decide(db, id, 'reject');
    await assert.rejects(
      undoHuman(db, { candidateId: id, actorId: reviewerId, undoOf: first }),
      rejects409('not_latest')
    );
  })
);

test(
  'two concurrent decisions on one token: exactly one wins',
  { skip: !url },
  withDb(async (db) => {
    const id = await seed(db, 'needs_human');
    const seen = (await addressVersionTokens(db, [id])).get(id);
    const results = await Promise.allSettled([
      decide(db, id, 'approve', { expectedVersionToken: seen }),
      decide(db, id, 'reject', { expectedVersionToken: seen }),
      decide(db, id, 'needs_info', { expectedVersionToken: seen }),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    for (const r of results.filter((r) => r.status === 'rejected'))
      assert.equal(r.reason.code, 'stale_decision');
    assert.equal(await decisionCount(db), 1);
  })
);
