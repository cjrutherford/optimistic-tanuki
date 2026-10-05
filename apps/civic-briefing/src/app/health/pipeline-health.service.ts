import { Logger } from '@nestjs/common';
import {
  loadLocalityRegistry,
  type LocalityConfig,
} from '@optimistic-tanuki/civic-core';
import type { EmailService } from '@optimistic-tanuki/email';
import type { PipelineHealthReport } from '@optimistic-tanuki/models';
import type { DataSource } from 'typeorm';
import { loadScheduleConfig } from '../schedule/schedule.config';
import {
  alertRecipients,
  PipelineAlerts,
  pipelineReport,
} from './pipeline-health';

/** How often the pipeline is checked for new problems (PIPELINE_ALERT_MS). */
const DEFAULT_ALERT_MS = 15 * 60 * 1000;

/**
 * Daylight's pipeline health for operators, and the alerts that follow from
 * it (P5.2). The towns are the scheduled editions in CIVIC_LOCALITIES_DIR;
 * without that registry nothing runs, and the report says so.
 */
export class PipelineHealthService {
  private readonly logger = new Logger(PipelineHealthService.name);
  private towns: readonly LocalityConfig[] | null | undefined;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ds: DataSource,
    private readonly email: EmailService | null
  ) {}

  report(): Promise<PipelineHealthReport> {
    return pipelineReport(this.ds, this.editions());
  }

  /**
   * Checks now and then every PIPELINE_ALERT_MS, emailing DAYLIGHT_ALERT_EMAIL
   * about problems not reported before. Started with the daily schedule.
   */
  startAlerts(env: NodeJS.ProcessEnv = process.env): void {
    if (this.timer || !this.editions()) return;
    const recipients = alertRecipients(env['DAYLIGHT_ALERT_EMAIL']);
    if (!recipients.length)
      this.logger.warn(
        'DAYLIGHT_ALERT_EMAIL is not set; pipeline problems are logged, not emailed'
      );
    const alerts = new PipelineAlerts(this.ds, this.email, recipients);
    const every = Number(env['PIPELINE_ALERT_MS']) || DEFAULT_ALERT_MS;
    const check = async () => {
      try {
        const { opened, resolved } = await alerts.check(await this.report());
        if (opened.length || resolved)
          this.logger.log(
            `pipeline alerts: ${opened.length} new, ${resolved} resolved`
          );
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

  private editions(): readonly LocalityConfig[] | null {
    if (this.towns === undefined) {
      const directory = loadScheduleConfig().localitiesDir;
      this.towns = directory
        ? loadLocalityRegistry(directory).editions()
        : null;
    }
    return this.towns;
  }
}
