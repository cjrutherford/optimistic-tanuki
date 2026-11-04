import 'reflect-metadata';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BriefingSchema,
  type BriefingRow,
  LocalitySchema,
  type LocalityRow,
} from '@optimistic-tanuki/civic-core';
import type { Repository } from 'typeorm';
import { CivicDatabaseModule } from './app/civic-database.module';
import { LocalitySyncModule } from './app/locality-sync/locality-sync.module';
import { LocalitySyncService } from './app/locality-sync/locality-sync.service';
import loadConfig from './config';

/**
 * Writes published briefings for the end-to-end suites (D28). The towns come
 * from the database like everywhere else (D25): it syncs the localities from
 * social (SOCIAL_HOST/PORT; the e2e social seed creates the towns), then adds
 * each briefing from `<CIVIC_E2E_BRIEFINGS_DIR>/<slug>/<periodEnd>-daily.md`
 * to a town that exists. It goes through the service's own connection and
 * entities, and is idempotent. It refuses to run without the briefings
 * directory, so it can't write into a real deployment by accident.
 *
 *   CIVIC_E2E_BRIEFINGS_DIR=… node seed-e2e.js
 */

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    CivicDatabaseModule,
    LocalitySyncModule,
  ],
})
class SeedModule {}

const DAY_MS = 86_400_000;
const BRIEFING_FILE = /^(\d{4}-\d{2}-\d{2})-daily\.md$/u;

function dayBefore(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) - DAY_MS)
    .toISOString()
    .slice(0, 10);
}

async function main(): Promise<void> {
  const briefingsDir = process.env['CIVIC_E2E_BRIEFINGS_DIR'];
  if (!briefingsDir) {
    throw new Error('CIVIC_E2E_BRIEFINGS_DIR must be set; refusing to seed.');
  }
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  try {
    const sync = app.get(LocalitySyncService);
    // Social may still be starting: try for about a minute.
    for (let attempt = 1; ; attempt += 1) {
      try {
        const summary = await sync.sync();
        console.log(
          `synced localities: ${summary.created} created, ${summary.updated} updated`
        );
        break;
      } catch (error) {
        if (attempt >= 12) throw error;
        console.warn(`locality sync failed (attempt ${attempt}), retrying`);
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    }
    const localities = app.get<Repository<LocalityRow>>(
      getRepositoryToken(LocalitySchema)
    );
    const briefings = app.get<Repository<BriefingRow>>(
      getRepositoryToken(BriefingSchema)
    );
    for (const slug of readdirSync(briefingsDir)) {
      if (!(await localities.findOneBy({ slug }))) {
        throw new Error(
          `no locality "${slug}" after syncing from social: add it to SEED_LOCALITY_SLUGS in the e2e social seed.`
        );
      }
      for (const file of readdirSync(join(briefingsDir, slug)).sort()) {
        const periodEnd = BRIEFING_FILE.exec(file)?.[1];
        if (!periodEnd) continue;
        const existing = await briefings.findOneBy({
          localitySlug: slug,
          cadence: 'daily',
          periodEnd,
        });
        if (existing) continue;
        await briefings.insert({
          localitySlug: slug,
          cadence: 'daily',
          periodStart: dayBefore(periodEnd),
          periodEnd,
          markdown: readFileSync(join(briefingsDir, slug, file), 'utf8'),
          itemIds: '[]',
          model: 'e2e-fixture',
          createdAt: `${periodEnd}T06:00:00.000Z`,
        });
        console.log(`seeded ${slug} ${periodEnd}`);
      }
    }
  } finally {
    await app.close();
  }
}

main()
  // The TCP client to social keeps its socket open after the context closes,
  // so the process would never exit and the compose one-shot would hang.
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
