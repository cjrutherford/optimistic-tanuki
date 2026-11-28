import { Logger } from '@nestjs/common';
import {
  LlmGenerationSchema,
  type LlmGenerationRow,
  PipelineRunSchema,
  type PipelineRunRow,
} from '@optimistic-tanuki/civic-core';
import type { EmailService } from '@optimistic-tanuki/email';
import type { PipelineHealthReport } from '@optimistic-tanuki/models';
import { MoreThanOrEqual, Not, type DataSource } from 'typeorm';
import {
  DaylightAlertSchema,
  type DaylightAlertRow,
} from './daylight-alert.schema';
import { type FailureCause, failureCause } from './failure-cause';

/** The rows a digest is built from: one window of runs and model calls. */
export interface DigestInput {
  since: string;
  until: string;
  report: PipelineHealthReport;
  runs: Pick<PipelineRunRow, 'localitySlug' | 'status' | 'error'>[];
  generations: Pick<
    LlmGenerationRow,
    'operation' | 'model' | 'status' | 'error' | 'latencyMs' | 'generatedAt'
  >[];
  alerts: { opened: number; resolved: number };
}

export interface DigestCause extends FailureCause {
  count: number;
  towns: string[];
}

export interface DigestModelRow {
  operation: string;
  model: string;
  calls: number;
  successful: number;
  /** Calls the model never answered: service unreachable or timed out. */
  unavailable: number;
  p95LatencyMs: number;
}

export type DigestVerdict = 'healthy' | 'degraded' | 'outage' | 'idle';

/** One day of the Daylight pipeline, summarised for an operator. */
export interface PipelineDigest {
  since: string;
  until: string;
  verdict: DigestVerdict;
  towns: {
    /** Towns that ran in the window (weekly towns rarely do, so not every edition town). */
    ran: number;
    /** Towns with at least one run that produced an edition. */
    succeeded: number;
    /** Towns whose every run in the window failed. */
    failedOnly: number;
  };
  runs: {
    total: number;
    succeeded: number;
    partial: number;
    failed: number;
    skipped: number;
    running: number;
  };
  /** Failed runs grouped by what they came down to, most frequent first. */
  runFailures: DigestCause[];
  calls: { total: number; successful: number; unavailable: number };
  models: DigestModelRow[];
  /** Model output rejected by validation, by rule, most frequent first. */
  rejections: DigestCause[];
  /** Hours in the window in which nearly every model call was unreachable. */
  outageHours: number;
  sources: {
    failing: {
      town: string;
      sourceId: string;
      adapter: string;
      attempts: number;
    }[];
    stale: number;
    staleTowns: number;
  };
  noSources: { slug: string; name: string; requests: number }[];
  alerts: { opened: number; resolved: number };
  improvements: string[];
}

const SUCCEEDED = new Set(['succeeded', 'partial_success']);
const FAILED = new Set(['failed', 'blocked']);

