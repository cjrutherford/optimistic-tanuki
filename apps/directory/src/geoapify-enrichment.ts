import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { isPrivateEnrichmentAuthorized } from './acquisition-authorization';
import { isPaused, ProviderPausedError } from './operating-controls';
import { reserveProviderBudget } from './provider-budget';
import { emptyOutcome } from './overture-auto-acquisition';
import type { AutoSweepOutcome } from './overture-auto-acquisition';

/**
 * Geoapify private enrichment (owner decision D4). For an already-staged listing it asks Geoapify Place Details for
 * opening hours and contact, and keeps the answer in `directory_geoapify_enrichment` only. Nothing here is read by the
 * public listing projection or the public export, and the retention sweep deletes the data once the Geoapify rights
 * policy entry's retention period has passed. It does nothing at all without GEOAPIFY_API_KEY.
 */
export const GEOAPIFY_PROVIDER = 'geoapify';
export const GEOAPIFY_OPERATION = 'place-details';
export const GEOAPIFY_ENDPOINT = 'https://api.geoapify.com/v2/place-details';

export type GeoapifyStatus =
  | 'not_configured'
  | 'no_policy'
  | 'ok'
  | 'paused'
  | 'budget_blocked'
  | 'error';

export interface GeoapifyPolicy {
  releaseId: string;
  retentionDays: number;
}
export interface GeoapifyConfig {
  apiKey: string;
  costCents: number;
  batch: number;
  fetchImpl?: typeof fetch;
}
export interface PrivateDetails {
  openingHours?: string;
  phone?: string;
  website?: string;
}

/** The Geoapify rights policy entry: private operations only, with a retention period in days. */
export function selectGeoapifyPolicy(parsed: unknown): GeoapifyPolicy | null {
  const entries = Array.isArray(parsed) ? parsed : [parsed];
  for (const e of entries as Array<Record<string, any> | null>) {
    if (!e || e['provider'] !== GEOAPIFY_PROVIDER) continue;
    const ops = e['operations'] ?? {};
    const days = e['retentionDays'];
    if (
      typeof e['releaseId'] === 'string' &&
      ops.publicDisplay === false &&
      ops.export === false &&
      ops.publicExport === false &&
      ops.retain === true &&
      Number.isSafeInteger(days) &&
      days >= 1 &&
      days <= 3650
    )
      return { releaseId: e['releaseId'], retentionDays: days };
  }
  return null;
}

