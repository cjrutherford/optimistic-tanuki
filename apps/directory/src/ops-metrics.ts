import type {
  DirectoryOpsMetrics,
  DirectoryOpsQueueMetrics,
} from '../../../libs/social/contracts/src/lib/directory';
import { TRIAGE_DAYS } from './listing-report';
import { listControls } from './operating-controls';
import {
  geoapifyCreditsToday,
  geoapifyDailyCreditLimit,
  MONTHLY_LIMIT_CENTS,
} from './provider-budget';
import { FRESH_DAYS, STALE_DAYS } from './source-freshness';
import { fillTimeMetrics } from './acquisition-refresh';

type Pool = { query(sql: string, params?: unknown[]): Promise<any[]> };

export const DEFAULT_SPEND_ALERT_CENTS = 2000;
/** A section that has not answered by then is a failed section. The runtime pool's own query_timeout is 3 s. */
const SECTION_TIMEOUT_MS = 3500;

/** `DIRECTORY_SPEND_ALERT_CENTS`: an integer in 1..2500, otherwise the 80% default. */
export function spendAlertCents(env: NodeJS.ProcessEnv): number {
  const raw = env['DIRECTORY_SPEND_ALERT_CENTS'];
  if (typeof raw !== 'string' || !/^\d{1,4}$/.test(raw.trim()))
    return DEFAULT_SPEND_ALERT_CENTS;
  const n = Number(raw.trim());
  return n >= 1 && n <= MONTHLY_LIMIT_CENTS ? n : DEFAULT_SPEND_ALERT_CENTS;
}

/**
 * A listing is "live" when its identity's scan has a completion row, belongs to a non-revoked policy, has no scan
 * revocation and the row itself has no row revocation. This is an index-friendly upper bound on what is served: it
 * does not apply suppressions, business-identity supersession or classification exclusion (those need per-town
 * context and would not stay cheap).
 */
const LIVE_WHERE = `EXISTS (SELECT 1 FROM directory_overture_private_completion c WHERE c."scanId"=i."scanId")
    AND EXISTS (SELECT 1 FROM directory_overture_private_membership m
                JOIN directory_overture_private_policy p ON p."policyId"=m."policyId" AND p.revoked=false
                WHERE m."scanId"=i."scanId")
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=i."scanId")
    AND NOT EXISTS (SELECT 1 FROM directory_overture_private_row_revocation x
                    WHERE x."scanId"=i."scanId" AND x."sourceFileRowNumber"=i."sourceFileRowNumber")`;

const int = (v: unknown) => Number(v ?? 0);

