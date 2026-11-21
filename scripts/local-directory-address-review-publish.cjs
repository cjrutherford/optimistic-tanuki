#!/usr/bin/env node
/**
 * Policy-gated publication for approved address-review candidates.
 *
 * Dry-run by default. Applying requires an explicit runtime public-display
 * policy and writes through OverturePrivateSink.attachLocalReviewedFields.
 *
 * Usage:
 *   DIRECTORY_REVIEW_DATABASE_URL=... \
 *     TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only scripts/local-directory-address-review-publish.cjs \
 *     --limit 10
 *
 * Applying:
 *   ... --apply --policy /path/to/public-display-policy.json
 */
const fs = require('node:fs');
const readline = require('node:readline');
const { DataSource } = require('typeorm');
const {
  findActivePrivateRow,
  publishAddressReviewCandidate,
} = require('../apps/directory/src/address-review-publish');
const {
  reviewedBindingKeyFromEnv,
} = require('../apps/directory/src/reviewed-binding');
const {
  projectPublicOverture,
} = require('../apps/directory/src/overture-public-projection');
const {
  buildUniqueContactStageMap,
  contactListingKey,
  contactMatchesCandidate,
  readContactListingRows,
} = require('./local-directory-contact-listings.cjs');

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
const policyPath = value(
  '--policy',
  process.env.DIRECTORY_PUBLIC_DISPLAY_POLICY || ''
);
const reviewer = value('--reviewer', '');
const limit = Number(value('--limit', '10'));
const communityId = value('--community', '');
const releaseId = value('--release', '');
const apply = flag('--apply');
// --skip-file: one candidate id per line, left out of the selection; failed ids are appended to it, so a
// candidate that cannot publish (stale assignment, unreadable stage row) does not take a slot on every pass.
const skipFile = value('--skip-file', '');
const skipIds = new Set(
  skipFile && fs.existsSync(skipFile)
    ? fs.readFileSync(skipFile, 'utf8').split('\n').filter(Boolean)
    : []
);
const databaseUrl = process.env.DIRECTORY_REVIEW_DATABASE_URL;

