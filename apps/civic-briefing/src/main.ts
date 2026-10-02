import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { INestApplicationContext, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { preflightFoundationTarget } from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import { AppModule } from './app/app.module';
import { DailySchedule } from './app/schedule/daily';
import { loadScheduleConfig } from './app/schedule/schedule.config';
import { portedStages } from './app/stages';
import loadConfig, { databaseUrl } from './config';

/**
 * Builds the daily schedule from the running Nest context, on the app's own
 * database connection. Returns null, with a warning, when no locality
 * registry is configured: the service still runs, it just publishes nothing.
 */
function buildSchedule(app: INestApplicationContext): DailySchedule | null {
  const config = loadScheduleConfig();
  if (!config.localitiesDir) {
    Logger.warn(
      'CIVIC_LOCALITIES_DIR is not set; the daily schedule will not start',
      'Bootstrap'
    );
    return null;
  }
  return new DailySchedule(
    { ...config, localitiesDir: config.localitiesDir },
    app.get<DataSource>(getDataSourceToken(), { strict: false }),
    portedStages(app)
  );
}

/**
 * One-shot command line modes, without the TCP listener:
 *
 *   civic-briefing source [town...]  search for sources now, then exit
 *   civic-briefing run [town...]     publish now, whatever the hour, then exit
 */
async function runOnce(mode: 'source' | 'run', towns: string[]) {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  try {
    const schedule = buildSchedule(app);
    if (!schedule) {
      process.exitCode = 1;
      return;
    }
    const work =
      mode === 'source' ? schedule.sourceNow(towns) : schedule.runNow(towns);
    for (const { town, action } of await work) {
      Logger.log(`${town}: ${action}`, mode === 'source' ? 'Sourcing' : 'Run');
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
  if (mode === 'source' || mode === 'run') {
    await runOnce(mode, process.argv.slice(3));
    return;
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

  const schedule = buildSchedule(app);
  if (schedule) {
    const shutdown = async () => {
      schedule.stop();
      await app.close();
      process.exit(0);
    };
    process.once('SIGINT', () => void shutdown());
    process.once('SIGTERM', () => void shutdown());
    schedule.start();
    Logger.log('Civic briefing daily schedule running', 'Bootstrap');
  }
}

bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack ?? error.message : String(error),
    'Bootstrap'
  );
  process.exit(1);
});
