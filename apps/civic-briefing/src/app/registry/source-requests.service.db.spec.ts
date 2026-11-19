import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { DataSource } from 'typeorm';
import { Foundation1790940573082 } from '../../../migrations/1790940573082-foundation';
import { AddDaylightAlerts1791165718816 } from '../../../migrations/1791165718816-AddDaylightAlerts';
import { DaylightDbLocalities1793805980810 } from '../../../migrations/1793805980810-DaylightDbLocalities';
import { DaylightLocalityDisambiguation1793808213553 } from '../../../migrations/1793808213553-DaylightLocalityDisambiguation';
import { SourceRequests1793837771735 } from '../../../migrations/1793837771735-SourceRequests';
import { OfficialCandidates1793843620449 } from '../../../migrations/1793843620449-OfficialCandidates';
import { BRIEFING_SCHEMAS } from '../schemas';
import { SourcingStore } from '../schedule/sourcing-store';
import { SourceRequestSchema } from './source-request.schema';
import {
  InvalidSourceRequestError,
  MAX_NOTE_LENGTH,
  SourceRequestsService,
} from './source-requests.service';

interface FakeRegistry {
  all(): LocalityConfig[];
  ancestors(): LocalityConfig[];
  descendants(): LocalityConfig[];
}

function place(slug: string, enabledSources: boolean[]): LocalityConfig {
  return {
    slug,
    name: slug.toUpperCase(),
    kind: 'town',
    sources: enabledSources.map((enabled, index) => ({
      sourceKey: `${slug}-${index}`,
      enabled,
    })),
  } as unknown as LocalityConfig;
}

describe('SourceRequestsService', () => {
  let ds: DataSource;
  let service: SourceRequestsService;

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
    const places = [
      place('sourced-ga', [true]),
      place('disabled-ga', [false]),
      place('empty-ga', []),
      place('fresh-ga', []),
    ];
    const registry: FakeRegistry = {
      all: () => places,
      ancestors: () => [],
      descendants: () => [],
    };
    service = new SourceRequestsService(ds, {
      current: () => registry as never,
    });
    const store = new SourcingStore(ds);
    const detail = {
      pagesRead: 0,
      searched: null,
      adopted: 0,
      refused: 0,
      officialSites: [],
    };
    await store.recordSearch('empty-ga', '2026-11-04', detail);
    await store.recordSearch('disabled-ga', '2026-11-04', detail);
  });

  beforeEach(async () => {
    await ds.getRepository(SourceRequestSchema).clear();
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  it('reports a town with an enabled source as has-sources', async () => {
    expect(await service.status('sourced-ga')).toEqual({
      slug: 'sourced-ga',
      name: 'SOURCED-GA',
      status: 'has-sources',
      requestCount: 0,
    });
  });

  it('reports a searched town with no enabled source as no-sources', async () => {
    expect((await service.status('empty-ga'))?.status).toBe('no-sources');
    expect((await service.status('disabled-ga'))?.status).toBe('no-sources');
  });

  it('reports a town discovery has not reached as not-sourced-yet', async () => {
    expect((await service.status('fresh-ga'))?.status).toBe('not-sourced-yet');
  });

  it('answers null for an unknown slug', async () => {
    expect(await service.status('nowhere-ga')).toBeNull();
    expect(await service.request('nowhere-ga', 'u1')).toBeNull();
  });

  it('records one request per reader per town and counts them', async () => {
    expect(await service.request('empty-ga', 'u1', '  please  ')).toEqual({
      requestCount: 1,
      alreadyRequested: false,
    });
    expect(await service.request('empty-ga', 'u1', 'again')).toEqual({
      requestCount: 1,
      alreadyRequested: true,
    });
    expect(await service.request('empty-ga', 'u2')).toEqual({
      requestCount: 2,
      alreadyRequested: false,
    });
    const rows = await ds
      .getRepository(SourceRequestSchema)
      .find({ order: { userId: 'ASC' } });
    expect(rows.map((row) => [row.userId, row.note])).toEqual([
      ['u1', 'please'],
      ['u2', null],
    ]);
    expect((await service.status('empty-ga'))?.requestCount).toBe(2);
    expect((await service.status('fresh-ga'))?.requestCount).toBe(0);
  });

  it('keeps one row when the same reader asks twice at once', async () => {
    const both = await Promise.all([
      service.request('empty-ga', 'u1'),
      service.request('empty-ga', 'u1'),
    ]);
    expect(both.map((reply) => reply?.alreadyRequested).sort()).toEqual([
      false,
      true,
    ]);
    expect(await ds.getRepository(SourceRequestSchema).count()).toBe(1);
  });

  it('accepts a note of the cap and refuses a longer one', async () => {
    expect(
      (await service.request('empty-ga', 'u1', 'x'.repeat(MAX_NOTE_LENGTH)))
        ?.alreadyRequested
    ).toBe(false);
    await expect(
      service.request('empty-ga', 'u2', 'x'.repeat(MAX_NOTE_LENGTH + 1))
    ).rejects.toBeInstanceOf(InvalidSourceRequestError);
    expect(await ds.getRepository(SourceRequestSchema).count()).toBe(1);
  });
});
