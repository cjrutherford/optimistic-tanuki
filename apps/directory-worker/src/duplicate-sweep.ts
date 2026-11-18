import type { DataSource } from 'typeorm';
import { isPaused } from '../../directory/src/operating-controls';
import { queueUncertainDuplicates } from '../../directory/src/duplicate-review';

/**
 * Owner decision D13 sweep: hide the weaker listing of an uncertain duplicate and queue the pair. Bounded per run,
 * idempotent (the queue never re-queues a pair that has a case) and never touches provenance.
 */
export interface DuplicateSweepConfig {
  intervalMs: number;
  /** Towns examined per run. */
  limit: number;
  /** A town whose scans did not change is examined again after this long (records reviewer-lifted suppressions). */
  recheckMs: number;
}

const int = (
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  min: number,
  max: number
): number => {
  const raw = env[key];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw Error(`Invalid ${key}`);
  return value;
};

/** Returns null (sweep disabled) only when DIRECTORY_AUTO_DUPLICATES is 'off'; anything but on/off is rejected. */
export function duplicateSweepConfig(
  env: NodeJS.ProcessEnv
): DuplicateSweepConfig | null {
  const mode = (env['DIRECTORY_AUTO_DUPLICATES'] ?? 'on').trim().toLowerCase();
  if (mode === 'off') return null;
  if (mode !== 'on') throw Error('Invalid DIRECTORY_AUTO_DUPLICATES');
  return {
    intervalMs: int(
      env,
      'DIRECTORY_AUTO_DUPLICATES_INTERVAL_MS',
      300_000,
      1000,
      86_400_000
    ),
    limit: int(env, 'DIRECTORY_AUTO_DUPLICATES_LIMIT', 5, 1, 50),
    recheckMs: int(
      env,
      'DIRECTORY_AUTO_DUPLICATES_RECHECK_MS',
      21_600_000,
      60_000,
      604_800_000
    ),
  };
}

export interface DuplicateSweepOutcome {
  status: 'ok' | 'paused';
  examined: number;
  queued: number;
  keptSeparateRecorded: number;
  failed: number;
}

interface DuplicateSweepSource {
  /** The town's current assignment change token, or null when Social cannot say. */
  changeToken(townId: string): Promise<string | null>;
}

/** Towns with a live completed scan, with a signature of the scans that make up what they serve. */
const TOWNS_SQL = `SELECT t."communityId" AS town, string_agg(t."scanId", ',' ORDER BY t."scanId") AS scans
  FROM directory_town_scan_target t
  JOIN directory_overture_private_completion c ON c."scanId"=t."scanId"
 WHERE NOT EXISTS (SELECT 1 FROM directory_overture_private_revocation x WHERE x."scanId"=t."scanId")
   AND NOT EXISTS (SELECT 1 FROM directory_town_scan_retirement z WHERE z."communityId"=t."communityId" AND z."scanId"=t."scanId")
 GROUP BY t."communityId" ORDER BY t."communityId"`;

export function createDuplicateSweepRunner(
  config: DuplicateSweepConfig,
  db: () => DataSource,
  source: DuplicateSweepSource,
  log: (message: string) => void = (m) => console.error(m),
  now: () => number = Date.now
): (signal?: AbortSignal) => Promise<DuplicateSweepOutcome> {
  // In memory only: a restart re-examines every town once, which is safe because the queue is idempotent.
  const seen = new Map<string, { scans: string; at: number }>();
  return async (signal) => {
    const data = db();
    const out: DuplicateSweepOutcome = {
      status: 'ok',
      examined: 0,
      queued: 0,
      keptSeparateRecorded: 0,
      failed: 0,
    };
    if (await isPaused(data, 'provider_acquisition')) {
      out.status = 'paused';
      return out;
    }
    const towns: Array<{ town: string; scans: string }> = await data.query(
      TOWNS_SQL
    );
    const due = towns
      .filter((t) => {
        const last = seen.get(t.town);
        return (
          !last || last.scans !== t.scans || now() - last.at >= config.recheckMs
        );
      })
      .sort(
        (a, b) =>
          (seen.get(a.town)?.at ?? 0) - (seen.get(b.town)?.at ?? 0) ||
          (a.town < b.town ? -1 : 1)
      )
      .slice(0, config.limit);
    for (const t of due) {
      if (signal?.aborted) break;
      out.examined += 1;
      try {
        const changeToken = await source.changeToken(t.town);
        if (!changeToken) {
          out.failed += 1;
          continue;
        }
        const result = await queueUncertainDuplicates(data as never, {
          townId: t.town,
          changeToken,
        });
        out.queued += result.queued;
        out.keptSeparateRecorded += result.keptSeparateRecorded;
        seen.set(t.town, { scans: t.scans, at: now() });
      } catch {
        out.failed += 1;
        log('duplicate sweep: a town failed');
      }
    }
    return out;
  };
}

export type DuplicateSweepSnapshot = {
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: DuplicateSweepOutcome['status'] | 'error' | null;
  examined: number;
  queued: number;
  failed: number;
};

export class DuplicateSweepStatus {
  private value: DuplicateSweepSnapshot;
  constructor(enabled: boolean) {
    this.value = {
      enabled,
      lastRunAt: null,
      lastStatus: null,
      examined: 0,
      queued: 0,
      failed: 0,
    };
  }
  record(
    status: DuplicateSweepSnapshot['lastStatus'],
    run?: DuplicateSweepOutcome
  ): void {
    this.value = {
      enabled: this.value.enabled,
      lastRunAt: new Date().toISOString(),
      lastStatus: status,
      examined: run?.examined ?? 0,
      queued: run?.queued ?? 0,
      failed: run?.failed ?? 0,
    };
  }
  snapshot(): DuplicateSweepSnapshot {
    return this.value;
  }
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/** Sequential, never throws. A run that examined a full batch runs again soon so a backlog drains at the per-run bound. */
export async function runDuplicateSweepLoop(options: {
  signal: AbortSignal;
  intervalMs: number;
  limit: number;
  run: (signal: AbortSignal) => Promise<DuplicateSweepOutcome>;
  status: DuplicateSweepStatus;
  pause?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<void> {
  const log = options.log ?? ((m: string) => console.error(m));
  const pause = options.pause ?? ((ms: number) => delay(ms, options.signal));
  while (!options.signal.aborted) {
    let wait = options.intervalMs;
    try {
      const run = await options.run(options.signal);
      options.status.record(run.status, run);
      if (run.examined > 0)
        log(
          `duplicate sweep: ${run.status} examined=${run.examined} queued=${run.queued} keptSeparate=${run.keptSeparateRecorded} failed=${run.failed}`
        );
      if (run.examined >= options.limit && run.failed < run.examined)
        wait = Math.min(wait, 5000);
    } catch {
      options.status.record('error');
      log('duplicate sweep failed');
    }
    if (!options.signal.aborted) await pause(wait);
  }
}
