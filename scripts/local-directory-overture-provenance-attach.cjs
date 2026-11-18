#!/usr/bin/env node
/**
 * Owner-run, manual, no network: attach minimal source provenance
 * (`dataset`, `license`, `property`) to served private rows that were staged
 * without it, so the rights queue can derive cases from `listing.sources`.
 *
 * Provenance is read from the October contact capture in the stage database,
 * which re-read the same pinned assets with the same region manifest and the
 * same `(regionId, sourceFileRowNumber)` numbering. A live row is matched on
 * that key and must also carry the same name; anything else is skipped and
 * counted. Scan ids, policies, bindings and carries are untouched: only the
 * `sources` key is added to `listing`, and only where it is absent.
 *
 *   --check (default)                  plan and report; writes nothing
 *   --apply --confirm-database <db>    write in one transaction
 *   --record <file>                    with --apply, write touched keys (for rollback)
 *   --rollback <file> --confirm-database <db>
 *                                      remove `sources` from the recorded rows
 *
 * Usage:
 *   LOCAL_DIRECTORY_DATABASE_URL=... \
 *   TS_NODE_PROJECT=apps/directory/tsconfig.json node -r ts-node/register/transpile-only \
 *     scripts/local-directory-overture-provenance-attach.cjs \
 *       --contact-stage <url> --contact-policy <sha256> [--apply --confirm-database ot_directory --record out.json]
 */
const fs = require('node:fs');

const rowKey = (regionId, row) => `${regionId}|${String(row)}`;
const normalize = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

/** Keep only well-formed `{dataset, license, property?}` entries. */
function minimalSources(sources) {
  if (!Array.isArray(sources)) return [];
  const out = [];
  for (const entry of sources) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.dataset !== 'string' || !entry.dataset) continue;
    if (typeof entry.license !== 'string' || !entry.license) continue;
    const item = { dataset: entry.dataset, license: entry.license };
    if (typeof entry.property === 'string') item.property = entry.property;
    out.push(item);
  }
  return out;
}

/**
 * Pure planner. `stageRows` and `liveRows` are `{regionId, sourceFileRowNumber,
 * listing}` (live rows also carry `scanId`). Returns the updates and a summary.
 */
function planProvenanceAttach(stageRows, liveRows) {
  const stage = new Map();
  const duplicateStage = new Set();
  for (const row of stageRows) {
    if (!row.regionId) continue;
    const key = rowKey(row.regionId, row.sourceFileRowNumber);
    if (stage.has(key)) duplicateStage.add(key);
    else stage.set(key, row.listing || {});
  }
  const summary = {
    stageRows: stageRows.length,
    liveRows: liveRows.length,
    matched: 0,
    alreadyHasSources: 0,
    skippedNoRegion: 0,
    skippedNoStageRow: 0,
    skippedAmbiguousStage: 0,
    skippedNameMismatch: 0,
    skippedEmptySources: 0,
    lineages: {},
  };
  const updates = [];
  for (const row of liveRows) {
    const listing = row.listing || {};
    if (Object.prototype.hasOwnProperty.call(listing, 'sources')) {
      summary.alreadyHasSources += 1;
      continue;
    }
    if (!row.regionId) {
      summary.skippedNoRegion += 1;
      continue;
    }
    const key = rowKey(row.regionId, row.sourceFileRowNumber);
    if (duplicateStage.has(key)) {
      summary.skippedAmbiguousStage += 1;
      continue;
    }
    const staged = stage.get(key);
    if (!staged) {
      summary.skippedNoStageRow += 1;
      continue;
    }
    if (normalize(staged.name) !== normalize(listing.name)) {
      summary.skippedNameMismatch += 1;
      continue;
    }
    const sources = minimalSources(staged.sources);
    if (!sources.length) {
      summary.skippedEmptySources += 1;
      continue;
    }
    summary.matched += 1;
    for (const s of sources) {
      const lineage = `${s.dataset}|${s.license}|${s.property ?? ''}`;
      summary.lineages[lineage] = (summary.lineages[lineage] || 0) + 1;
    }
    updates.push({
      scanId: row.scanId,
      sourceFileRowNumber: String(row.sourceFileRowNumber),
      sources,
    });
  }
  return { updates, summary };
}