async function infrastructure(pool: Pool, env: NodeJS.ProcessEnv) {
  const [row] = await pool.query(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname='postgis') AS postgis,
            (SELECT count(*)::int FROM migrations) AS applied,
            (SELECT name FROM migrations ORDER BY "timestamp" DESC LIMIT 1) AS latest`
  );
  return {
    database: 'ok' as const,
    postgis: row.postgis === true,
    migrationsApplied: int(row.applied),
    latestMigration: (row.latest as string | null) ?? null,
    exportStorage: env['DIRECTORY_EXPORT_DIR']
      ? ('configured' as const)
      : ('unconfigured' as const),
  };
}

async function towns(pool: Pool) {
  const rows = await pool.query(
    `SELECT "geometryStatus" AS status, count(*)::int AS total,
            count(*) FILTER (WHERE eligible AND "geometryStatus"='ready')::int AS onboarded
       FROM directory_town GROUP BY "geometryStatus"`
  );
  const byStatus: Record<string, number> = {};
  let total = 0;
  let onboarded = 0;
  for (const r of rows) {
    byStatus[String(r.status)] = int(r.total);
    total += int(r.total);
    onboarded += int(r.onboarded);
  }
  return { total, onboarded, byStatus };
}

async function coverage(pool: Pool) {
  const [r] = await pool.query(
    `SELECT count(*)::int AS listings, count(DISTINCT i."communityId")::int AS towns
       FROM directory_listing_identity i WHERE ${LIVE_WHERE}`
  );
  return {
    townsWithListings: int(r.towns),
    publishedListings: int(r.listings),
  };
}

async function freshness(pool: Pool) {
  const [r] = await pool.query(
    `SELECT count(*) FILTER (WHERE e."upstreamLastModified" < now() - ($1::int * interval '1 day'))::int AS due,
            count(*) FILTER (WHERE e."upstreamLastModified" < now() - ($2::int * interval '1 day'))::int AS stale,
            count(*) FILTER (WHERE e."upstreamLastModified" IS NULL)::int AS unknown,
            floor(extract(epoch FROM now() - min(e."upstreamLastModified")) / 86400)::int AS oldest
       FROM directory_listing_identity i
       LEFT JOIN directory_overture_source_evidence e ON e."scanId"=i."scanId"
      WHERE ${LIVE_WHERE}`,
    [FRESH_DAYS, STALE_DAYS]
  );
  return {
    refreshDueListings: int(r.due),
    staleListings: int(r.stale),
    unknownFreshnessListings: int(r.unknown),
    oldestListingAgeDays:
      r.oldest === null || r.oldest === undefined ? null : int(r.oldest),
  };
}

async function policy(pool: Pool) {
  const [r] = await pool.query(
    `SELECT (SELECT count(*) FROM directory_overture_private_policy WHERE revoked=false)::int AS active,
            (SELECT count(*) FROM directory_overture_private_policy WHERE revoked=true)::int AS revoked,
            (SELECT count(*) FROM directory_rights_case WHERE status='review')::int AS rights,
            (SELECT count(*) FROM directory_taxonomy_case WHERE status='open')::int AS taxonomy,
            (SELECT count(*) FROM directory_listing_report WHERE status='received' AND "createdAt" < clock_timestamp() - make_interval(days => ${TRIAGE_DAYS}))::int AS untriaged`
  );
  return {
    activePolicies: int(r.active),
    revokedPolicies: int(r.revoked),
    publicationPaused: int(r.active) === 0,
    openRightsCases: int(r.rights),
    openTaxonomyCases: int(r.taxonomy),
    reportsUntriagedOver3Days: int(r.untriaged),
  };
}

async function spend(pool: Pool, env: NodeJS.ProcessEnv) {
  const [r] = await pool.query(
    `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM') AS period,
            (SELECT COALESCE(SUM("reservedCents"),0)::int FROM directory_provider_budget_attempt
              WHERE provider<>'geoapify' AND period=to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM')) AS reserved`
  );
  const reservedCents = int(r.reserved);
  const alertCents = spendAlertCents(env);
  return {
    period: String(r.period),
    reservedCents,
    limitCents: MONTHLY_LIMIT_CENTS,
    geoapifyCreditsToday: await geoapifyCreditsToday(pool),
    geoapifyDailyCreditLimit: geoapifyDailyCreditLimit(env),
    alertCents,
    alert: reservedCents >= alertCents,
    exhausted: reservedCents >= MONTHLY_LIMIT_CENTS,
  };
}

async function queue(
  pool: Pool,
  table: string,
  queued: string,
  running: string,
  failedAt: string,
  createdAt: string
): Promise<DirectoryOpsQueueMetrics> {
  const [r] = await pool.query(
    `SELECT count(*) FILTER (WHERE status ${queued})::int AS queued,
            count(*) FILTER (WHERE status ${running})::int AS running,
            count(*) FILTER (WHERE status='failed' AND "${failedAt}" > now() - interval '24 hours')::int AS failed,
            floor(extract(epoch FROM now() - min("${createdAt}") FILTER (WHERE status ${queued})))::int AS oldest
       FROM ${table} WHERE status IN ('queued','pending','running','rolling_back','failed')`
  );
  return {
    queued: int(r.queued),
    running: int(r.running),
    failedLast24h: int(r.failed),
    oldestQueuedSeconds:
      r.oldest === null || r.oldest === undefined
        ? null
        : Math.max(0, int(r.oldest)),
  };
}

async function queues(pool: Pool) {
  const [exportQ, taxonomyQ, withdrawalQ] = await Promise.all([
    queue(
      pool,
      'directory_export_job',
      "='queued'",
      "='running'",
      'updatedAt',
      'createdAt'
    ),
    queue(
      pool,
      'directory_taxonomy_run',
      "='pending'",
      "IN ('running','rolling_back')",
      'updatedAt',
      'createdAt'
    ),
    queue(
      pool,
      'directory_withdrawal_request',
      "='pending'",
      "='running'",
      'updatedAt',
      'requestedAt'
    ),
  ]);
  return { export: exportQ, taxonomy: taxonomyQ, withdrawal: withdrawalQ };
}

