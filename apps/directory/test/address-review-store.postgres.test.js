const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { DataSource } = require('typeorm');
const {
  deletionIdentityKey,
} = require('../../../libs/storage/src/lib/account-deletion-write-fence');
const {
  DEFAULT_ADDRESS_REVIEW_POLICY,
  decideAddressReview,
} = require('../src/address-review');
const {
  listAddressReviewCandidates,
  storeAddressReviewCandidate,
  updateAddressReviewEvidence,
  archiveUnanchoredAddressReviewCandidate,
} = require('../src/address-review-store');
const {
  recordHuman: recordHumanAddressReviewDecision,
} = require('./review-test-helpers');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
const communityId = '00000000-0000-4000-8000-000000000001';
const reviewerId = '00000000-0000-4000-8000-000000000002';
const scanId = 'a'.repeat(64);
const now = new Date('2026-11-10T12:00:00.000Z');

const baseCandidate = (overrides = {}) => ({
  communityId,
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

const needsHumanDecision = () =>
  decideAddressReview({
    candidate: baseCandidate(),
    geocode: null,
    official: null,
    now,
  });

test(
  'archives an unanchored candidate without losing prior review history',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision: needsHumanDecision(),
      });
      const result = await archiveUnanchoredAddressReviewCandidate(
        db,
        stored.id
      );
      assert.equal(result.status, 'archived');
      const rows = await listAddressReviewCandidates(db, {
        status: 'archived',
      });
      assert.equal(rows.length, 1);
      const decisions = await db.query(
        'SELECT decision,checks FROM "directory_address_review_decision" WHERE "candidateId"=$1 ORDER BY "createdAt"',
        [stored.id]
      );
      assert.equal(decisions.length, 2);
      assert.equal(decisions[1].decision, 'archive');
      assert.equal(decisions[1].checks.previousStatus, 'needs_human');
      await assert.rejects(
        updateAddressReviewEvidence(db, {
          candidateId: stored.id,
          decision: needsHumanDecision(),
        }),
        /archived/i
      );
    });
  }
);

test(
  'evidence refresh cannot alter a published candidate',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision: needsHumanDecision(),
      });
      await db.query(
        'UPDATE "directory_address_review_candidate" SET status=\'published\' WHERE id=$1',
        [stored.id]
      );
      await assert.rejects(
        updateAddressReviewEvidence(db, {
          candidateId: stored.id,
          decision: needsHumanDecision(),
        }),
        /published/i
      );
      await assert.rejects(
        storeAddressReviewCandidate(db, {
          ...baseCandidate(),
          decision: needsHumanDecision(),
        }),
        /reviewed candidate/i
      );
      const [row] = await db.query(
        'SELECT status FROM "directory_address_review_candidate" WHERE id=$1',
        [stored.id]
      );
      assert.equal(row.status, 'published');
    });
  }
);

async function withDatabase(run) {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  try {
    await db.query(
      'TRUNCATE "directory_address_review_decision", "directory_address_review_candidate"'
    );
    await run(db);
  } finally {
    await db.destroy();
  }
}

test(
  'stores a needs-human candidate and lists it',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const decision = needsHumanDecision();
      assert.equal(decision.verdict, 'needs_human');
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision,
      });
      assert.equal(stored.status, 'needs_human');
      const rows = await listAddressReviewCandidates(db, {
        status: 'needs_human',
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].name, 'Fixture Bakery');
      assert.equal(rows[0].sourceFileRowNumber, '42');
      assert.equal(rows[0].verdict, 'needs_human');
    });
  }
);

test(
  'holds a high-confidence candidate for human review while auto-approval is paused',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const officialEvidence = {
        url: 'https://fixture.example.test/locations/main-st',
        status: 'fetched',
        nameMatch: true,
        addressMatch: true,
        phoneMatch: true,
        websiteMatch: true,
        fetchedAt: now.toISOString(),
        evidenceHash: 'b'.repeat(64),
      };
      const decision = decideAddressReview({
        candidate: baseCandidate(),
        geocode: {
          status: 'match',
          normalizedAddress: '10 MAIN ST',
          coordinates: { lat: 31.0002, lng: -83.0002 },
          precision: 'rooftop',
          distanceMeters: 30,
          provider: 'census',
          checkedAt: now.toISOString(),
        },
        official: officialEvidence,
        now,
      });
      assert.equal(decision.verdict, 'auto_approve');
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        officialEvidence,
        decision,
      });
      assert.equal(stored.status, 'needs_human');
      const decisions = await db.query(
        'SELECT "actorKind","decision","evidenceUrl" FROM "directory_address_review_decision" WHERE "candidateId"=$1',
        [stored.id]
      );
      assert.equal(decisions.length, 1);
      assert.equal(decisions[0].actorKind, 'auto');
      assert.equal(decisions[0].decision, 'needs_info');
      assert.equal(
        decisions[0].evidenceUrl,
        'https://fixture.example.test/locations/main-st'
      );
    });
  }
);

