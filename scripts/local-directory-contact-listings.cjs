const CONTACT_LISTING_SQL = `
  SELECT r."regionId", r."sourceFileRowNumber", r."scanId" AS "stageScanId",
         m."policyId" AS "stagePolicyId", r.listing,
         p.revoked AS "policyRevoked",
         EXISTS (
           SELECT 1 FROM "directory_overture_private_revocation" scan_revocation
           WHERE scan_revocation."scanId"=r."scanId"
         ) AS "scanRevoked",
         EXISTS (
           SELECT 1 FROM "directory_overture_private_row_revocation" row_revocation
           WHERE row_revocation."scanId"=r."scanId"
             AND row_revocation."sourceFileRowNumber"=r."sourceFileRowNumber"
         ) AS "rowRevoked"
  FROM "directory_overture_private_row" r
  JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId"
  JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId"
  JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
  WHERE m."policyId"=$1 AND r.listing IS NOT NULL
    AND (r."regionId", r."sourceFileRowNumber") IN (
      SELECT * FROM unnest($2::text[], $3::bigint[])
    )`;

const contactListingKey = (regionId, sourceFileRowNumber) =>
  `${regionId}|${String(sourceFileRowNumber)}`;

/** A unique key is not enough: its retained identity and reviewed fields must agree. */
function contactMatchesCandidate(candidate, listing) {
  const clean = (value) => (typeof value === 'string' ? value.trim() : '');
  const containsSingle = (reviewed, retained) =>
    Array.isArray(reviewed) &&
    reviewed.length === 1 &&
    clean(reviewed[0]) &&
    Array.isArray(retained) &&
    retained.some((value) => clean(value) === clean(reviewed[0]));
  const coords = listing?.location?.coordinates;
  if (
    !clean(candidate?.name) ||
    clean(candidate.name) !== clean(listing?.name) ||
    !clean(candidate?.category) ||
    clean(candidate.category) !== clean(listing?.category) ||
    listing?.location?.type !== 'Point' ||
    !Array.isArray(coords) ||
    coords.length !== 2 ||
    !coords.every(Number.isFinite) ||
    !Number.isFinite(candidate?.point?.lng) ||
    !Number.isFinite(candidate?.point?.lat) ||
    Math.abs(coords[0] - candidate.point.lng) >= 1e-6 ||
    Math.abs(coords[1] - candidate.point.lat) >= 1e-6 ||
    !containsSingle(candidate.addresses, listing.addresses)
  )
    return false;
  if (
    candidate.officialEvidence?.websiteMatch === true &&
    Array.isArray(candidate.websites) &&
    candidate.websites.length > 0 &&
    !containsSingle(candidate.websites, listing.websites)
  )
    return false;
  if (
    candidate.officialEvidence?.phoneMatch === true &&
    Array.isArray(candidate.phones) &&
    candidate.phones.length > 0 &&
    !containsSingle(candidate.phones, listing.phones)
  )
    return false;
  return true;
}

/** Rows whose key has exactly one stage record and no revocation of any kind. */
function uniqueUnrevokedContactRows(rows) {
  const counts = new Map();
  for (const row of rows) {
    const key = contactListingKey(row.regionId, row.sourceFileRowNumber);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const kept = new Map();
  for (const row of rows) {
    const key = contactListingKey(row.regionId, row.sourceFileRowNumber);
    if (
      counts.get(key) !== 1 ||
      row.policyRevoked !== false ||
      row.scanRevoked !== false ||
      row.rowRevoked !== false
    )
      continue;
    kept.set(key, row);
  }
  return kept;
}

/** Keep only source-row keys with exactly one contact-stage record. */
function buildUniqueContactListingMap(rows) {
  const listings = new Map();
  for (const [key, row] of uniqueUnrevokedContactRows(rows))
    listings.set(key, row.listing);
  return listings;
}

/**
 * Like buildUniqueContactListingMap, but keeps the stage row's own identity
 * (scan, row number, membership policy) so a publication can be bound to it.
 */
function buildUniqueContactStageMap(rows) {
  const stage = new Map();
  for (const [key, row] of uniqueUnrevokedContactRows(rows)) {
    stage.set(key, {
      listing: row.listing,
      scanId: row.stageScanId,
      sourceFileRowNumber: String(row.sourceFileRowNumber),
      policyId: row.stagePolicyId,
    });
  }
  return stage;
}

async function readContactListingRows(stage, policyId, candidates) {
  return stage.query(CONTACT_LISTING_SQL, [
    policyId,
    candidates.map((row) => row.communityId),
    candidates.map((row) => String(row.sourceFileRowNumber)),
  ]);
}

module.exports = {
  CONTACT_LISTING_SQL,
  buildUniqueContactListingMap,
  buildUniqueContactStageMap,
  contactListingKey,
  contactMatchesCandidate,
  readContactListingRows,
};
