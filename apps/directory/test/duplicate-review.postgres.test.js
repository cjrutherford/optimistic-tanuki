require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  queueUncertainDuplicates,
  decideDuplicateCase,
  listDuplicateCases,
  getDuplicateCase,
} = require('../src/duplicate-review');
const {
  drawDuplicateSample,
  getDuplicateSample,
  judgeSampleItem,
  listDuplicateSamples,
} = require('../src/duplicate-sample');
const { createReport, transitionReport } = require('../src/listing-report');
const { getOrCreateListingIdentities } = require('../src/listing-identity');
const { collectOpsMetrics } = require('../src/ops-metrics');
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

const CLEAN = [
  'directory_duplicate_sample_item',
  'directory_duplicate_sample',
  'directory_listing_report',
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
];

test(
  'the review screen pages the queue on the server, shows both listings, refuses stale decisions and samples reproducibly',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const town = randomUUID();
    const scanId = hex();
    const reviewer = randomUUID();
    try {
      await seed(ds, town, scanId, hex());
      // Six uncertain pairs: odd ones are similar names, even ones the same name 300 m apart.
      let row = 1;
      for (let n = 0; n < 6; n++) {
        const lat = 0.03 * n;
        const second = n % 2 ? `Pair ${n} Cafe` : `Pair ${n} Cafe Downtown`;
        const dLng = n % 2 ? 0.0032 : 0.0005;
        await ds.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [
            scanId,
            row++,
            town,
            JSON.stringify(
              listingOf(`Pair ${n} Cafe`, 0, lat, {
                addresses: [`${n} Main St`],
                phones: ['+19125550100'],
              })
            ),
          ]
        );
        await ds.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [scanId, row++, town, JSON.stringify(listingOf(second, dLng, lat))]
        );
      }
      assert.equal(
        (
          await queueUncertainDuplicates(ds, {
            townId: town,
            changeToken: TOKEN,
          })
        ).queued,
        6
      );

      // Server-side paging: totals count every case, pages do not overlap, filters narrow.
      const p1 = await listDuplicateCases(ds, town, { limit: 4, offset: 0 });
      const p2 = await listDuplicateCases(ds, town, { limit: 4, offset: 4 });
      assert.equal(p1.total, 6);
      assert.equal(p1.cases.length, 4);
      assert.equal(p2.cases.length, 2);
      assert.equal(
        new Set([...p1.cases, ...p2.cases].map((c) => c.caseId)).size,
        6
      );
      const near = await listDuplicateCases(ds, town, {
        rule: 'same_name_near',
      });
      assert.equal(near.total, 3);
      assert.ok(near.cases.every((c) => c.rule === 'same_name_near'));
      assert.equal(
        (await listDuplicateCases(ds, town, { state: 'merged' })).total,
        0
      );
      await assert.rejects(
        listDuplicateCases(ds, town, { limit: 101 }),
        /Invalid duplicate case/
      );
      await assert.rejects(
        listDuplicateCases(ds, town, { rule: 'nope' }),
        /Invalid duplicate case/
      );

      // The pair view: both listings, the hidden one flagged, history included.
      const target = p1.cases[0];
      const detail = await getDuplicateCase(ds, town, target.caseId);
      assert.equal(detail.keptListing.hidden, false);
      assert.equal(detail.hiddenListing.hidden, true);
      assert.equal(detail.keptListing.category, 'restaurant');
      assert.deepEqual(detail.keptListing.sources, ['meta']);
      assert.ok(detail.keptListing.coordinates);
      assert.equal(detail.history[0].kind, 'queued');
      await assert.rejects(
        getDuplicateCase(ds, randomUUID(), target.caseId),
        /Duplicate case unavailable/
      );

      // Stale decisions are refused; a replay of the same decision is not stale.
      const decision = {
        caseId: target.caseId,
        townId: town,
        action: 'merge',
        actorId: reviewer,
        reason: 'same cafe',
        expectedState: 'queued',
      };
      await assert.rejects(
        decideDuplicateCase(ds, { ...decision, expectedState: 'merged' }),
        /Duplicate case changed/
      );
      assert.equal((await decideDuplicateCase(ds, decision)).replayed, false);
      assert.equal((await decideDuplicateCase(ds, decision)).replayed, true);
      await assert.rejects(
        decideDuplicateCase(ds, {
          ...decision,
          action: 'keep_separate',
          expectedState: 'queued',
        }),
        /Duplicate case changed/
      );

      // D18 sample: stored once per round, reproducible from the seed, judged into a wrong-merge rate.
      const draw = (round, seed) =>
        drawDuplicateSample(ds, {
          townId: town,
          round,
          actorId: reviewer,
          size: 4,
          seed,
        });
      const first = await draw('2026-r1', 'seed-a');
      assert.equal(first.replayed, false);
      assert.equal(first.sample.report.sampleSize, 4);
      assert.equal(first.sample.populationSize, 6);
      const again = await draw('2026-r1', 'ignored-seed');
      assert.equal(again.replayed, true);
      assert.equal(again.sample.seed, 'seed-a');
      const other = await draw('2026-r2', 'seed-a');
      const ids = async (id) =>
        (await getDuplicateSample(ds, town, id)).items
          .map((i) => i.caseId)
          .sort();
      assert.deepEqual(
        await ids(first.sample.sampleId),
        await ids(other.sample.sampleId)
      );
      const sample = await getDuplicateSample(ds, town, first.sample.sampleId);
      assert.equal(sample.items.length, 4);
      assert.ok(sample.items.every((i) => i.verdict === null));
      let report;
      for (const [i, item] of sample.items.entries()) {
        const result = await judgeSampleItem(ds, {
          townId: town,
          sampleId: first.sample.sampleId,
          caseId: item.caseId,
          verdict: i === 0 ? 'distinct' : 'duplicate',
          actorId: reviewer,
        });
        report = result.report;
      }
      assert.equal(report.judged, 4);
      assert.equal(report.wrong, 1);
      assert.equal(report.rate, 0.25);
      assert.equal(report.complete, true);
      assert.equal(report.withinLimit, false);
      assert.equal(
        (
          await judgeSampleItem(ds, {
            townId: town,
            sampleId: first.sample.sampleId,
            caseId: sample.items[0].caseId,
            verdict: 'distinct',
            actorId: reviewer,
          })
        ).replayed,
        true
      );
      await assert.rejects(
        judgeSampleItem(ds, {
          townId: town,
          sampleId: first.sample.sampleId,
          caseId: randomUUID(),
          verdict: 'duplicate',
          actorId: reviewer,
        }),
        /Duplicate sample unavailable/
      );
      const listed = await listDuplicateSamples(ds, town);
      assert.equal(listed.samples.length, 2);
      assert.equal(
        listed.samples.find((s) => s.round === '2026-r1').report.wrong,
        1
      );
    } finally {
      for (const t of CLEAN) await ds.query(`DELETE FROM ${t}`);
      await ds.destroy();
    }
  }
);

