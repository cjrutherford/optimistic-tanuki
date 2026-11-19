import {
  ClientProxyFactory,
  MicroserviceOptions,
  Transport,
} from '@nestjs/microservices';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  preflightFoundationTarget,
  registerAdapter,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import { AppModule } from './app/app.module';
import { DbLocalityRegistrySource } from './app/registry/db-locality-registry.source';
import { localitySyncIntervalMs } from './app/locality-sync/locality-sync.service';
import { LocalityRegistrySource } from './app/registry/locality-registry.source';
import { BackfillService } from './app/health/backfill.service';
import { PipelineHealthService } from './app/health/pipeline-health.service';
import { DailySchedule, MODEL_TIMEOUT_MS } from './app/schedule/daily';
import { promptProxyFetch } from './app/model/prompt-proxy-fetch';
import { createCivicCoreAdapter } from '@optimistic-tanuki/civic-adapters';
import {
  TcpCivicCoreClient,
  civicCoreEndpoint,
} from './app/civic-core/civic-core.client';
import { BLOB_STORE } from './app/tokens';
import type { BlobStore } from '@optimistic-tanuki/civic-core';
import { loadScheduleConfig } from './app/schedule/schedule.config';
import { portedStages } from './app/stages';
import loadConfig, { databaseUrl } from './config';

/**
 * Builds the daily schedule from the running Nest context, on the app's own
 * database connection, over the database-built locality registry. Building it
 * does not start it: DAYLIGHT_SCHEDULE_ENABLED decides that.
 */
function buildSchedule(app: INestApplicationContext): DailySchedule {
  const config = loadScheduleConfig();
  const modelFetch =
    config.model.transport === 'prompt-proxy'
      ? promptProxyFetch(
          ClientProxyFactory.create({
            transport: Transport.TCP,
            options: config.model.promptProxy,
          }),
          // A little longer than the gateway's own limit, so it decides timeouts.
          { timeoutMs: MODEL_TIMEOUT_MS + 30_000 }
        )
      : undefined;
  Logger.log(
    config.model.transport === 'prompt-proxy'
      ? `model calls via prompt-proxy at ${config.model.promptProxy.host}:${config.model.promptProxy.port}`
      : 'model calls direct to LLM_BASE_URL',
    'Bootstrap'
  );
  // Civic Core is read over TCP; its adapter is registered here, not in
  // ALL_ADAPTERS, because it needs this client.
  const civicCore = new TcpCivicCoreClient(
    ClientProxyFactory.create({
      transport: Transport.TCP,
      options: civicCoreEndpoint(),
    })
  );
  registerAdapter(createCivicCoreAdapter(civicCore));
  return new DailySchedule(
    config,
    app.get<DataSource>(getDataSourceToken(), { strict: false }),
    portedStages(app),
    app.get(LocalityRegistrySource),
    modelFetch,
    app.get<BlobStore>(BLOB_STORE),
    civicCore
  );
}

/**
 * One-shot command line modes, without the TCP listener:
 *
 *   civic-briefing source [town...]  search for sources now, then exit
 *   civic-briefing run [town...]     publish now, whatever the hour, then exit
 *   civic-briefing pull [town...]    search, then fetch and parse the whole
 *                                    history window without publishing
 *   civic-briefing backfill [--days n] [town...]
 *                                    write the editions the schedule would
 *                                    have written over the last n days
 *                                    (default PIPELINE_HISTORY_DAYS), from
 *                                    what a pull stored (D31)
 */
type OnceMode = 'source' | 'run' | 'pull' | 'backfill';
const ONCE_MODES: readonly string[] = ['source', 'run', 'pull', 'backfill'];

async function runOnce(mode: OnceMode, args: string[]) {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    // One sync, render and load, so the command sees every town in the database.
    await app.get(LocalityRegistrySource).refresh();
    const schedule = buildSchedule(app);
    const daysAt = args.indexOf('--days');
    const days = daysAt >= 0 ? Number(args[daysAt + 1]) : undefined;
    if (days !== undefined && !(Number.isInteger(days) && days > 0))
      throw new Error(`--days must be a positive whole number`);
    const towns = args.filter(
      (arg, index) => arg !== '--days' && (daysAt < 0 || index !== daysAt + 1)
    );
    const work =
      mode === 'source'
        ? schedule.sourceNow(towns)
        : mode === 'pull'
        ? schedule.pullNow(towns)
        : mode === 'backfill'
        ? schedule.backfill(towns, days)
        : schedule.runNow(towns);
    for (const { town, action } of await work) {
      Logger.log(
        `${town}: ${action}`,
        mode === 'source' ? 'Sourcing' : mode === 'run' ? 'Run' : mode
      );
    }
  } finally {
    await app.close();
  }
}

async function bootstrap() {
  const config = loadConfig();

  // The schema comes from this app's migrations (run by db-setup). Refuse to
  // start against an empty or differently-versioned database.
  await preflightFoundationTarget(databaseUrl(config));

  const mode = process.argv[2];
  if (mode && ONCE_MODES.includes(mode)) {
    await runOnce(mode as OnceMode, process.argv.slice(3));
    // The model and Civic Core clients are made outside Nest, so closing the
    // app leaves their sockets open; a one-shot command ends here.
    process.exit(process.exitCode ?? 0);
  }

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '0.0.0.0',
        port: Number(config.listenPort) || 3028,
      },
    }
  );

  await app.listen().then(() => {
    Logger.log(
      'Civic briefing microservice listening on port: ' +
        (config.listenPort || 3028)
    );
  });

  // The registry is refreshed whether or not the schedule runs: other
  // services read the town list from here. The first refresh finishes before
  // the schedule's first tick; a social outage is logged, not fatal.
  const registry = app.get(DbLocalityRegistrySource);
  await registry.start(localitySyncIntervalMs());

  const schedule = buildSchedule(app);
  const enabled = loadScheduleConfig().scheduleEnabled;
  const health = app.get(PipelineHealthService);
  // An operator's pull and backfill (D31) run on this schedule, switch or not.
  app.get(BackfillService).attach(schedule);
  const shutdown = async () => {
    schedule.stop();
    health.stopAlerts();
    registry.stop();
    await app.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  if (enabled) {
    // Pipeline problems reach an operator (P5.2); only where runs happen.
    health.startAlerts();
    schedule.start();
    Logger.log('Civic briefing daily schedule running', 'Bootstrap');
  } else {
    Logger.warn(
      'DAYLIGHT_SCHEDULE_ENABLED is off; the daily schedule is not running',
      'Bootstrap'
    );
  }
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack ?? error.message : String(error),
    'Bootstrap'
  );
  process.exit(1);
});
