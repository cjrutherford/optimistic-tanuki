import {
  LocalitySchema,
  type LocalityRow,
} from '@optimistic-tanuki/civic-core';
import { createTestSchema } from '@optimistic-tanuki/civic-core/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DataSource, type Repository } from 'typeorm';
import { Foundation1790940573082 } from '../../../migrations/1790940573082-foundation';
import { AddDaylightAlerts1791165718816 } from '../../../migrations/1791165718816-AddDaylightAlerts';
import { DaylightDbLocalities1793805980810 } from '../../../migrations/1793805980810-DaylightDbLocalities';
import { DaylightLocalityDisambiguation1793808213553 } from '../../../migrations/1793808213553-DaylightLocalityDisambiguation';
import { SourceRequests1793837771735 } from '../../../migrations/1793837771735-SourceRequests';
import { OfficialCandidates1793843620449 } from '../../../migrations/1793843620449-OfficialCandidates';
import type { CivicTownOfficials } from '../civic-core/civic-core.client';
import type { SocialCommunity } from '../locality-sync/community-to-locality';
import { LocalitySyncService } from '../locality-sync/locality-sync.service';
import type { LocalityCommunitySource } from '../locality-sync/social-locality.client';
import { DbLocalityRegistrySource } from '../registry/db-locality-registry.source';
import { BRIEFING_SCHEMAS } from '../schemas';
import {
  OfficialCandidatePuller,
  type OfficialsSource,
} from './official-candidate-puller';
import {
  type OfficialCandidateRow,
  OfficialCandidateSchema,
} from './official-candidate.schema';
import {
  InvalidOfficialCandidateError,
  OfficialCandidatesService,
} from './official-candidates.service';

class FakeSocial implements LocalityCommunitySource {
  async listLocalityCommunities(): Promise<SocialCommunity[]> {
    return [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Adel',
        slug: 'adel-ga',
        localityType: 'town',
        adminArea: 'GA',
        lat: 31.14,
        lng: -83.43,
      },
    ];
  }
}

class FakeCivic implements OfficialsSource {
  down = false;
  towns: CivicTownOfficials[] = [];
  async officials(): Promise<CivicTownOfficials[]> {
    if (this.down) throw new Error('civic is unreachable');
    return this.towns;
  }
}

const AGENDA = '11111111-1111-4111-8111-111111111111';

function adel(
  officials: { name: string; role: string }[],
  lastSeen = '2026-10-01T00:00:00.000Z'
): CivicTownOfficials {
  return {
    tenantId: 'tenant-adel',
    townName: 'Adel',
    state: 'GA',
    kind: 'town',
    officials: officials.map((official) => ({
      ...official,
      sourceAgendaId: AGENDA,
      firstSeen: '2026-09-01T00:00:00.000Z',
      lastSeen,
    })),
  };
}

const ok = {
  office: 'Mayor',
  source: 'https://cityofadel.example/council',
  decidedBy: 'admin-1',
  domains: ['cityofadel.example'],
  callbackNumberSource: 'https://cityofadel.example/contact',
};