/** Turns a window of rows into the digest. Pure, so the arithmetic is tested without a database. */
export function buildDigest(input: DigestInput): PipelineDigest {
  const names = new Map(input.report.towns.map((t) => [t.slug, t.name]));
  const name = (slug: string) => names.get(slug) ?? slug;

  const runs = {
    total: input.runs.length,
    succeeded: count(input.runs, (r) => r.status === 'succeeded'),
    partial: count(input.runs, (r) => r.status === 'partial_success'),
    failed: count(input.runs, (r) => FAILED.has(r.status)),
    skipped: count(input.runs, (r) => r.status === 'skipped-overlap'),
    running: count(input.runs, (r) => r.status === 'running'),
  };

  const ranTowns = new Set(input.runs.map((r) => r.localitySlug));
  const okTowns = new Set(
    input.runs.filter((r) => SUCCEEDED.has(r.status)).map((r) => r.localitySlug)
  );
  const failedTowns = new Set(
    input.runs.filter((r) => FAILED.has(r.status)).map((r) => r.localitySlug)
  );
  const towns = {
    ran: [...ranTowns].filter((slug) =>
      input.runs.some(
        (r) => r.localitySlug === slug && r.status !== 'skipped-overlap'
      )
    ).length,
    succeeded: okTowns.size,
    failedOnly: [...failedTowns].filter((slug) => !okTowns.has(slug)).length,
  };

  const runFailures = groupCauses(
    input.runs
      .filter((r) => FAILED.has(r.status))
      .map((r) => ({
        cause: failureCause(r.error),
        town: name(r.localitySlug),
      }))
  );

  const generations = input.generations;
  const isUnavailable = (g: DigestInput['generations'][number]) =>
    g.status !== 'successful' &&
    ['model-unavailable', 'model-timeout'].includes(failureCause(g.error).kind);
  const calls = {
    total: generations.length,
    successful: count(generations, (g) => g.status === 'successful'),
    unavailable: count(generations, isUnavailable),
  };

  const byModel = new Map<string, DigestInput['generations']>();
  for (const g of generations) {
    const key = `${g.operation}\u0000${g.model}`;
    byModel.set(key, [...(byModel.get(key) ?? []), g]);
  }
  const models: DigestModelRow[] = [...byModel.entries()]
    .map(([key, rows]) => {
      const [operation, model] = key.split('\u0000');
      return {
        operation,
        model,
        calls: rows.length,
        successful: count(rows, (g) => g.status === 'successful'),
        unavailable: count(rows, isUnavailable),
        // Over answered calls only: a refused connection fails in
        // milliseconds and would hide how slow the model really is.
        p95LatencyMs: percentile(
          rows.filter((g) => !isUnavailable(g)).map((g) => g.latencyMs),
          0.95
        ),
      };
    })
    .sort(
      (a, b) => a.operation.localeCompare(b.operation) || b.calls - a.calls
    );

  const rejections = groupCauses(
    generations
      .filter((g) => g.status !== 'successful' && !isUnavailable(g))
      .map((g) => ({ cause: failureCause(g.error), town: g.operation }))
  );

  const hours = new Map<string, { total: number; unavailable: number }>();
  for (const g of generations) {
    const hour = g.generatedAt.slice(0, 13);
    const bucket = hours.get(hour) ?? { total: 0, unavailable: 0 };
    bucket.total += 1;
    if (isUnavailable(g)) bucket.unavailable += 1;
    hours.set(hour, bucket);
  }
  const outageHours = [...hours.values()].filter(
    (h) => h.total >= 5 && h.unavailable / h.total >= 0.9
  ).length;

  const failing = input.report.towns.flatMap((t) =>
    t.problems
      .filter((p) => p.status === 'failing')
      .map((p) => ({
        town: t.name,
        sourceId: p.sourceId,
        adapter: p.adapter,
        attempts: p.consecutiveFailures,
      }))
  );
  const staleTowns = input.report.towns.filter((t) =>
    t.problems.some((p) => p.status === 'stale')
  );
  const sources = {
    failing: failing.sort((a, b) => b.attempts - a.attempts),
    stale: staleTowns.reduce(
      (sum, t) => sum + count(t.problems, (p) => p.status === 'stale'),
      0
    ),
    staleTowns: staleTowns.length,
  };
  const noSources = input.report.towns
    .filter((t) => t.noSources)
    .map((t) => ({ slug: t.slug, name: t.name, requests: t.requestCount ?? 0 }))
    .sort((a, b) => b.requests - a.requests);

  const digest: PipelineDigest = {
    since: input.since,
    until: input.until,
    verdict: 'healthy',
    towns,
    runs,
    runFailures,
    calls,
    models,
    rejections,
    outageHours,
    sources,
    noSources,
    alerts: input.alerts,
    improvements: [],
  };
  digest.verdict = verdict(digest);
  digest.improvements = improvements(digest);
  return digest;
}

