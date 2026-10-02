import 'reflect-metadata';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  createFoundationDataSource,
  createReplayHttpClient,
  loadLocalityRegistry,
  replaySummarizer,
  runPipeline,
} from '@optimistic-tanuki/civic-core';
import { AdaptersModule } from './app/adapters/adapters.module';
import { AgendaModule } from './app/agenda/agenda.module';
import { BriefingModule } from './app/briefing/briefing.module';
import { CivicDatabaseModule } from './app/civic-database.module';
import { CollateModule } from './app/collate/collate.module';
import { GatherModule } from './app/gather/gather.module';
import { ParseModule } from './app/parse/parse.module';
import { PlatformModule } from './app/platform.module';
import { ProjectionModule } from './app/projection/projection.module';
import { QuarantineModule } from './app/quarantine/quarantine.module';
import { portedStages } from './app/stages';
import { StoriesModule } from './app/stories/stories.module';

/**
 * Replays a recorded corpus through civic-briefing's stages (parity gate,
 * plan slice P2.4; driven by tools/civic-parity).
 *
 * The runner, the windows, the lease, the publication boundary and the
 * artifacts are the same ones the POC's replay used; only the stages and the
 * database differ. If the published briefings hash to the POC's golden
 * baseline, the service behaves like the POC all the way to what a reader
 * sees. No model is called: replay uses the deterministic summarizer.
 *
 *   replay --corpus <dir> --towns <slug...> --from <date> --to <date>
 *          --database postgres://... --artifacts <dir> --localities <dir>
 *          [--backfill-days <n>] [--community <dir>]
 */

function argument(name: string, fallback?: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (value === undefined && fallback === undefined)
    throw new Error(`--${name} is required`);
  return value ?? (fallback as string);
}

function list(name: string): string[] {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return [];
  const values: string[] = [];
  for (
    let at = index + 1;
    at < process.argv.length && !process.argv[at]!.startsWith('--');
    at += 1
  )
    values.push(process.argv[at]!);
  return values;
}

function* days(from: string, to: string): Generator<string> {
  for (
    let day = new Date(`${from}T00:00:00Z`);
    day <= new Date(`${to}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    yield day.toISOString().slice(0, 10);
  }
}

async function main(): Promise<void> {
  const corpus = argument('corpus');
  const databaseUrl = argument('database');
  const artifacts = argument('artifacts');
  const from = argument('from');
  const to = argument('to');
  const backfillDays = Number(argument('backfill-days', '30'));
  // Without a snapshot directory a replay reads no community material, so it
  // stays a function of its corpus; the parity gate passes none.
  const community = argument('community', '') || undefined;
  const registry = loadLocalityRegistry(argument('localities'), undefined);
  const towns = list('towns').length
    ? list('towns')
    : registry.editions().map((locality) => locality.slug);

  // An empty parity database gets the foundation schema from the entities,
  // which schema:log shows matches the service's migration.
  const dataSource = await createFoundationDataSource(databaseUrl);

  @Module({
    imports: [
      // Only what the stages read from config; blobs stay beside the artifacts.
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ blobDirectory: join(artifacts, '..', 'blobs') })],
      }),
      CivicDatabaseModule.forDataSource(dataSource),
      PlatformModule,
      AdaptersModule,
      QuarantineModule,
      GatherModule,
      ParseModule,
      AgendaModule,
      ProjectionModule,
      CollateModule,
      StoriesModule,
      BriefingModule,
    ],
  })
  class ReplayModule {}

  const app = await NestFactory.createApplicationContext(ReplayModule, {
    logger: ['error', 'warn'],
  });
  const stages = portedStages(app);

  try {
    for (const date of days(from, to)) {
      for (const slug of towns) {
        const client = createReplayHttpClient(corpus, {
          asOf: () => new Date(`${date}T23:59:59Z`),
        });
        const result = await runPipeline({
          registry,
          localitySlug: slug,
          cadence: 'daily',
          dataSource,
          summarizer: replaySummarizer,
          httpClient: client,
          now: new Date(`${date}T12:00:00Z`),
          outputRoot: artifacts,
          backfillDays,
          ...(community ? { communityDirectory: community } : {}),
          stages,
        });
        process.stderr.write(
          `${date} ${slug}: ${result.status}${
            client.misses.length
              ? `, ${client.misses.length} unrecorded requests`
              : ''
          }\n`
        );
      }
    }
  } finally {
    await app.close();
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack ?? error.message : String(error)}\n`
  );
  process.exit(1);
});
