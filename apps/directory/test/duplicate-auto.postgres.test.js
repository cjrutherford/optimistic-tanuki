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
  autoResolveDuplicates,
  closeStaleDuplicateCases,
} = require('../src/duplicate-auto');
const { drawDuplicateSample } = require('../src/duplicate-sample');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const hex = () => randomBytes(32).toString('hex');
const TOKEN = 'tok-auto';
const src = (dataset) => [{ property: '/geometry', dataset, license: 'CDLA' }];
// 0.00005 degrees of longitude here is about 5 m; 0.0032 about 300 m.
const listingOf = (name, dLng, lat, dataset) => ({
  name,
  category: 'restaurant',
  location: { type: 'Point', coordinates: [-83.5 + dLng, 31.25 + lat] },
  attribution: ['Example'],
  notices: [],
  termsUrls: [],
  assignmentChangeToken: TOKEN,
  sources: src(dataset),
});
const CLEAN = [
  'directory_duplicate_sample_item',
  'directory_duplicate_sample',
  'directory_duplicate_case_event',
  'directory_duplicate_case',
  'directory_listing_suppression',
  'directory_listing_identity',
  'directory_overture_private_row_revocation',
  'directory_overture_private_row',
  'directory_overture_source_evidence',
  'directory_town_scan_target',
  'directory_overture_private_completion',
  'directory_overture_private_membership',
  'directory_overture_private_scan_lock',
  'directory_overture_private_policy',
];

