import { readFileSync } from 'node:fs';
import type { DataSource } from 'typeorm';
import {
  AutoAcquisitionConfig,
  AutoSweepOutcome,
  DEFAULT_AUTO_CONFIG,
  ExtractRequest,
  runAutoAcquisitionSweep,
} from '../../directory/src/overture-auto-acquisition';
import type { OvertureInventory } from '../../directory/src/overture-stage-core';
import type { OvertureRightsPolicy } from '../../directory/src/overture-rights';
import { SpatialSession } from './geometry-sweep';
import {
  AtpRightsPolicy,
  selectAtpPolicy,
} from '../../directory/src/alltheplaces';
import { runAtpAcquisitionSweep } from '../../directory/src/alltheplaces-acquisition';
import {
  runGeoapifySweep,
  selectGeoapifyPolicy,
} from '../../directory/src/geoapify-enrichment';
import { createAtpSnapshotProvider } from './alltheplaces-snapshot';

/** The release the owner pinned (D1). Acquisition is for this release only. */
export const PINNED_OVERTURE_RELEASE = '2026-10-21.0';

export type AcquisitionSweepConfig = AutoAcquisitionConfig & {
  intervalMs: number;
  inventoryFile: string;
  rightsPolicyFile: string;
};

/** Returns null (sweep disabled) only when DIRECTORY_AUTO_ACQUISITION is 'off'; anything but on/off is rejected. */
export function acquisitionSweepConfig(
  env: NodeJS.ProcessEnv
): AcquisitionSweepConfig | null {
  const mode = (env['DIRECTORY_AUTO_ACQUISITION'] ?? 'on').trim().toLowerCase();
  if (mode === 'off') return null;
  if (mode !== 'on') throw Error('Invalid DIRECTORY_AUTO_ACQUISITION');
  const int = (name: string, fallback: number, min: number, max: number) => {
    const value = Number(env[name] || fallback);
    if (!Number.isSafeInteger(value) || value < min || value > max)
      throw Error(`Invalid ${name}`);
    return value;
  };
  return {
    intervalMs: int(
      'DIRECTORY_AUTO_ACQUISITION_INTERVAL_MS',
      120_000,
      1000,
      86_400_000
    ),
    limit: int(
      'DIRECTORY_AUTO_ACQUISITION_LIMIT',
      DEFAULT_AUTO_CONFIG.limit,
      1,
      20
    ),
    maxAssets: int(
      'DIRECTORY_AUTO_ACQUISITION_MAX_ASSETS',
      DEFAULT_AUTO_CONFIG.maxAssets,
      1,
      16
    ),
    retryBackoffMs: int(
      'DIRECTORY_AUTO_ACQUISITION_RETRY_BACKOFF_MS',
      DEFAULT_AUTO_CONFIG.retryBackoffMs,
      1000,
      2_000_000_000
    ),
    maxAttempts: int(
      'DIRECTORY_AUTO_ACQUISITION_MAX_ATTEMPTS',
      DEFAULT_AUTO_CONFIG.maxAttempts,
      1,
      20
    ),
    inventoryFile:
      env['DIRECTORY_AUTO_ACQUISITION_INVENTORY_FILE'] ||
      '/etc/directory/overture/inventory.json',
    rightsPolicyFile: env['DIRECTORY_RIGHTS_POLICY_FILE'] || '',
  };
}

/** Pinned-inventory and rights-policy loading. Null means there is nothing approved to acquire under. */
export function loadAcquisitionInputs(
  config: AcquisitionSweepConfig,
  read: (file: string) => string = (f) => readFileSync(f, 'utf8')
): { inventory: OvertureInventory; rights: OvertureRightsPolicy } | null {
  try {
    if (!config.rightsPolicyFile) return null;
    const inventory = JSON.parse(
      read(config.inventoryFile)
    ) as OvertureInventory;
    if (inventory.release !== PINNED_OVERTURE_RELEASE) return null;
    const parsed = JSON.parse(read(config.rightsPolicyFile));
    const rights = (Array.isArray(parsed) ? parsed : [parsed]).find(
      (p) => p?.releaseId === PINNED_OVERTURE_RELEASE
    );
    return rights ? { inventory, rights } : null;
  } catch {
    return null;
  }
}

type Extractor = (args: Record<string, unknown>) => Promise<{
  scanId?: string | null;
  sourceFileRowNumber?: number | null;
}>;

export function createAcquisitionSweepRunner(
  config: AcquisitionSweepConfig,
  db: () => DataSource,
  log: (message: string) => void = (m) => console.error(m)
): (signal?: AbortSignal) => Promise<AutoSweepOutcome> {
  return async (signal) => {
    const inputs = loadAcquisitionInputs(config);
    if (!inputs) throw Error('Acquisition inputs unavailable');
    // Loaded here, not at module scope: the ESM extractor and DuckDB are only needed when a sweep has work.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractPrivate } =
      require('../../../scripts/overture-private-extractor.mjs') as {
        extractPrivate: Extractor;
      };
    const spatial = new SpatialSession();
    let remote = false;
    try {
      return await runAutoAcquisitionSweep({
        db: db(),
        inventory: inputs.inventory,
        rights: inputs.rights,
        config,
        signal,
        log,
        extract: async (request: ExtractRequest) => {
          const connection = await spatial.connection();
          if (!remote) {
            await connection.run('LOAD httpfs');
            remote = true;
          }
          return extractPrivate({
            connection,
            sourceMode: 'remote',
            ...request,
          });
        },
      });
    } finally {
      spatial.close();
    }
  };
}

