#!/usr/bin/env node
/**
 * Local, private address-review candidate import.
 *
 * This writes only to a dedicated review database (DIRECTORY_REVIEW_DATABASE_URL).
 * It never writes to DIRECTORY_DATABASE_URL and never publishes a listing.
 *
 * Usage:
 *   DIRECTORY_REVIEW_DATABASE_URL=... \
 *     TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only scripts/local-directory-address-review-import.cjs \
 *     --limit 100
 */
const fs = require('node:fs');
const readline = require('node:readline');
const { DataSource } = require('typeorm');
const { decideAddressReview } = require('../apps/directory/src/address-review');
const {
  storeAddressReviewCandidate,
} = require('../apps/directory/src/address-review-store');
const { classifyAddressRisk } = require('../apps/directory/src/address-risk');
const {
  evaluateOvertureFieldRights,
} = require('../apps/directory/src/overture-rights');
const {
  findActivePrivateRow,
} = require('../apps/directory/src/address-review-publish');

const defaultSource =
  '/home/cjrutherford/workspace/business-directory-poc/data/providers/overture/2026-09-23.0/four-seat-places.jsonl';

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const source = value('--source', defaultSource);
const limit = Number(value('--limit', '100'));
const rights = value('--rights', 'review');
const policyPath = value(
  '--policy',
  process.env.DIRECTORY_PUBLIC_DISPLAY_POLICY || ''
);
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;

if (!databaseUrl) {
  console.error(
    'DIRECTORY_REVIEW_DATABASE_URL is required. Do not point this at the live DIRECTORY_DATABASE_URL.'
  );
  process.exit(1);
}
if (!Number.isSafeInteger(limit) || limit < 0 || limit > 10000) {
  console.error('--limit must be between 0 and 10000');
  process.exit(1);
}
if (!['review', 'eligible', 'denied'].includes(rights)) {
  console.error('--rights must be review, eligible or denied');
  process.exit(1);
}
let policy = null;
if (policyPath) {
  try {
    policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  } catch {
    console.error('Unable to read --policy');
    process.exit(1);
  }
  if (
    !policy ||
    typeof policy !== 'object' ||
    typeof policy.releaseId !== 'string' ||
    !policy.releaseId.trim() ||
    !policy.operations ||
    policy.operations.publicDisplay !== true ||
    !Array.isArray(policy.terms)
  ) {
    console.error(
      'Policy must be a runtime OvertureRightsPolicy with publicDisplay enabled'
    );
    process.exit(1);
  }
}
if (!fs.existsSync(source)) {
  console.error(`Source artifact not found: ${source}`);
  process.exit(1);
}

const text = (value) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
const array = (value) =>
  Array.isArray(value)
    ? value
        .map((entry) => (typeof entry === 'string' ? entry : entry?.freeform))
        .map(text)
        .filter(Boolean)
    : [];

(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  try {
    const towns = await db.query(
      'SELECT "communityId", slug FROM directory_town WHERE slug IS NOT NULL'
    );
    const townBySeat = new Map();
    for (const town of towns) {
      const seat = String(town.slug).split('-')[0];
      if (seat) townBySeat.set(seat, town.communityId);
    }
    if (townBySeat.size === 0) {
      throw Error(
        'Review database has no directory_town mappings; seed the review database first'
      );
    }

    const summary = {
      rows: 0,
      imported: 0,
      skippedNoTown: 0,
      skippedNoAddress: 0,
      skippedUnanchored: 0,
      autoApproved: 0,
      needsHuman: 0,
      rejected: 0,
      reasons: new Map(),
    };

    const reader = readline.createInterface({
      input: fs.createReadStream(source, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of reader) {
      if (limit > 0 && summary.rows >= limit) break;
      if (!line.trim()) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      summary.rows += 1;
      const seat = text(row.assignedSeatId);
      const communityId = seat ? townBySeat.get(seat) : null;
      if (!communityId) {
        summary.skippedNoTown += 1;
        continue;
      }
      const addresses = array(row.addresses);
      if (addresses.length === 0) {
        summary.skippedNoAddress += 1;
        continue;
      }
      const coordinates = row.geometry?.coordinates;
      if (
        row.geometry?.type !== 'Point' ||
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        !coordinates.every(Number.isFinite)
      ) {
        summary.rejected += 1;
        continue;
      }
      const [lng, lat] = coordinates;
      const name = text(row.names?.primary) || 'unknown';
      const category = text(row.basic_category) || 'unknown';
      const risk = classifyAddressRisk({
        name,
        category,
        taxonomy: row.taxonomy?.hierarchy,
        assignedCategoryIds: row.assignedCategoryIds,
        address: addresses[0],
      });
      let rightsValue = rights;
      if (policy) {
        const rightsDecision = evaluateOvertureFieldRights(
          { ...row, releaseId: policy.releaseId },
          'publicDisplay',
          policy
        );
        rightsValue =
          rightsDecision.fields.address.status === 'eligible'
            ? 'eligible'
            : rightsDecision.fields.address.status === 'review'
            ? 'review'
            : 'denied';
      }
      const candidate = {
        sourceRow: Number(row.sourceFileRowNumber),
        name,
        category,
        point: { lat, lng },
        addresses,
        websites: array(row.websites),
        phones: array(row.phones),
        rights: rightsValue,
        residential: risk.residential,
        sensitive: risk.sensitive,
        adult: risk.adult,
      };
      const decision = decideAddressReview({
        candidate,
        geocode: null,
        official: null,
      });
      let active;
      try {
        active = await findActivePrivateRow(db, {
          communityId,
          name: candidate.name,
          category: candidate.category,
          point: candidate.point,
        });
      } catch (error) {
        if (
          ![
            'No active private row matches this candidate',
            'Multiple active private rows match this candidate',
          ].includes(error.message)
        )
          throw error;
        summary.skippedUnanchored += 1;
        continue;
      }
      await storeAddressReviewCandidate(db, {
        communityId,
        scanId: active.scanId,
        sourceRow: Number(active.sourceFileRowNumber),
        name: candidate.name,
        category: candidate.category,
        point: candidate.point,
        addresses: candidate.addresses,
        websites: candidate.websites,
        phones: candidate.phones,
        rights: candidate.rights,
        risk: {
          residential: candidate.residential,
          sensitive: candidate.sensitive,
          adult: candidate.adult,
        },
        geocode: null,
        officialEvidence: null,
        decision,
      });
      summary.imported += 1;
      if (decision.verdict === 'auto_approve') summary.autoApproved += 1;
      else if (decision.verdict === 'reject') summary.rejected += 1;
      else summary.needsHuman += 1;
      for (const reason of decision.reasons) {
        summary.reasons.set(reason, (summary.reasons.get(reason) || 0) + 1);
      }
    }

    console.log(
      JSON.stringify(
        {
          source,
          limit: limit || null,
          rights,
          ...summary,
          reasons: [...summary.reasons.entries()].sort(
            (left, right) => right[1] - left[1]
          ),
        },
        null,
        2
      )
    );
  } finally {
    await db.destroy();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
