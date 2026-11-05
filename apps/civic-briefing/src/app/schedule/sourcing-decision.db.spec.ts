import {
  type LocalityRow,
  LocalitySchema,
  type SourceRow,
  FoundationSourceSchema,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { DataSource } from 'typeorm';
import { Foundation1790940573082 } from '../../../migrations/1790940573082-foundation';
import { AddDaylightAlerts1791165718816 } from '../../../migrations/1791165718816-AddDaylightAlerts';
import { DaylightDbLocalities1793805980810 } from '../../../migrations/1793805980810-DaylightDbLocalities';
import { DaylightLocalityDisambiguation1793808213553 } from '../../../migrations/1793808213553-DaylightLocalityDisambiguation';
import { SourceRequests1793837771735 } from '../../../migrations/1793837771735-SourceRequests';
import { OfficialCandidates1793843620449 } from '../../../migrations/1793843620449-OfficialCandidates';
import { BRIEFING_SCHEMAS } from '../schemas';
import {
  type SourcingDecisionRow,
  SourcingDecisionSchema,
} from './sourcing-decision.schema';

describe('locality, source and sourcing-decision columns (migrated schema)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = new DataSource({
      type: 'postgres',
      url: (await createTestSchema()).url,
      entities: BRIEFING_SCHEMAS,
      migrations: [
        Foundation1790940573082,
        AddDaylightAlerts1791165718816,
        DaylightDbLocalities1793805980810,
        DaylightLocalityDisambiguation1793808213553,
        SourceRequests1793837771735,
        OfficialCandidates1793843620449,
      ],
    });
    await ds.initialize();
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('leaves no drift between the entities and the migrations', async () => {
    const pending = await ds.driver.createSchemaBuilder().log();
    expect(pending.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('round-trips a locality row with the database-driven columns', async () => {
    const communityId = '2f0b5c3e-8a1d-4c55-9a53-0d9d6b6f3a11';
    const syncedAt = new Date('2026-11-04T12:00:00.000Z');
    const repo = ds.getRepository<LocalityRow>(LocalitySchema);
    await repo.save({
      slug: 'adel-ga',
      name: 'Adel',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 31.1,
      lon: -83.4,
      kind: 'city',
      parents: JSON.stringify(['ga']),
      edition: true,
      communityId,
      syncedAt,
      topics: JSON.stringify(['council']),
      cadence: JSON.stringify(['daily']),
      websites: JSON.stringify(['https://adelga.example']),
    });
    await repo.save({
      slug: 'plain-ga',
      name: 'Plain',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 32,
      lon: -83,
    });

    const adel = await repo.findOneByOrFail({ slug: 'adel-ga' });
    expect(adel.communityId).toBe(communityId);
    expect(adel.active).toBe(true);
    expect(adel.syncedAt?.toISOString()).toBe(syncedAt.toISOString());
    expect(JSON.parse(adel.topics ?? '')).toEqual(['council']);
    expect(JSON.parse(adel.cadence ?? '')).toEqual(['daily']);
    expect(JSON.parse(adel.websites ?? '')).toEqual(['https://adelga.example']);

    const plain = await repo.findOneByOrFail({ slug: 'plain-ga' });
    expect(plain.communityId).toBeNull();
    expect(plain.active).toBe(true);
    expect(plain.syncedAt).toBeNull();

    await expect(
      repo.save({ ...plain, slug: 'dupe-ga', communityId })
    ).rejects.toThrow(/communityId|unique/i);
  });

  it('round-trips a source with its origin', async () => {
    const repo = ds.getRepository<SourceRow>(FoundationSourceSchema);
    await repo.save({
      id: 'adel-news',
      sourceKey: 'adel-news',
      ownerSlug: 'adel-ga',
      coverage: 'adel-ga',
      adapter: 'rss',
      name: 'Adel News',
      url: 'https://adelga.example/feed',
      kind: 'news',
      enabled: true,
      origin: 'discovered',
    });
    const row = await repo.findOneByOrFail({ id: 'adel-news' });
    expect(row.origin).toBe('discovered');
  });

  it('round-trips adopted, refused and searched decisions', async () => {
    const repo = ds.getRepository<SourcingDecisionRow>(SourcingDecisionSchema);
    const decidedAt = new Date('2026-11-04T13:00:00.000Z');
    await repo.save([
      {
        slug: 'adel-ga',
        ownerSlug: 'cook-county-ga',
        sourceKey: 'cook-agendas',
        adapter: 'civicplus',
        url: 'https://cook.example/agendas',
        decision: 'adopted',
        via: 'crawl https://cook.example',
        reason: 'on an official site\nagenda feed parses',
        evidence: JSON.stringify(['3 items parsed']),
        decidedAt,
      },
      {
        slug: 'adel-ga',
        url: 'https://other.example',
        decision: 'refused',
        reason: 'never mentions Adel',
        evidence: JSON.stringify([]),
        decidedAt: new Date('2026-11-04T12:59:00.000Z'),
      },
      {
        slug: 'adel-ga',
        decision: 'searched',
        localDate: '2026-11-04',
        detail: JSON.stringify({ pagesRead: 12, adopted: 1, refused: 1 }),
        decidedAt: new Date('2026-11-04T13:05:00.000Z'),
      },
    ]);

    const rows = await repo.find({
      where: { slug: 'adel-ga' },
      order: { decidedAt: 'DESC' },
    });
    expect(rows.map((row) => row.decision)).toEqual([
      'searched',
      'adopted',
      'refused',
    ]);
    expect(rows[0].localDate).toBe('2026-11-04');
    expect(rows[0].sourceKey).toBeNull();
    expect(rows[1].decidedAt.toISOString()).toBe(decidedAt.toISOString());
    expect(JSON.parse(rows[1].evidence ?? '')).toEqual(['3 items parsed']);
  });
});
