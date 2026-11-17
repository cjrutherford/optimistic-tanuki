#!/usr/bin/env node
/**
 * Bounded address-evidence worker for the private review queue.
 *
 * It reads review candidates from DIRECTORY_REVIEW_DATABASE_URL, geocodes the
 * source address with the US Census Geocoder, fetches the first HTTPS official
 * page with robots.txt/rate-limit controls, runs the decision engine, and
 * updates the private candidate/decision rows. It never publishes a listing.
 *
 * Usage:
 *   DIRECTORY_REVIEW_DATABASE_URL=... \
 *     TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only scripts/local-directory-address-review-evidence.cjs \
 *     --limit 10
 *
 * To characterise a multi-town backlog without processing every row, pass
 * `--per-town 5`. The worker then selects up to five candidates per community
 * (ordered by creation time) instead of the first N overall.
 */
const fs = require('node:fs');
const readline = require('node:readline');
const { DataSource } = require('typeorm');
const {
  decideAddressReview,
  haversineMeters,
} = require('../apps/directory/src/address-review');
const {
  censusQuery,
  createRateLimiter,
  fetchOfficialPage,
  geocodeCensus,
} = require('../apps/directory/src/address-evidence');
const {
  updateAddressReviewEvidence,
} = require('../apps/directory/src/address-review-store');
const { classifyAddressRisk } = require('../apps/directory/src/address-risk');
const { evaluateOvertureFieldRights } = require('../apps/directory/src/overture-rights');

const defaultSource =
  '/home/cjrutherford/workspace/business-directory-poc/data/providers/overture/2026-09-23.0/four-seat-places.jsonl';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const source = value('--source', defaultSource);
const candidateId = value('--id', '');
const limit = Number(value('--limit', '10'));
const perTown = Number(value('--per-town', '0'));
const status = value('--status', 'needs_human');
const censusDelay = Number(value('--census-delay', '1200'));
const pageDelay = Number(value('--page-delay', '1500'));
const refresh = flag('--refresh');
const dryRun = flag('--dry-run');
const skipOfficial = flag('--no-official');
const policyPath = value('--policy', process.env.DIRECTORY_PUBLIC_DISPLAY_POLICY || '');
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;

if (!dryRun) {
  console.error('Address evidence writes are paused pending the auto-approval precision gate; use --dry-run.');
  process.exit(1);
}
if (!databaseUrl) {
  console.error(
    'DIRECTORY_REVIEW_DATABASE_URL is required. Do not point this at a public serving database.'
  );
  process.exit(1);
}
if (candidateId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidateId)) {
  console.error('--id must be a UUID');
  process.exit(1);
}
if (!Number.isSafeInteger(limit) || limit < 1 || limit > (perTown ? 5000 : 100)) {
  console.error(`--limit must be between 1 and ${perTown ? 5000 : 100}`);
  process.exit(1);
}
if (!Number.isSafeInteger(perTown) || perTown < 0 || perTown > 100) {
  console.error('--per-town must be between 0 and 100');
  process.exit(1);
}
if (!['needs_human', 'auto_approved', 'approved', 'published', 'rejected', 'revoked'].includes(status)) {
  console.error('--status is invalid');
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
    console.error('Policy must be a runtime OvertureRightsPolicy with publicDisplay enabled');
    process.exit(1);
  }
}
if (
  !Number.isFinite(censusDelay) ||
  !Number.isFinite(pageDelay) ||
  censusDelay < 0 ||
  pageDelay < 0
) {
  console.error('Delays must be non-negative milliseconds');
  process.exit(1);
}

const officialSource = (row, fallback) => {
  const websites = Array.isArray(row?.websites) ? row.websites : [];
  const phones = Array.isArray(row?.phones) ? row.phones : [];
  const address = row?.addresses?.[0];
  return {
    name: row?.names?.primary || fallback.name,
    address:
      typeof address?.freeform === 'string'
        ? address.freeform
        : fallback.addresses[0],
    phone: phones[0] || fallback.phones[0],
    website: websites.find(
      (url) => typeof url === 'string' && /^https?:\/\//.test(url)
    ),
  };
};

async function readSourceRows(path, rowNumbers) {
  const rows = new Map();
  if (!fs.existsSync(path)) return rows;
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
    const key = String(row.sourceFileRowNumber);
    if (rowNumbers.has(key)) rows.set(key, row);
  }
  return rows;
}

