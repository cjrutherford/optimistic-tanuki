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
  loadLocalityRegistry,
  LocalitySchema,
  type LocalityRow,
} from '@optimistic-tanuki/civic-core';
import type { Repository } from 'typeorm';
import { CivicDatabaseModule } from './app/civic-database.module';
import loadConfig from './config';

/**
 * Writes published briefings for the end-to-end suites (D28): each town's
 * locality from the registry, then its briefings from
 * `<CIVIC_E2E_BRIEFINGS_DIR>/<slug>/<periodEnd>-daily.md`. It goes through the
 * service's own connection and entities, and is idempotent. It refuses to run
 * without both directories, so it can't write into a real deployment by
 * accident.
 *
 *   CIVIC_LOCALITIES_DIR=… CIVIC_E2E_BRIEFINGS_DIR=… node seed-e2e.js
 */

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [loadConfig] }),
    CivicDatabaseModule,
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
  const localitiesDir = process.env['CIVIC_LOCALITIES_DIR'];
  const briefingsDir = process.env['CIVIC_E2E_BRIEFINGS_DIR'];
  if (!localitiesDir || !briefingsDir) {
    throw new Error(
      'CIVIC_LOCALITIES_DIR and CIVIC_E2E_BRIEFINGS_DIR must both be set; refusing to seed.'
    );
  }
  const registry = loadLocalityRegistry(localitiesDir);
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: ['error', 'warn'],
  });
  try {
    const localities = app.get<Repository<LocalityRow>>(
      getRepositoryToken(LocalitySchema)
    );
    const briefings = app.get<Repository<BriefingRow>>(
      getRepositoryToken(BriefingSchema)
    );
    for (const slug of readdirSync(briefingsDir)) {
      const locality = registry.get(slug);
      // The places around a town are stored with it, as the pipeline does.
      for (const place of [locality, ...registry.ancestors(slug)]) {
        await localities.upsert(
          {
            slug: place.slug,
            name: place.name,
            state: place.state,
            timezone: place.timezone,
            lat: place.lat,
            lon: place.lon,
            kind: place.kind ?? null,
            parents: JSON.stringify(place.parents ?? []),
            edition: place.edition === true,
            aliases: JSON.stringify(place.aliases ?? []),
            ruleVersion: place.ruleVersion ?? null,
          },
          ['slug']
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