// The pause on --apply is lifted (owner D11/D12): the publisher keeps its own source-identity, containment,
// withdrawal and quality gates, and D12 candidates are published on an exact Census geocode alone.
if (!databaseUrl) {
  console.error(
    'DIRECTORY_REVIEW_DATABASE_URL is required. Point it at the database that owns the private review rows.'
  );
  process.exit(1);
}
if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5000) {
  console.error('--limit must be between 1 and 5000');
  process.exit(1);
}
if (apply && !policyPath) {
  console.error('--policy is required when --apply is set');
  process.exit(1);
}
if (
  communityId &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    communityId
  )
) {
  console.error('--community must be a UUID');
  process.exit(1);
}
let policy = null;
if (policyPath) {
  try {
    policy = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
    // A rights-policy file may hold several releases; --release picks one (default: the last).
    if (Array.isArray(policy))
      policy =
        (releaseId && policy.find((p) => p?.releaseId === releaseId)) ||
        (releaseId ? null : policy[policy.length - 1]);
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
if (
  reviewer &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    reviewer
  )
) {
  console.error('--reviewer must be a UUID');
  process.exit(1);
}
if (contactMode && !/^[a-f0-9]{64}$/.test(contactPolicy)) {
  console.error('--contact-policy must be a 64-character sha256 policy id');
  process.exit(1);
}

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

async function latestApprover(db, candidateId) {
  const rows = await db.query(
    `SELECT "actorId","evidenceUrl" FROM "directory_address_review_decision"
     WHERE "candidateId"=$1 AND "actorKind"='human' AND "decision"='approve'
     ORDER BY "createdAt" DESC LIMIT 1`,
    [candidateId]
  );
  return rows[0] || null;
}

/** The stage's own installation id, or an operator label; a stage with neither is refused at apply. */
async function readStageInstallationId(stage) {
  try {
    const rows = await stage.query(
      'SELECT "id" FROM "directory_installation" ORDER BY "createdAt" LIMIT 2'
    );
    if (rows.length === 1 && rows[0].id) return String(rows[0].id);
  } catch {
    // A stage without the table falls back to the operator label.
  }
  return (process.env.DIRECTORY_CONTACT_STAGE_LABEL || '').trim() || null;
}

async function readContactListings(url, candidates) {
  const stage = new DataSource({ type: 'postgres', url });
  await stage.initialize();
  try {
    const rows = await readContactListingRows(stage, contactPolicy, candidates);
    return {
      stageRows: buildUniqueContactStageMap(rows),
      installationId: await readStageInstallationId(stage),
    };
  } finally {
    await stage.destroy();
  }
}

function sourceFromContact(candidate, listing) {
  const coordinates = [candidate.point?.lng, candidate.point?.lat];
  if (!coordinates.every(Number.isFinite)) {
    throw Error('Candidate point is incomplete');
  }
  return {
    releaseId: policy.releaseId,
    sources: Array.isArray(listing.sources) ? listing.sources : [],
    names: { primary: candidate.name },
    basic_category: candidate.category,
    taxonomy: {
      primary: candidate.category,
      hierarchy: [candidate.category],
    },
    geometry: { type: 'Point', coordinates },
    addresses:
      candidate.addresses && candidate.addresses.length
        ? [{ freeform: candidate.addresses[0] }]
        : [],
    websites:
      candidate.websites && candidate.websites.length
        ? [candidate.websites[0]]
        : [],
    phones:
      candidate.phones && candidate.phones.length ? [candidate.phones[0]] : [],
  };
}

(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  try {
    const candidates = await db.query(
      `SELECT * FROM "directory_address_review_candidate"
       WHERE "status" IN ('approved','auto_approved')
         AND ($2::uuid IS NULL OR "communityId"=$2)
         AND NOT ("id"::text = ANY($3::text[]))
       ORDER BY "updatedAt" ASC, "id"
       LIMIT $1`,
      [limit, communityId || null, [...skipIds]]
    );
    if (!candidates.length) {
      console.log(
        JSON.stringify({
          processed: 0,
          message: 'No approved candidates are ready for publication',
          apply,
        })
      );
      return;
    }
    const sourceRows = await readSourceRows(
      source,
      new Set(candidates.map((row) => String(row.sourceFileRowNumber)))
    );
    const contact = contactMode
      ? await readContactListings(contactStage, candidates)
      : null;
    const contactListings = contact ? contact.stageRows : null;
    let bindingKey = null;
    if (apply) {
      bindingKey = reviewedBindingKeyFromEnv();
      if (contactMode && !contact.installationId) {
        throw Error(
          'The contact stage has no installation id; set DIRECTORY_CONTACT_STAGE_LABEL to identify it'
        );
      }
    }
    const summary = {
      processed: 0,
      resolvedActiveRow: 0,
      missingActiveRow: 0,
      missingSourceRow: 0,
      sourceMismatch: 0,
      rightsEligible: 0,
      rightsBlocked: 0,
      published: 0,
      failed: 0,
      failures: {},
      samples: [],
    };

    for (const candidate of candidates) {
      summary.processed += 1;
      let sourceRow;
      let stageRow = null;
      if (contactMode) {
        stageRow = contactListings.get(
          contactListingKey(
            candidate.communityId,
            candidate.sourceFileRowNumber
          )
        );
        if (!stageRow) {
          summary.missingSourceRow += 1;
          continue;
        }
        if (!contactMatchesCandidate(candidate, stageRow.listing)) {
          summary.sourceMismatch += 1;
          continue;
        }
        sourceRow = sourceFromContact(candidate, stageRow.listing);
      } else {
        sourceRow = sourceRows.get(String(candidate.sourceFileRowNumber));
        if (!sourceRow) {
          summary.missingSourceRow += 1;
          continue;
        }
      }
      let active = null;
      try {
        active = await findActivePrivateRow(db, {
          communityId: candidate.communityId,
          name: candidate.name,
          category: candidate.category,
          point: candidate.point,
        });
        summary.resolvedActiveRow += 1;
      } catch {
        summary.missingActiveRow += 1;
        continue;
      }
      const sourceForPublication = policy
        ? { ...sourceRow, releaseId: policy.releaseId }
        : sourceRow;
      if (policy) {
        const rights = projectPublicOverture(
          sourceForPublication,
          {
            residential: false,
            sensitive: false,
            adult: false,
            addressVerified: true,
            websiteVerified: candidate.officialEvidence?.websiteMatch === true,
            phoneVerified: candidate.officialEvidence?.phoneMatch === true,
          },
          policy,
          false
        );
        if (rights.status !== 'eligible') {
          summary.rightsBlocked += 1;
          continue;
        }
        summary.rightsEligible += 1;
      } else {
        summary.rightsBlocked += 1;
        continue;
      }
      if (summary.samples.length < 5) {
        summary.samples.push({
          id: candidate.id,
          name: candidate.name,
          sourceRow: candidate.sourceFileRowNumber,
          activeScan: active.scanId,
          activeRow: active.sourceFileRowNumber,
          apply,
        });
      }
      if (!apply) continue;
      const humanApproval =
        candidate.status === 'approved'
          ? await latestApprover(db, candidate.id)
          : null;
      const actorId = humanApproval?.actorId || reviewer || null;
      if (!actorId) {
        summary.failed += 1;
        continue;
      }
      try {
        await publishAddressReviewCandidate(db, {
          candidateId: candidate.id,
          source: sourceForPublication,
          policy,
          actorId,
          actorKind: candidate.status === 'auto_approved' ? 'auto' : 'human',
          humanEvidenceUrl: humanApproval?.evidenceUrl || undefined,
          sourceBinding: contactMode
            ? {
                provenance: 'contact_stage',
                key: bindingKey,
                stageInstallationId: contact.installationId,
                stage: stageRow,
              }
            : {
                provenance: 'source_file',
                key: bindingKey,
                fileRow: sourceRow,
              },
        });
        summary.published += 1;
      } catch (error) {
        summary.failed += 1;
        const why = String(error?.message || error).slice(0, 80);
        summary.failures[why] = (summary.failures[why] || 0) + 1;
        if (skipFile) fs.appendFileSync(skipFile, candidate.id + '\n');
      }
    }

    console.log(
      JSON.stringify(
        {
          source: contactMode
            ? 'contact-stage:' +
              (process.env.DIRECTORY_CONTACT_STAGE_LABEL || 'unlabelled')
            : source,
          limit,
          apply,
          policy: policy ? policy.releaseId : null,
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
