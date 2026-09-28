import { RpcException } from '@nestjs/microservices';
import { CivicBroadcastSeverity } from '@optimistic-tanuki/models';
import { extractDocumentText } from '@optimistic-tanuki/document-text';
import { discoverAgendaLinks } from './agenda-source-discovery';

jest.mock('@optimistic-tanuki/document-text', () => ({
  extractDocumentText: jest.fn(async () =>
    [
      'CITY COUNCIL REGULAR MEETING',
      '1. Call to order and invocation for the evening session.',
      'The mayor opened the meeting with remarks about the budget.',
      '2. Rezoning request for 142 Bull Street seeking setback variance relief from the side setback requirement.',
      'The applicant requests relief from the side setback requirement for the proposed addition.',
      '3. Adjournment of the regular meeting.',
    ].join('\n')
  ),
  DocumentExtractionError: class DocumentExtractionError extends Error {
    constructor(readonly reason: string, message: string) {
      super(message);
      this.name = 'DocumentExtractionError';
    }
  },
}));

import { CivicService } from './civic.service';
import { CivicAgenda } from '../entities/civic-agenda.entity';
import { CivicAgendaItem } from '../entities/civic-agenda-item.entity';
import { TipProject } from '../entities/tip-project.entity';
import { EmergencyBroadcast } from '../entities/emergency-broadcast.entity';

type Stored = Record<string, unknown> & { id: string };

class TestRepository {
  readonly records: Stored[] = [];
  private sequence = 0;

  create(values: Record<string, unknown>): Stored {
    return { ...values } as Stored;
  }

  async findOne(options: {
    where: Record<string, unknown>;
  }): Promise<Stored | null> {
    return (
      this.records.find((record) =>
        Object.entries(options.where).every(
          ([key, value]) => record[key] === value
        )
      ) || null
    );
  }

  async find(options: {
    where: Record<string, unknown>;
    order?: Record<string, 'ASC' | 'DESC'>;
    take?: number;
  }): Promise<Stored[]> {
    const matches = this.records.filter((record) =>
      Object.entries(options.where).every(
        ([key, value]) => record[key] === value
      )
    );
    const [orderKey, direction] = Object.entries(options.order ?? {})[0] ?? [];
    const ordered = !orderKey
      ? matches
      : [...matches].sort((left, right) => {
          const comparison = String(left[orderKey]).localeCompare(
            String(right[orderKey])
          );
          return direction === 'DESC' ? -comparison : comparison;
        });
    return options.take === undefined
      ? ordered
      : ordered.slice(0, options.take);
  }

  async save(entity: Partial<Stored>): Promise<Stored> {
    const full = { ...entity } as Stored;
    if (!full.id) {
      this.sequence += 1;
      full.id = `00000000-0000-4000-8000-${String(this.sequence).padStart(
        12,
        '0'
      )}`;
    }
    const index = this.records.findIndex((record) => record.id === full.id);
    if (index < 0) {
      this.records.push(full);
    } else {
      this.records[index] = full;
    }
    return full;
  }

  async delete(
    criteria: Record<string, unknown>
  ): Promise<{ affected: number }> {
    const before = this.records.length;
    for (let index = this.records.length - 1; index >= 0; index -= 1) {
      if (
        Object.entries(criteria).every(
          ([key, value]) => this.records[index][key] === value
        )
      ) {
        this.records.splice(index, 1);
      }
    }
    return { affected: before - this.records.length };
  }

  createQueryBuilder(): never {
    throw new Error('query builder is not supported by the fake repository');
  }
}

const repositories = new Map<string, TestRepository>();
const repositoryFor = (entity: { name: string }): TestRepository => {
  const existing = repositories.get(entity.name);
  if (existing) {
    return existing;
  }
  const created = new TestRepository();
  repositories.set(entity.name, created);
  return created;
};