function verdict(d: PipelineDigest): DigestVerdict {
  if (!d.runs.total) return 'idle';
  if (
    d.outageHours > 0 ||
    (d.calls.total && d.calls.unavailable / d.calls.total >= 0.5)
  )
    return 'outage';
  if (d.runs.failed / d.runs.total > 0.1 || d.sources.failing.length)
    return 'degraded';
  return 'healthy';
}

/** What is worth acting on, most consequential first. */
function improvements(d: PipelineDigest): string[] {
  const out: string[] = [];
  if (d.outageHours)
    out.push(
      `The model service was unreachable for about ${d.outageHours} hour${
        d.outageHours === 1 ? '' : 's'
      }. Check Ollama and prompt-proxy; every run in that time failed.`
    );
  const pipeline = d.runFailures.filter((c) => c.kind === 'pipeline');
  for (const cause of pipeline.slice(0, 2))
    if (cause.count >= 3)
      out.push(
        `${cause.count} runs failed with “${cause.label}” (${listTowns(
          cause.towns
        )}). This is a pipeline fault, not the model.`
      );
  for (const rule of d.rejections.slice(0, 3)) {
    if (rule.kind !== 'grounding' || rule.count < 10) continue;
    out.push(
      `${rule.count} model outputs were ${rule.label}, mostly in ${listTowns(
        rule.towns
      )} calls. Review that prompt, or the rule if the output was right.`
    );
  }
  for (const row of d.models) {
    const answered = row.calls - row.unavailable;
    if (answered < 20) continue;
    const rate = row.successful / answered;
    if (rate < 0.3)
      out.push(
        `${row.model} passed only ${percent(rate)} of ${row.operation} calls (${
          row.successful
        } of ${answered}). Consider replacing it for ${row.operation}.`
      );
    if (row.p95LatencyMs > 90_000)
      out.push(
        `${row.operation} on ${
          row.model
        } is slow: 95% of calls finish within ${Math.round(
          row.p95LatencyMs / 1000
        )}s. Long calls hold the run lease and delay other towns.`
      );
  }
  if (d.sources.failing.length)
    out.push(
      `${d.sources.failing.length} source${
        d.sources.failing.length === 1 ? ' is' : 's are'
      } failing outright. The adapter or the site may have changed.`
    );
  if (d.sources.stale >= 10)
    out.push(
      `${d.sources.stale} sources across ${d.sources.staleTowns} towns have gone quiet. Usually a site that stopped posting, sometimes a moved page.`
    );
  const asked = d.noSources.filter((t) => t.requests > 0);
  if (asked.length)
    out.push(
      `${asked.length} town${
        asked.length === 1 ? ' has' : 's have'
      } readers asking for coverage but no sources found: ${listTowns(
        asked.map((t) => `${t.name} (${t.requests})`)
      )}.`
    );
  return out;
}

const VERDICT_TEXT: Record<DigestVerdict, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  outage: 'Outage',
  idle: 'No runs',
};