const ACTIVE_ROWS = `SELECT r."scanId", r."sourceFileRowNumber", r."regionId", r.listing
  FROM "directory_overture_private_row" r
  JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId"
  JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" AND p.revoked=false
  JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
  WHERE r.listing IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_revocation" x WHERE x."scanId"=r."scanId")
    AND NOT EXISTS (SELECT 1 FROM "directory_overture_private_row_revocation" x WHERE x."scanId"=r."scanId" AND x."sourceFileRowNumber"=r."sourceFileRowNumber")`;

const STAGE_ROWS = `SELECT r."regionId", r."sourceFileRowNumber", r.listing
  FROM "directory_overture_private_row" r
  JOIN "directory_overture_private_membership" m ON m."scanId"=r."scanId"
  JOIN "directory_overture_private_policy" p ON p."policyId"=m."policyId" AND p.revoked=false
  JOIN "directory_overture_private_completion" c ON c."scanId"=r."scanId"
  WHERE m."policyId"=$1 AND r.listing ? 'sources'`;

async function main(argv, env) {
  const { DataSource } = require('typeorm');
  const value = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : '';
  };
  const flag = (name) => argv.includes(name);
  const liveUrl = env.LOCAL_DIRECTORY_DATABASE_URL;
  if (!liveUrl) throw new Error('LOCAL_DIRECTORY_DATABASE_URL is required');
  const confirm = value('--confirm-database');
  const rollbackFile = value('--rollback');
  const apply = flag('--apply');
  const live = new DataSource({ type: 'postgres', url: liveUrl });
  await live.initialize();
  try {
    const [{ db }] = await live.query('SELECT current_database() AS db');
    if ((apply || rollbackFile) && confirm !== db) {
      throw new Error(`--confirm-database must name the target (${db})`);
    }
    if (rollbackFile) {
      const recorded = JSON.parse(fs.readFileSync(rollbackFile, 'utf8'));
      const result = await live.transaction((q) =>
        q.query(
          `UPDATE "directory_overture_private_row" r SET listing = r.listing - 'sources'
           FROM unnest($1::text[], $2::bigint[]) AS k("scanId", row)
           WHERE r."scanId"=k."scanId" AND r."sourceFileRowNumber"=k.row`,
          [recorded.keys.map((k) => k[0]), recorded.keys.map((k) => k[1])]
        )
      );
      console.log(JSON.stringify({ rolledBack: result[1] ?? null, db }));
      return;
    }
    const contactStage = value('--contact-stage');
    const contactPolicy = value('--contact-policy');
    if (!contactStage || !/^[0-9a-f]{64}$/.test(contactPolicy)) {
      throw new Error(
        '--contact-stage <url> and --contact-policy <sha256> are required'
      );
    }
    const stage = new DataSource({ type: 'postgres', url: contactStage });
    await stage.initialize();
    let stageRows;
    try {
      stageRows = await stage.query(STAGE_ROWS, [contactPolicy]);
    } finally {
      await stage.destroy();
    }
    const liveRows = await live.query(ACTIVE_ROWS);
    const { updates, summary } = planProvenanceAttach(stageRows, liveRows);
    let written = 0;
    if (apply) {
      await live.transaction(async (q) => {
        const size = 5000;
        for (let i = 0; i < updates.length; i += size) {
          const chunk = updates.slice(i, i + size);
          const result = await q.query(
            `UPDATE "directory_overture_private_row" r
             SET listing = r.listing || jsonb_build_object('sources', k.sources)
             FROM unnest($1::text[], $2::bigint[], $3::jsonb[]) AS k("scanId", row, sources)
             WHERE r."scanId"=k."scanId" AND r."sourceFileRowNumber"=k.row
               AND NOT (r.listing ? 'sources')`,
            [
              chunk.map((u) => u.scanId),
              chunk.map((u) => u.sourceFileRowNumber),
              chunk.map((u) => JSON.stringify(u.sources)),
            ]
          );
          written += Number(result[1] ?? 0);
        }
      });
      const record = value('--record');
      if (record) {
        fs.writeFileSync(
          record,
          JSON.stringify({
            db,
            contactPolicy,
            keys: updates.map((u) => [u.scanId, u.sourceFileRowNumber]),
          })
        );
      }
    }
    console.log(
      JSON.stringify(
        { db, mode: apply ? 'apply' : 'check', written, ...summary },
        null,
        2
      )
    );
  } finally {
    await live.destroy();
  }
}

module.exports = { planProvenanceAttach, minimalSources };

if (require.main === module) {
  main(process.argv.slice(2), process.env).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