const createDataSource = () => {
  const manager = {
    queryRunner: { isTransactionActive: true, query: async () => [] },
    getRepository: (entity: { name: string }) => repositoryFor(entity),
  };
  return {
    transaction: async <T>(callback: (value: typeof manager) => Promise<T>) =>
      callback(manager),
  } as never;
};

async function rpcError(promise: Promise<unknown>): Promise<{
  statusCode: number;
  message: string;
}> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(RpcException);
    return (error as RpcException).getError() as {
      statusCode: number;
      message: string;
    };
  }
  throw new Error('Expected the call to fail.');
}

const point = (lng: number, lat: number): Record<string, unknown> => ({
  type: 'Point',
  coordinates: [lng, lat],
});

describe('CivicService', () => {
  let service: CivicService;
  const tenantId = 'chatham-county';

  beforeEach(() => {
    repositories.clear();
    service = new CivicService(createDataSource());
  });

  it('registers and reads back a TIP project with funding figures', async () => {
    const created = await service.registerTipProject(tenantId, {
      name: 'Islands Expressway resurfacing',
      description: 'Mill and resurface 4.2 miles of the Islands Expressway.',
      geometry: point(-81.05, 32.02),
      fundingAllocatedCents: 4000000000,
      status: 'funded',
      milestone: 'Design complete',
    });

    expect(created.fundingAllocatedCents).toBe(4000000000);
    expect(created.fundingSpentCents).toBe(0);

    const listed = await service.getTipProjects(tenantId, {});
    expect(listed).toHaveLength(1);
    expect(listed[0].geometry).toEqual(point(-81.05, 32.02));

    const single = await service.getTipProject(tenantId, created.id);
    expect(single.name).toBe('Islands Expressway resurfacing');
  });

  it('rejects non-finite and oversized geometries', async () => {
    const infinite = await rpcError(
      service.registerTipProject(tenantId, {
        name: 'Bad geometry',
        description: 'A project whose geometry is not finite.',
        geometry: { type: 'Point', coordinates: [NaN, 32] },
        fundingAllocatedCents: 100,
        status: 'planned',
      })
    );
    expect(infinite.statusCode).toBe(400);

    const unknown = await rpcError(
      service.registerTipProject(tenantId, {
        name: 'Bad type',
        description: 'A project with an unknown geometry type.',
        geometry: { type: 'Circle', coordinates: [0, 0] },
        fundingAllocatedCents: 100,
        status: 'planned',
      })
    );
    expect(unknown.statusCode).toBe(400);

    expect(repositoryFor(TipProject).records).toHaveLength(0);
  });

  it('filters TIP projects by bounding box', async () => {
    await service.registerTipProject(tenantId, {
      name: 'Near project',
      description: 'A project inside the query box.',
      geometry: point(-81.1, 32.0),
      fundingAllocatedCents: 100,
      status: 'planned',
    });
    await service.registerTipProject(tenantId, {
      name: 'Far project',
      description: 'A project outside the query box.',
      geometry: point(-84.39, 33.75),
      fundingAllocatedCents: 100,
      status: 'planned',
    });

    const inside = await service.getTipProjects(tenantId, {
      bbox: [-81.5, 31.5, -80.5, 32.5],
    });
    expect(inside.map((project) => project.name)).toEqual(['Near project']);

    const badBox = await rpcError(
      service.getTipProjects(tenantId, { bbox: [0, 0, 0] as never })
    );
    expect(badBox.statusCode).toBe(400);
  });

  it('applies the TIP limit after filtering projects by bounding box', async () => {
    for (let index = 0; index < 3; index += 1) {
      await service.registerTipProject(tenantId, {
        name: `Outside ${index}`,
        description: 'Outside the requested box.',
        geometry: point(10 + index, 10),
        fundingAllocatedCents: 100,
        status: 'planned',
      });
    }
    await service.registerTipProject(tenantId, {
      name: 'Later match',
      description: 'This project is inside the requested box.',
      geometry: point(0, 0),
      fundingAllocatedCents: 100,
      status: 'planned',
    });

    const projects = await service.getTipProjects(tenantId, {
      bbox: [-1, -1, 1, 1],
      limit: 1,
    });

    expect(projects.map((project) => project.name)).toEqual(['Later match']);
  });

  it('includes a line that crosses the bbox with both vertices outside', async () => {
    await service.registerTipProject(tenantId, {
      name: 'Crossing road',
      description: 'A road that crosses the query rectangle.',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-2, 0],
          [2, 0],
        ],
      },
      fundingAllocatedCents: 100,
      status: 'planned',
    });

    const projects = await service.getTipProjects(tenantId, {
      bbox: [-1, -1, 1, 1],
    });

    expect(projects.map((project) => project.name)).toEqual(['Crossing road']);
  });

  it('includes a polygon that fully covers the bbox', async () => {
    await service.registerTipProject(tenantId, {
      name: 'District overlay',
      description: 'A polygon that covers the query rectangle.',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-2, -2],
            [2, -2],
            [2, 2],
            [-2, 2],
            [-2, -2],
          ],
        ],
      },
      fundingAllocatedCents: 100,
      status: 'planned',
    });

    const projects = await service.getTipProjects(tenantId, {
      bbox: [-1, -1, 1, 1],
    });

    expect(projects.map((project) => project.name)).toEqual([
      'District overlay',
    ]);
  });

  it('publishes broadcasts and hides expired ones', async () => {
    await service.publishBroadcast(tenantId, {
      severity: CivicBroadcastSeverity.WARNING,
      headline: 'Flash flood watch',
      body: 'A flash flood watch is in effect until midnight for low-lying roads.',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    });
    const repository = repositoryFor(EmergencyBroadcast);
    await repository.save({
      tenantId,
      severity: 'advisory',
      headline: 'Old advisory',
      body: 'An advisory that has already expired.',
      issuedAt: new Date(Date.now() - 7200000),
      expiresAt: new Date(Date.now() - 3600000),
      audience: null,
    });

    const active = await service.getBroadcasts(tenantId, {});
    expect(active.map((broadcast) => broadcast.headline)).toEqual([
      'Flash flood watch',
    ]);

    const since = await service.getBroadcasts(tenantId, {
      since: new Date(Date.now() + 1000).toISOString(),
    });
    expect(since).toEqual([]);
  });

  it('summarizes agenda text extractively around zoning language', () => {
    const summary = service.extractiveSummary(
      'The meeting opened with routine approvals. A rezoning request for 142 Bull Street seeks a variance for setback relief. Neighbors spoke about parking and density. The board deferred the vote.'
    );

    expect(summary).toContain('rezoning request');
    expect(summary).toContain('variance');
  });

  it('ingests an agenda document into items and rejects itemless files', async () => {
    const text = [
      'CITY COUNCIL REGULAR MEETING',
      '1. Call to order and invocation.',
      '2. Rezoning request for 142 Bull Street seeking setback variance relief.',
      'The applicant requests relief from the side setback requirement.',
      '3. Adjournment.',
    ].join('\n');
    const agenda = await service.ingestAgenda(tenantId, {
      meetingBody: 'city-council',
      meetingDate: '2026-09-01T18:00:00.000Z',
      title: 'September council session',
      fileName: 'agenda.pdf',
      fileBase64: Buffer.from(`%PDF-1.7\n${text}\n${' '.repeat(64)}`).toString(
        'base64'
      ),
    } as never);

    expect(agenda.items.length).toBeGreaterThanOrEqual(2);
    expect(agenda.items[1].summary.length).toBeGreaterThanOrEqual(20);
    expect(repositoryFor(CivicAgendaItem).records.length).toBe(
      agenda.items.length
    );

    const agendas = await service.getAgendas(tenantId, { search: 'rezoning' });
    expect(agendas).toHaveLength(1);
  });

  it('parses Roman-numbered headings used by planning commission agendas', async () => {
    jest
      .mocked(extractDocumentText)
      .mockResolvedValueOnce(
        [
          'METROPOLITAN PLANNING COMMISSION',
          'XIIII. Adjournment',
          'XIII. Executive Session',
          'The commission entered executive session.',
          'VII. Consent Agenda',
          'Approval of the minutes and routine applications.',
          'I. Call to Order',
          'The chair called the meeting to order.',
        ].join('\n')
      );

    const agenda = await service.ingestAgenda(tenantId, {
      meetingBody: 'planning-commission',
      meetingDate: '2026-10-27T18:00:00.000Z',
      title: 'October planning commission meeting',
      fileName: 'agenda.pdf',
      fileBase64: Buffer.from(`%PDF-1.7\n${' '.repeat(64)}`).toString('base64'),
    } as never);

    expect(agenda.items.map((item) => item.itemNumber)).toEqual([
      'I',
      'VII',
      'XIII',
      'XIIII',
    ]);
  });

  it('keeps a discovered meeting on its stated Eastern calendar date', () => {
    const entries = discoverAgendaLinks(
      '<table><tr><td>Oct 27, 2026</td><td>Oct 27, 2026 MPC Meeting</td><td><a href="/agenda.pdf">Agenda PDF</a></td></tr></table>',
      'https://www.thempc.org/Board/Tpc',
      'planning-commission'
    );

    expect(entries[0].meetingDate).toBe('2026-10-27T12:00:00.000Z');
  });

  it('deduplicates unchanged direct-source content but refreshes a changed PDF at the same URL', async () => {
    const documents = [
      Buffer.from('%PDF-1.7 council agenda version one'),
      Buffer.from('%PDF-1.7 council agenda version one'),
      Buffer.from('%PDF-1.7 council agenda amended'),
    ];
    const fetcher = jest.fn().mockImplementation(async () => ({
      ok: true,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: async () => documents.shift()!,
    }));
    const configured = new CivicService(createDataSource(), {
      agendaSources: [
        {
          id: 'savannah-council',
          url: 'https://city.example/agendas/current.pdf',
        },
      ],
      fetcher,
    });
    const input = {
      sourceId: 'savannah-council',
      meetingBody: 'city-council',
      meetingDate: '2026-09-01T18:00:00.000Z',
      title: 'September council session',
    } as never;

    const first = await configured.importAgendaSource(tenantId, input);
    const second = await configured.importAgendaSource(tenantId, input);
    const amended = await configured.importAgendaSource(tenantId, input);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(second.id).toBe(first.id);
    expect(amended.id).toBe(first.id);
    expect(repositoryFor(CivicAgenda).records).toHaveLength(1);
    expect(repositoryFor(CivicAgendaItem).records).toHaveLength(3);
  });

  it('does not import a configured source into a different tenant', async () => {
    const fetcher = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/pdf' },
      arrayBuffer: async () => Buffer.from('%PDF-1.7 council agenda'),
    });
    const configured = new CivicService(createDataSource(), {
      agendaSources: [{ id: 'planning', url: 'https://city.example/plan.pdf' }],
      fetcher,
    });
    const source = {
      sourceId: 'planning',
      meetingBody: 'planning-commission',
      meetingDate: '2026-09-01T18:00:00.000Z',
      title: 'September planning session',
    } as never;

    const first = await configured.importAgendaSource(tenantId, source);
    const second = await configured.importAgendaSource('other-county', source);

    expect(second.id).not.toBe(first.id);
    expect(repositoryFor(CivicAgenda).records).toHaveLength(2);
  });

  it('rejects source URLs that are not registered as trusted agenda sources', async () => {
    const fetcher = jest.fn();
    const configured = new CivicService(createDataSource(), {
      agendaSources: [],
      fetcher,
    });

    const error = await rpcError(
      configured.importAgendaSource(tenantId, {
        sourceId: 'arbitrary-url',
        meetingBody: 'planning-commission',
        meetingDate: '2026-09-01T18:00:00.000Z',
        title: 'Planning session',
      } as never)
    );

    expect(error.statusCode).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('polls configured Savannah HTML and MPC PDF indexes and ingests discovered agendas', async () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const fixture = (name: string) =>
      fs.readFileSync(path.join(__dirname, 'fixtures', name));
    const routes = new Map<string, { type: string; body: Buffer }>([
      [
        'https://agenda.savannahga.gov/publishing/ap-agendas.html',
        { type: 'text/html', body: fixture('savannah-index.html') },
      ],
      [
        'https://agenda.savannahga.gov/publishing/september-agenda.html',
        { type: 'text/html', body: fixture('savannah-agenda.html') },
      ],
      [
        'https://www.thempc.org/Board/Tpc',
        { type: 'text/html', body: fixture('mpc-index.html') },
      ],
      [
        'https://www.thempc.org/eagenda/current.pdf',
        { type: 'application/pdf', body: Buffer.from('%PDF-1.7 MPC agenda') },
      ],
    ]);
    const fetcher = jest.fn().mockImplementation(async (url: string) => {
      const route = routes.get(url);
      if (!route) throw new Error(`Unexpected fixture URL ${url}`);
      return {
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? route.type : null),
        },
        arrayBuffer: async () => route.body,
      };
    });
    const configured = new CivicService(createDataSource(), {
      agendaSources: [
        {
          id: 'savannah-council',
          indexUrl: 'https://agenda.savannahga.gov/publishing/ap-agendas.html',
          meetingBody: 'city-council',
          tenantId,
        },
        {
          id: 'mpc-planning',
          indexUrl: 'https://www.thempc.org/Board/Tpc',
          meetingBody: 'planning-commission',
          tenantId,
        },
      ],
      fetcher,
    });

    const firstRun = await configured.pollConfiguredAgendaSources();
    const secondRun = await configured.pollConfiguredAgendaSources();

    expect(firstRun).toEqual({ discovered: 2, ingested: 2, skipped: 0 });
    expect(secondRun).toEqual({ discovered: 2, ingested: 0, skipped: 2 });
    expect(
      repositoryFor(CivicAgenda).records.map((agenda) => agenda['title'])
    ).toEqual([
      'September 24, 2026 City Council Regular Meeting',
      'Sep 15, 2026 MPC Meeting',
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      'https://agenda.savannahga.gov/publishing/september-agenda.html',
      expect.objectContaining({ redirect: 'manual', signal: expect.anything() })
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://www.thempc.org/eagenda/current.pdf',
      expect.objectContaining({ redirect: 'manual', signal: expect.anything() })
    );
  });

  it('coalesces overlapping source polls into one in-flight request', async () => {
    const configured = new CivicService(createDataSource(), {
      agendaSources: [
        {
          id: 'savannah-council',
          indexUrl: 'https://agenda.savannahga.gov/publishing/ap-agendas.html',
          meetingBody: 'city-council',
          tenantId,
        },
      ],
    });
    let releasePoll!: (result: {
      discovered: number;
      ingested: number;
      skipped: number;
    }) => void;
    const pollOnce = jest
      .spyOn(
        configured as unknown as {
          pollConfiguredAgendaSourcesOnce: () => Promise<{
            discovered: number;
            ingested: number;
            skipped: number;
          }>;
        },
        'pollConfiguredAgendaSourcesOnce'
      )
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            releasePoll = resolve;
          })
      );
    const first = configured.pollConfiguredAgendaSources();
    const second = configured.pollConfiguredAgendaSources();
    expect(pollOnce).toHaveBeenCalledTimes(1);
    releasePoll({ discovered: 0, ingested: 0, skipped: 0 });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { discovered: 0, ingested: 0, skipped: 0 },
      { discovered: 0, ingested: 0, skipped: 0 },
    ]);
  });

  it('rejects discovered links and redirects outside the approved HTTPS host', async () => {
    const fetcher = jest.fn().mockImplementation(async (url: string) => ({
      ok: false,
      status: 302,
      headers: {
        get: (name: string) =>
          name === 'location' ? 'https://127.0.0.1/internal' : null,
      },
      arrayBuffer: async () => new ArrayBuffer(0),
    }));
    const configured = new CivicService(createDataSource(), {
      agendaSources: [
        {
          id: 'savannah-council',
          indexUrl: 'https://agenda.savannahga.gov/publishing/ap-agendas.html',
          meetingBody: 'city-council',
          tenantId,
        },
      ],
      fetcher,
    });

    const result = await configured.pollConfiguredAgendaSources();

    expect(result).toEqual({ discovered: 0, ingested: 0, skipped: 0 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'https://agenda.savannahga.gov/publishing/ap-agendas.html',
      expect.objectContaining({ redirect: 'manual', signal: expect.anything() })
    );
  });

  it('stops reading a source response as soon as the streaming byte cap is exceeded', async () => {
    let pulled = 0;
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        if (pulled <= 3) controller.enqueue(new Uint8Array([1, 2, 3]));
        else controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const configured = new CivicService(createDataSource(), {
      maxAgendaBytes: 4,
      agendaSources: [
        {
          id: 'tiny-pdf',
          url: 'https://agenda.savannahga.gov/current.pdf',
        },
      ],
      fetcher: async () => ({
        ok: true,
        status: 200,
        headers: {
          get: (name) => (name === 'content-type' ? 'application/pdf' : null),
        },
        body,
      }),
    });

    const error = await rpcError(
      configured.importAgendaSource(tenantId, {
        sourceId: 'tiny-pdf',
        meetingBody: 'city-council',
        meetingDate: '2026-09-01T18:00:00.000Z',
        title: 'Tiny PDF',
      } as never)
    );

    expect(error.statusCode).toBe(400);
    expect(cancelled).toBe(true);
    expect(pulled).toBeLessThanOrEqual(3);
  });

  it('skips scheduled polling when no explicit source tenant is configured', async () => {
    const fetcher = jest.fn();
    const configured = new CivicService(createDataSource(), {
      agendaSources: [
        {
          id: 'savannah-council',
          indexUrl: 'https://agenda.savannahga.gov/publishing/ap-agendas.html',
          meetingBody: 'city-council',
        },
      ],
      fetcher,
    });

    await expect(configured.pollConfiguredAgendaSources()).resolves.toEqual({
      discovered: 0,
      ingested: 0,
      skipped: 0,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('starts polling on module initialization and clears its timer on destroy', () => {
    jest.useFakeTimers();
    try {
      const configured = new CivicService(createDataSource(), {
        agendaSources: [
          {
            id: 'savannah-council',
            indexUrl:
              'https://agenda.savannahga.gov/publishing/ap-agendas.html',
            meetingBody: 'city-council',
          },
        ],
        agendaPollIntervalMs: 60_000,
      });
      const poll = jest
        .spyOn(configured, 'pollConfiguredAgendaSources')
        .mockResolvedValue({ discovered: 0, ingested: 0, skipped: 0 });

      configured.onModuleInit();
      expect(poll).toHaveBeenCalledTimes(1);
      jest.advanceTimersByTime(60_000);
      expect(poll).toHaveBeenCalledTimes(2);
      configured.onModuleDestroy();
      jest.advanceTimersByTime(120_000);
      expect(poll).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('isolates tenants and requires tenant context', async () => {
    await service.registerTipProject(tenantId, {
      name: 'Tenant project',
      description: 'A project owned by one municipality.',
      geometry: point(-81.1, 32.0),
      fundingAllocatedCents: 100,
      status: 'planned',
    });

    expect(await service.getTipProjects('other-county', {})).toEqual([]);
    const missing = await rpcError(service.getTipProjects('', {}));
    expect(missing.statusCode).toBe(401);
  });
});