/**
 * Restricted operator metrics. Every section is collected on its own with a bounded query; one that fails (or runs past
 * 3.5 s) becomes null and its name is added to `errors`, and the call still succeeds. Definitions:
 *
 * - infrastructure: database 'ok' when the section's query ran; postgis = the extension is installed;
 *   migrationsApplied = rows in the TypeORM `migrations` table; latestMigration = name of the highest-timestamp row;
 *   exportStorage = 'configured' when DIRECTORY_EXPORT_DIR is set.
 * - towns: total = rows in directory_town; byStatus = rows per geometryStatus; onboarded = eligible towns whose
 *   geometryStatus is 'ready' (boundary installed and usable).
 * - coverage: publishedListings = listing identities of live scans (completed, non-revoked policy, scan not revoked,
 *   row not revoked; an upper bound, suppressions and classification exclusions are not applied);
 *   townsWithListings = distinct communities among them.
 * - freshness: over the same live identities. refreshDueListings = source evidence older than 90 days; staleListings =
 *   older than 120 days (a subset of refreshDue); unknownFreshnessListings = live identities with no upstreamLastModified
 *   evidence (they are neither fresh nor stale, and must not be read as fresh); oldestListingAgeDays = whole days since
 *   the oldest stamp, null when none. The evidence hash is not re-verified here.
 * - policy: activePolicies / revokedPolicies = private policies by `revoked`; publicationPaused = no active policy (the
 *   same global fact coverage reports as `unconfigured`); openRightsCases = status 'review'; openTaxonomyCases = 'open'; reportsUntriagedOver3Days =
 *   listing reports still 'received' (not acknowledged or triaged) three days after they were filed (owner decision D17).
 * - spend: reservedCents = sum of provider budget reservations for the current UTC month; alert = reserved >=
 *   alertCents (DIRECTORY_SPEND_ALERT_CENTS, default 2000); exhausted = reserved >= the 2500 cent ceiling.
 * - queues: queued = export 'queued', taxonomy run 'pending', withdrawal 'pending'; running = 'running' (taxonomy also
 *   'rolling_back'); failedLast24h = status 'failed' with updatedAt in the last 24 h; oldestQueuedSeconds = age of the
 *   oldest queued row's creation (requestedAt for withdrawals), null when nothing is queued.
 * - fillTime: D15 target of 7 days from registration (or from a later boundary version) to a terminal acquisition
 *   state: a completed live scan (filled) or an automatic run ending succeeded / succeeded_empty (zero) / blocked
 *   (other than geometry_pending) / failed_permanent. waitingOverTarget = eligible towns with none yet and a wait past
 *   the target; resolvedLate = reached one after more than the target; overTargetTowns = their sum; alert = any town
 *   still waiting past the target.
 * - controls: the three operating controls (absent row = running, version 0).
 */
