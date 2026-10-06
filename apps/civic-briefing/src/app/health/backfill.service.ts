import { Logger } from '@nestjs/common';
import type {
  BackfillRequest,
  BackfillStatus,
} from '@optimistic-tanuki/models';

/** What a backfill needs from the daily schedule. */
export interface BackfillSchedule {
  townSlugs(): string[];
  exclusive<T>(work: () => Promise<T>): Promise<T>;
  pullNow(
    slugs: readonly string[]
  ): Promise<{ town: string; action: string }[]>;
  backfill(
    slugs: readonly string[],
    days?: number
  ): Promise<{ town: string; action: string }[]>;
}

/**
 * An operator's pull and backfill (D31), run in the background: town by
 * town, a pull, then the town's past editions. One at a time, and the
 * daily schedule waits while it runs. The schedule is attached at startup
 * only where a town registry is configured.
 */
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);
  private schedule: BackfillSchedule | null = null;
  private state: BackfillStatus = {
    running: false,
    configured: false,
    towns: [],
    days: null,
    startedAt: null,
    finishedAt: null,
    steps: [],
    problem: null,
  };
  private work: Promise<void> | null = null;

  attach(schedule: BackfillSchedule): void {
    this.schedule = schedule;
    this.state = { ...this.state, configured: true };
  }

  status(): BackfillStatus {
    return { ...this.state, steps: [...this.state.steps] };
  }

  /** Starts a backfill unless one is running; answers with the status either way. */
  start(request: BackfillRequest = {}): BackfillStatus {
    const schedule = this.schedule;
    if (!schedule)
      return {
        ...this.status(),
        problem:
          'No town registry is configured (CIVIC_LOCALITIES_DIR), so there is nothing to backfill.',
      };
    if (this.state.running) return this.status();
    const known = schedule.townSlugs();
    const towns = request.towns?.length ? request.towns : known;
    const unknown = towns.filter((town) => !known.includes(town));
    if (unknown.length)
      return {
        ...this.status(),
        problem: `Not a scheduled town: ${unknown.join(', ')}.`,
      };
    this.state = {
      running: true,
      configured: true,
      towns,
      days: request.days ?? null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      steps: [],
      problem: null,
    };
    this.work = this.run(schedule, towns, request.days);
    return this.status();
  }

  /** Resolves when the current backfill, if any, has finished. For tests. */
  async settled(): Promise<void> {
    await this.work;
  }

  private async run(
    schedule: BackfillSchedule,
    towns: string[],
    days: number | undefined
  ): Promise<void> {
    try {
      await schedule.exclusive(async () => {
        for (const town of towns) {
          this.state.steps.push(...(await schedule.pullNow([town])));
          this.state.steps.push(...(await schedule.backfill([town], days)));
        }
      });
    } catch (error) {
      this.state.problem =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`backfill stopped: ${this.state.problem}`);
    } finally {
      this.state.running = false;
      this.state.finishedAt = new Date().toISOString();
    }
  }
}