/** The digest as an email: a plain-text body and an equivalent HTML body. */
export function renderDigest(
  d: PipelineDigest,
  day: string
): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `Daylight daily digest ${day}: ${VERDICT_TEXT[d.verdict]} · ${
    d.towns.succeeded
  }/${d.towns.ran} towns published · ${d.runs.failed} failed runs`;
  const passRate =
    d.calls.total - d.calls.unavailable
      ? percent(d.calls.successful / (d.calls.total - d.calls.unavailable))
      : '—';

  const worked = [
    `${d.towns.succeeded} of the ${d.towns.ran} towns that ran published an edition.`,
    `${d.runs.succeeded + d.runs.partial} runs completed (${
      d.runs.succeeded
    } clean, ${d.runs.partial} with some sources missing).`,
    `${d.calls.successful} model outputs passed validation (${passRate} of the calls the model answered).`,
    ...(d.alerts.resolved
      ? [`${d.alerts.resolved} earlier problems cleared.`]
      : []),
  ];
  const didnt = [
    ...(d.runs.failed
      ? [
          `${d.runs.failed} runs failed in ${d.towns.failedOnly} towns that published nothing.`,
        ]
      : ['No runs failed.']),
    ...d.runFailures
      .slice(0, 6)
      .map((c) => `${c.count} × ${c.label} (${listTowns(c.towns)})`),
    ...(d.calls.unavailable
      ? [
          `${d.calls.unavailable} model calls never got an answer (service unreachable or timed out).`,
        ]
      : []),
    ...failingByTown(d.sources.failing),
    ...(d.sources.stale
      ? [
          `${d.sources.stale} sources in ${d.sources.staleTowns} towns have gone quiet.`,
        ]
      : []),
  ];
  const improve = d.improvements.length
    ? d.improvements
    : ['Nothing stands out today.'];

  const text = [
    `Daylight daily digest, ${day} (${d.since} to ${d.until})`,
    `Status: ${VERDICT_TEXT[d.verdict]}`,
    '',
    'WHAT WORKED',
    ...worked.map((l) => `- ${l}`),
    '',
    "WHAT DIDN'T",
    ...didnt.map((l) => `- ${l}`),
    '',
    'WHAT TO IMPROVE',
    ...improve.map((l) => `- ${l}`),
    '',
    'MODEL CALLS (passed / answered, p95 latency)',
    ...d.models.map(
      (m) =>
        `- ${m.operation} · ${m.model}: ${m.successful}/${
          m.calls - m.unavailable
        }${m.unavailable ? ` (+${m.unavailable} unanswered)` : ''}, ${seconds(
          m.p95LatencyMs,
          m.calls - m.unavailable
        )}`
    ),
    '',
    'TOP REJECTION REASONS',
    ...(d.rejections.length
      ? d.rejections
          .slice(0, 8)
          .map((r) => `- ${r.count} × ${r.label} (${listTowns(r.towns)})`)
      : ['- none']),
    '',
    'Pipeline health in Towne Square’s Operations page shows the current state.',
  ].join('\n');

  const html = digestHtml(d, day, { worked, didnt, improve });
  return { subject, text, html };
}

function digestHtml(
  d: PipelineDigest,
  day: string,
  sections: { worked: string[]; didnt: string[]; improve: string[] }
): string {
  const colour: Record<DigestVerdict, string> = {
    healthy: '#1a7f37',
    degraded: '#9a6700',
    outage: '#cf222e',
    idle: '#57606a',
  };
  const list = (items: string[]) =>
    `<ul style="margin:4px 0 16px;padding-left:20px">${items
      .map((i) => `<li style="margin:2px 0">${escape(i)}</li>`)
      .join('')}</ul>`;
  const heading = (title: string) =>
    `<h3 style="margin:16px 0 4px;font-size:15px">${escape(title)}</h3>`;
  const cell =
    'padding:4px 8px;border-bottom:1px solid #d0d7de;text-align:left';
  const modelRows = d.models
    .map((m) => {
      const answered = m.calls - m.unavailable;
      return `<tr><td style="${cell}">${escape(
        m.operation
      )}</td><td style="${cell}">${escape(m.model)}</td><td style="${cell}">${
        m.successful
      }/${answered} (${
        answered ? percent(m.successful / answered) : '—'
      })</td><td style="${cell}">${
        m.unavailable
      }</td><td style="${cell}">${seconds(m.p95LatencyMs, answered)}</td></tr>`;
    })
    .join('');
  const rejectionRows = d.rejections
    .slice(0, 8)
    .map(
      (r) =>
        `<tr><td style="${cell}">${r.count}</td><td style="${cell}">${escape(
          r.label
        )}</td><td style="${cell}">${escape(listTowns(r.towns))}</td></tr>`
    )
    .join('');
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1f2328;max-width:720px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 4px;font-size:18px">Daylight daily digest · ${escape(
    day
  )}</h2>
