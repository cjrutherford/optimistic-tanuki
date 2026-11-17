#!/usr/bin/env node
/**
 * Read-only source-freshness report for completed Overture scans.
 *
 * Usage:
 *   DIRECTORY_DATABASE_URL=... TS_NODE_PROJECT=apps/directory/tsconfig.json \
 *     node -r ts-node/register/transpile-only \
 *     scripts/local-directory-source-freshness-report.cjs [--fail-on due|stale|unknown]
 *
 * Prints one JSON document. Per scan: release, upstream Last-Modified (U),
 * recorded time (R), age in days, state, whether the evidence hash verifies,
 * and active reviewed bindings. Exits 2 when any scan is at or beyond the
 * --fail-on severity (unknown > stale > due). Never writes.
 */
const { DataSource } = require('typeorm');
const { scanFreshness, evidenceHashMatches, freshnessCounts } = require('../apps/directory/src/source-freshness');

const args = process.argv.slice(2);
const flag = args.indexOf('--fail-on');
const failOn = flag >= 0 ? args[flag + 1] : '';
if (failOn && !['due', 'stale', 'unknown'].includes(failOn)) {
  console.error('--fail-on must be due, stale or unknown');
  process.exit(1);
}
const databaseUrl = process.env.DIRECTORY_DATABASE_URL;
if (!databaseUrl) {
  console.error('DIRECTORY_DATABASE_URL is required');
  process.exit(1);
}
const rank = { fresh: 0, due: 1, stale: 2, unknown: 3 };
const DAY = 86400000;

(async () => {
  const db = new DataSource({ type: 'postgres', url: databaseUrl });
  await db.initialize();
  try {
    const rows = await db.query(`SELECT c."scanId" AS "completedScanId", e."scanId", e."evidenceVersion", e.kind, e."releaseId", e."artifactUrl", e."artifactEtag", e."artifactBytes", e."upstreamLastModified", e."observedAt", e."recordedAt", e.recorder, e."inventorySha256", e."evidenceSha256",
        (SELECT count(*)::int FROM directory_reviewed_binding b WHERE b."scanId"=c."scanId" AND b.state='active') AS "activeBindings",
        (SELECT count(*)::int FROM directory_reviewed_binding b WHERE b."scanId"=c."scanId" AND b.state<>'active') AS "inactiveBindings",
        EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=c."scanId") AS revoked
      FROM directory_overture_private_completion c
      LEFT JOIN directory_overture_source_evidence e ON e."scanId"=c."scanId"
      ORDER BY c."scanId"`);
    const now = new Date();
    const scans = rows.map((row) => {
      const evidence = row.scanId ? row : null;
      const state = scanFreshness(evidence, now);
      const modified = evidence?.upstreamLastModified ? new Date(evidence.upstreamLastModified) : null;
      return {
        scanId: row.completedScanId,
        revoked: row.revoked,
        releaseId: evidence?.releaseId ?? null,
        kind: evidence?.kind ?? null,
        upstreamLastModified: modified ? modified.toISOString() : null,
        recordedAt: evidence?.recordedAt ? new Date(evidence.recordedAt).toISOString() : null,
        ageDays: modified ? Math.floor((now.getTime() - modified.getTime()) / DAY) : null,
        evidenceHashVerified: evidence ? evidenceHashMatches(evidence) : null,
        state,
        activeBindings: row.activeBindings,
        inactiveBindings: row.inactiveBindings,
      };
    });
    const live = scans.filter((scan) => !scan.revoked);
    const counts = freshnessCounts(rows.filter((row) => !row.revoked).map((row) => (row.scanId ? row : null)), now);
    console.log(JSON.stringify({ evaluatedAt: now.toISOString(), thresholds: { freshDays: 90, staleDays: 120 }, counts, scans }, null, 2));
    if (failOn && live.some((scan) => rank[scan.state] >= rank[failOn])) process.exitCode = 2;
  } finally {
    await db.destroy();
  }
})().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
