import { DataSource } from 'typeorm';
import { reviewedBindingKeyFromEnv } from '../../directory/src/reviewed-binding';
import { DEFAULT_LEASE_MS, DEFAULT_SUSPENSION_TIMEOUT_MS, sweepBindings } from '../../directory/src/reviewed-binding-revalidate';

export type BindingSweepConfig = {
  liveUrl: string;
  stageUrl: string;
  stageLabel: string;
  key: string;
  intervalMs: number;
  limit: number;
  leaseMs: number;
  suspensionTimeoutMs: number;
};

export type BindingSweepRun = { status: 'ok' | 'stage-unreachable'; examined: number; counts: Record<string, number> };

export type BindingSweepSnapshot = {
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: 'ok' | 'stage-unreachable' | 'error' | null;
  examined: number;
  counts: Record<string, number>;
};

const required = ['DIRECTORY_DATABASE_URL', 'DIRECTORY_CONTACT_STAGE_DATABASE_URL', 'DIRECTORY_CONTACT_STAGE_LABEL', 'DIRECTORY_REVIEWED_BINDING_HMAC_KEY'] as const;

/** Returns null (sweep disabled) unless all four settings are present. Never echoes values. */
export function bindingSweepConfig(env: NodeJS.ProcessEnv): BindingSweepConfig | null {
  if (required.some((name) => !(env[name] ?? '').trim())) return null;
  const intervalMs = Number(env.DIRECTORY_BINDING_SWEEP_INTERVAL_MS || 3_600_000);
  if (!Number.isSafeInteger(intervalMs) || intervalMs < 1000 || intervalMs > 86_400_000) throw Error('Invalid binding sweep interval');
  return {
    liveUrl: env.DIRECTORY_DATABASE_URL as string,
    stageUrl: env.DIRECTORY_CONTACT_STAGE_DATABASE_URL as string,
    stageLabel: (env.DIRECTORY_CONTACT_STAGE_LABEL as string).trim(),
    key: reviewedBindingKeyFromEnv(env),
    intervalMs,
    limit: 500,
    leaseMs: DEFAULT_LEASE_MS,
    suspensionTimeoutMs: DEFAULT_SUSPENSION_TIMEOUT_MS,
  };
}

export class BindingSweepStatus {
  private snapshotValue: BindingSweepSnapshot;
  constructor(enabled: boolean) {
    this.snapshotValue = { enabled, lastRunAt: null, lastStatus: null, examined: 0, counts: {} };
  }
  record(status: BindingSweepSnapshot['lastStatus'], run?: BindingSweepRun): void {
    this.snapshotValue = { ...this.snapshotValue, lastRunAt: new Date().toISOString(), lastStatus: status, examined: run?.examined ?? 0, counts: run?.counts ?? {} };
  }
  snapshot(): BindingSweepSnapshot { return this.snapshotValue; }
}

/** One sweep with the production wiring. The stage session is read-only; unreachable stage means no writes at all. */
export function createBindingSweepRunner(config: BindingSweepConfig): () => Promise<BindingSweepRun> {
  return async () => {
    const live = new DataSource({ type: 'postgres', url: config.liveUrl, extra: { connectionTimeoutMillis: 5000 } });
    const stage = new DataSource({
      type: 'postgres',
      url: config.stageUrl,
      extra: { options: '-c default_transaction_read_only=on -c statement_timeout=15000', connectionTimeoutMillis: 5000 },
    });
    await live.initialize();
    try {
      try { await stage.initialize(); } catch { return { status: 'stage-unreachable', examined: 0, counts: {} }; }
      try {
        const summary = await sweepBindings(live, stage, config.key, {
          apply: true, limit: config.limit, leaseMs: config.leaseMs, suspensionTimeoutMs: config.suspensionTimeoutMs, stageInstallationId: config.stageLabel,
        });
        return { status: 'ok', examined: summary.examined, counts: { ...summary.counts } };
      } finally { await stage.destroy(); }
    } finally { await live.destroy(); }
  };
}

type LoopOptions = {
  signal: AbortSignal;
  intervalMs: number;
  run: () => Promise<BindingSweepRun>;
  status: BindingSweepStatus;
  pause?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
};

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/** Sequential by construction: the next run is only scheduled after the previous one settles. Never throws. */
export async function runBindingSweepLoop(options: LoopOptions): Promise<void> {
  const log = options.log ?? ((m: string) => console.error(m));
  const pause = options.pause ?? ((ms: number) => delay(ms, options.signal));
  while (!options.signal.aborted) {
    try {
      const run = await options.run();
      options.status.record(run.status, run);
      if (run.status === 'stage-unreachable') log('binding sweep skipped: contact stage unreachable');
    } catch {
      options.status.record('error');
      log('binding sweep failed');
    }
    if (!options.signal.aborted) await pause(options.intervalMs);
  }
}
