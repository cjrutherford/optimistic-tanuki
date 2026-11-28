import { Logger } from '@nestjs/common';
import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import type { EmailService } from '@optimistic-tanuki/email';
import type {
  PipelineDashboard,
  PipelineHealthReport,
} from '@optimistic-tanuki/models';
import type { DataSource } from 'typeorm';
import type { LocalityRegistrySource } from '../registry/locality-registry.source';
import {
  alertRecipients,
  PipelineAlerts,
  pipelineReport,
} from './pipeline-health';
import {
  buildDigest,
  DigestSender,
  digestSchedule,
  loadDigestInput,
} from './pipeline-digest';
import { loadTrend } from './pipeline-trend';

/** How often the pipeline is checked for new problems (PIPELINE_ALERT_MS). */
const DEFAULT_ALERT_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Days of history on the operations dashboard's trend. */
const TREND_DAYS = 7;

/**
 * Daylight's pipeline health for operators, and the alerts that follow from
 * it (P5.2). The towns are the scheduled editions of the database-built
 * registry, read fresh each time so a sync's new towns are reported.
 */
export class PipelineHealthService {
  private readonly logger = new Logger(PipelineHealthService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ds: DataSource,
    private readonly email: EmailService | null,
    private readonly registry: Pick<LocalityRegistrySource, 'current'>
  ) {}

  report(): Promise<PipelineHealthReport> {
    return pipelineReport(
      this.ds,
      this.editions(),
      new Date(),
      this.registry.current()
    );
  }

  /**
   * The operations dashboard: the health report, the last 24 hours as the
   * daily digest summarises them, and a week's trend in the digest timezone.
   */
  async dashboard(
    env: NodeJS.ProcessEnv = process.env,
    now = new Date()
  ): Promise<PipelineDashboard> {
    const health = await pipelineReport(
      this.ds,
      this.editions(),
      now,
      this.registry.current()
    );
    const { timeZone } = digestSchedule(env);
    const digest = buildDigest(
      await loadDigestInput(
        this.ds,
        health,
        new Date(now.getTime() - DAY_MS),
        now
      )
    );
    const trend = await loadTrend(this.ds, now, TREND_DAYS, timeZone);
    return { health, digest, trend, timeZone };
  }

  /**
   * Checks now and then every PIPELINE_ALERT_MS, emailing DAYLIGHT_ALERT_EMAIL
   * about problems not reported before, and sending the daily digest once a
   * day at DAYLIGHT_DIGEST_AT (see digestSchedule). Started with the daily
   * schedule.
   */
  startAlerts(env: NodeJS.ProcessEnv = process.env): void {
    if (this.timer) return;
    const recipients = alertRecipients(env['DAYLIGHT_ALERT_EMAIL']);
    if (!recipients.length)
      this.logger.warn(
        'DAYLIGHT_ALERT_EMAIL is not set; pipeline problems are logged, not emailed'
      );
    const alerts = new PipelineAlerts(this.ds, this.email, recipients);
    const schedule = digestSchedule(env);
    const digest = new DigestSender(this.ds, this.email, schedule);
    if (schedule.recipients.length)
      this.logger.log(
        `daily digest at ${schedule.at} ${schedule.timeZone} to ${schedule.recipients.length} recipient(s)`
      );
    const every = Number(env['PIPELINE_ALERT_MS']) || DEFAULT_ALERT_MS;
    const check = async () => {
      try {
        const report = await this.report();
        const { opened, resolved } = await alerts.check(report);
        if (opened.length || resolved)
          this.logger.log(
            `pipeline alerts: ${opened.length} new, ${resolved} resolved`
          );
        await digest.maybeSend(async () => report);
      } catch (error) {
        this.logger.error(
          `pipeline health check failed: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    };
    void check();
    this.timer = setInterval(() => void check(), every);
  }

  stopAlerts(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private editions(): readonly LocalityConfig[] {
    return this.registry.current().editions();
  }
}
