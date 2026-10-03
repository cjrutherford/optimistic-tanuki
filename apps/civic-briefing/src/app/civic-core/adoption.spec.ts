import type {
  CivicCoreClient,
  CivicTenantRecord,
} from '@optimistic-tanuki/civic-adapters';
import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import { civicCoreDecisions } from './adoption';

function place(
  slug: string,
  name: string,
  state: string,
  kind: string
): LocalityConfig {
  return {
    slug,
    name,
    state,
    kind,
    timezone: 'America/New_York',
    lat: 0,
    lon: 0,
    parents: [],
    edition: true,
    topics: [],
    cadence: ['daily'],
    sources: [],
  };
}

const tenant = (
  id: string,
  townName: string,
  state: string,
  kind: CivicTenantRecord['kind']
): CivicTenantRecord => ({
  id,
  displayName: `${townName} Civic Core`,
  townName,
  state,
  kind,
});

const tifton = place('tifton-ga', 'Tifton', 'GA', 'city');
const nashvilleGa = place('nashville-ga', 'Nashville', 'GA', 'city');
const localities = [
  tifton,
  nashvilleGa,
  place('nashville-tn', 'Nashville', 'TN', 'city'),
  place('twin-a', 'Twin', 'OH', 'town'),
  place('twin-b', 'City of Twin', 'OH', 'city'),
];

const clientWith = (tenants: CivicTenantRecord[]): CivicCoreClient => ({
  tenants: async () => tenants,
  agendas: async () => [],
  broadcasts: async () => [],
  tipProjects: async () => [],
});

describe('civicCoreDecisions', () => {
  it("adopts a matched tenant as the town's own source", async () => {
    const { decisions } = await civicCoreDecisions(
      clientWith([tenant('t1', 'City of Tifton', 'GA', 'city')]),
      tifton,
      localities
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      adopted: true,
      ownerSlug: 'tifton-ga',
      source: {
        adapter: 'civic-core',
        sourceKey: 'civic-core-t1',
        url: 'civic-core:t1',
        kind: 'meeting',
        desk: 'government',
        coverage: 'all',
        config: { tenantId: 't1' },
        name: 'City of Tifton Civic Core',
      },
    });
    expect(decisions[0]!.evidence[0]).toContain('tifton-ga');
  });

  it('leaves a tenant that belongs to another town alone', async () => {
    const { decisions } = await civicCoreDecisions(
      clientWith([tenant('t1', 'Nashville', 'GA', 'city')]),
      tifton,
      localities
    );
    expect(decisions).toEqual([]);
  });

  it('does not adopt a tenant again once the town has its source', async () => {
    const adopted = {
      ...tifton,
      sources: [
        {
          sourceKey: 'civic-core-t1',
          ownerSlug: 'tifton-ga',
          coverage: 'all' as const,
          adapter: 'civic-core',
          name: 'x',
          url: 'civic-core:t1',
          kind: 'meeting' as const,
        },
      ],
    };
    const { decisions } = await civicCoreDecisions(
      clientWith([tenant('t1', 'Tifton', 'GA', 'city')]),
      adopted,
      localities
    );
    expect(decisions).toEqual([]);
  });

  it('refuses a namesake in another state and says why for the town it resembles', async () => {
    const { decisions } = await civicCoreDecisions(
      clientWith([tenant('n1', 'Nashville', 'AL', 'city')]),
      nashvilleGa,
      localities
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ adopted: false });
    expect(decisions[0]!.reasons[0]).toMatch(
      /no city named "Nashville" in AL/u
    );
  });

  it('refuses an ambiguous tenant for each town it could be', async () => {
    const { decisions } = await civicCoreDecisions(
      clientWith([tenant('w1', 'Twin', 'OH', 'town')]),
      localities[3]!,
      localities
    );
    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({ adopted: false });
    expect(decisions[0]!.reasons[0]).toMatch(/ambiguous/u);
  });

  it('skips Civic Core when it is unreachable', async () => {
    const client = {
      ...clientWith([]),
      tenants: async () => {
        throw new Error('ECONNREFUSED');
      },
    };
    expect(await civicCoreDecisions(client, tifton, localities)).toEqual({
      decisions: [],
      unreachable: 'ECONNREFUSED',
    });
  });
});
