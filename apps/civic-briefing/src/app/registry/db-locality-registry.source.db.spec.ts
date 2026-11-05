import {
  LocalitySchema,
  type LocalityRow,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource, type Repository } from 'typeorm';
import { Foundation1790940573082 } from '../../../migrations/1790940573082-foundation';
import { AddDaylightAlerts1791165718816 } from '../../../migrations/1791165718816-AddDaylightAlerts';
import { DaylightDbLocalities1793805980810 } from '../../../migrations/1793805980810-DaylightDbLocalities';
import { DaylightLocalityDisambiguation1793808213553 } from '../../../migrations/1793808213553-DaylightLocalityDisambiguation';
import { SourceRequests1793837771735 } from '../../../migrations/1793837771735-SourceRequests';
import { OfficialCandidates1793843620449 } from '../../../migrations/1793843620449-OfficialCandidates';
import type { SocialCommunity } from '../locality-sync/community-to-locality';
import { LocalitySyncService } from '../locality-sync/locality-sync.service';
import type { LocalityCommunitySource } from '../locality-sync/social-locality.client';
import { BRIEFING_SCHEMAS } from '../schemas';
import { DbLocalityRegistrySource } from './db-locality-registry.source';

class FakeSocial implements LocalityCommunitySource {
  down = false;
  calls = 0;
  communities: SocialCommunity[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Adel',
      slug: 'adel-ga',
      localityType: 'town',
      adminArea: 'GA',
      lat: 31.14,
      lng: -83.43,
    },
    {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Tifton',
      slug: 'tifton-ga',
      localityType: 'city',
      adminArea: 'GA',
      lat: 31.45,
      lng: -83.51,
    },
  ];
  async listLocalityCommunities(): Promise<SocialCommunity[]> {
    this.calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    if (this.down) throw new Error('social is unreachable');
    return this.communities;
  }
}

describe('DbLocalityRegistrySource (migrated schema)', () => {
  let ds: DataSource;
  let repo: Repository<LocalityRow>;
  let social: FakeSocial;
  let dir: string;
  let registry: DbLocalityRegistrySource;

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
    repo = ds.getRepository<LocalityRow>(LocalitySchema);
  });

  beforeEach(async () => {
    await repo.clear();
    social = new FakeSocial();
    dir = join(mkdtempSync(join(tmpdir(), 'registry-')), 'generated');
    registry = new DbLocalityRegistrySource(
      ds,
      new LocalitySyncService(social, repo, {
        topics: ['council'],
        cadence: ['daily'],
      }),
      dir,
      5
    );
  });

  afterEach(() => rmSync(dirname(dir), { recursive: true, force: true }));

  afterAll(async () => {
    await ds?.destroy();
  });

  const editions = () =>
    registry
      .current()
      .editions()
      .map((town) => town.slug)
      .sort();

  it('is empty before the first refresh', () => {
    expect(editions()).toEqual([]);
  });

  it('syncs, renders and loads the towns in the database', async () => {
    await registry.refresh();
    expect(editions()).toEqual(['adel-ga', 'tifton-ga']);
    expect(registry.current().get('georgia').kind).toBe('state');
  });

  it('shares one refresh between concurrent callers', async () => {
    const [a, b] = await Promise.all([registry.refresh(), registry.refresh()]);
    expect(a).toBe(b);
    expect(social.calls).toBe(1);
  });

  it('keeps going on the database when social is down', async () => {
    await registry.refresh();
    social.down = true;
    await registry.refresh();
    expect(editions()).toEqual(['adel-ga', 'tifton-ga']);
  });

  it('yields an empty registry when social is down and the database is empty', async () => {
    social.down = true;
    await registry.start(3_600_000);
    registry.stop();
    expect(editions()).toEqual([]);
    expect(registry.current().all()).toEqual([]);
  });

  it('skips the social sync with sync: false and renders from the database', async () => {
    await registry.refresh();
    social.down = true;
    social.communities = [];
    await registry.refresh({ sync: false });
    expect(social.calls).toBe(1);
    expect(editions()).toEqual(['adel-ga', 'tifton-ga']);
  });

  it('lets a no-sync call join a full refresh, but a full call is not satisfied by a no-sync one', async () => {
    const full = registry.refresh();
    const noSync = registry.refresh({ sync: false });
    expect(noSync).toBe(full);
    await full;
    expect(social.calls).toBe(1);

    const first = registry.refresh({ sync: false });
    const second = registry.refresh();
    const third = registry.refresh();
    expect(second).not.toBe(first);
    expect(third).toBe(second);
    await Promise.all([first, second]);
    expect(social.calls).toBe(2);
  });

  it('drops a town social no longer lists', async () => {
    await registry.refresh();
    social.communities = social.communities.slice(0, 1);
    await registry.refresh();
    expect(editions()).toEqual(['adel-ga']);
  });
});

function dirname(path: string): string {
  return join(path, '..');
}