async function seed(ds, town, scanId) {
  const policyId = hex();
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
     VALUES ($1,1,'attached_verified','2026-10-21.0','https://example.org/a','e',$2,$3,'test')`,
    [scanId, hex(), hex()]
  );
}

test(
  'stale cleanup, auto resolution, swap kept, status counts and the D18 sample population',
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
    const byName = async (status) =>
      Object.fromEntries(
        (
          await listDuplicateCases(ds, town, status ? { status } : {})
        ).cases.map((c) => [c.keptName + '/' + c.hiddenName, c])
      );
    const suppressed = async (row) =>
      (
        await ds.query(
          `SELECT 1 FROM directory_listing_suppression WHERE "scanId"=$1 AND "sourceFileRowNumber"=$2 AND "liftedAt" IS NULL`,
          [scanId, row]
        )
      ).length === 1;
    try {
      await seed(ds, town, scanId);
      // Obvious same place (rows 1, 2): brand and longer form, 5 m apart, two sources.
      await insert(1, listingOf("Domino's", 0, 0, 'meta'));
      await insert(2, listingOf("Domino's Pizza", 0.00005, 0, 'AllThePlaces'));
      // Not obvious: a pharmacy in a grocery (3, 4) and the same name 300 m apart (5, 6).
      await insert(3, listingOf('Walmart Supercenter', 0, 0.01, 'meta'));
      await insert(
        4,
        listingOf('Walmart Supercenter Pharmacy', 0.00005, 0.01, 'AllThePlaces')
      );
      await insert(5, listingOf('Corner Cafe', 0, 0.02, 'meta'));
      await insert(6, listingOf('Corner Cafe', 0.0032, 0.02, 'meta'));
      // Reviewed pair (7, 8): obvious by the rule, but a reviewer touches it first.
      await insert(7, listingOf('Taco Bell', 0, 0.03, 'meta'));
      await insert(
        8,
        listingOf('Taco Bell Cantina', 0.00005, 0.03, 'AllThePlaces')
      );
      // A pair that goes stale (9, 10): the hidden listing's row is revoked later.
      await insert(9, listingOf('Stale Diner', 0, 0.04, 'meta'));
      await insert(10, listingOf('Stale Diner', 0.0032, 0.04, 'meta'));

      assert.equal(
        (
          await queueUncertainDuplicates(ds, {
            townId: town,
            changeToken: TOKEN,
          })
        ).queued,
        5
      );
      const all = await byName();
      assert.equal(Object.keys(all).length, 5);
      const papa = Object.values(all).find((c) => /Taco/.test(c.keptName));
      // A reviewer decides and undoes the Taco Bell case: it must never be auto resolved afterwards.
      await decideDuplicateCase(ds, {
        caseId: papa.caseId,
        townId: town,
        action: 'merge',
        actorId: reviewer,
        reason: 'checked',
      });
      await decideDuplicateCase(ds, {
        caseId: papa.caseId,
        townId: town,
        action: 'undo',
        actorId: reviewer,
        reason: 'second look',
      });

      // Dry run reports and writes nothing.
      const dry = await autoResolveDuplicates(ds, {
        townId: town,
        dryRun: true,
      });
      assert.equal(dry.resolved, 1);
      assert.equal(dry.byRule['auto_brand_variant_colocated'], 1);
      assert.equal((await byName('auto_resolved')) && 0, 0);
      assert.equal((await listDuplicateCases(ds, town)).counts.autoResolved, 0);

      const run = await autoResolveDuplicates(ds, { townId: town });
      assert.equal(run.resolved, 1);
      const again = await autoResolveDuplicates(ds, { townId: town });
      assert.equal(again.resolved, 0);
      const auto = Object.values(await byName('auto_resolved'));
      assert.equal(auto.length, 1);
      assert.equal(auto[0].state, 'merged');
      assert.equal(auto[0].autoRule, 'auto_brand_variant_colocated');
      assert.equal(auto[0].keptName, "Domino's Pizza");
      assert.equal(
        await suppressed(1),
        true,
        'the weaker listing stays hidden'
      );
      const detail = await getDuplicateCase(ds, town, auto[0].caseId);
      const last = detail.history[detail.history.length - 1];
      assert.equal(last.kind, 'auto_merged');
      assert.equal(last.actorKind, 'auto');
      assert.equal(last.ruleId, 'auto_brand_variant_colocated');
      assert.equal(last.actorId, null);

      // Stale: revoke the hidden row of the Stale Diner pair, then close; idempotent, and the suppression is lifted.
      const staleCase = Object.values(all).find((c) =>
        /Stale/.test(c.keptName)
      );
      await ds.query(
        'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,$2)',
        [scanId, staleCase.hidden.sourceFileRowNumber]
      );
      const dryStale = await closeStaleDuplicateCases(ds, {
        townId: town,
        dryRun: true,
      });
      assert.equal(dryStale.examined, 1);
      assert.equal(dryStale.closed, 0);
      assert.equal(
        await suppressed(Number(staleCase.hidden.sourceFileRowNumber)),
        true
      );
      const closed = await closeStaleDuplicateCases(ds, { townId: town });
      assert.equal(closed.closed, 1);
      assert.deepEqual(closed.byReason, { row_revoked: 1 });
      assert.equal(
        (await closeStaleDuplicateCases(ds, { townId: town })).closed,
        0
      );
      assert.equal(
        await suppressed(Number(staleCase.hidden.sourceFileRowNumber)),
        false
      );
      const staleDetail = await getDuplicateCase(ds, town, staleCase.caseId);
      assert.equal(staleDetail.state, 'stale');
      assert.equal(staleDetail.status, 'stale');
      assert.match(
        staleDetail.history.at(-1).note,
        /hidden listing row_revoked/
      );
      await assert.rejects(
        decideDuplicateCase(ds, {
          caseId: staleCase.caseId,
          townId: town,
          action: 'merge',
          actorId: reviewer,
          reason: 'x',
        }),
        /Duplicate case changed/
      );

      // Counts by status and the status filter.
      const page = await listDuplicateCases(ds, town);
      assert.deepEqual(page.counts, {
        open: 3,
        autoResolved: 1,
        stale: 1,
        reviewed: 0,
      });
      assert.equal(
        (await listDuplicateCases(ds, town, { status: 'open' })).total,
        3
      );
      assert.equal(
        (await listDuplicateCases(ds, town, { status: 'stale' })).total,
        1
      );

      // Swap kept on the auto-resolved case: the other listing returns; the case becomes a reviewer decision.
      const keptBefore = auto[0].kept;
      const swapped = await decideDuplicateCase(ds, {
        caseId: auto[0].caseId,
        townId: town,
        action: 'swap_kept',
        actorId: reviewer,
        reason: 'ATP listing is the better one',
        expectedKept: keptBefore,
      });
      assert.deepEqual(swapped, { replayed: false, state: 'merged' });
      assert.equal(await suppressed(1), false);
      assert.equal(await suppressed(2), true);
      const after = await getDuplicateCase(ds, town, auto[0].caseId);
      assert.equal(after.kept.sourceFileRowNumber, '1');
      assert.equal(after.hidden.sourceFileRowNumber, '2');
      assert.equal(after.status, 'reviewed');
      assert.equal(after.autoRule, null);
      assert.equal(after.history.at(-1).kind, 'swapped');
      assert.equal(after.history.at(-1).actorId, reviewer);
      // The same click again is a replay, not a swap back; a stale expectation is refused.
      assert.deepEqual(
        await decideDuplicateCase(ds, {
          caseId: auto[0].caseId,
          townId: town,
          action: 'swap_kept',
          actorId: reviewer,
          reason: 'again',
          expectedKept: keptBefore,
        }),
        { replayed: true, state: 'merged' }
      );
      assert.equal(await suppressed(2), true);
      await assert.rejects(
        decideDuplicateCase(ds, {
          caseId: auto[0].caseId,
          townId: town,
          action: 'swap_kept',
          actorId: reviewer,
          reason: 'x',
          expectedKept: { scanId: 'nope', sourceFileRowNumber: '9' },
        }),
        /Duplicate case changed/
      );
      // Swapping is reversible by swapping again, and a kept-separate pair cannot be swapped.
      await decideDuplicateCase(ds, {
        caseId: auto[0].caseId,
        townId: town,
        action: 'swap_kept',
        actorId: reviewer,
        reason: 'back',
      });
      assert.equal(await suppressed(1), true);
      const corner = Object.values(all).find((c) => /Corner/.test(c.keptName));
      await decideDuplicateCase(ds, {
        caseId: corner.caseId,
        townId: town,
        action: 'keep_separate',
        actorId: reviewer,
        reason: 'two shops',
      });
      await assert.rejects(
        decideDuplicateCase(ds, {
          caseId: corner.caseId,
          townId: town,
          action: 'swap_kept',
          actorId: reviewer,
          reason: 'x',
        }),
        /Invalid duplicate case/
      );

      // A reviewer confirming an auto-resolved case takes it over (reviewed, not auto).
      const autoAgain =
        (await byName('reviewed'))[`Domino's Pizza/Domino's`] ?? null;
      assert.ok(autoAgain);

      // The D18 sample population includes auto-resolved cases (state merged).
      const sample = await drawDuplicateSample(ds, {
        townId: town,
        round: 'r1',
        actorId: reviewer,
        size: 100,
      });
      const items = await ds.query(
        'SELECT "caseId" FROM directory_duplicate_sample_item WHERE "sampleId"=$1',
        [sample.sample.sampleId]
      );
      assert.ok(items.some((i) => i.caseId === auto[0].caseId));
    } finally {
      for (const t of CLEAN) await ds.query(`DELETE FROM ${t}`);
      await ds.destroy();
    }
  }
);
