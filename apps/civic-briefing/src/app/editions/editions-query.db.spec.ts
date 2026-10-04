import {
  BriefingSchema,
  createFoundationDataSource,
  LocalitySchema,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { EditionsQueryService } from './editions-query.service';

describe('EditionsQueryService', () => {
  let ds: DataSource;
  let editions: EditionsQueryService;

  beforeAll(async () => {
    ds = await createFoundationDataSource((await createTestSchema()).url);
    await ds.getRepository(LocalitySchema).save([
      {
        slug: 'tifton-ga',
        name: 'Tifton',
        state: 'GA',
        timezone: 'America/New_York',
        lat: 31.45,
        lon: -83.5,
      },
      {
        slug: 'groton-ct',
        name: 'Groton',
        state: 'CT',
        timezone: 'America/New_York',
        lat: 41.35,
        lon: -72.08,
      },
    ] as never);
    const briefing = (
      slug: string,
      periodEnd: string,
      markdown: string,
      cadence = 'daily'
    ) => ({
      localitySlug: slug,
      cadence,
      periodStart: periodEnd,
      periodEnd,
      markdown,
      itemIds: '[]',
      model: 'test',
      createdAt: `${periodEnd}T12:00:00Z`,
      ruleVersion: 'v',
    });
    await ds
      .getRepository(BriefingSchema)
      .save([
        briefing('tifton-ga', '2026-09-15', '# first'),
        briefing('tifton-ga', '2026-09-16', '# second'),
        briefing('tifton-ga', '2026-09-16', '# second, republished'),
        briefing('groton-ct', '2026-09-17', '# groton'),
      ] as never);
    editions = new EditionsQueryService(ds);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('lists every town with a briefing, by state then name', async () => {
    expect(await editions.editions()).toStrictEqual([
      { slug: 'groton-ct', name: 'Groton', state: 'CT', latest: '2026-09-17' },
      { slug: 'tifton-ga', name: 'Tifton', state: 'GA', latest: '2026-09-16' },
    ]);
  });

  it("lists a town's editions newest first, one per period", async () => {
    const history = await editions.history('tifton-ga');
    expect(history?.latest).toBe('2026-09-16');
    expect(history?.briefings.map((b) => b.periodEnd)).toStrictEqual([
      '2026-09-16',
      '2026-09-15',
    ]);
    expect(await editions.history('nowhere-ga')).toBeNull();
  });

  it('serves the newest publication for a day, or the newest of all', async () => {
    expect((await editions.briefing('tifton-ga'))?.markdown).toBe(
      '# second, republished'
    );
    expect((await editions.briefing('tifton-ga', '2026-09-15'))?.markdown).toBe(
      '# first'
    );
    expect(await editions.briefing('tifton-ga', '2026-09-30')).toBeNull();
    expect(await editions.briefing('tifton-ga', 'yesterday')).toBeNull();
  });
});