/** The standalone AllThePlaces policy entry (pinned archive), or null when none is approved. */
export function loadAtpPolicy(
  rightsPolicyFile: string,
  read: (file: string) => string = (f) => readFileSync(f, 'utf8')
): AtpRightsPolicy | null {
  try {
    return rightsPolicyFile
      ? selectAtpPolicy(JSON.parse(read(rightsPolicyFile)))
      : null;
  } catch {
    return null;
  }
}

export function createAtpSweepRunner(
  config: AcquisitionSweepConfig,
  db: () => DataSource,
  cacheDir: string,
  log: (message: string) => void = (m) => console.error(m)
): (signal?: AbortSignal) => Promise<AutoSweepOutcome> {
  return async (signal) => {
    const policy = loadAtpPolicy(config.rightsPolicyFile);
    if (!policy) throw Error('AllThePlaces policy unavailable');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { extractPrivate } =
      require('../../../scripts/overture-private-extractor.mjs') as {
        extractPrivate: Extractor;
      };
    const spatial = new SpatialSession();
    try {
      return await runAtpAcquisitionSweep({
        db: db(),
        policy,
        config,
        signal,
        log,
        ensureSnapshot: createAtpSnapshotProvider({
          policy,
          cacheDir,
          log,
          connection: () => spatial.connection() as never,
        }),
        extract: async (request) =>
          extractPrivate({
            connection: await spatial.connection(),
            sourceMode: 'local',
            ...request,
          }),
      });
    } finally {
      spatial.close();
    }
  };
}

export function createGeoapifySweepRunner(
  config: AcquisitionSweepConfig,
  db: () => DataSource,
  env: NodeJS.ProcessEnv,
  log: (message: string) => void = (m) => console.error(m)
): (signal?: AbortSignal) => Promise<AutoSweepOutcome> {
  return async (signal) => {
    let policy = null;
    try {
      policy = selectGeoapifyPolicy(
        JSON.parse(readFileSync(config.rightsPolicyFile, 'utf8'))
      );
    } catch {
      /* no policy: the sweep records it */
    }
    const cost = Number(env['DIRECTORY_GEOAPIFY_COST_CENTS'] || 1);
    const batch = Number(env['DIRECTORY_GEOAPIFY_BATCH'] || 20);
    if (!Number.isSafeInteger(cost) || cost < 1 || cost > 100)
      throw Error('Invalid DIRECTORY_GEOAPIFY_COST_CENTS');
    if (!Number.isSafeInteger(batch) || batch < 1 || batch > 200)
      throw Error('Invalid DIRECTORY_GEOAPIFY_BATCH');
    const daily = Number(env['DIRECTORY_GEOAPIFY_DAILY_LOOKUPS'] || 50);
    if (!Number.isSafeInteger(daily) || daily < 1 || daily > 2500)
      throw Error('Invalid DIRECTORY_GEOAPIFY_DAILY_LOOKUPS');
    return runGeoapifySweep({
      dailyLookups: daily,
      db: db(),
      apiKey: env['GEOAPIFY_API_KEY'],
      policy,
      costCents: cost,
      batch,
      signal,
      log,
    });
  };
}

export type AcquisitionSweepSnapshot = {
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: AutoSweepOutcome['status'] | 'error' | null;
  examined: number;
  succeeded: number;
  failed: number;
};

export class AcquisitionSweepStatus {
  private value: AcquisitionSweepSnapshot;
  constructor(enabled: boolean) {
    this.value = {
      enabled,
      lastRunAt: null,
      lastStatus: null,
      examined: 0,
      succeeded: 0,
      failed: 0,
    };
  }
  record(
    status: AcquisitionSweepSnapshot['lastStatus'],
    run?: AutoSweepOutcome
  ): void {
    this.value = {
      enabled: this.value.enabled,
      lastRunAt: new Date().toISOString(),
      lastStatus: status,
      examined: run?.examined ?? 0,
      succeeded: (run?.succeeded ?? 0) + (run?.empty ?? 0),
      failed: run?.failed ?? 0,
    };
  }
  snapshot(): AcquisitionSweepSnapshot {
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

/** Sequential, never throws. A sweep that did work runs again soon so a backlog drains at the per-sweep bound. */
export async function runAcquisitionSweepLoop(options: {
  signal: AbortSignal;
  intervalMs: number;
  run: (signal: AbortSignal) => Promise<AutoSweepOutcome>;
  status: AcquisitionSweepStatus;
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
      if (run.examined > 0 || run.recordedPending > 0)
        log(
          `acquisition sweep: ${run.status} examined=${run.examined} succeeded=${run.succeeded} empty=${run.empty} partial=${run.partial} failed=${run.failed} blocked=${run.blocked}`
        );
      if (run.status === 'ok' && run.examined > 0 && run.failed < run.examined)
        wait = Math.min(wait, 5000);
    } catch {
      options.status.record('error');
      log('acquisition sweep failed');
    }
    if (!options.signal.aborted) await pause(wait);
  }
}
