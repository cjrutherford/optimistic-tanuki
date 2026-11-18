import {
  applyFieldExclusions,
  EXPORT_FIELDS,
  loadFieldExclusions,
  projectExportRow,
} from './export-job';
import {
  evaluateOvertureFieldRights,
  OvertureRightsPolicy,
} from './overture-rights';
import { SERVED_ROW_FROM, servedRowWhere } from './town-coverage';

/**
 * Public self-service export (S8b). One town's published listings as CSV or JSONL, generated on request from the
 * current served data, so a withdrawal, suppression, revocation or rights decision applies to the very next download.
 *
 * A field leaves only when the release's policy grants the separate `publicExport` operation
 * (`operations.publicExport: true` plus the field in a source term's `permissions.publicExport`). Operator `export`
 * never implies it, and nothing is exposed until a policy opts in. Adult, suppressed, withdrawn or unpublished rows,
 * private fields and Geoapify-derived values never appear. The output carries no row id, scan id, reference or
 * change token, only the allowlisted listing fields and the per-source attribution the terms require.
 */
type Q = { query(sql: string, params?: unknown[]): Promise<any> };

export const PUBLIC_EXPORT_SCHEMA = 'town-square-public-export/v1';
export const PUBLIC_EXPORT_FORMATS = ['csv', 'jsonl'] as const;
export type PublicExportFormat = (typeof PUBLIC_EXPORT_FORMATS)[number];
export const PUBLIC_EXPORT_DEFAULT_ROW_CAP = 5000;
const PAGE = 500;

export type PublicExportResult =
  | { ok: false; code: 'no_public_export' }
  | {
      ok: true;
      body: string;
      contentType: string;
      filename: string;
      rowCount: number;
      truncated: boolean;
    };

const rowsOf = (result: any): any[] =>
  Array.isArray(result?.[0]) ? result[0] : result ?? [];

/** Spreadsheet formula injection: a cell that starts with one of these is prefixed so it stays text. */
function csvCell(value: unknown): string {
  let text =
    value === undefined || value === null
      ? ''
      : typeof value === 'string'
      ? value
      : typeof value === 'object'
      ? Object.values(value as Record<string, unknown>)
          .filter((v) => typeof v === 'string' || typeof v === 'number')
          .join(', ')
      : String(value);
  text = text.replace(/\r?\n|\r/g, ' ');
  if (/^[=+\-@\t]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))
    text = `'${text}`;
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface PublicExportInput {
  readonly town: string;
  readonly format: PublicExportFormat;
  readonly changeToken: string;
  readonly policyFor: (releaseId: string) => OvertureRightsPolicy | undefined;
  /**
   * The release the run ledger records (as rights sync and operator export use), for scans with no source
   * evidence row. A scan's own evidence release always wins.
   */
  readonly releaseId?: string | null;
  readonly rowCap?: number;
  readonly now?: () => Date;
}