<p style="margin:0 0 12px;color:#57606a;font-size:13px">${escape(
    d.since
  )} to ${escape(d.until)}</p>
<p style="margin:0 0 12px"><span style="display:inline-block;padding:2px 10px;border-radius:9999px;color:#fff;background:${
    colour[d.verdict]
  };font-weight:600">${VERDICT_TEXT[d.verdict]}</span>
&nbsp;${d.towns.succeeded}/${d.towns.ran} towns published · ${
    d.runs.failed
  } failed runs · ${d.calls.successful} outputs passed</p>
${heading('What worked')}${list(sections.worked)}
${heading("What didn't")}${list(sections.didnt)}
${heading('What to improve')}${list(sections.improve)}
${heading('Model calls')}
<table style="border-collapse:collapse;font-size:13px;width:100%"><tr><th style="${cell}">Operation</th><th style="${cell}">Model</th><th style="${cell}">Passed / answered</th><th style="${cell}">Unanswered</th><th style="${cell}">p95</th></tr>${
    modelRows || `<tr><td style="${cell}" colspan="5">No model calls</td></tr>`
  }</table>
${heading('Top rejection reasons')}
<table style="border-collapse:collapse;font-size:13px;width:100%"><tr><th style="${cell}">Count</th><th style="${cell}">Reason</th><th style="${cell}">Operations</th></tr>${
    rejectionRows || `<tr><td style="${cell}" colspan="3">None</td></tr>`
  }</table>
<p style="margin:16px 0 0;color:#57606a;font-size:12px">Pipeline health in Towne Square’s Operations page shows the current state.</p>
</body></html>`;
}

/** The window's rows, read for a digest. */
export async function loadDigestInput(
  ds: DataSource,
  report: PipelineHealthReport,
  since: Date,
  until: Date
): Promise<DigestInput> {
  const from = since.toISOString();
  const runs = await ds.getRepository<PipelineRunRow>(PipelineRunSchema).find({
    select: { localitySlug: true, status: true, error: true },
    where: { startedAt: MoreThanOrEqual(from) },
  });
  const generations = await ds
    .getRepository<LlmGenerationRow>(LlmGenerationSchema)
    .find({
      select: {
        operation: true,
        model: true,
        status: true,
        error: true,
        latencyMs: true,
        generatedAt: true,
      },
      where: { generatedAt: MoreThanOrEqual(from) },
    });
  const alerts = ds.getRepository<DaylightAlertRow>(DaylightAlertSchema);
  const opened = await alerts.countBy({
    firstSeenAt: MoreThanOrEqual(from),
    kind: Not('digest'),
  });
  const resolved = await alerts.countBy({
    resolvedAt: MoreThanOrEqual(from),
    kind: Not('digest'),
  });
  return {
    since: from,
    until: until.toISOString(),
    report,
    runs,
    generations,
    alerts: { opened, resolved },
  };
}

export interface DigestSchedule {
  /** HH:MM, local to `timeZone`, from which the day's digest may go out. */
  at: string;
  timeZone: string;
  recipients: readonly string[];
}

/** DAYLIGHT_DIGEST_EMAIL (falls back to DAYLIGHT_ALERT_EMAIL), _AT, _TZ. */
export function digestSchedule(env: NodeJS.ProcessEnv): DigestSchedule {
  const addresses = (
    env['DAYLIGHT_DIGEST_EMAIL'] ??
    env['DAYLIGHT_ALERT_EMAIL'] ??
    ''
  )
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  const at = /^\d{2}:\d{2}$/.test(env['DAYLIGHT_DIGEST_AT'] ?? '')
    ? (env['DAYLIGHT_DIGEST_AT'] as string)
    : '07:00';
  return {
    at,
    timeZone: env['DAYLIGHT_DIGEST_TZ'] || 'America/New_York',
    recipients: addresses,
  };
}

/** The local date (YYYY-MM-DD) and time (HH:MM) of `now` in `timeZone`. */
export function localClock(
  now: Date,
  timeZone: string
): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts['year']}-${parts['month']}-${parts['day']}`,
    time: `${parts['hour']}:${parts['minute']}`,
  };
}

