import type {
  FetchContext,
  FetchResult,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import {
  createCivicCoreAdapter,
  parseCivicCoreConfig,
} from '../../src/civic-core/index.js';
import type { CivicCoreClient } from '../../src/civic-core/client.js';

const NOW = new Date('2026-10-03T12:00:00Z');

const source: SourceConfig = {
  sourceKey: 'civic-core-t1',
  ownerSlug: 'tifton-ga',
  coverage: 'all',
  adapter: 'civic-core',
  name: 'City of Tifton',
  url: 'civic-core:t1',
  kind: 'meeting',
  desk: 'government',
  config: { tenantId: 't1' },
};

const ctx = {} as FetchContext;

interface FakeClient extends CivicCoreClient {
  agendas: jest.Mock;
  broadcasts: jest.Mock;
  tipProjects: jest.Mock;
}

function fakeClient(overrides: Partial<FakeClient> = {}): FakeClient {
  return {
    tenants: jest.fn().mockResolvedValue([]),
    agendas: jest.fn().mockResolvedValue([
      {
        id: 'a1',
        meetingBody: 'city-council',
        meetingDate: '2026-10-07T00:00:00Z',
        title: 'Council regular meeting',
        items: [
          { id: 'i1', itemNumber: '1', title: 'Budget', summary: 'Adopt FY27' },
          { id: 'i2', title: 'Paving', summary: '' },
        ],
      },
    ]),
    broadcasts: jest.fn().mockResolvedValue([
      {
        id: 'b1',
        severity: 'warning',
        headline: 'Boil water notice',
        body: 'Boil water until further notice.',
        issuedAt: '2026-10-02T08:00:00Z',
        expiresAt: '2026-10-05T00:00:00Z',
      },
      {
        id: 'b2',
        severity: 'advisory',
        headline: 'Old notice',
        body: 'Gone.',
        issuedAt: '2026-09-01T08:00:00Z',
        expiresAt: '2026-09-02T00:00:00Z',
      },
    ]),
    tipProjects: jest.fn().mockResolvedValue([
      {
        id: 'p1',
        name: 'Main Street resurfacing',
        description: 'Resurface Main St.',
        fundingAllocatedCents: 250_000_000,
        fundingSpentCents: 10_050,
        status: 'design',
        milestone: 'Bid opening',
      },
    ]),
    ...overrides,
  } as FakeClient;
}

const fetched = (results: FetchResult[]) =>
  results.filter(
    (r): r is Extract<FetchResult, { kind: 'fetched' }> => r.kind === 'fetched'
  );

describe('civic-core adapter', () => {
  it('is named civic-core', () => {
    expect(createCivicCoreAdapter(fakeClient()).name).toBe('civic-core');
  });

  describe('config', () => {
    it('accepts a tenantId', () => {
      expect(parseCivicCoreConfig(source)).toEqual({
        config: { tenantId: 't1' },
      });
    });
    it.each([
      undefined,
      {},
      { tenantId: '' },
      { tenantId: 5 },
      { tenantId: 'a/b' },
    ])('rejects %j', (config) => {
      expect(
        'error' in
          parseCivicCoreConfig({
            ...source,
            config: config as Record<string, unknown> | undefined,
          })
      ).toBe(true);
    });
    it('turns bad config into a failed result without calling the client', async () => {
      const client = fakeClient();
      const results = await createCivicCoreAdapter(client, {
        now: () => NOW,
      }).fetch({ ...source, config: {} }, ctx);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ kind: 'failed' });
      expect(client.agendas).not.toHaveBeenCalled();
    });
  });

  describe('fetch', () => {
    it('returns one record per agenda, active broadcast and TIP project', async () => {
      const results = await createCivicCoreAdapter(fakeClient(), {
        now: () => NOW,
      }).fetch(source, ctx);
      expect(results.map((r) => r.url)).toEqual([
        'civic-core:t1/agenda/a1',
        'civic-core:t1/broadcast/b1',
        'civic-core:t1/tip-project/p1',
      ]);
      for (const result of fetched(results)) {
        expect(result.requestUrl).toBe('civic-core:t1');
        expect(result.payload.kind).toBe('text');
      }
      expect(
        JSON.parse((fetched(results)[0]!.payload as { body: string }).body)
      ).toMatchObject({ id: 'a1' });
    });

    it('skips broadcasts past expiresAt', async () => {
      const results = await createCivicCoreAdapter(fakeClient(), {
        now: () => NOW,
      }).fetch(source, ctx);
      expect(results.some((r) => r.url.endsWith('/broadcast/b2'))).toBe(false);
    });

    it('turns a client failure into a retryable failed result and keeps the other reads', async () => {
      const client = fakeClient({
        agendas: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });
      const results = await createCivicCoreAdapter(client, {
        now: () => NOW,
      }).fetch(source, ctx);
      const failure = results.find((r) => r.kind === 'failed');
      expect(failure).toMatchObject({
        url: 'civic-core:t1/agenda',
        requestUrl: 'civic-core:t1',
        error: { retryable: true },
      });
      expect(fetched(results)).toHaveLength(2);
    });
  });

  describe('parse', () => {
    async function parsed() {
      const adapter = createCivicCoreAdapter(fakeClient(), { now: () => NOW });
      const out = [];
      for (const raw of fetched(await adapter.fetch(source, ctx)))
        out.push(...(await adapter.parse(raw, source)));
      return out;
    }

    it('turns an agenda into a meeting', async () => {
      const [agenda] = await parsed();
      expect(agenda).toMatchObject({
        title: 'Council regular meeting',
        kind: 'meeting',
        eventDate: '2026-10-07T00:00:00.000Z',
        uris: ['civic-core:t1/agenda/a1'],
      });
      expect(agenda!.body).toContain('1 Budget: Adopt FY27');
      expect(agenda!.body).toContain('Paving');
    });

    it('turns a broadcast into an alert carrying its severity', async () => {
      const alert = (await parsed())[1]!;
      expect(alert.kind).toBe('alert');
      expect(alert.title).toBe('Warning: Boil water notice');
      expect(alert.body).toContain('Severity: Warning');
      expect(alert.publishedAt).toBe('2026-10-02T08:00:00.000Z');
    });

    it('turns a TIP project into a news item with funding and status', async () => {
      const project = (await parsed())[2]!;
      expect(project.kind).toBe('news');
      expect(project.title).toBe('Main Street resurfacing');
      expect(project.body).toContain('Status: design');
      expect(project.body).toContain('Milestone: Bid opening');
      expect(project.body).toContain('allocated: $2,500,000');
      expect(project.body).toContain('spent: $100.5');
    });

    it('ignores records it cannot read', async () => {
      const adapter = createCivicCoreAdapter(fakeClient());
      const raw = {
        url: 'civic-core:t1/agenda/x',
        contentType: 'application/json',
        fetchedAt: NOW.toISOString(),
        payload: { kind: 'text' as const, body: 'not json' },
      };
      expect(await adapter.parse(raw, source)).toEqual([]);
      expect(
        await adapter.parse({ ...raw, url: 'civic-core:t1/other/x' }, source)
      ).toEqual([]);
    });
  });
});