/** Removes any apiKey query parameter, and the literal key when known, from text that may be stored or logged. */
export function redactSecrets(text: string, apiKey?: string): string {
  let out = String(text).replace(/api_?key=[^&\s"')]*/gi, 'apiKey=[redacted]');
  if (apiKey && apiKey.trim())
    out = out.split(apiKey.trim()).join('[redacted]');
  return out;
}

export async function recordProviderStatus(
  db: DataSource,
  provider: string,
  status: string,
  detail = ''
): Promise<void> {
  await db.query(
    `INSERT INTO directory_provider_status (provider, status, detail, "checkedAt") VALUES ($1,$2,$3,now())
     ON CONFLICT (provider) DO UPDATE SET status=EXCLUDED.status, detail=EXCLUDED.detail, "checkedAt"=now()`,
    [provider, status, redactSecrets(detail).slice(0, 256)]
  );
}

const str = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

/** Reads only opening hours, phone and website out of a Place Details response. Email and everything else is dropped. */
export function extractPrivateDetails(body: unknown): PrivateDetails {
  const features = (body as { features?: unknown })?.features;
  const props = (Array.isArray(features) ? features : [])
    .map((f) => (f as { properties?: Record<string, any> })?.properties)
    .find((p) => p && typeof p === 'object');
  if (!props) return {};
  const contact = (props['contact'] ?? {}) as Record<string, unknown>;
  const out: PrivateDetails = {};
  const hours = str(props['opening_hours'], 500);
  const phone = str(contact['phone'] ?? props['phone'], 64);
  const website = str(props['website'] ?? contact['website'], 300);
  if (hours) out.openingHours = hours;
  if (phone) out.phone = phone;
  if (website && /^https?:\/\//i.test(website)) out.website = website;
  return out;
}

/** One Place Details lookup. The key goes in the query string Geoapify requires and is never logged or thrown. */
export async function fetchPlaceDetails(
  config: Pick<GeoapifyConfig, 'apiKey' | 'fetchImpl'>,
  lon: number,
  lat: number
): Promise<PrivateDetails> {
  const url = new URL(GEOAPIFY_ENDPOINT);
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lon));
  url.searchParams.set('apiKey', config.apiKey);
  let response: Response;
  try {
    response = await (config.fetchImpl ?? fetch)(url, {
      signal: AbortSignal.timeout(15_000),
      redirect: 'error',
    });
  } catch (error) {
    // A transport error can carry the request URL, and the URL carries the key.
    throw Error(
      `Geoapify request failed: ${redactSecrets(
        error instanceof Error ? error.message : 'network',
        config.apiKey
      ).slice(0, 120)}`
    );
  }
  if (!response.ok) throw Error(`Geoapify request failed: ${response.status}`);
  return extractPrivateDetails(await response.json());
}

const CANDIDATES = `
  SELECT r."scanId", r."sourceFileRowNumber"::text AS "row", r.listing->'location'->'coordinates' AS coordinates
  FROM directory_overture_private_row r
  JOIN directory_overture_private_completion c ON c."scanId" = r."scanId"
  LEFT JOIN directory_geoapify_enrichment e ON e."scanId" = r."scanId" AND e."sourceFileRowNumber" = r."sourceFileRowNumber"
  WHERE e."scanId" IS NULL AND r.listing IS NOT NULL
    AND jsonb_typeof(r.listing->'location'->'coordinates')='array'
    AND jsonb_array_length(r.listing->'location'->'coordinates')=2
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation v WHERE v."scanId" = r."scanId")
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation v WHERE v."scanId" = r."scanId" AND v."sourceFileRowNumber" = r."sourceFileRowNumber")
  ORDER BY r."scanId", r."sourceFileRowNumber"
  LIMIT $1`;

/** Deletes enrichment past its expiry, and any whose scan or row was withdrawn. */
export async function runGeoapifyRetention(db: DataSource): Promise<number> {
  // TypeORM returns [rows, affectedCount] for a DELETE on postgres, so count in SQL rather than trusting the shape.
  const rows = await db.query(
    `WITH gone AS (DELETE FROM directory_geoapify_enrichment e
     WHERE e."expiresAt" <= now()
        OR EXISTS (SELECT 1 FROM directory_overture_private_revocation v WHERE v."scanId" = e."scanId")
        OR EXISTS (SELECT 1 FROM directory_overture_private_row_revocation v WHERE v."scanId" = e."scanId" AND v."sourceFileRowNumber" = e."sourceFileRowNumber")
     RETURNING 1) SELECT count(*)::int AS n FROM gone`
  );
  return Number(rows[0]?.n ?? 0);
}

export interface GeoapifySweepDeps {
  db: DataSource;
  /** Absent or empty means not configured. */
  apiKey?: string;
  policy: GeoapifyPolicy | null;
  costCents?: number;
  batch?: number;
  /** Lookups allowed per UTC day across sweeps; keeps a switched-on sweep small. */
  dailyLookups?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  log?: (message: string) => void;
}

/** One sweep: retention first (always), then enrichment when a key, a policy, the budget and the kill switch allow it. */
export async function runGeoapifySweep(
  deps: GeoapifySweepDeps
): Promise<AutoSweepOutcome> {
  const { db } = deps;
  const out = emptyOutcome('ok');
  // Retention is not optional: previously fetched data is deleted on schedule even if the key has since been removed.
  const deleted = await runGeoapifyRetention(db);
  if (deleted) deps.log?.(`geoapify retention: deleted ${deleted}`);
  if (!deps.apiKey || !deps.apiKey.trim()) {
    await recordProviderStatus(
      db,
      GEOAPIFY_PROVIDER,
      'not_configured',
      'GEOAPIFY_API_KEY is not set'
    );
    return out;
  }
  if (!isPrivateEnrichmentAuthorized(GEOAPIFY_PROVIDER) || !deps.policy) {
    await recordProviderStatus(
      db,
      GEOAPIFY_PROVIDER,
      'no_policy',
      'no Geoapify rights policy entry'
    );
    return out;
  }
  if (await isPaused(db, 'provider_acquisition')) {
    await recordProviderStatus(db, GEOAPIFY_PROVIDER, 'paused');
    out.status = 'paused';
    return out;
  }
  const cost = deps.costCents ?? 1;
  const [{ today }] = await db.query(
    `SELECT count(*)::int AS today FROM directory_provider_budget_attempt
      WHERE provider=$1 AND "createdAt" >= date_trunc('day', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
    [GEOAPIFY_PROVIDER]
  );
  const allowed = Math.max(
    0,
    Math.min(deps.batch ?? 20, (deps.dailyLookups ?? 50) - Number(today))
  );
  const candidates: Array<{
    scanId: string;
    row: string;
    coordinates: [number, number];
  }> = allowed ? await db.query(CANDIDATES, [allowed]) : [];
  let status: GeoapifyStatus = 'ok';
  let lastError = '';
  for (const c of candidates) {
    if (deps.signal?.aborted) break;
    try {
      await reserveProviderBudget(db, {
        attemptId: randomUUID(),
        provider: GEOAPIFY_PROVIDER,
        operation: GEOAPIFY_OPERATION,
        maxCostCents: cost,
      });
    } catch (error) {
      if (error instanceof ProviderPausedError) {
        out.status = 'paused';
        status = 'paused';
      } else {
        out.status = 'blocked';
        status = 'budget_blocked';
      }
      break;
    }
    out.examined++;
    try {
      const details = await fetchPlaceDetails(
        { apiKey: deps.apiKey, fetchImpl: deps.fetchImpl },
        c.coordinates[0],
        c.coordinates[1]
      );
      await db.query(
        `INSERT INTO directory_geoapify_enrichment ("scanId","sourceFileRowNumber",details,"fetchedAt","expiresAt")
         VALUES ($1,$2,$3::jsonb,now(), now() + ($4 || ' days')::interval)
         ON CONFLICT DO NOTHING`,
        [
          c.scanId,
          c.row,
          JSON.stringify(details),
          String(deps.policy.retentionDays),
        ]
      );
      out.succeeded++;
    } catch (error) {
      out.failed++;
      status = 'error';
      lastError = redactSecrets(
        error instanceof Error ? error.message : 'lookup failed',
        deps.apiKey
      );
      deps.log?.(`geoapify lookup failed: ${lastError}`);
      break;
    }
  }
  await recordProviderStatus(
    db,
    GEOAPIFY_PROVIDER,
    status,
    `enriched=${out.succeeded} failed=${out.failed}${
      lastError ? ` lastError=${lastError}` : ''
    }`
  );
  return out;
}
