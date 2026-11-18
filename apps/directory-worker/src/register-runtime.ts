import { createServer, Server } from 'node:http';
import { DataSource } from 'typeorm';
import { DirectoryRecoveryIdentity } from '../../directory/src/register-recovery-authority';
import {
  RegisterDeliveryV2,
  RegisterSourceIdentity,
} from './register-delivery';
import { registerBootstrapPage } from './register-bootstrap';
import { registerSweepPage } from './register-sweep';
import { runRegisterLoop } from './register-loop';
import {
  BindingSweepConfig,
  BindingSweepStatus,
  bindingSweepConfig,
  createBindingSweepRunner,
  runBindingSweepLoop,
} from './binding-sweep';
import { retryUntilReady } from './startup-retry';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const gen = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[1-9][0-9]*$/.test(v) &&
  BigInt(v) <= 9223372036854775807n;
const fields = [
  'sourceEpoch',
  'recoveryEpoch',
  'owner',
  'activationId',
  'socialGeneration',
  'directoryGeneration',
] as const;
export type RegisterWorkerConfig = {
  databaseUrl: string;
  host: string;
  port: number;
  readSecret: string;
  repairSecret: string;
  identity: DirectoryRecoveryIdentity;
  externalFence: true;
  workerPort: number;
  sweepIntervalMs: number;
  bindingSweep: BindingSweepConfig | null;
  startupTimeoutMs: number;
};
export function registerWorkerConfig(
  env: NodeJS.ProcessEnv
): RegisterWorkerConfig {
  const need = (key: string) => {
    const v = env[key];
    if (!v) throw Error(`${key} is required`);
    return v;
  };
  let raw: any;
  try {
    raw = JSON.parse(need('DIRECTORY_REGISTER_RUNTIME_IDENTITY'));
  } catch {
    throw Error('DIRECTORY_REGISTER_RUNTIME_IDENTITY must be valid JSON');
  }
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    Object.keys(raw).length !== 6 ||
    fields.some((k) => !(k in raw))
  )
    throw Error(
      'DIRECTORY_REGISTER_RUNTIME_IDENTITY must contain the complete six-field identity'
    );
  if (
    ![raw.sourceEpoch, raw.recoveryEpoch, raw.owner, raw.activationId].every(
      (v: unknown) => typeof v === 'string' && uuid.test(v)
    ) ||
    !gen(raw.socialGeneration) ||
    !gen(raw.directoryGeneration)
  )
    throw Error(
      'DIRECTORY_REGISTER_RUNTIME_IDENTITY contains an invalid identity'
    );
  const port = Number(need('SOCIAL_PORT')),
    workerPort = Number(env.DIRECTORY_WORKER_PORT || 3121);
  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isInteger(workerPort) ||
    workerPort < 1 ||
    workerPort > 65535
  )
    throw Error('Invalid worker port');
  const readSecret = need('DIRECTORY_REGISTER_READ_SECRET'),
    repairSecret = need('DIRECTORY_REGISTER_REPAIR_SECRET');
  if (
    Buffer.byteLength(readSecret) < 32 ||
    Buffer.byteLength(repairSecret) < 32 ||
    readSecret === repairSecret
  )
    throw Error('Register secrets must be distinct and at least 32 bytes');
  if (need('DIRECTORY_EXTERNAL_FENCE_ASSERTION') !== 'fenced')
    throw Error('Explicit external fence assertion required');
  const sweepIntervalMs = Number(
    env.DIRECTORY_REGISTER_SWEEP_INTERVAL_MS || 60000
  );
  if (
    !Number.isSafeInteger(sweepIntervalMs) ||
    sweepIntervalMs < 100 ||
    sweepIntervalMs > 60000
  )
    throw Error('Invalid sweep interval');
  const startupTimeoutMs = Number(
    env.DIRECTORY_WORKER_STARTUP_TIMEOUT_MS || 600000
  );
  if (
    !Number.isSafeInteger(startupTimeoutMs) ||
    startupTimeoutMs < 0 ||
    startupTimeoutMs > 3600000
  )
    throw Error('Invalid startup timeout');
  return {
    bindingSweep: bindingSweepConfig(env),
    startupTimeoutMs,
    databaseUrl: need('DIRECTORY_DATABASE_URL'),
    host: need('SOCIAL_HOST'),
    port,
    readSecret,
    repairSecret,
    identity: raw,
    externalFence: true,
    workerPort,
    sweepIntervalMs,
  };
}
export class RegisterWorkerHealth {
  private bootstrapped = false;
  private lastSweep = 0;
  private failed = false;
  constructor(private readonly staleMs: number) {}
  bootstrapComplete() {
    this.bootstrapped = true;
  }
  sweepComplete() {
    this.lastSweep = Date.now();
    this.failed = false;
  }
  error() {
    this.failed = true;
  }
  live() {
    return true;
  }
  ready() {
    return (
      this.bootstrapped &&
      !this.failed &&
      this.lastSweep > 0 &&
      Date.now() - this.lastSweep <= this.staleMs
    );
  }
  /** Sweep-based readiness plus a live database round trip, so an outage shows within one probe instead of after the stale window. */
  async readyWithProbe(
    probe: () => Promise<unknown>,
    timeoutMs = 2000
  ): Promise<boolean> {
    if (!this.ready()) return false;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        probe(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('probe timeout')),
            timeoutMs
          );
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
export async function runRegisterWorker(
  config: RegisterWorkerConfig
): Promise<void> {
  const newDb = () =>
    new DataSource({
      type: 'postgres',
      url: config.databaseUrl,
      extra: {
        connectionTimeoutMillis: 3000,
        statement_timeout: 10000,
        query_timeout: 12000,
      },
    });
  let db = newDb();
  let client: RegisterDeliveryV2 | undefined, server: Server | undefined;
  const controller = new AbortController(),
    health = new RegisterWorkerHealth(120000),
    sweepStatus = new BindingSweepStatus(config.bindingSweep !== null);
  const stop = () => controller.abort();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    const id = config.identity;
    const sourceId: RegisterSourceIdentity = {
      sourceEpoch: id.sourceEpoch,
      activationId: id.activationId,
      socialGeneration: id.socialGeneration,
    };
    // Directory and Social may still be starting (migrations, authority row, Social incarnation); wait with bounded backoff instead of exiting.
    await retryUntilReady(
      async () => {
        if (client) {
          client.close();
          client = undefined;
        }
        if (db.isInitialized) await db.destroy();
        db = newDb();
        await db.initialize();
        const rows = await db.query(
          `SELECT p.*,i."recoveryEpoch" AS "authorityEpoch" FROM directory_census_progress p JOIN directory_installation i ON i.id='recovery-authority' WHERE p.id='recovery'`
        );
        if (
          rows.length !== 1 ||
          rows[0].protocol !== 'register-pending-v1' ||
          rows[0].authorityEpoch !== id.recoveryEpoch ||
          fields.some((k) => rows[0][k] !== id[k]) ||
          !['blocked', 'reg-source', 'reg-directory', 'reg-running'].includes(
            rows[0].phase
          )
        )
          throw Error('Pinned Directory register authority unavailable');
        client = new RegisterDeliveryV2(
          config.host,
          config.port,
          config.readSecret,
          config.repairSecret
        );
        await client.scan(sourceId, null, 1); // Fails closed if Social has a different incarnation.
      },
      { signal: controller.signal, timeoutMs: config.startupTimeoutMs }
    );
    server = createServer((req, res) => {
      const live = req.url === '/health/live',
        ready = req.url === '/health/ready';
      if (!live && !ready) {
        res.writeHead(404).end();
        return;
      }
      void (async () => {
        const ok = live
          ? health.live()
          : await health.readyWithProbe(() => db.query('SELECT 1'));
        const body =
          ready && config.bindingSweep
            ? JSON.stringify({
                status: ok ? 'ok' : 'unavailable',
                bindingSweep: sweepStatus.snapshot(),
              })
            : ok
            ? 'ok'
            : 'unavailable';
        res.writeHead(ok ? 200 : 503).end(body);
      })();
    });
    await new Promise<void>((resolve, reject) => {
      server!.once('error', reject);
      server!.listen(config.workerPort, '0.0.0.0', resolve);
    });
    const bindingLoop = config.bindingSweep
      ? runBindingSweepLoop({
          signal: controller.signal,
          intervalMs: config.bindingSweep.intervalMs,
          run: createBindingSweepRunner(config.bindingSweep),
          status: sweepStatus,
        })
      : (console.error('binding sweep disabled: missing configuration'),
        Promise.resolve());
    await Promise.all([
      bindingLoop,
      runRegisterLoop({
        signal: controller.signal,
        retryMs: 5000,
        sweepIntervalMs: config.sweepIntervalMs,
        bootstrap: async () => {
          const result = await registerBootstrapPage(db, id, client!, 100);
          if (result === 'complete') health.bootstrapComplete();
          return result;
        },
        sweep: async () => {
          const result = await registerSweepPage(db, id, client!, 100);
          if (result === 'complete') health.sweepComplete();
          return result;
        },
        onError: () => health.error(),
      }),
    ]);
  } finally {
    controller.abort();
    if (server)
      await new Promise<void>((resolve) => server!.close(() => resolve()));
    client?.close();
    if (db.isInitialized) await db.destroy();
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  }
}
