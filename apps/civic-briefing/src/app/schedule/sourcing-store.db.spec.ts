import {
  FoundationSourceSchema,
  type SourceRow,
  type SourcingDecision,
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
import { SourcingStore } from './sourcing-store';

function decision(
  sourceKey: string,
  url: string,
  overrides: Partial<SourcingDecision> = {}
): SourcingDecision {
  return {
    adopted: true,
    ownerSlug: 'adel-ga',
    via: 'crawl https://adel.example',
    reasons: ['on an official site', 'feed parses'],
    evidence: ['3 items parsed'],
    source: {
      sourceKey,
      ownerSlug: 'adel-ga',
      coverage: 'adel-ga',
      adapter: 'rss',
      name: sourceKey,
      url,
      kind: 'news',
    },
    ...overrides,
  } as SourcingDecision;
}

describe('SourcingStore', () => {
  let ds: DataSource;
  let store: SourcingStore;

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
    store = new SourcingStore(ds);
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  const sources = () => ds.getRepository<SourceRow>(FoundationSourceSchema);

  it('adopts a source as discovered, once', async () => {
    const found = decision('adel-feed', 'https://adel.example/feed');
    expect(await store.adopt(found)).toBe(true);
    expect(await store.adopt(found)).toBe(false);
    const rows = await sources().findBy({ sourceKey: 'adel-feed' });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      origin: 'discovered',
      ownerSlug: 'adel-ga',
      adapter: 'rss',
      enabled: true,
    });
  });

  it('leaves an operator-disabled discovered source off', async () => {
    await store.adopt(decision('adel-off', 'https://adel.example/off'));
    await sources().update({ sourceKey: 'adel-off' }, { enabled: false });
    expect(
      await store.adopt(decision('adel-off', 'https://adel.example/off'))
    ).toBe(false);
    expect(
      (await sources().findOneByOrFail({ sourceKey: 'adel-off' })).enabled
    ).toBe(false);
  });

  it('never overwrites an override row, by key or by address', async () => {
    await sources().save({
      id: 'adel-hand',
      sourceKey: 'adel-hand',
      ownerSlug: 'adel-ga',
      coverage: 'adel-ga',
      adapter: 'rss',
      name: 'Hand kept',
      url: 'https://adel.example/hand/',
      kind: 'news',
      enabled: true,
      origin: 'override',
    });
    expect(
      await store.adopt(
        decision('adel-hand', 'https://elsewhere.example/other', {})
      )
    ).toBe(false);
    expect(
      await store.adopt(
        decision('adel-hand-2', 'https://www.adel.example/hand')
      )
    ).toBe(false);
    const row = await sources().findOneByOrFail({ sourceKey: 'adel-hand' });
    expect(row).toMatchObject({ name: 'Hand kept', origin: 'override' });
    expect(await sources().findBy({ sourceKey: 'adel-hand-2' })).toEqual([]);
  });

  it('does not adopt what the configured registry already holds', async () => {
    const hand = decision('yaml-feed', 'https://adel.example/yaml').source;
    expect(
      await store.adopt(
        decision('adel-yaml-dup', 'https://www.adel.example/yaml/'),
        [hand]
      )
    ).toBe(false);
    expect(await sources().findBy({ sourceKey: 'adel-yaml-dup' })).toEqual([]);
  });

  it('round-trips decisions and searched rows', async () => {
    const at = new Date('2026-11-04T13:00:00.000Z');
    await store.recordDecision(
      'adel-ga',
      decision('a', 'https://a.example/'),
      at
    );
    await store.recordDecision(
      'adel-ga',
      decision('b', 'https://b.example/', {
        adopted: false,
        reasons: ['never mentions Adel'],
        evidence: [],
      }),
      at
    );
    await store.recordSearch(
      'adel-ga',
      '2026-11-04',
      {
        pagesRead: 4,
        searched: null,
        adopted: 1,
        refused: 1,
        officialSites: [],
      },
      at
    );
    const rows = await ds
      .getRepository<SourcingDecisionRow>(SourcingDecisionSchema)
      .find({ order: { id: 'ASC' } });
    expect(rows.map((row) => row.decision)).toEqual([
      'adopted',
      'refused',
      'searched',
    ]);
    expect(rows[0]).toMatchObject({
      sourceKey: 'a',
      reason: 'on an official site\nfeed parses',
      evidence: '["3 items parsed"]',
      via: 'crawl https://adel.example',
    });
    expect(JSON.parse(rows[2]?.detail ?? '{}')).toMatchObject({ pagesRead: 4 });
    expect(rows[2]?.localDate).toBe('2026-11-04');
  });

  it('lastSearched is the latest searched local date, per town', async () => {
    expect(await store.lastSearched('nowhere-ga')).toBeNull();
    const detail = {
      pagesRead: 0,
      searched: null,
      adopted: 0,
      refused: 0,
      officialSites: [],
    };
    await store.recordSearch('dawson-ga', '2026-10-20', detail);
    await store.recordSearch('dawson-ga', '2026-11-03', detail);
    await store.recordSearch('dawson-ga', '2026-10-27', detail);
    await store.recordDecision(
      'dawson-ga',
      decision('d', 'https://d.example/')
    );
    expect(await store.lastSearched('dawson-ga')).toBe('2026-11-03');
  });
});