describe('official candidates (migrated schema)', () => {
  let ds: DataSource;
  let localities: Repository<LocalityRow>;
  let candidates: Repository<OfficialCandidateRow>;
  let civic: FakeCivic;
  let dir: string;
  let registry: DbLocalityRegistrySource;
  let service: OfficialCandidatesService;

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
    localities = ds.getRepository<LocalityRow>(LocalitySchema);
    candidates = ds.getRepository<OfficialCandidateRow>(
      OfficialCandidateSchema
    );
  });

  beforeEach(async () => {
    await candidates.clear();
    await localities.clear();
    civic = new FakeCivic();
    dir = join(mkdtempSync(join(tmpdir(), 'officials-')), 'generated');
    registry = new DbLocalityRegistrySource(
      ds,
      new LocalitySyncService(new FakeSocial(), localities, {
        topics: ['council'],
        cadence: ['daily'],
      }),
      dir,
      5,
      new OfficialCandidatePuller(ds, civic)
    );
    service = new OfficialCandidatesService(ds, registry);
    await registry.refresh();
  });

  afterEach(() => rmSync(dirname(dir), { recursive: true, force: true }));
  afterAll(async () => {
    await ds?.destroy();
  });

  const pull = () => registry.refresh();
  const rows = () => candidates.find({ order: { name: 'ASC' } });
  const roster = () =>
    registry
      .current()
      .get('adel-ga')
      .officials?.roster.map((e) => e.name);

  describe('pulling', () => {
    it('stores names from a matched tenant as pending, with an app-set id', async () => {
      civic.towns = [
        adel([{ name: 'Jane Doe', role: 'Mayor' }]),
        {
          ...adel([{ name: 'Nobody Here', role: 'Mayor' }]),
          tenantId: 'tenant-x',
          townName: 'Nowhere',
        },
      ];
      await pull();
      const [row] = await rows();
      expect(await rows()).toHaveLength(1);
      expect(row).toMatchObject({
        slug: 'adel-ga',
        name: 'Jane Doe',
        normalizedName: 'jane doe',
        role: 'Mayor',
        civicTenantId: 'tenant-adel',
        sourceAgendaId: AGENDA,
        status: 'pending',
        decidedBy: null,
        decidedAt: null,
      });
      expect(row?.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('updates lastSeen and role of a pending candidate without duplicating it', async () => {
      civic.towns = [adel([{ name: 'Jane Doe', role: 'Council Member' }])];
      await pull();
      civic.towns = [
        adel(
          [{ name: 'JANE  DOE', role: 'Mayor' }],
          '2026-10-20T00:00:00.000Z'
        ),
      ];
      await pull();
      const found = await rows();
      expect(found).toHaveLength(1);
      expect(found[0]?.role).toBe('Mayor');
      expect(found[0]?.name).toBe('Jane Doe');
      expect(found[0]?.lastSeen.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    });

    it('never re-opens a rejected candidate or duplicates an accepted one', async () => {
      civic.towns = [
        adel([
          { name: 'Jane Doe', role: 'Mayor' },
          { name: 'John Roe', role: 'Clerk' },
        ]),
      ];
      await pull();
      const [jane, john] = await rows();
      await service.reject({ id: jane?.id as string, decidedBy: 'a' });
      await service.accept({ id: john?.id as string, ...ok, office: 'Clerk' });
      civic.towns = [
        adel(
          [
            { name: 'Jane Doe', role: 'Council Member' },
            { name: 'John Roe', role: 'Treasurer' },
          ],
          '2026-10-25T00:00:00.000Z'
        ),
      ];
      await pull();
      const found = await rows();
      expect(found).toHaveLength(2);
      expect(found.find((r) => r.name === 'Jane Doe')).toMatchObject({
        status: 'rejected',
        role: 'Mayor',
      });
      expect(found.find((r) => r.name === 'John Roe')).toMatchObject({
        status: 'accepted',
        role: 'Clerk',
      });
    });

    it('skips names already in the town roster, by normalized name', async () => {
      civic.towns = [adel([{ name: 'John Roe', role: 'Clerk' }])];
      await pull();
      await service.accept({
        id: (await rows())[0]?.id as string,
        ...ok,
      });
      await candidates.clear();
      civic.towns = [adel([{ name: 'JOHN ROE Jr.', role: 'Clerk' }])];
      await pull();
      expect(await rows()).toHaveLength(0);
    });

    it('logs and changes nothing when Civic Core is down', async () => {
      civic.towns = [adel([{ name: 'Jane Doe', role: 'Mayor' }])];
      await pull();
      civic.down = true;
      civic.towns = [adel([{ name: 'Someone Else', role: 'Mayor' }])];
      await expect(pull()).resolves.toBeDefined();
      expect((await rows()).map((r) => r.name)).toEqual(['Jane Doe']);
    });

    it('does not pull on a no-sync refresh', async () => {
      civic.towns = [adel([{ name: 'Jane Doe', role: 'Mayor' }])];
      await registry.refresh({ sync: false });
      expect(await rows()).toHaveLength(0);
    });
  });

  describe('listing', () => {
    it('defaults to pending, filters by slug and status, and says whether the town has officials', async () => {
      civic.towns = [
        adel([
          { name: 'Jane Doe', role: 'Mayor' },
          { name: 'John Roe', role: 'Clerk' },
        ]),
      ];
      await pull();
      const pending = await service.list();
      expect(pending.map((c) => c.name)).toEqual(['John Roe', 'Jane Doe']);
      expect(pending[0]).toMatchObject({
        slug: 'adel-ga',
        townName: 'Adel',
        townHasOfficials: false,
        sourceAgendaId: AGENDA,
      });
      await service.reject({ id: pending[0]?.id as string, decidedBy: 'a' });
      expect(await service.list({ slug: 'adel-ga' })).toHaveLength(1);
      expect(await service.list({ slug: 'other-ga' })).toHaveLength(0);
      const rejected = await service.list({ status: 'rejected' });
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({ decidedBy: 'a' });
      await expect(service.list({ status: 'maybe' })).rejects.toBeInstanceOf(
        InvalidOfficialCandidateError
      );
    });
  });

  describe('accepting', () => {
    let id: string;
    let second: string;
    beforeEach(async () => {
      civic.towns = [
        adel([
          { name: 'Jane Doe', role: 'Mayor' },
          { name: 'John Roe', role: 'Clerk' },
        ]),
      ];
      await pull();
      const [jane, john] = await rows();
      id = jane?.id as string;
      second = john?.id as string;
    });

    const row = () => localities.findOneByOrFail({ slug: 'adel-ga' });

    it.each([
      ['an empty office', { office: '  ' }],
      ['an http source', { source: 'http://cityofadel.example/council' }],
      ['a source that is not a URL', { source: 'council page' }],
      [
        'an http callback source',
        { callbackNumberSource: 'http://cityofadel.example/contact' },
      ],
      ['no domains', { domains: [] }],
      ['no callback source', { callbackNumberSource: undefined }],
    ])('refuses %s and changes nothing', async (_label, override) => {
      await expect(
        service.accept({ id, ...ok, ...override })
      ).rejects.toBeInstanceOf(InvalidOfficialCandidateError);
      expect((await row()).officials ?? null).toBeNull();
      expect((await candidates.findOneByOrFail({ id })).status).toBe('pending');
    });

    it('refuses a value the locality parser rejects, so the registry cannot break', async () => {
      await expect(
        service.accept({ id, ...ok, domains: ['Not A Host'] })
      ).rejects.toBeInstanceOf(InvalidOfficialCandidateError);
      expect((await row()).officials ?? null).toBeNull();
      expect((await candidates.findOneByOrFail({ id })).status).toBe('pending');
    });

    it('creates the town officials from the first acceptance, accepts the candidate and reloads the registry', async () => {
      const reply = await service.accept({
        id,
        ...ok,
        domains: [' CityOfAdel.example '],
      });
      expect(reply).toMatchObject({
        id,
        status: 'accepted',
        decidedBy: 'admin-1',
        townHasOfficials: true,
      });
      expect(JSON.parse((await row()).officials as string)).toEqual({
        domains: ['cityofadel.example'],
        roster: [
          {
            name: 'Jane Doe',
            office: 'Mayor',
            source: 'https://cityofadel.example/council',
          },
        ],
        callbackNumberSource: 'https://cityofadel.example/contact',
      });
      const stored = await candidates.findOneByOrFail({ id });
      expect(stored.decidedAt).toBeInstanceOf(Date);
      expect(roster()).toEqual(['Jane Doe']);
    });

    it('appends to an existing roster without needing domains', async () => {
      await service.accept({ id, ...ok });
      const reply = await service.accept({
        id: second,
        office: 'Clerk',
        source: 'https://cityofadel.example/clerk',
        decidedBy: 'admin-2',
      });
      expect(reply?.status).toBe('accepted');
      expect(roster()).toEqual(['Jane Doe', 'John Roe']);
      expect(JSON.parse((await row()).officials as string).domains).toEqual([
        'cityofadel.example',
      ]);
    });

    it('answers null for an unknown id and refuses a decided candidate', async () => {
      expect(
        await service.accept({
          id: '22222222-2222-4222-8222-222222222222',
          ...ok,
        })
      ).toBeNull();
      await service.accept({ id, ...ok });
      await expect(service.accept({ id, ...ok })).rejects.toBeInstanceOf(
        InvalidOfficialCandidateError
      );
    });
  });

  describe('rejecting', () => {
    it('marks the candidate rejected with who decided, and leaves the roster alone', async () => {
      civic.towns = [adel([{ name: 'Jane Doe', role: 'Mayor' }])];
      await pull();
      const id = (await rows())[0]?.id as string;
      expect(await service.reject({ id, decidedBy: 'admin-1' })).toMatchObject({
        status: 'rejected',
        decidedBy: 'admin-1',
      });
      expect(roster()).toBeUndefined();
      await expect(
        service.reject({ id, decidedBy: 'admin-1' })
      ).rejects.toBeInstanceOf(InvalidOfficialCandidateError);
      expect(
        await service.reject({
          id: '22222222-2222-4222-8222-222222222222',
          decidedBy: 'a',
        })
      ).toBeNull();
    });
  });
});
