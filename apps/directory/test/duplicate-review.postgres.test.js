require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  queueUncertainDuplicates,
  decideDuplicateCase,
  listDuplicateCases,
} = require('../src/duplicate-review');
const { liftSuppression } = require('../src/listing-suppression');
const { buildPublicExport } = require('../src/public-export');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const hex = () => randomBytes(32).toString('hex');
const RELEASE = '2026-10-21.0';
const TOKEN = 'tok-d13';
const FIELDS = [
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
const sources = POINTERS.map((property) => ({
  property,
  dataset: 'meta',
  license: 'CDLA',
}));
const policy = {
  releaseId: RELEASE,
  operations: { export: true, publicExport: true },
  terms: [
    {
      dataset: 'meta',
      license: 'CDLA',
      attribution: 'Overture Maps Foundation',
      termsUrl: 'https://overturemaps.org/terms',
      notice: 'Contains Overture data',
      permissions: { export: FIELDS, publicExport: FIELDS },
    },
  ],
};
// One thousandth of a degree of longitude here is about 95 m.
const listingOf = (name, dLng = 0, dLat = 0, extra = {}) => ({
  name,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83.5 + dLng, 31.25 + dLat] },
  attribution: ['Example'],
  notices: [],
  termsUrls: [],
  assignmentChangeToken: TOKEN,
  sources,
  ...extra,
});

async function seed(ds, town, scanId, policyId) {
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
    [town, scanId]
  );
  await ds.query(
    `INSERT INTO directory_overture_source_evidence ("scanId","evidenceVersion",kind,"releaseId","artifactUrl","artifactEtag","inventorySha256","evidenceSha256",recorder)
     VALUES ($1,1,'attached_verified',$2,'https://example.org/a','e',$3,$4,'test')`,
    [scanId, RELEASE, hex(), hex()]
  );
}

