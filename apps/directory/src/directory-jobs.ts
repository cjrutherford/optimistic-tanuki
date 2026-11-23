import { randomUUID } from 'node:crypto';
import { recordOperatorEvent } from './operator-audit';
import {
  renormalizeScan,
  scansNeedingNormalization,
  type RenormalizeOutcome,
} from './renormalize';

/**
 * Guarded maintenance jobs started from the owner console. The directory has no general job table (acquisition and
 * taxonomy runs each own theirs), so these run in-process and are tracked in a small registry: status and counts live
 * in memory, so a restart forgets them. That is safe because the work is idempotent: a re-normalize pass skips a row
 * already on the current version, and a half-finished real run simply resumes on the next one. The audit rows
 * (`directory_operator_event`, kind `job`) are durable and record who started what and how it ended.
 *
 * Only one job of a kind runs at a time; a second start while one runs is refused with `job_running`.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const JOB_RETENTION = 25;
export const RENORMALIZE_SCAN_LIMIT = 1000;

export type JobStatus = 'running' | 'succeeded' | 'failed';
export interface DirectoryJob {
  id: string;
  kind: 'renormalize';
  status: JobStatus;
  dryRun: boolean;
  townId: string | null;
  startedAt: string;
  finishedAt: string | null;
  counts: {
    scansTotal: number;
    scansDone: number;
    scanned: number;
    updated: number;
    skipped: number;
  };
  /** A short, non-secret reason when `status` is `failed`. */
  error: string | null;
}

export class JobRunningError extends Error {
  constructor() {
    super('A job is already running');
  }
}

interface Db {
  query(sql: string, params?: unknown[]): Promise<any[]>;
  transaction<T>(work: (manager: any) => Promise<T>): Promise<T>;
}

export interface JobRunner {
  scans(townId?: string): Promise<string[]>;
  run(
    scanId: string,
    options: { dryRun: boolean }
  ): Promise<Pick<RenormalizeOutcome, 'scanned' | 'updated' | 'skipped'>>;
}

export function productionRunner(db: Db): JobRunner {
  return {
    scans: (townId) =>
      scansNeedingNormalization(
        db as never,
        RENORMALIZE_SCAN_LIMIT,
        undefined,
        townId
      ),
    run: (scanId, options) => renormalizeScan(db as never, scanId, options),
  };
}

export class DirectoryJobs {
  private readonly jobs = new Map<string, DirectoryJob>();
  /** Settles when the job's background pass ends; tests await it, the server never does. */
  private readonly done = new Map<string, Promise<void>>();

  constructor(
    private readonly db: Pick<Db, 'query'>,
    private readonly runner: JobRunner,
    private readonly now: () => Date = () => new Date()
  ) {}

  async startRenormalize(input: {
    actorId: string;
    townId?: string;
    dryRun?: boolean;
    reason?: string;
  }): Promise<DirectoryJob> {
    const dryRun = input.dryRun ?? true;
    if (
      !UUID.test(input.actorId || '') ||
      (input.townId !== undefined && !UUID.test(input.townId)) ||
      typeof dryRun !== 'boolean' ||
      (!dryRun && !(typeof input.reason === 'string' && input.reason.trim())) ||
      (input.reason !== undefined &&
        (typeof input.reason !== 'string' || input.reason.length > 1024))
    )
      throw Error('Invalid job');
    if ([...this.jobs.values()].some((j) => j.status === 'running'))
      throw new JobRunningError();
    const job: DirectoryJob = {
      id: randomUUID(),
      kind: 'renormalize',
      status: 'running',
      dryRun,
      townId: input.townId ?? null,
      startedAt: this.now().toISOString(),
      finishedAt: null,
      counts: {
        scansTotal: 0,
        scansDone: 0,
        scanned: 0,
        updated: 0,
        skipped: 0,
      },
      error: null,
    };
    this.jobs.set(job.id, job);
    this.trim();
    try {
      await recordOperatorEvent(this.db, {
        kind: 'job',
        subjectId: job.id,
        action: 'start',
        actorId: input.actorId,
        reason: input.reason?.trim() || null,
        detail: { job: job.kind, dryRun, townId: job.townId },
      });
    } catch (error) {
      this.jobs.delete(job.id);
      throw error;
    }
    this.done.set(job.id, this.execute(job, input.actorId));
    return { ...job, counts: { ...job.counts } };
  }

  private async execute(job: DirectoryJob, actorId: string): Promise<void> {
    try {
      const scans = await this.runner.scans(job.townId ?? undefined);
      job.counts.scansTotal = scans.length;
      for (const scanId of scans) {
        const out = await this.runner.run(scanId, { dryRun: job.dryRun });
        job.counts.scansDone++;
        job.counts.scanned += out.scanned;
        job.counts.updated += out.updated;
        job.counts.skipped += out.skipped;
      }
      job.status = 'succeeded';
    } catch {
      job.status = 'failed';
      job.error =
        'The pass stopped before it finished; run it again to resume.';
    }
    job.finishedAt = this.now().toISOString();
    try {
      await recordOperatorEvent(this.db, {
        kind: 'job',
        subjectId: job.id,
        action: job.status === 'succeeded' ? 'finish' : 'fail',
        actorId,
        detail: { ...job.counts, dryRun: job.dryRun },
      });
    } catch {
      /* The in-memory record is already final; the start row stands. */
    }
  }

  private trim(): void {
    const finished = [...this.jobs.values()].filter(
      (j) => j.status !== 'running'
    );
    while (this.jobs.size > JOB_RETENTION && finished.length) {
      const oldest = finished.shift() as DirectoryJob;
      this.jobs.delete(oldest.id);
      this.done.delete(oldest.id);
    }
  }

  get(id: string): DirectoryJob | null {
    const job = this.jobs.get(id);
    return job ? { ...job, counts: { ...job.counts } } : null;
  }

  list(limit = 10): DirectoryJob[] {
    return [...this.jobs.values()]
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
      .map((j) => ({ ...j, counts: { ...j.counts } }));
  }

  /** Test hook: resolves when the job's background pass has ended. */
  settled(id: string): Promise<void> {
    return this.done.get(id) ?? Promise.resolve();
  }
}
