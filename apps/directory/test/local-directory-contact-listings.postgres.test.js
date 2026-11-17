const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  buildUniqueContactListingMap,
  buildUniqueContactStageMap,
  contactListingKey,
  readContactListingRows,
} = require('../../../scripts/local-directory-contact-listings.cjs');

const url = process.env.S5_CONTACT_TEST_DATABASE_URL;
if (url) {
  const parsed = new URL(url);
  if (
    !['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) ||
    !/^\/directory_contact_test_[a-z0-9_]+$/i.test(parsed.pathname)
  ) {
    throw Error('A dedicated loopback directory_contact_test_* database is required');
  }
}

const hexId = () => randomBytes(32).toString('hex');
const listing = (name) => ({ name, address: `${name} address` });

test('contact selection preserves ambiguous physical rows before applying revocation eligibility', { skip: !url }, async () => {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  const town = randomUUID();
  const policies = { active: hexId(), revoked: hexId() };
  const scans = {
    duplicateActive: hexId(),
    duplicateRevoked: hexId(),
    rowRevoked: hexId(),
    scanRevoked: hexId(),
    uniqueActive: hexId(),
    policyRevoked: hexId(),
  };
  try {
    await db.query(
      'INSERT INTO directory_overture_private_policy ("policyId",revoked) VALUES ($1,false),($2,true)',
      [policies.active, policies.revoked],
    );
    for (const [key, scanId] of Object.entries(scans)) {
      await db.query(
        'INSERT INTO directory_overture_private_membership ("scanId","policyId") VALUES ($1,$2)',
        [scanId, key === 'policyRevoked' ? policies.revoked : policies.active],
      );
      await db.query(
        'INSERT INTO directory_overture_private_completion ("scanId") VALUES ($1)',
        [scanId],
      );
    }
    const insertRow = (scanId, row, name) =>
      db.query(
        'INSERT INTO directory_overture_private_row ("scanId","sourceFileRowNumber","regionId",listing) VALUES ($1,$2,$3,$4::jsonb)',
        [scanId, row, town, JSON.stringify(listing(name))],
      );
    await insertRow(scans.duplicateActive, 1, 'Duplicate active');
    await insertRow(scans.duplicateRevoked, 1, 'Duplicate revoked');
    await insertRow(scans.rowRevoked, 2, 'Unique row revoked');
    await insertRow(scans.scanRevoked, 3, 'Unique scan revoked');
    await insertRow(scans.uniqueActive, 4, 'Unique active');
    await insertRow(scans.policyRevoked, 5, 'Unique policy revoked');
    await db.query(
      'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)',
      [scans.duplicateRevoked],
    );
    await db.query(
      'INSERT INTO directory_overture_private_revocation ("scanId") VALUES ($1)',
      [scans.scanRevoked],
    );
    await db.query(
      'INSERT INTO directory_overture_private_row_revocation ("scanId","sourceFileRowNumber") VALUES ($1,2)',
      [scans.rowRevoked],
    );

    const activeRows = await readContactListingRows(
      db,
      policies.active,
      [1, 2, 3, 4].map((sourceFileRowNumber) => ({ communityId: town, sourceFileRowNumber })),
    );
    const activeMap = buildUniqueContactListingMap(activeRows);
    assert.equal(activeRows.filter((row) => row.sourceFileRowNumber === '1').length, 2);
    assert.equal(activeMap.has(contactListingKey(town, 1)), false);
    assert.equal(activeMap.has(contactListingKey(town, 2)), false);
    assert.equal(activeMap.has(contactListingKey(town, 3)), false);
    assert.deepEqual(activeMap.get(contactListingKey(town, 4)), listing('Unique active'));

    const stageMap = buildUniqueContactStageMap(activeRows);
    assert.deepEqual([...stageMap.keys()], [contactListingKey(town, 4)]);
    assert.deepEqual(stageMap.get(contactListingKey(town, 4)), {
      listing: listing('Unique active'),
      scanId: scans.uniqueActive,
      sourceFileRowNumber: '4',
      policyId: policies.active,
    });

    const revokedPolicyRows = await readContactListingRows(db, policies.revoked, [
      { communityId: town, sourceFileRowNumber: 5 },
    ]);
    assert.equal(revokedPolicyRows.length, 1);
    assert.equal(
      buildUniqueContactListingMap(revokedPolicyRows).has(contactListingKey(town, 5)),
      false,
    );
  } finally {
    await db.destroy();
  }
});