test(
  'uncertain duplicates hide the weaker listing, queue a case, restore on keep separate and stay hidden on merge',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const town = randomUUID();
    const scanId = hex();
    const reviewer = randomUUID();
    const insert = (n, listing) =>
      ds.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
        [scanId, n, town, JSON.stringify(listing)]
      );
    const served = async () =>
      (
        await ds.query(
          `SELECT r.listing->>'name' AS name FROM directory_overture_private_row r
            WHERE r."regionId"=$1 AND NOT EXISTS (SELECT 1 FROM directory_listing_suppression s WHERE s."scanId"=r."scanId" AND s."sourceFileRowNumber"=r."sourceFileRowNumber" AND s."liftedAt" IS NULL)
            ORDER BY 1`,
          [town]
        )
      ).map((r) => r.name);
    const exported = async () => {
      const result = await buildPublicExport(ds, {
        town,
        format: 'jsonl',
        changeToken: TOKEN,
        policyFor: (rel) => (rel === RELEASE ? policy : undefined),
      });
      assert.equal(result.ok, true);
      return result.body;
    };
    const queue = () =>
      queueUncertainDuplicates(ds, { townId: town, changeToken: TOKEN });
    const cases = async () => (await listDuplicateCases(ds, town)).cases;
    try {
      await seed(ds, town, scanId, hex());
      // Uncertain pair 1: the second is the weaker (no contact fields).
      await insert(
        1,
        listingOf("Joe's Diner", 0, 0, {
          addresses: ['1 Main St'],
          phones: ['+19125550100'],
        })
      );
      await insert(2, listingOf("Joe's Diner Downtown", 0.0005));
      // Uncertain pair 2: same name 300 m apart.
      await insert(
        3,
        listingOf('Corner Cafe', 0, 0.02, { websites: ['https://c.example'] })
      );
      await insert(4, listingOf('Corner Cafe', 0.0032, 0.02));
      // Certain match: left alone (the acquisition dedupe owns it).
      await insert(5, listingOf('Twin Books', 0, 0.04));
      await insert(6, listingOf('Twin Books', 0.0001, 0.04));
      // Certain distinct: unrelated names close together, and the same name far apart.
      await insert(7, listingOf('Alpha Hardware', 0, 0.06));
      await insert(8, listingOf('Zeta Bakery', 0.0003, 0.06));
      await insert(9, listingOf('Far Cafe', 0, 0.08));
      await insert(10, listingOf('Far Cafe', 0.02, 0.08));

      const first = await queue();
      assert.equal(first.queued, 2);
      assert.deepEqual(await served(), [
        'Alpha Hardware',
        'Corner Cafe',
        'Far Cafe',
        'Far Cafe',
        "Joe's Diner",
        'Twin Books',
        'Twin Books',
        'Zeta Bakery',
      ]);
      const open = await cases();
      assert.equal(open.length, 2);
      assert.ok(open.every((c) => c.state === 'queued'));
      const byHidden = Object.fromEntries(
        open.map((c) => [c.hiddenName + c.hidden.sourceFileRowNumber, c])
      );
      const joe = byHidden["Joe's Diner Downtown2"];
      const corner = byHidden['Corner Cafe4'];
      assert.ok(joe && corner);
      assert.equal(joe.weakerBasis, 'fields');
      assert.equal(joe.rule, 'similar_name');
      assert.equal(corner.rule, 'same_name_near');
      const [supp] = await ds.query(
        `SELECT "reasonCode","actorId",note FROM directory_listing_suppression WHERE "scanId"=$1 AND "sourceFileRowNumber"=2 AND "liftedAt" IS NULL`,
        [scanId]
      );
      assert.equal(supp.reasonCode, 'duplicate');
      assert.equal(supp.actorId, null);
      assert.match(supp.note, /D13/);
      const queuedEvents = await ds.query(
        `SELECT kind,"actorId" FROM directory_duplicate_case_event WHERE "caseId"=$1`,
        [joe.caseId]
      );
      assert.deepEqual(queuedEvents, [{ kind: 'queued', actorId: null }]);

      // The hidden rows never reach the public export; the kept ones do.
      let body = await exported();
      assert.ok(!body.includes("Joe's Diner Downtown"));
      assert.equal((body.match(/Corner Cafe/g) ?? []).length, 1);
      assert.ok(body.includes("Joe's Diner"));
      assert.ok(body.includes('Twin Books'));

      // Idempotent: a second pass queues nothing and hides nothing more.
      assert.equal((await queue()).queued, 0);
      assert.equal((await cases()).length, 2);

      // Keep separate restores the listing, closes the case and is never queued again.
      const decision = {
        caseId: joe.caseId,
        townId: town,
        action: 'keep_separate',
        actorId: reviewer,
        reason: 'two restaurants',
      };
      assert.deepEqual(await decideDuplicateCase(ds, decision), {
        replayed: false,
        state: 'kept_separate',
      });
      assert.equal((await decideDuplicateCase(ds, decision)).replayed, true);
      assert.ok((await served()).includes("Joe's Diner Downtown"));
      body = await exported();
      assert.ok(body.includes("Joe's Diner Downtown"));
      assert.equal((await queue()).queued, 0);
      assert.ok(
        (await served()).includes("Joe's Diner Downtown"),
        'a kept-separate pair is not hidden again'
      );

      // Merge keeps the weaker listing hidden, and it stays hidden through later passes.
      await decideDuplicateCase(ds, {
        caseId: corner.caseId,
        townId: town,
        action: 'merge',
        actorId: reviewer,
        reason: 'same cafe',
      });
      assert.equal(
        (await cases()).find((c) => c.caseId === corner.caseId).state,
        'merged'
      );
      assert.equal((await queue()).queued, 0);
      assert.equal(
        (await served()).filter((n) => n === 'Corner Cafe').length,
        1
      );
      assert.equal(((await exported()).match(/Corner Cafe/g) ?? []).length, 1);

      // Undo re-opens a decided case and hides the listing again.
      await decideDuplicateCase(ds, {
        caseId: joe.caseId,
        townId: town,
        action: 'undo',
        actorId: reviewer,
        reason: 'mistake',
      });
      assert.ok(!(await served()).includes("Joe's Diner Downtown"));
      assert.ok(!(await exported()).includes("Joe's Diner Downtown"));
      assert.equal(
        (await cases()).find((c) => c.caseId === joe.caseId).state,
        'queued'
      );
      const kinds = (
        await ds.query(
          `SELECT kind FROM directory_duplicate_case_event WHERE "caseId"=$1 ORDER BY "createdAt",id`,
          [joe.caseId]
        )
      ).map((r) => r.kind);
      assert.deepEqual(kinds, ['queued', 'kept_separate', 'undone']);

      // Lifting through the ordinary suppression route is also a keep-separate; the next pass records it.
      const [open2] = await ds.query(
        `SELECT id FROM directory_listing_suppression WHERE "scanId"=$1 AND "sourceFileRowNumber"=2 AND "liftedAt" IS NULL`,
        [scanId]
      );
      await liftSuppression(ds, {
        suppressionId: open2.id,
        townId: town,
        reasonCode: 'resolved',
        actorId: reviewer,
      });
      const third = await queue();
      assert.equal(third.queued, 0);
      assert.equal(third.keptSeparateRecorded, 1);
      assert.equal(
        (await cases()).find((c) => c.caseId === joe.caseId).state,
        'kept_separate'
      );
      assert.ok((await served()).includes("Joe's Diner Downtown"));

      await assert.rejects(
        decideDuplicateCase(ds, { ...decision, reason: ' ' }),
        /Invalid duplicate case/
      );
      await assert.rejects(
        decideDuplicateCase(ds, { ...decision, townId: randomUUID() }),
        /Duplicate case unavailable/
      );
    } finally {
      for (const t of [
        'directory_duplicate_case_event',
        'directory_duplicate_case',
        'directory_listing_suppression',
        'directory_listing_identity',
        'directory_overture_private_row',
        'directory_overture_source_evidence',
        'directory_town_scan_target',
        'directory_overture_private_completion',
        'directory_overture_private_membership',
        'directory_overture_private_scan_lock',
        'directory_overture_private_policy',
      ])
        await ds.query(`DELETE FROM ${t}`);
      await ds.destroy();
    }
  }
);