(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  try {
    const candidates = perTown
      ? await db.query(
          `SELECT * FROM (
             SELECT c.*, row_number() OVER (
               PARTITION BY c."communityId"
               ORDER BY c."createdAt" ASC, c."id"
             ) AS "townRank"
             FROM "directory_address_review_candidate" c
             WHERE ($1::uuid IS NULL OR c."id"=$1)
               AND c."status"=$2
               AND ($3::boolean OR c."geocode" IS NULL OR c."geocode"='null'::jsonb OR c."officialEvidence" IS NULL OR c."officialEvidence"='null'::jsonb)
           ) ranked
           WHERE ranked."townRank" <= $4
           ORDER BY ranked."communityId", ranked."townRank"
           LIMIT $5`,
          [candidateId || null, status, refresh, perTown, limit]
        )
      : await db.query(
          `SELECT * FROM "directory_address_review_candidate"
           WHERE ($1::uuid IS NULL OR "id"=$1) AND "status"=$2 AND ($3::boolean OR "geocode" IS NULL OR "geocode"='null'::jsonb OR "officialEvidence" IS NULL OR "officialEvidence"='null'::jsonb)
           ORDER BY "createdAt" ASC, "id"
           LIMIT $4`,
          [candidateId || null, status, refresh, limit]
        );
    if (!candidates.length) {
      console.log(JSON.stringify({ processed: 0, message: 'No candidates matched' }));
      return;
    }

    const sourceRows = await readSourceRows(
      source,
      new Set(candidates.map((row) => String(row.sourceFileRowNumber)))
    );
    const censusLimiter = createRateLimiter(censusDelay);
    const pageLimiter = createRateLimiter(pageDelay);
    const robotsCache = new Map();
    const summary = {
      processed: 0,
      autoApproved: 0,
      needsHuman: 0,
      rejected: 0,
      geocodeMatches: 0,
      geocodeMissing: 0,
      officialFetched: 0,
      officialBlocked: 0,
      officialUnavailable: 0,
      officialMissing: 0,
      samples: [],
    };

    for (const candidate of candidates) {
      const sourceRow = sourceRows.get(String(candidate.sourceFileRowNumber));
      const addresses = Array.isArray(candidate.addresses)
        ? candidate.addresses
        : [];
      const websites = Array.isArray(candidate.websites)
        ? candidate.websites
        : [];
      const phones = Array.isArray(candidate.phones) ? candidate.phones : [];
      const sourceAddress = sourceRow?.addresses?.[0] || {
        freeform: addresses[0],
        country: 'US',
      };
      const sourceWebsite = Array.isArray(sourceRow?.websites)
        ? sourceRow.websites.find(
            (url) => typeof url === 'string' && /^https?:\/\//.test(url)
          )
        : websites.find(
            (url) => typeof url === 'string' && /^https?:\/\//.test(url)
          );
      const sourcePhone = sourceRow?.phones?.[0] || phones[0];
      const sourceName = sourceRow?.names?.primary || candidate.name;
      const fallback = {
        name: sourceName,
        addresses,
        phones,
        websites,
      };
      const officialSourceInput = officialSource(sourceRow, fallback);

      let geocode =
        candidate.geocode && candidate.geocode.status
          ? candidate.geocode
          : null;
      if (!geocode || refresh) {
        if (censusQuery(sourceAddress)) {
          await censusLimiter();
          geocode = await geocodeCensus({ address: sourceAddress });
          if (
            geocode.status === 'match' &&
            geocode.coordinates &&
            candidate.point &&
            Number.isFinite(candidate.point.lat) &&
            Number.isFinite(candidate.point.lng)
          ) {
            geocode = {
              ...geocode,
              distanceMeters: haversineMeters(
                candidate.point,
                geocode.coordinates
              ),
            };
          }
        } else {
          geocode = null;
        }
      }
      if (geocode?.status === 'match') summary.geocodeMatches += 1;
      else summary.geocodeMissing += 1;

      let official =
        candidate.officialEvidence && candidate.officialEvidence.status
          ? candidate.officialEvidence
          : null;
      if (!official || refresh) {
        if (!skipOfficial && sourceWebsite) {
          await pageLimiter();
          official = await fetchOfficialPage({
            url: sourceWebsite,
            source: officialSourceInput,
            robotsCache,
          });
        } else if (!skipOfficial) {
          official = {
            url: '',
            status: 'unavailable',
            fetchedAt: new Date().toISOString(),
          };
        }
      }
      if (official?.status === 'fetched') summary.officialFetched += 1;
      else if (official?.status === 'blocked') summary.officialBlocked += 1;
      else if (official?.status === 'unavailable')
        summary.officialUnavailable += 1;
      else summary.officialMissing += 1;

      const riskClassification = classifyAddressRisk({
        name: sourceName,
        category: candidate.category,
        taxonomy: sourceRow?.taxonomy?.hierarchy,
        assignedCategoryIds: sourceRow?.assignedCategoryIds,
        address: sourceAddress?.freeform,
      });
      let rightsValue = candidate.rights;
      if (policy && sourceRow) {
        const rightsDecision = evaluateOvertureFieldRights(
          { ...sourceRow, releaseId: policy.releaseId },
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
      const decisionCandidate = {
        sourceRow: Number(candidate.sourceFileRowNumber),
        name: sourceName,
        category: candidate.category,
        point: candidate.point,
        addresses: addresses.length ? addresses : officialSourceInput.address ? [officialSourceInput.address] : [],
        websites: websites.length ? websites : sourceWebsite ? [sourceWebsite] : [],
        phones: phones.length ? phones : sourcePhone ? [sourcePhone] : [],
        rights: rightsValue,
        residential: riskClassification.residential,
        sensitive: riskClassification.sensitive,
        adult: riskClassification.adult,
      };
      const decision = decideAddressReview({
        candidate: decisionCandidate,
        geocode,
        official,
      });

      if (!dryRun) {
        await updateAddressReviewEvidence(db, {
          candidateId: candidate.id,
          geocode,
          officialEvidence: official,
          risk: {
            residential: riskClassification.residential,
            sensitive: riskClassification.sensitive,
            adult: riskClassification.adult,
          },
          rights: rightsValue,
          decision,
        });
      }

      summary.processed += 1;
      if (decision.verdict === 'auto_approve') summary.autoApproved += 1;
      else if (decision.verdict === 'reject') summary.rejected += 1;
      else summary.needsHuman += 1;
      if (summary.samples.length < 5) {
        summary.samples.push({
          id: candidate.id,
          name: sourceName,
          geocode: geocode?.status,
          distanceMeters: geocode?.distanceMeters ?? null,
          official: official?.status ?? null,
          verdict: decision.verdict,
          reasons: decision.reasons,
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          source,
          limit,
          perTown,
          status,
          refresh,
          dryRun,
          ...summary,
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
