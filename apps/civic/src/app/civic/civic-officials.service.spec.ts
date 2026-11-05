import { CivicOfficial } from '../entities/civic-official.entity';
import { CivicTenant } from '../entities/civic-tenant.entity';
import { CivicOfficialsService } from './civic-officials.service';
import { CivicOfficialsController } from './civic-officials.controller';

type Row = Record<string, unknown>;

interface FakeRepository {
  rows: Row[];
  findOneBy: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  find: jest.Mock;
}

function repository(rows: Row[] = []): FakeRepository {
  const matches = (row: Row, where: Row) =>
    Object.entries(where).every(([key, value]) => row[key] === value);
  let id = 0;
  return {
    rows,
    findOneBy: jest.fn(
      async (where: Row) => rows.find((row) => matches(row, where)) ?? null
    ),
    insert: jest.fn(async (row: Row) => {
      rows.push({ id: `id-${++id}`, ...row });
    }),
    update: jest.fn(async (where: Row, patch: Row) => {
      Object.assign(rows.find((row) => matches(row, where)) ?? {}, patch);
    }),
    find: jest.fn(async (options: { where: Row }) =>
      rows.filter((row) => matches(row, options.where))
    ),
  };
}

function setup(now = new Date('2026-11-04T12:00:00Z')) {
  const officials = repository();
  const tenants = repository([
    { id: 'savannah', townName: 'Savannah', state: 'GA', kind: 'city' },
    { id: 'tifton', townName: 'Tifton', state: 'GA', kind: 'city' },
  ]);
  const dataSource = {
    getRepository: (entity: unknown) =>
      entity === CivicOfficial
        ? officials
        : entity === CivicTenant
        ? tenants
        : undefined,
  };
  const service = new CivicOfficialsService(
    dataSource as never,
    () => new Date(now)
  );
  return { service, officials };
}

describe('CivicOfficialsService', () => {
  it('records the officials in an agenda once per person', async () => {
    const { service, officials } = setup();
    const count = await service.record(
      'savannah',
      'a1',
      'Mayor Van Johnson opened.\nAlderman Kurtis Purtee spoke.',
      new Date('2026-09-24T18:00:00Z')
    );
    expect(count).toBe(2);
    await service.record(
      'savannah',
      'a1',
      'Mayor Van Johnson opened.',
      new Date('2026-09-24T18:00:00Z')
    );
    expect(officials.rows).toHaveLength(2);
    expect(officials.rows[0]).toMatchObject({
      tenantId: 'savannah',
      name: 'Van Johnson',
      normalizedName: 'van johnson',
      role: 'Mayor',
      sourceAgendaId: 'a1',
    });
  });

  it('moves lastSeen forward with a newer agenda and not back with an older one', async () => {
    const { service, officials } = setup();
    await service.record(
      'savannah',
      'a1',
      'Mayor Van Johnson',
      new Date('2026-05-01T00:00:00Z')
    );
    await service.record(
      'savannah',
      'a2',
      'Mayor Van Johnson',
      new Date('2026-09-01T00:00:00Z')
    );
    await service.record(
      'savannah',
      'a0',
      'Mayor Van Johnson',
      new Date('2026-01-01T00:00:00Z')
    );
    expect(officials.rows).toHaveLength(1);
    expect(officials.rows[0]).toMatchObject({
      sourceAgendaId: 'a2',
      firstSeen: new Date('2026-01-01T00:00:00Z'),
      lastSeen: new Date('2026-09-01T00:00:00Z'),
    });
  });

  it('does not fail the ingest when storing fails', async () => {
    const { service, officials } = setup();
    officials.findOneBy.mockRejectedValue(new Error('db down'));
    await expect(
      service.record('savannah', 'a1', 'Mayor Van Johnson', new Date())
    ).resolves.toBe(0);
  });

  it('serves officials per town, dropping those unseen for over 12 months', async () => {
    const { service } = setup();
    await service.record(
      'savannah',
      'a1',
      'Mayor Van Johnson',
      new Date('2026-09-01T00:00:00Z')
    );
    await service.record(
      'savannah',
      'a0',
      'Alderman Old Timer',
      new Date('2025-10-01T00:00:00Z')
    );
    await service.record(
      'tifton',
      'b1',
      'Mayor Pro Tem Jo Rivers',
      new Date('2026-10-01T00:00:00Z')
    );
    const all = await service.list();
    expect(all.map((town) => town.tenantId)).toEqual(['savannah', 'tifton']);
    expect(all[0]).toMatchObject({ townName: 'Savannah', state: 'GA' });
    expect(all[0].officials.map((o) => o.name)).toEqual(['Van Johnson']);
    expect(await service.list('tifton')).toHaveLength(1);
    expect(await service.list('nowhere')).toEqual([]);
  });

  it('answers the TCP pattern with an optional town filter', async () => {
    const { service } = setup();
    await service.record(
      'savannah',
      'a1',
      'Mayor Van Johnson',
      new Date('2026-09-01T00:00:00Z')
    );
    const controller = new CivicOfficialsController(service);
    expect(await controller.getOfficials({ town: ' savannah ' })).toHaveLength(
      1
    );
    expect(await controller.getOfficials(undefined)).toHaveLength(1);
    expect(await controller.getOfficials({ town: 'tifton' })).toEqual([]);
  });
});
