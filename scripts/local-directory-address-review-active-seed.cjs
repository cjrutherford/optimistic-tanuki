#!/usr/bin/env node
/**
 * Seed address-review candidates.
 *
 * Two sources are supported:
 *
 * 1. `--source <jsonl>` (default): the retained September four-seat artifact.
 *    Matches the four pilot towns by seat, name and point.
 * 2. `--contact-stage <url> --contact-policy <sha256>`: the October
 *    contact-retaining stage capture. Matches every active private row by
 *    `(regionId, sourceFileRowNumber)`, which is stable across captures of the
 *    same pinned asset.
 *
 * Writes only private review candidates and never publishes.
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

const defaultSource =
  '/home/cjrutherford/workspace/business-directory-poc/data/providers/overture/2026-09-23.0/four-seat-places.jsonl';
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const flag = (name) => args.includes(name);
const source = value('--source', defaultSource);
const contactStage = value(
  '--contact-stage',
  process.env.DIRECTORY_CONTACT_STAGE_DATABASE_URL || ''
);
const contactPolicy = value(
  '--contact-policy',
  process.env.DIRECTORY_CONTACT_POLICY || ''
);
const contactMode = Boolean(contactStage);
const activePolicy = value(
  '--active-policy',
  process.env.DIRECTORY_ACTIVE_POLICY || ''
);
const limit = Number(value('--limit', contactMode ? '200000' : '100'));
const refresh = flag('--refresh');
const policyPath = value(
  '--policy',
  process.env.DIRECTORY_PUBLIC_DISPLAY_POLICY || ''
);
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;
if (!databaseUrl) {
  console.error('DIRECTORY_REVIEW_DATABASE_URL is required');
  process.exit(1);
}
const maxLimit = contactMode ? 250000 : 5000;
if (!Number.isSafeInteger(limit) || limit < 1 || limit > maxLimit) {
  console.error(`--limit must be between 1 and ${maxLimit}`);
  process.exit(1);
}
if (contactMode && !/^[a-f0-9]{64}$/.test(contactPolicy)) {
  console.error('--contact-policy must be a 64-character sha256 policy id');
  process.exit(1);
}
if (activePolicy && !/^[a-f0-9]{64}$/.test(activePolicy)) {
  console.error('--active-policy must be a 64-character sha256 policy id');
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

const normalize = (value) =>
  typeof value === 'string'
    ? value.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';
const cleanStrings = (value) =>
  Array.isArray(value)
    ? value
        .filter(
          (entry) =>
            typeof entry === 'string' &&
            entry.trim().length > 0 &&
            entry.length <= 2048
        )
        .slice(0, 50)
    : [];
const rowNumberKey = (regionId, row) => `${regionId}|${String(row)}`;
const identityKey = (regionId, name, category, point) =>
  `${regionId}|${normalize(name)}|${normalize(category)}|${Number(
    point.lat
  ).toFixed(5)}|${Number(point.lng).toFixed(5)}`;

async function readArtifact(path) {
  const rows = new Map();
  const reader = readline.createInterface({
    input: fs.createReadStream(path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of reader) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const seat = normalize(row.assignedSeatId);
    const coordinates = row.geometry?.coordinates;
    if (
      !seat ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite)
    ) {
      continue;
    }
    const key = `${seat}|${normalize(
      row.names?.primary
    )}|${coordinates[1].toFixed(5)}|${coordinates[0].toFixed(5)}`;
    if (!rows.has(key)) rows.set(key, row);
  }
  return rows;
}

function activeRowsQuery(regionIds, excludePolicy, onlyPolicy) {
  const conditions = [
    'p.revoked=false',
    'c."scanId" IS NOT NULL',
    'NOT EXISTS (SELECT 1 FROM "directory_overture_private_revocation" x WHERE x."scanId"=r."scanId")',
    'NOT EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")',
    'r.listing IS NOT NULL',
  ];
  const params = [];
  if (regionIds) {
    params.push(regionIds);
    conditions.push(`r."regionId" = ANY($${params.length}::text[])`);
  }
  if (excludePolicy) {
    params.push(excludePolicy);
    conditions.push(`m."policyId" <> $${params.length}`);
  }
  if (onlyPolicy) {
    params.push(onlyPolicy);
    conditions.push(`m."policyId" = $${params.length}`);
  }
  return {
    sql: `SELECT r."scanId",r."sourceFileRowNumber",r."regionId",r.listing
      FROM "directory_overture_private_row" r
      JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId"
      JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId"
      JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY r."scanId",r."sourceFileRowNumber"`,
    params,
  };
}

async function readContacts(url) {
  const stage = new DataSource({ type: 'postgres', url });
  await stage.initialize();
  try {
    const rows = await stage.query(
      `SELECT r."regionId", r."sourceFileRowNumber", r.listing
       FROM "directory_overture_private_row" r
       JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId"
       JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId"
       JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
       WHERE m."policyId"=$1 AND p.revoked=false AND r.listing IS NOT NULL
         AND (r.listing ? 'addresses' OR r.listing ? 'websites' OR r.listing ? 'phones')`,
      [contactPolicy]
    );
    const contacts = new Map();
    for (const row of rows) {
      const key = rowNumberKey(row.regionId, row.sourceFileRowNumber);
      if (!contacts.has(key)) contacts.set(key, row.listing);
    }
    return contacts;
  } finally {
    await stage.destroy();
  }
}

async function existingCandidates(db) {
  const rows = await db.query(
    'SELECT "scanId","sourceFileRowNumber","communityId","name","category","point" FROM "directory_address_review_candidate"'
  );
  const scanKeys = new Set();
  const identityKeys = new Set();
  for (const row of rows) {
    scanKeys.add(rowNumberKey(row.scanId, row.sourceFileRowNumber));
    const point = row.point;
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
      identityKeys.add(
        identityKey(row.communityId, row.name, row.category, point)
      );
    }
  }
  return { scanKeys, identityKeys };
}

function rightsFor(sources) {
  if (!policy) return 'review';
  const decision = evaluateOvertureFieldRights(
    { sources, releaseId: policy.releaseId },
    'publicDisplay',
    policy
  );
  return decision.fields.address.status === 'eligible'
    ? 'eligible'
    : decision.fields.address.status === 'review'
    ? 'review'
    : 'denied';
}

async function seedContactCohort(db, summary) {
  const contacts = await readContacts(contactStage);
  const activeQuery = activeRowsQuery(null, contactPolicy, activePolicy);
  const active = await db.query(activeQuery.sql, activeQuery.params);
  summary.contactRows = contacts.size;
  summary.activeRows = active.length;
  const existing = refresh
    ? { scanKeys: new Set(), identityKeys: new Set() }
    : await existingCandidates(db);

  for (const row of active) {
    if (summary.imported >= limit) break;
    const key = rowNumberKey(row.regionId, row.sourceFileRowNumber);
    const listing = row.listing;
    if (
      existing.scanKeys.has(rowNumberKey(row.scanId, row.sourceFileRowNumber))
    ) {
      summary.skippedExisting += 1;
      continue;
    }
    const contact = contacts.get(key);
    if (!contact) {
      summary.skippedNoContact += 1;
      continue;
    }
    summary.matched += 1;
    const addresses = [...new Set(cleanStrings(contact.addresses))];
    if (!addresses.length) {
      summary.skippedNoAddress += 1;
      continue;
    }
    const coordinates = listing?.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
      summary.skippedInvalidPoint += 1;
      continue;
    }
    const name =
      typeof listing.name === 'string' && listing.name.trim()
        ? listing.name
        : 'unknown';
    const category =
      typeof listing.category === 'string' && listing.category.trim()
        ? listing.category
        : 'unknown';
    const websites = cleanStrings(contact.websites);
    const phones = cleanStrings(contact.phones);
    const sources = Array.isArray(contact.sources) ? contact.sources : [];
    const risk = classifyAddressRisk({
      name,
      category,
      taxonomy: [category],
      assignedCategoryIds: [],
      address: addresses[0],
    });
    const rights = rightsFor(sources);
    const candidate = {
      sourceRow: Number(row.sourceFileRowNumber),
      name,
      category,
      point: { lat: coordinates[1], lng: coordinates[0] },
      addresses,
      websites,
      phones,
      rights,
      residential: risk.residential,
      sensitive: risk.sensitive,
      adult: risk.adult,
    };
    const identity = identityKey(row.regionId, name, category, candidate.point);
    if (existing.identityKeys.has(identity)) {
      summary.skippedDuplicateIdentity += 1;
      continue;
    }
    const decision = decideAddressReview({
      candidate,
      geocode: null,
      official: null,
    });
    await storeAddressReviewCandidate(db, {
      communityId: row.regionId,
      scanId: row.scanId,
      sourceRow: candidate.sourceRow,
      name,
      category,
      point: candidate.point,
      addresses,
      websites,
      phones,
      rights,
      risk: {
        residential: risk.residential,
        sensitive: risk.sensitive,
        adult: risk.adult,
      },
      geocode: null,
      officialEvidence: null,
      decision,
    });
    existing.identityKeys.add(identity);
    summary.imported += 1;
    summary.towns.add(row.regionId);
    if (decision.verdict === 'auto_approve') summary.autoApproved += 1;
    else if (decision.verdict === 'reject') summary.rejected += 1;
    else summary.needsHuman += 1;
    for (const reason of decision.reasons) {
      summary.reasons.set(reason, (summary.reasons.get(reason) || 0) + 1);
    }
  }
}

async function seedArtifactCohort(db, summary) {
  const towns = await db.query(
    `SELECT "communityId", slug FROM "directory_town"
     WHERE slug IN ('valdosta-ga','waycross-ga','tifton-ga','douglas-ga')`
  );
  if (towns.length !== 4) throw Error('Four pilot towns are required');
  const seatByTown = new Map();
  for (const town of towns) {
    seatByTown.set(town.communityId, String(town.slug).split('-')[0]);
  }
  const artifact = await readArtifact(source);
  const { sql, params } = activeRowsQuery(
    towns.map((town) => town.communityId),
    undefined,
    activePolicy
  );
  const activeRows = await db.query(sql, params);
  const existing = refresh
    ? { scanKeys: new Set(), identityKeys: new Set() }
    : await existingCandidates(db);
  const seen = new Set();
  summary.activeRows = activeRows.length;

  for (const active of activeRows) {
    if (summary.imported >= limit) break;
    if (
      existing.scanKeys.has(
        rowNumberKey(active.scanId, active.sourceFileRowNumber)
      )
    ) {
      summary.skippedExisting += 1;
      continue;
    }
    const seat = seatByTown.get(active.regionId);
    const coordinates = active.listing?.location?.coordinates;
    if (!seat || !Array.isArray(coordinates) || coordinates.length !== 2) {
      continue;
    }
    const key = `${seat}|${normalize(
      active.listing?.name
    )}|${coordinates[1].toFixed(5)}|${coordinates[0].toFixed(5)}`;
    const row = artifact.get(key);
    if (!row) {
      summary.skippedNoArtifact += 1;
      continue;
    }
    if (seen.has(row.sourceFileRowNumber)) {
      summary.skippedDuplicateArtifact += 1;
      continue;
    }
    seen.add(row.sourceFileRowNumber);
    summary.matched += 1;
    const addresses = [
      ...new Set(
        (row.addresses ?? [])
          .map((address) =>
            typeof address === 'string' ? address : address?.freeform
          )
          .filter((address) => typeof address === 'string' && address.trim())
          .map((address) => address.trim())
      ),
    ];
    if (!addresses.length) continue;
    const category = active.listing?.category || row.basic_category;
    const name = active.listing?.name || row.names?.primary;
    const risk = classifyAddressRisk({
      name,
      category,
      taxonomy: row.taxonomy?.hierarchy,
      assignedCategoryIds: row.assignedCategoryIds,
      address: addresses[0],
    });
    const rights = rightsFor(row.sources);
    const candidate = {
      sourceRow: row.sourceFileRowNumber,
      name,
      category,
      point: { lat: coordinates[1], lng: coordinates[0] },
      addresses,
      websites: cleanStrings(row.websites),
      phones: cleanStrings(row.phones),
      rights,
      residential: risk.residential,
      sensitive: risk.sensitive,
      adult: risk.adult,
    };
    const identity = identityKey(
      active.regionId,
      name,
      category,
      candidate.point
    );
    if (existing.identityKeys.has(identity)) {
      summary.skippedDuplicateIdentity += 1;
      continue;
    }
    const decision = decideAddressReview({
      candidate,
      geocode: null,
      official: null,
    });
    await storeAddressReviewCandidate(db, {
      communityId: active.regionId,
      scanId: active.scanId,
      sourceRow: Number(active.sourceFileRowNumber),
      name,
      category,
      point: candidate.point,
      addresses,
      websites: candidate.websites,
      phones: candidate.phones,
      rights,
      risk: {
        residential: risk.residential,
        sensitive: risk.sensitive,
        adult: risk.adult,
      },
      geocode: null,
      officialEvidence: null,
      decision,
    });
    existing.identityKeys.add(identity);
    summary.imported += 1;
    summary.towns.add(active.regionId);
    if (decision.verdict === 'auto_approve') summary.autoApproved += 1;
    else if (decision.verdict === 'reject') summary.rejected += 1;
    else summary.needsHuman += 1;
    for (const reason of decision.reasons) {
      summary.reasons.set(reason, (summary.reasons.get(reason) || 0) + 1);
    }
  }
}

(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  try {
    const summary = {
      mode: contactMode ? 'contact' : 'artifact',
      activeRows: 0,
      contactRows: 0,
      matched: 0,
      skippedExisting: 0,
      skippedDuplicateIdentity: 0,
      skippedNoArtifact: 0,
      skippedDuplicateArtifact: 0,
      skippedNoContact: 0,
      skippedNoAddress: 0,
      skippedInvalidPoint: 0,
      imported: 0,
      towns: new Set(),
      autoApproved: 0,
      needsHuman: 0,
      rejected: 0,
      reasons: new Map(),
    };
    if (contactMode) await seedContactCohort(db, summary);
    else await seedArtifactCohort(db, summary);
    console.log(
      JSON.stringify(
        {
          source: contactMode ? contactStage : source,
          contactPolicy: contactMode ? contactPolicy : null,
          limit,
          policy: policy ? policy.releaseId : null,
          ...summary,
          towns: summary.towns.size,
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
