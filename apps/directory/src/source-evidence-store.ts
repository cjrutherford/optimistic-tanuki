import { EntityManager } from 'typeorm';
import {
  EVIDENCE_VERSION,
  EvidenceCore,
  evidenceHash,
  evidenceHashMatches,
  plausibleLastModified,
} from './source-freshness';

/** What a recorder supplies. scanId, version, hash and recordedAt are filled in here. */
export interface SourceEvidenceInput {
  kind: 'captured' | 'attached_verified';
  releaseId: string;
  artifactUrl: string;
  artifactEtag: string;
  artifactBytes: number | string | null;
  upstreamLastModified: Date | null;
  observedAt: Date | null;
  recorder: string;
  inventorySha256: string;
}

const COLUMNS =
  '"scanId","evidenceVersion","kind","releaseId","artifactUrl","artifactEtag","artifactBytes","upstreamLastModified","observedAt","recordedAt","recorder","inventorySha256","evidenceSha256"';

/**
 * The only writer of directory_overture_source_evidence. Insert-only: a second
 * writer with different evidence is an error, never an overwrite. Call inside the
 * transaction that records the scan completion (or the attach script's own).
 * Returns false (no row) when no input is supplied: evidence is never synthesised.
 */
export async function insertSourceEvidence(
  manager: EntityManager,
  scanId: string,
  input: SourceEvidenceInput | null | undefined
): Promise<boolean> {
  if (!input) return false;
  if (
    !/^[a-f0-9]{64}$/.test(scanId) ||
    !['captured', 'attached_verified'].includes(input.kind) ||
    !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(input.releaseId) ||
    typeof input.artifactUrl !== 'string' ||
    !input.artifactUrl ||
    !/^[A-Za-z0-9-]{1,100}$/.test(input.artifactEtag) ||
    typeof input.recorder !== 'string' ||
    !input.recorder ||
    input.recorder.length > 160 ||
    !/^[a-f0-9]{64}$/.test(input.inventorySha256)
  )
    throw Error('Invalid source evidence');
  const bytes =
    input.artifactBytes === null || input.artifactBytes === undefined
      ? null
      : String(input.artifactBytes);
  if (bytes !== null && !/^\d{1,15}$/.test(bytes))
    throw Error('Invalid source evidence');
  // The DB clock is the trusted one; a date it considers future is not evidence.
  const [{ now }] = await manager.query('SELECT now() AS now');
  const recordedAt: Date = now instanceof Date ? now : new Date(now);
  let modified = plausibleLastModified(
    input.upstreamLastModified,
    input.releaseId
  );
  if (modified && modified.getTime() > recordedAt.getTime()) modified = null;
  let observed = input.kind === 'captured' ? input.observedAt : null;
  if (
    observed &&
    (!Number.isFinite(observed.getTime()) ||
      observed.getTime() > recordedAt.getTime() + 5 * 60_000)
  )
    observed = null;
  const core: EvidenceCore = {
    scanId,
    evidenceVersion: EVIDENCE_VERSION,
    kind: input.kind,
    releaseId: input.releaseId,
    artifactUrl: input.artifactUrl,
    artifactEtag: input.artifactEtag,
    artifactBytes: bytes,
    upstreamLastModified: modified,
    observedAt: observed,
    recorder: input.recorder,
    inventorySha256: input.inventorySha256,
  };
  const hash = evidenceHash(core);
  await manager.query(
    `INSERT INTO directory_overture_source_evidence (${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT ("scanId") DO NOTHING`,
    [
      scanId,
      EVIDENCE_VERSION,
      core.kind,
      core.releaseId,
      core.artifactUrl,
      core.artifactEtag,
      bytes,
      modified,
      observed,
      recordedAt,
      core.recorder,
      core.inventorySha256,
      hash,
    ]
  );
  const [stored] = await manager.query(
    'SELECT "evidenceSha256" FROM directory_overture_source_evidence WHERE "scanId" = $1',
    [scanId]
  );
  if (!stored || stored.evidenceSha256 !== hash)
    throw Error('Source evidence already recorded with different content');
  return true;
}

/**
 * Cutover copy: carry verified stage evidence into the live DB, byte for byte
 * (recordedAt included). A row whose hash does not verify is NOT copied, so that
 * scan is `unknown` rather than carrying a claim nobody can verify. Absent stays
 * absent. Run inside the live transaction beside the completion insert.
 */
export async function copySourceEvidence(
  stage: Pick<EntityManager, 'query'>,
  live: Pick<EntityManager, 'query'>,
  scans: string[]
): Promise<{ copied: string[]; rejected: string[]; absent: string[] }> {
  const rows = await stage.query(
    `SELECT ${COLUMNS} FROM directory_overture_source_evidence WHERE "scanId" = ANY($1::text[]) ORDER BY "scanId"`,
    [scans]
  );
  const copied: string[] = [],
    rejected: string[] = [];
  for (const row of rows) {
    if (!evidenceHashMatches(row)) {
      rejected.push(row.scanId);
      continue;
    }
    await live.query(
      `INSERT INTO directory_overture_source_evidence (${COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        row.scanId,
        row.evidenceVersion,
        row.kind,
        row.releaseId,
        row.artifactUrl,
        row.artifactEtag,
        row.artifactBytes,
        row.upstreamLastModified,
        row.observedAt,
        row.recordedAt,
        row.recorder,
        row.inventorySha256,
        row.evidenceSha256,
      ]
    );
    copied.push(row.scanId);
  }
  const have = new Set([...copied, ...rejected]);
  return { copied, rejected, absent: scans.filter((scan) => !have.has(scan)) };
}