export async function collectOpsMetrics(
  pool: Pool,
  env: NodeJS.ProcessEnv = process.env
): Promise<DirectoryOpsMetrics> {
  const errors: string[] = [];
  const section = async <T>(
    name: string,
    run: () => Promise<T>
  ): Promise<T | null> => {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        run(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(Error('timeout')),
            SECTION_TIMEOUT_MS
          );
        }),
      ]);
    } catch {
      errors.push(name);
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  const [inf, tw, cov, fr, pol, sp, qs, ft, rq, ctl] = await Promise.all([
    section('infrastructure', () => infrastructure(pool, env)),
    section('towns', () => towns(pool)),
    section('coverage', () => coverage(pool)),
    section('freshness', () => freshness(pool)),
    section('policy', () => policy(pool)),
    section('spend', () => spend(pool, env)),
    section('queues', () => queues(pool)),
    section('fillTime', () => fillTimeMetrics(pool)),
    section('runQuality', () => runQualityMetrics(pool)),
    section('controls', () => listControls(pool)),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    infrastructure: inf,
    towns: tw,
    coverage: cov,
    freshness: fr,
    policy: pol,
    spend: sp,
    queues: qs,
    fillTime: ft,
    runQuality: rq,
    controls: ctl,
    errors: errors.sort(),
  };
}

async function runQualityMetrics(pool: Pool) {
  const rows = await pool.query(
    `SELECT count(*) FILTER (WHERE quality->>'passed' = 'false')::int AS total,
            count(*) FILTER (WHERE quality->>'passed' = 'false'
                             AND "finishedAt" > now() - interval '24 hours')::int AS recent
       FROM directory_acquisition_run
      WHERE status = 'failed_permanent'`
  );
  return {
    failedTotal: Number(rows[0]?.total ?? 0),
    failedLast24h: Number(rows[0]?.recent ?? 0),
  };
}

const SAFE_LABEL = /^[a-z][a-z0-9_]{0,31}$/;

/** Prometheus text exposition 0.0.4. Labels are only fixed enumerations (queue, control key, section, status). */
export function toPrometheus(m: DirectoryOpsMetrics): string {
  const out: string[] = [];
  const gauge = (
    name: string,
    help: string,
    samples: Array<[Record<string, string>, number | null | undefined]>
  ) => {
    const live = samples.filter(
      (s): s is [Record<string, string>, number] =>
        typeof s[1] === 'number' && Number.isFinite(s[1])
    );
    if (!live.length) return;
    out.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`);
    for (const [labels, value] of live) {
      const l = Object.entries(labels).filter(([, v]) => SAFE_LABEL.test(v));
      out.push(
        `${name}${
          l.length ? `{${l.map(([k, v]) => `${k}="${v}"`).join(',')}}` : ''
        } ${value}`
      );
    }
  };
  const flag = (b: boolean | undefined | null) =>
    typeof b === 'boolean' ? (b ? 1 : 0) : undefined;
  const none = {} as Record<string, string>;
  const t = Date.parse(m.generatedAt);
  gauge(
    'directory_ops_generated_timestamp_seconds',
    'When the metrics were collected.',
    [[none, Number.isFinite(t) ? Math.floor(t / 1000) : undefined]]
  );
  gauge(
    'directory_ops_section_failed',
    'Metric section failed to collect.',
    [
      'infrastructure',
      'towns',
      'coverage',
      'freshness',
      'policy',
      'spend',
      'queues',
      'fillTime',
      'runQuality',
      'controls',
    ].map(
      (s) =>
        [{ section: s }, m.errors.includes(s) ? 1 : 0] as [
          Record<string, string>,
          number
        ]
    )
  );
  const i = m.infrastructure;
  gauge('directory_postgis_installed', 'PostGIS extension installed.', [
    [none, flag(i?.postgis)],
  ]);
  gauge('directory_migrations_applied', 'Applied migrations.', [
    [none, i?.migrationsApplied],
  ]);
  gauge(
    'directory_export_storage_configured',
    'Export storage directory configured.',
    [[none, i ? (i.exportStorage === 'configured' ? 1 : 0) : undefined]]
  );
  gauge('directory_towns_total', 'Towns known to Directory.', [
    [none, m.towns?.total],
  ]);
  gauge('directory_towns_onboarded', 'Eligible towns with a ready boundary.', [
    [none, m.towns?.onboarded],
  ]);
  gauge(
    'directory_towns_by_status',
    'Towns by geometry status.',
    Object.entries(m.towns?.byStatus ?? {}).map(
      ([k, v]) => [{ status: k }, v] as [Record<string, string>, number]
    )
  );
  gauge(
    'directory_towns_with_listings',
    'Towns with at least one live listing.',
    [[none, m.coverage?.townsWithListings]]
  );
  gauge('directory_published_listings', 'Live listing identities.', [
    [none, m.coverage?.publishedListings],
  ]);
  gauge(
    'directory_refresh_due_listings',
    'Live listings whose source is older than 90 days.',
    [[none, m.freshness?.refreshDueListings]]
  );
  gauge(
    'directory_stale_listings',
    'Live listings whose source is older than 120 days.',
    [[none, m.freshness?.staleListings]]
  );
  gauge(
    'directory_unknown_freshness_listings',
    'Live listings with no source freshness evidence.',
    [[none, m.freshness?.unknownFreshnessListings]]
  );
  gauge(
    'directory_oldest_listing_age_days',
    'Age in days of the oldest live listing source.',
    [[none, m.freshness?.oldestListingAgeDays]]
  );
  gauge('directory_active_policies', 'Non-revoked private policies.', [
    [none, m.policy?.activePolicies],
  ]);
  gauge('directory_revoked_policies', 'Revoked private policies.', [
    [none, m.policy?.revokedPolicies],
  ]);
  gauge(
    'directory_publication_paused',
    'No active policy: publication is paused.',
    [[none, flag(m.policy?.publicationPaused)]]
  );
  gauge('directory_open_rights_cases', 'Rights cases in review.', [
    [none, m.policy?.openRightsCases],
  ]);
  gauge('directory_open_taxonomy_cases', 'Open taxonomy cases.', [
    [none, m.policy?.openTaxonomyCases],
  ]);
  gauge(
    'directory_reports_untriaged_over_3_days',
    'Listing reports still received (not acknowledged) after 3 days.',
    [[none, m.policy?.reportsUntriagedOver3Days]]
  );
  gauge(
    'directory_spend_reserved_cents',
    'Provider budget reserved this UTC month.',
    [[none, m.spend?.reservedCents]]
  );
  gauge('directory_spend_limit_cents', 'Monthly provider budget ceiling.', [
    [none, m.spend?.limitCents],
  ]);
  gauge(
    'directory_geoapify_credits_today',
    'Geoapify credits used today (UTC).',
    [[none, m.spend?.geoapifyCreditsToday]]
  );
  gauge('directory_geoapify_credits_limit', 'Geoapify daily credit limit.', [
    [none, m.spend?.geoapifyDailyCreditLimit],
  ]);
  gauge('directory_spend_alert_cents', 'Spend alert threshold.', [
    [none, m.spend?.alertCents],
  ]);
  gauge('directory_spend_alert', 'Spend is at or above the alert threshold.', [
    [none, flag(m.spend?.alert)],
  ]);
  gauge('directory_spend_exhausted', 'Monthly budget exhausted.', [
    [none, flag(m.spend?.exhausted)],
  ]);
  const q = Object.entries(m.queues ?? {});
  gauge(
    'directory_queue_queued',
    'Queued jobs.',
    q.map(
      ([k, v]) => [{ queue: k }, v.queued] as [Record<string, string>, number]
    )
  );
  gauge(
    'directory_queue_running',
    'Running jobs.',
    q.map(
      ([k, v]) => [{ queue: k }, v.running] as [Record<string, string>, number]
    )
  );
  gauge(
    'directory_queue_failed_last_24h',
    'Jobs that failed in the last 24 hours.',
    q.map(
      ([k, v]) =>
        [{ queue: k }, v.failedLast24h] as [Record<string, string>, number]
    )
  );
  gauge(
    'directory_queue_oldest_queued_seconds',
    'Age of the oldest queued job.',
    q.map(
      ([k, v]) =>
        [{ queue: k }, v.oldestQueuedSeconds] as [
          Record<string, string>,
          number | null
        ]
    )
  );
  gauge(
    'directory_fill_target_days',
    'Days from registration to a terminal acquisition state (D15).',
    [[none, m.fillTime?.targetDays]]
  );
  gauge(
    'directory_fill_over_target_towns',
    'Eligible towns whose wait to a terminal acquisition state exceeds the target.',
    [[none, m.fillTime?.overTargetTowns]]
  );
  gauge(
    'directory_fill_waiting_over_target_towns',
    'Eligible towns still waiting for acquisition past the target.',
    [[none, m.fillTime?.waitingOverTarget]]
  );
  gauge(
    'directory_fill_alert',
    'A town is still waiting for acquisition past the fill-time target.',
    [[none, flag(m.fillTime?.alert)]]
  );
  gauge(
    'directory_runs_failed_quality',
    'Acquisition runs failed on the quality scorecard (quality_limit), by window.',
    [
      [{ window: 'total' }, m.runQuality?.failedTotal],
      [{ window: 'last24h' }, m.runQuality?.failedLast24h],
    ]
  );
  gauge(
    'directory_control_paused',
    'Operating control paused.',
    (m.controls ?? []).map(
      (c) =>
        [{ key: c.key }, c.paused ? 1 : 0] as [Record<string, string>, number]
    )
  );
  return out.join('\n') + '\n';
}
