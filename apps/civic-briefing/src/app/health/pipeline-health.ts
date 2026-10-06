import { Logger } from '@nestjs/common';
import {
  localityHealth,
  type LocalityConfig,
  PipelineRunSchema,
  type PipelineRunRow,
} from '@optimistic-tanuki/civic-core';
import type { EmailService } from '@optimistic-tanuki/email';
import type {
  PipelineHealthReport,
  PipelineSourceProblem,
} from '@optimistic-tanuki/models';
import { IsNull, type DataSource } from 'typeorm';
import {
  DaylightAlertSchema,
  type DaylightAlertRow,
} from './daylight-alert.schema';

/** Run statuses an operator has to look at. */
const FAILED_RUNS = new Set(['failed', 'blocked']);

/**
 * Each town's latest run and the sources that need attention (P5.2). `towns`
 * is null when civic-briefing has no locality registry, so nothing runs.
 */
export async function pipelineReport(
  ds: DataSource,
  towns: readonly LocalityConfig[] | null,
  now = new Date()
): Promise<PipelineHealthReport> {
  if (!towns)
    return { configured: false, checkedAt: now.toISOString(), towns: [] };
  const runs = ds.getRepository<PipelineRunRow>(PipelineRunSchema);
  const report: PipelineHealthReport = {
    configured: true,
    checkedAt: now.toISOString(),
    towns: [],
  };
  for (const town of towns) {
    const [lastRun] = await runs.find({
      where: { localitySlug: town.slug },
      order: { startedAt: 'DESC', id: 'DESC' },
      take: 1,
    });
    const health = await localityHealth(ds, town);
    const problems: PipelineSourceProblem[] = health.sources
      .filter(
        (source) =>
          source.enabled &&
          (source.status === 'failing' || source.status === 'stale')
      )
      .map((source) => ({
        sourceId: source.sourceId,
        adapter: source.adapter,
        status: source.status as 'failing' | 'stale',
        stalenessDays: source.stalenessDays,
        consecutiveFailures: source.consecutiveFailures,
        lastSuccessAt: source.lastSuccessAt,
      }));
    report.towns.push({
      slug: town.slug,
      name: town.name,
      lastRun: lastRun
        ? {
            runId: lastRun.id ?? 0,
            status: lastRun.status,
            cadence: lastRun.cadence,
            startedAt: lastRun.startedAt,
            completedAt: lastRun.completedAt ?? null,
            currentStage: lastRun.currentStage ?? null,
            error: lastRun.error ?? null,
          }
        : null,
      problems,
    });
  }
  return report;
}

export interface PipelineProblem {
  key: string;
  kind: DaylightAlertRow['kind'];
  localitySlug: string;
  detail: string;
}

/** What in a report an operator should be told about, keyed so each is told once. */
export function pipelineProblems(
  report: PipelineHealthReport
): PipelineProblem[] {
  const problems: PipelineProblem[] = [];
  for (const town of report.towns) {
    const run = town.lastRun;
    if (run && FAILED_RUNS.has(run.status)) {
      problems.push({
        key: `run:${run.runId}`,
        kind: 'run-failed',
        localitySlug: town.slug,
        detail: `${town.name}: the ${run.cadence} run started ${
          run.startedAt
        } ended ${run.status}${
          run.currentStage ? ` at ${run.currentStage}` : ''
        }${run.error ? `: ${run.error}` : ''}`,
      });
    }
    for (const source of town.problems) {
      problems.push({
        key: `source:${source.sourceId}:${source.status}`,
        kind: source.status === 'failing' ? 'source-failing' : 'source-stale',
        localitySlug: town.slug,
        detail:
          source.status === 'failing'
            ? `${town.name}: ${source.sourceId} (${source.adapter}) is failing, ${source.consecutiveFailures} attempts in a row`
            : `${town.name}: ${source.sourceId} (${
                source.adapter
              }) has gone quiet${
                source.stalenessDays === null
                  ? ''
                  : `, nothing new for ${source.stalenessDays} days`
              }`,
      });
    }
  }
  return problems;
}

/**
 * Tells an operator about new pipeline problems, once each (P5.2). A problem
 * is recorded when first seen and emailed to `recipients`; it is resolved
 * when it clears, so a recurrence is a new alert. Without recipients (or an
 * email service) problems are still recorded and logged.
 */
export class PipelineAlerts {
  private readonly logger = new Logger('PipelineAlerts');

  constructor(
    private readonly ds: DataSource,
    private readonly email: Pick<EmailService, 'sendEmail'> | null,
    private readonly recipients: readonly string[]
  ) {}

  async check(
    report: PipelineHealthReport,
    now = new Date()
  ): Promise<{ opened: PipelineProblem[]; resolved: number }> {
    const alerts = this.ds.getRepository<DaylightAlertRow>(DaylightAlertSchema);
    const problems = pipelineProblems(report);
    const open = await alerts.find({ where: { resolvedAt: IsNull() } });
    const openKeys = new Set(open.map((alert) => alert.key));
    const currentKeys = new Set(problems.map((problem) => problem.key));
    const at = now.toISOString();

    const resolved = open.filter((alert) => !currentKeys.has(alert.key));
    for (const alert of resolved)
      await alerts.update(alert.id as number, { resolvedAt: at });

    const opened = problems.filter((problem) => !openKeys.has(problem.key));
    if (!opened.length) return { opened, resolved: resolved.length };
    const notified = await this.notify(opened);
    await alerts.insert(
      opened.map((problem) => ({
        ...problem,
        firstSeenAt: at,
        notifiedAt: notified ? at : null,
        resolvedAt: null,
      }))
    );
    return { opened, resolved: resolved.length };
  }

  private async notify(problems: PipelineProblem[]): Promise<boolean> {
    for (const problem of problems) this.logger.warn(problem.detail);
    if (!this.email || !this.recipients.length) return false;
    const count = problems.length;
    const result = await this.email.sendEmail({
      to: [...this.recipients],
      subject: `Daylight: ${count} new pipeline ${
        count === 1 ? 'problem' : 'problems'
      }`,
      text: [
        'Daylight found new problems in the briefing pipeline:',
        '',
        ...problems.map((problem) => `- ${problem.detail}`),
        '',
        'Pipeline health in Towne Square’s Operations page shows the current state.',
        'You are told once per problem; it is reported again only if it clears and comes back.',
      ].join('\n'),
    });
    if (!result.success) {
      this.logger.error(
        `could not email the pipeline alert: ${result.error ?? 'unknown error'}`
      );
      return false;
    }
    return true;
  }
}

/** DAYLIGHT_ALERT_EMAIL: comma-separated operator addresses. */
export function alertRecipients(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
}