export async function buildPublicExport(
  db: Q,
  input: PublicExportInput
): Promise<PublicExportResult> {
  const cap = Math.max(1, input.rowCap ?? PUBLIC_EXPORT_DEFAULT_ROW_CAP);
  const scans = rowsOf(
    await db.query(
      `SELECT DISTINCT t."scanId" FROM directory_town_scan_target t WHERE t."communityId"=$1::uuid ORDER BY 1`,
      [input.town]
    )
  ).map((r) => r.scanId as string);

  const rows: Record<string, any>[] = [];
  const sources = new Map<string, { dataset: string; license: string }>();
  const attributions = new Set<string>();
  const termsUrls = new Set<string>();
  const notices = new Set<string>();
  const present = new Set<string>();
  let truncated = false;

  for (const scanId of scans) {
    if (truncated) break;
    const [evidence] = rowsOf(
      await db.query(
        `SELECT "releaseId" FROM directory_overture_source_evidence WHERE "scanId"=$1 ORDER BY "evidenceVersion" DESC LIMIT 1`,
        [scanId]
      )
    );
    const releaseId: string | undefined =
      evidence?.releaseId ?? input.releaseId ?? undefined;
    const policy = releaseId ? input.policyFor(releaseId) : undefined;
    // Default off: no policy, or no publicExport opt-in, exposes nothing from this scan.
    if (!releaseId || !policy || policy.operations?.publicExport !== true)
      continue;
    const exclusions = await loadFieldExclusions(db, releaseId);
    const evaluationFor = (listing: Record<string, unknown>) =>
      applyFieldExclusions(
        evaluateOvertureFieldRights(
          { releaseId, sources: listing['sources'] as never },
          'publicExport',
          policy
        ),
        exclusions
      );
    let after = '-1';
    for (;;) {
      const page = rowsOf(
        await db.query(
          `SELECT DISTINCT ON (r."sourceFileRowNumber") r."sourceFileRowNumber"::text AS n, r.listing
           FROM ${SERVED_ROW_FROM}
           WHERE r."scanId"=$1 AND r."sourceFileRowNumber" > $2::bigint AND r.listing IS NOT NULL
             AND ${servedRowWhere('$3', '$4')}
             AND (NOT (r.listing ? 'adult') OR r.listing->'adult'='false'::jsonb)
           ORDER BY r."sourceFileRowNumber" LIMIT $5`,
          [scanId, after, input.town, input.changeToken, PAGE]
        )
      );
      for (const r of page) {
        after = r.n;
        const projection = projectExportRow(r.listing, evaluationFor);
        if (!projection.included) continue;
        if (rows.length >= cap) {
          truncated = true;
          break;
        }
        for (const p of Object.values(projection.provenance)) {
          p.attributions.forEach((v) => attributions.add(v));
          p.termsUrls.forEach((v) => termsUrls.add(v));
          p.notices.forEach((v) => notices.add(v));
          for (const d of p.datasets)
            sources.set(JSON.stringify([d.dataset, d.license]), d);
        }
        Object.keys(projection.fields).forEach((k) => present.add(k));
        rows.push(projection.fields);
      }
      if (truncated || page.length < PAGE) break;
    }
  }
  if (!rows.length) return { ok: false, code: 'no_public_export' };

  const fields = EXPORT_FIELDS.map((f) => f.key as string).filter((k) =>
    present.has(k)
  );
  const generatedAt = (input.now ?? (() => new Date()))().toISOString();
  const stamp = generatedAt.slice(0, 10);
  const sourceList = [...sources.values()].sort((a, b) =>
    `${a.dataset}|${a.license}`.localeCompare(`${b.dataset}|${b.license}`)
  );
  const provenance = {
    schema: PUBLIC_EXPORT_SCHEMA,
    generatedAt,
    fields,
    rowCount: rows.length,
    rowCap: cap,
    truncated,
    sources: sourceList,
    attributions: [...attributions].sort(),
    termsUrls: [...termsUrls].sort(),
    notices: [...notices].sort(),
  };

  if (input.format === 'jsonl') {
    const body =
      [
        JSON.stringify({ type: 'header', ...provenance }),
        ...rows.map((r) => JSON.stringify({ type: 'row', ...r })),
        JSON.stringify({
          type: 'trailer',
          rowCount: rows.length,
          truncated,
        }),
      ].join('\n') + '\n';
    return {
      ok: true,
      body,
      contentType: 'application/x-ndjson; charset=utf-8',
      filename: `town-square-listings-${stamp}.jsonl`,
      rowCount: rows.length,
      truncated,
    };
  }

  const columns = fields.flatMap((k) =>
    k === 'location' ? ['latitude', 'longitude'] : [k]
  );
  const comment = (text: string) => `# ${text.replace(/\r?\n|\r/g, ' ')}`;
  const lines = [
    comment(`Town Square business listings (${PUBLIC_EXPORT_SCHEMA})`),
    comment(`Generated ${generatedAt}`),
    comment(
      `Rows: ${rows.length}${
        truncated ? ` (truncated at the ${cap} row limit)` : ''
      }`
    ),
    ...sourceList.map((s) =>
      comment(`Source: ${s.dataset}, licence ${s.license}`)
    ),
    ...provenance.attributions.map((a) => comment(`Attribution: ${a}`)),
    ...provenance.termsUrls.map((u) => comment(`Terms: ${u}`)),
    ...provenance.notices.map((n) => comment(`Notice: ${n}`)),
    columns.join(','),
    ...rows.map((r) =>
      columns
        .map((c) => {
          if (c === 'latitude') return csvCell(r['location']?.coordinates?.[1]);
          if (c === 'longitude')
            return csvCell(r['location']?.coordinates?.[0]);
          return csvCell(r[c]);
        })
        .join(',')
    ),
  ];
  return {
    ok: true,
    body: lines.join('\r\n') + '\r\n',
    contentType: 'text/csv; charset=utf-8',
    filename: `town-square-listings-${stamp}.csv`,
    rowCount: rows.length,
    truncated,
  };
}
