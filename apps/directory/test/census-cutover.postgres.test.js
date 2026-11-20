const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  retireOldCohort,
  duplicateActiveRows,
} = require('../../../scripts/local-directory-census-cutover.cjs');
const { findActivePrivateRow } = require('../src/address-review-publish');

const url = process.env.S10_CUTOVER_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/census_cutover_test_[a-z0-9_]+$/i.test(parsed.pathname)
  )
    throw Error(
      'A dedicated loopback census_cutover_test_* database is required'
    );
}
const hexId = () => randomBytes(32).toString('hex');

test(
  'cutover retires old rows outside a held town and leaves one active row per business',
  { skip: !url },
  async () => {
    const db = new DataSource({ type: 'postgres', url });
    await db.initialize();
    const [moved, held] = [randomUUID(), randomUUID()];
    const [oldPolicy, newPolicy] = [hexId(), hexId()];
    const [oldScan, newScan] = [hexId(), hexId()];
    const point = { type: 'Point', coordinates: [-82.5, 30.5] };
    const listing = (name) => ({ name, category: 'cafe', location: point });
    try {
      await db.query(
        'INSERT INTO directory_overture_private_policy ("policyId") VALUES ($1),($2)',
        [oldPolicy, newPolicy]
      );
      for (const [scan, policy] of [
        [oldScan, oldPolicy],
        [newScan, newPolicy],
      ]) {
        await db.query(
          'INSERT INTO directory_overture_private_scan_lock ("scanId") VALUES ($1)',
          [scan]
        );
        await db.query(
          'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
          [scan, policy]
        );
        await db.query(
          'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
          [scan]
        );
      }
      const row = (scan, n, region, name) =>
        db.query(
          'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4)',
          [scan, n, region, JSON.stringify(listing(name))]
        );
      await row(oldScan, 1, moved, 'Moved Cafe');
      await row(oldScan, 2, held, 'Held Cafe');
      await row(newScan, 1, moved, 'Moved Cafe');
      const input = (communityId, name) => ({
        communityId,
        name,
        category: 'cafe',
        point: { lat: 30.5, lng: -82.5 },
      });
      // Before: the moved town has two active rows, so the match is ambiguous.
      assert.equal(
        (await duplicateActiveRows(db, [oldPolicy, newPolicy])).length,
        1
      );
      await assert.rejects(
        findActivePrivateRow(db, input(moved, 'Moved Cafe')),
        /Multiple active/
      );
      const result = await retireOldCohort(db, {
        oldPolicyId: oldPolicy,
        newPolicyId: newPolicy,
        held: new Set([held]),
      });
      assert.equal(result.revoked, 1);
      assert.equal(
        (await duplicateActiveRows(db, [oldPolicy, newPolicy])).length,
        0
      );
      const active = await findActivePrivateRow(db, input(moved, 'Moved Cafe'));
      assert.equal(active.scanId, newScan);
      // The held town keeps exactly its old row, and the old policy stays unrevoked.
      const kept = await findActivePrivateRow(db, input(held, 'Held Cafe'));
      assert.equal(kept.scanId, oldScan);
      assert.equal(kept.policyId, oldPolicy);
      // Running it again changes nothing.
      assert.equal(
        (
          await retireOldCohort(db, {
            oldPolicyId: oldPolicy,
            newPolicyId: newPolicy,
            held: new Set([held]),
          })
        ).revoked,
        0
      );
    } finally {
      await db.query(
        'DELETE FROM directory_overture_private_row_revocation WHERE "scanId"=ANY($1)',
        [[oldScan, newScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_row WHERE "scanId"=ANY($1)',
        [[oldScan, newScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_completion WHERE "scanId"=ANY($1)',
        [[oldScan, newScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_membership WHERE "scanId"=ANY($1)',
        [[oldScan, newScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_scan_lock WHERE "scanId"=ANY($1)',
        [[oldScan, newScan]]
      );
      await db.query(
        'DELETE FROM directory_overture_private_policy WHERE "policyId"=ANY($1)',
        [[oldPolicy, newPolicy]]
      );
      await db.destroy();
    }
  }
);