test(
  'refreshes evidence without automatically approving during the pause',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision: needsHumanDecision(),
      });
      const officialEvidence = {
        url: 'https://fixture.example.test/locations/main-st',
        status: 'fetched',
        nameMatch: true,
        addressMatch: true,
        phoneMatch: true,
        websiteMatch: true,
        fetchedAt: now.toISOString(),
        evidenceHash: 'd'.repeat(64),
      };
      const geocode = {
        status: 'match',
        normalizedAddress: '10 MAIN ST',
        coordinates: { lat: 31.0002, lng: -83.0002 },
        precision: 'rooftop',
        distanceMeters: 30,
        provider: 'census',
        checkedAt: now.toISOString(),
      };
      const decision = decideAddressReview({
        candidate: baseCandidate(),
        geocode,
        official: officialEvidence,
        now,
      });
      assert.equal(decision.verdict, 'auto_approve');

      const updated = await updateAddressReviewEvidence(db, {
        candidateId: stored.id,
        geocode,
        officialEvidence,
        decision,
      });
      assert.equal(updated.status, 'needs_human');

      const rows = await db.query(
        'SELECT "geocode","officialEvidence","status" FROM "directory_address_review_candidate" WHERE "id"=$1',
        [stored.id]
      );
      assert.equal(rows[0].status, 'needs_human');
      assert.equal(rows[0].geocode.provider, 'census');
      assert.equal(rows[0].officialEvidence.status, 'fetched');

      const count = async () =>
        (
          await db.query(
            'SELECT count(*)::int AS n FROM "directory_address_review_decision" WHERE "candidateId"=$1',
            [stored.id]
          )
        )[0].n;
      assert.equal(await count(), 1);
      await updateAddressReviewEvidence(db, {
        candidateId: stored.id,
        geocode,
        officialEvidence,
        decision,
      });
      assert.equal(await count(), 1);
    });
  }
);

test(
  'records a human approval with evidence and updates status',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision: needsHumanDecision(),
      });
      const result = await recordHumanAddressReviewDecision(db, {
        candidateId: stored.id,
        actorId: reviewerId,
        decision: 'approve',
        evidenceUrl: 'https://fixture.example.test/locations/main-st',
        evidenceHash: 'c'.repeat(64),
        reason: 'Compared the official location page and the source row.',
        checks: { officialAddress: 'pass', officialName: 'pass' },
      });
      assert.equal(result.status, 'approved');
      const rows = await listAddressReviewCandidates(db, {
        status: 'approved',
      });
      assert.equal(rows.length, 1);
      const decisions = await db.query(
        'SELECT "actorKind","actorId","decision","evidenceUrl" FROM "directory_address_review_decision" WHERE "candidateId"=$1',
        [stored.id]
      );
      assert.equal(decisions.length, 2);
      assert.equal(decisions[1].actorKind, 'human');
      assert.equal(decisions[1].actorId, reviewerId);
      assert.equal(decisions[1].decision, 'approve');
    });
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
  'refuses a human decision from a reviewer whose account is being deleted',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision: needsHumanDecision(),
      });
      const input = {
        candidateId: stored.id,
        actorId: reviewerId,
        decision: 'approve',
        evidenceUrl: 'https://fixture.example.test/locations/main-st',
      };
      await withFence(db, reviewerId, () =>
        assert.rejects(
          recordHumanAddressReviewDecision(db, input),
          /ACCOUNT_DELETION_FENCED/
        )
      );
      const humanRows = () =>
        db.query(
          'SELECT 1 FROM "directory_address_review_decision" WHERE "candidateId"=$1 AND "actorKind"=\'human\'',
          [stored.id]
        );
      assert.equal((await humanRows()).length, 0);
      assert.equal(
        (await recordHumanAddressReviewDecision(db, input)).status,
        'approved'
      );
      assert.equal((await humanRows()).length, 1);
    });
  }
);

test(
  'requires HTTPS evidence for a human approval',
  { skip: !url },
  async () => {
    await withDatabase(async (db) => {
      const stored = await storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        decision: needsHumanDecision(),
      });
      await assert.rejects(
        recordHumanAddressReviewDecision(db, {
          candidateId: stored.id,
          actorId: reviewerId,
          decision: 'approve',
          evidenceUrl: 'http://localhost/evidence',
        }),
        /HTTPS evidence/
      );
      const rows = await listAddressReviewCandidates(db, {
        status: 'needs_human',
      });
      assert.equal(rows.length, 1);
    });
  }
);

test('rejects an invalid status transition', { skip: !url }, async () => {
  await withDatabase(async (db) => {
    const stored = await storeAddressReviewCandidate(db, {
      ...baseCandidate(),
      decision: needsHumanDecision(),
    });
    await recordHumanAddressReviewDecision(db, {
      candidateId: stored.id,
      actorId: reviewerId,
      decision: 'approve',
      evidenceUrl: 'https://fixture.example.test/locations/main-st',
      attested: true,
    });
    await assert.rejects(
      recordHumanAddressReviewDecision(db, {
        candidateId: stored.id,
        actorId: reviewerId,
        decision: 'approve',
        evidenceUrl: 'https://fixture.example.test/locations/main-st',
        attested: true,
      }),
      /Invalid decision/
    );
  });
});

test('rejects invalid candidate input', { skip: !url }, async () => {
  await withDatabase(async (db) => {
    await assert.rejects(
      storeAddressReviewCandidate(db, {
        ...baseCandidate(),
        addresses: [],
        decision: needsHumanDecision(),
      }),
      /Invalid addresses/
    );
  });
});