/**
 * Sends the day's digest once, the first check at or after `schedule.at`.
 * A sent digest is recorded as a resolved `digest:<date>` alert row, so a
 * restart does not send it again; a failed send is retried on the next check.
 */
export class DigestSender {
  private readonly logger = new Logger('PipelineDigest');

  constructor(
    private readonly ds: DataSource,
    private readonly email: Pick<EmailService, 'sendEmail'> | null,
    private readonly schedule: DigestSchedule
  ) {}

  async maybeSend(
    report: () => Promise<PipelineHealthReport>,
    now = new Date()
  ): Promise<'sent' | 'not-due' | 'already-sent' | 'no-recipients' | 'failed'> {
    if (!this.email || !this.schedule.recipients.length) return 'no-recipients';
    const clock = localClock(now, this.schedule.timeZone);
    if (clock.time < this.schedule.at) return 'not-due';
    const key = `digest:${clock.date}`;
    const alerts = this.ds.getRepository<DaylightAlertRow>(DaylightAlertSchema);
    if (await alerts.existsBy({ key })) return 'already-sent';

    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const digest = buildDigest(
      await loadDigestInput(this.ds, await report(), since, now)
    );
    const message = renderDigest(digest, clock.date);
    const result = await this.email.sendEmail({
      to: [...this.schedule.recipients],
      ...message,
    });
    if (!result.success) {
      this.logger.error(
        `could not email the daily digest: ${result.error ?? 'unknown error'}`
      );
      return 'failed';
    }
    const at = now.toISOString();
    await alerts.insert({
      key,
      kind: 'digest',
      localitySlug: '*',
      detail: message.subject,
      firstSeenAt: at,
      notifiedAt: at,
      resolvedAt: at,
    });
    this.logger.log(`sent ${message.subject}`);
    return 'sent';
  }
}

/** Failing sources, one line per town, worst towns first. */
function failingByTown(
  failing: PipelineDigest['sources']['failing']
): string[] {
  const byTown = new Map<string, typeof failing>();
  for (const s of failing)
    byTown.set(s.town, [...(byTown.get(s.town) ?? []), s]);
  const lines = [...byTown.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([town, sources]) =>
      sources.length === 1
        ? `${town}: ${sources[0].sourceId} (${
            sources[0].adapter
          }) failing, ${plural(sources[0].attempts, 'attempt')} in a row`
        : `${town}: ${sources.length} sources failing (${[
            ...new Set(sources.map((s) => s.adapter)),
          ].join(', ')}), up to ${plural(
            Math.max(...sources.map((s) => s.attempts)),
            'attempt'
          )} in a row`
    );
  return lines.length > 6
    ? [
        ...lines.slice(0, 6),
        `…and failing sources in ${lines.length - 6} more towns.`,
      ]
    : lines;
}

function groupCauses(
  items: { cause: FailureCause; town: string }[]
): DigestCause[] {
  const groups = new Map<string, DigestCause>();
  for (const { cause, town } of items) {
    const group = groups.get(cause.key) ?? { ...cause, count: 0, towns: [] };
    group.count += 1;
    if (!group.towns.includes(town)) group.towns.push(town);
    groups.set(cause.key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function listTowns(towns: string[]): string {
  return towns.length > 4
    ? `${towns.slice(0, 3).join(', ')} and ${towns.length - 3} more`
    : towns.join(', ');
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function seconds(ms: number, answered: number): string {
  return answered ? `${Math.round(ms / 1000)}s` : '—';
}

function count<T>(rows: readonly T[], test: (row: T) => boolean): number {
  return rows.reduce((n, row) => n + (test(row) ? 1 : 0), 0);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