test(
  'a safety or privacy report hides the listing at once through the ordinary suppression; other reports do not; a decline lifts it',
  { skip: !url },
  async () => {
    const ds = new DataSource({ type: 'postgres', url });
    await ds.initialize();
    const town = randomUUID();
    const scanId = hex();
    const reviewer = randomUUID();
    const contactKey = 'k'.repeat(64);
    try {
      await seed(ds, town, scanId, hex());
      const listings = {};
      for (const [n, name] of [
        [1, 'Safety Shop'],
        [2, 'Privacy Shop'],
        [3, 'Wrong Hours Shop'],
        [4, 'Unfounded Shop'],
      ]) {
        await ds.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [scanId, n, town, JSON.stringify(listingOf(name, n * 0.05))]
        );
        const [identity] = await getOrCreateListingIdentities(ds, town, [
          { scanId, row: String(n) },
        ]);
        listings[name] = identity.id;
      }
      const hidden = async () =>
        await ds.query(
          `SELECT "sourceFileRowNumber"::int AS n,"reasonCode","actorId",note FROM directory_listing_suppression WHERE "liftedAt" IS NULL ORDER BY 1`
        );
      const report = (name, reasonCode) =>
        createReport(ds, contactKey, {
          townId: town,
          listingId: listings[name],
          reasonCode,
          note: 'please look',
        });
      await report('Wrong Hours Shop', 'incorrect-details');
      assert.deepEqual(await hidden(), [], 'an ordinary report hides nothing');
      await report('Safety Shop', 'safety');
      await report('Privacy Shop', 'rights-request');
      await report('Unfounded Shop', 'safety');
      const open = await hidden();
      assert.deepEqual(
        open.map((h) => [h.n, h.reasonCode, h.actorId]),
        [
          [1, 'safety', null],
          [2, 'rights-request', null],
          [4, 'safety', null],
        ]
      );
      assert.match(open[0].note, /D17/);
      // A second safety report on an already hidden listing adds nothing.
      await report('Safety Shop', 'safety');
      assert.equal((await hidden()).length, 3);

      const rows = await ds.query(
        `SELECT id,"listingId","reasonCode","suppressionId",status FROM directory_listing_report ORDER BY "createdAt",id`
      );
      const linked = rows.filter((r) => r.suppressionId);
      assert.equal(linked.length, 3);

      // Declining the unfounded report lifts the provisional hide; resolving keeps the listing hidden.
      const unfounded = rows.find(
        (r) => r.listingId === listings['Unfounded Shop']
      );
      await transitionReport(ds, {
        townId: town,
        reportId: unfounded.id,
        action: 'decline',
        actorId: reviewer,
        note: 'no problem found',
      });
      assert.deepEqual(
        (await hidden()).map((h) => h.n),
        [1, 2]
      );
      const privacy = rows.find(
        (r) => r.listingId === listings['Privacy Shop']
      );
      await transitionReport(ds, {
        townId: town,
        reportId: privacy.id,
        action: 'resolve',
        actorId: reviewer,
        note: 'removed at the owner request',
      });
      assert.deepEqual(
        (await hidden()).map((h) => h.n),
        [1, 2]
      );
      const [after] = await ds.query(
        'SELECT "suppressionId" FROM directory_listing_report WHERE id=$1',
        [privacy.id]
      );
      assert.equal(after.suppressionId, privacy.suppressionId);
      // The ops metric counts reports still unacknowledged after three days.
      await ds.query(
        `UPDATE directory_listing_report SET "createdAt"=CURRENT_TIMESTAMP - interval '4 days' WHERE status='received' AND "reasonCode"='safety'`
      );
      const metrics = await collectOpsMetrics(ds, {});
      assert.equal(metrics.policy.reportsUntriagedOver3Days, 2);
    } finally {
      for (const t of CLEAN) await ds.query(`DELETE FROM ${t}`);
      await ds.destroy();
    }
  }
);
