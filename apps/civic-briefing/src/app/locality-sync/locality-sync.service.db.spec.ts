import {
  type LocalityRow,
  LocalitySchema,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { DataSource, type Repository } from 'typeorm';
import { Foundation1790940573082 } from '../../../migrations/1790940573082-foundation';
import { AddDaylightAlerts1791165718816 } from '../../../migrations/1791165718816-AddDaylightAlerts';
import { DaylightDbLocalities1793805980810 } from '../../../migrations/1793805980810-DaylightDbLocalities';
import { DaylightLocalityDisambiguation1793808213553 } from '../../../migrations/1793808213553-DaylightLocalityDisambiguation';
import { BRIEFING_SCHEMAS } from '../schemas';
import type { SocialCommunity } from './community-to-locality';
import { LocalitySyncService } from './locality-sync.service';
import type { LocalityCommunitySource } from './social-locality.client';

class FakeSource implements LocalityCommunitySource {
  communities: SocialCommunity[] = [];
  async listLocalityCommunities(): Promise<SocialCommunity[]> {
    return this.communities;
  }
}

const ID = {
  adel: '00000000-0000-4000-8000-000000000001',
  nashGa: '00000000-0000-4000-8000-000000000002',
  nashTn: '00000000-0000-4000-8000-000000000003',
  bad: '00000000-0000-4000-8000-000000000004',
};

function communities(): SocialCommunity[] {
  return [
    {
      id: ID.adel,
      name: 'Adel',
      slug: 'adel-ga',
      localityType: 'town',
      adminArea: 'GA',
      lat: 31.14,
      lng: -83.43,
    },
    {
      id: ID.nashGa,
      name: 'Nashville',
      slug: 'nashville-ga',
      localityType: 'town',
      adminArea: 'GA',
      lat: 31.2,
      lng: -83.25,
    },
    {
      id: ID.nashTn,
      name: 'Nashville',
      slug: 'nashville-tn',
      localityType: 'city',
      adminArea: 'TN',
      lat: 36.16,
      lng: -86.78,
    },
    {
      id: ID.bad,
      name: 'Nowhere',
      slug: 'nowhere',
      localityType: 'town',
      adminArea: 'Narnia',
      lat: 1,
      lng: 1,
    },
  ];
}

describe('LocalitySyncService (migrated schema)', () => {
  let ds: DataSource;
  let repo: Repository<LocalityRow>;
  let source: FakeSource;
  let clock: number;
  let service: LocalitySyncService;

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
      ],
    });
    await ds.initialize();
    await ds.runMigrations();
    repo = ds.getRepository<LocalityRow>(LocalitySchema);
  });

  beforeEach(async () => {
    await repo.clear();
    source = new FakeSource();
    source.communities = communities();
    clock = Date.UTC(2026, 10, 4, 12);
    service = new LocalitySyncService(
      source,
      repo,
      { topics: ['council'], cadence: ['daily'] },
      () => new Date(clock)
    );
  });

  afterAll(async () => {
    await ds?.destroy();
  });

  const bySlug = (slug: string) => repo.findOneByOrFail({ slug });

  it('creates towns, state roots and the US root, and skips the unmappable', async () => {
    const summary = await service.sync();
    expect(summary.created).toBe(3);
    expect(summary.skipped).toEqual([
      expect.objectContaining({
        communityId: ID.bad,
        reason: expect.stringMatching(/adminArea/),
      }),
    ]);
    const slugs = (await repo.find()).map((r) => r.slug).sort();
    expect(slugs).toEqual([
      'adel-ga',
      'georgia',
      'nashville-ga',
      'nashville-tn',
      'tennessee',
      'us',
    ]);

    expect(await bySlug('us')).toMatchObject({
      kind: 'country',
      state: 'US',
      edition: false,
      parents: '[]',
      communityId: null,
    });
    expect(await bySlug('georgia')).toMatchObject({
      kind: 'state',
      state: 'GA',
      edition: false,
      parents: '["us"]',
      active: true,
    });
    expect(await bySlug('adel-ga')).toMatchObject({
      communityId: ID.adel,
      kind: 'town',
      edition: true,
      active: true,
      parents: '["georgia"]',
      timezone: 'America/New_York',
      topics: '["council"]',
      cadence: '["daily"]',
    });
    expect((await bySlug('nashville-tn')).timezone).toBe('America/Chicago');
  });

  it('is idempotent: a second run changes only syncedAt', async () => {
    await service.sync();
    const before = await repo.find({ order: { slug: 'ASC' } });
    clock += 3_600_000;
    const summary = await service.sync();
    expect(summary).toMatchObject({ created: 0, updated: 0, deactivated: 0 });
    const after = await repo.find({ order: { slug: 'ASC' } });
    const strip = (rows: LocalityRow[]) =>
      rows.map(({ syncedAt: _s, ...rest }) => rest);
    expect(strip(after)).toEqual(strip(before));
    expect((await bySlug('adel-ga')).syncedAt?.getTime()).toBe(clock);
    // Roots are created once and left alone.
    expect((await bySlug('georgia')).syncedAt?.getTime()).toBe(
      Date.UTC(2026, 10, 4, 12)
    );
  });

  it('updates a changed name and keeps tuned topics', async () => {
    await service.sync();
    await repo.update({ slug: 'adel-ga' }, { topics: '["custom"]' });
    source.communities[0] = { ...source.communities[0], name: 'Adel City' };
    const summary = await service.sync();
    expect(summary.updated).toBe(1);
    expect(await bySlug('adel-ga')).toMatchObject({
      name: 'Adel City',
      topics: '["custom"]',
    });
  });

  it('derives exclude phrases for a namesake town once, and keeps hand-set ones', async () => {
    await service.sync();
    expect((await bySlug('nashville-ga'))?.excludePhrases).toBe(
      JSON.stringify([
        'Nashville, Tennessee',
        'Nashville, Tenn.',
        'Nashville, TN',
      ])
    );
    expect((await bySlug('adel-ga'))?.excludePhrases).toBeNull();
    await repo.update(
      { slug: 'nashville-ga' },
      { excludePhrases: '["Nashville, Indiana"]' }
    );
    await repo.update({ slug: 'adel-ga' }, { excludePhrases: null });
    await service.sync();
    expect((await bySlug('nashville-ga'))?.excludePhrases).toBe(
      '["Nashville, Indiana"]'
    );
  });

  it('applies the edition rule on re-sync: only cities and towns', async () => {
    await service.sync();
    await repo.update({ slug: 'adel-ga' }, { edition: false });
    source.communities[0] = {
      ...source.communities[0],
      localityType: 'neighborhood',
    };
    await service.sync();
    expect((await bySlug('adel-ga'))?.edition).toBe(false);
    source.communities[0] = {
      ...source.communities[0],
      localityType: 'town',
    };
    await service.sync();
    expect((await bySlug('adel-ga'))?.edition).toBe(true);
  });

  it('deactivates communities that are gone, never deleting, and reactivates them', async () => {
    await service.sync();
    source.communities = source.communities.filter((c) => c.id !== ID.nashGa);
    const summary = await service.sync();
    expect(summary.deactivated).toBe(1);
    expect((await bySlug('nashville-ga')).active).toBe(false);
    expect((await bySlug('adel-ga')).active).toBe(true);
    expect((await bySlug('georgia')).active).toBe(true);

    source.communities = communities();
    const back = await service.sync();
    expect(back).toMatchObject({ updated: 1, deactivated: 0 });
    expect((await bySlug('nashville-ga')).active).toBe(true);
  });

  it('deactivates nothing when social returns no communities', async () => {
    await service.sync();
    source.communities = [];
    expect((await service.sync()).deactivated).toBe(0);
    expect((await bySlug('adel-ga')).active).toBe(true);
  });

  it('refuses a slug change on an existing community', async () => {
    await service.sync();
    source.communities[0] = {
      ...source.communities[0],
      localitySlug: 'adel-city-ga',
    };
    const summary = await service.sync();
    expect(summary).toMatchObject({ created: 0, updated: 0, deactivated: 0 });
    expect(summary.skipped).toEqual([
      expect.objectContaining({
        communityId: ID.adel,
        reason: expect.stringMatching(/slug change refused/),
      }),
      expect.objectContaining({ communityId: ID.bad }),
    ]);
    expect(await repo.findOneBy({ slug: 'adel-city-ga' })).toBeNull();
    expect((await bySlug('adel-ga')).active).toBe(true);
  });

  it('adopts an existing row with no community, and refuses a slug owned by another community', async () => {
    await repo.insert({
      slug: 'adel-ga',
      name: 'Adel',
      state: 'GA',
      timezone: 'America/New_York',
      lat: 31.14,
      lon: -83.43,
      kind: 'town',
      edition: true,
    });
    await service.sync();
    expect((await bySlug('adel-ga')).communityId).toBe(ID.adel);

    source.communities.push({
      id: '00000000-0000-4000-8000-0000000000ff',
      name: 'Adel again',
      slug: 'adel-ga',
      localityType: 'town',
      adminArea: 'GA',
      lat: 1,
      lng: 1,
    });
    const summary = await service.sync();
    expect(summary.skipped.map((s) => s.reason)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/duplicate slug|already belongs/),
      ])
    );
    expect((await bySlug('adel-ga')).communityId).toBe(ID.adel);
  });
});
