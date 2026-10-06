import type { LocalityConfig } from '@optimistic-tanuki/civic-core';
import { matchTenants } from '../../src/civic-core/match.js';
import type { CivicTenantRecord } from '../../src/civic-core/client.js';

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
): CivicTenantRecord => ({ id, displayName: townName, townName, state, kind });

const registry = [
  place('tifton-ga', 'Tifton', 'GA', 'city'),
  place('nashville-ga', 'Nashville', 'GA', 'city'),
  place('nashville-tn', 'Nashville', 'TN', 'city'),
  place('madison-fl', 'Madison', 'FL', 'town'),
  place('madison-county-fl', 'Madison', 'FL', 'county'),
  place('georgia', 'Georgia', 'GA', 'state'),
  place('twin-a', 'Twin', 'OH', 'town'),
  place('twin-b', 'City of Twin', 'OH', 'city'),
];

describe('matchTenants', () => {
  it('matches exactly and records the evidence', () => {
    const [match] = matchTenants(
      [tenant('t', 'Tifton', 'GA', 'city')],
      registry
    );
    expect(match).toMatchObject({ tenantId: 't', localitySlug: 'tifton-ga' });
    expect((match as { evidence: string[] }).evidence[0]).toContain(
      'tifton-ga'
    );
  });

  it('normalises prefixes, punctuation, case and a state suffix', () => {
    const results = matchTenants(
      [
        tenant('a', 'City of Tifton', 'GA', 'city'),
        tenant('b', 'TIFTON.', 'GA', 'town'),
        tenant('c', 'Tifton, GA', 'GA', 'city'),
      ],
      registry
    );
    expect(
      results.map((r) => ('localitySlug' in r ? r.localitySlug : r))
    ).toEqual(['tifton-ga', 'tifton-ga', 'tifton-ga']);
  });

  it('refuses a namesake in another state', () => {
    const [match] = matchTenants(
      [tenant('t', 'Nashville', 'GA', 'city')],
      registry
    );
    expect(match).toMatchObject({ localitySlug: 'nashville-ga' });
    const [tx] = matchTenants(
      [tenant('t', 'Nashville', 'AL', 'city')],
      registry
    );
    expect(tx).toMatchObject({ tenantId: 't' });
    expect('refused' in tx!).toBe(true);
  });

  it('resolves a city and a county of the same name by kind', () => {
    const results = matchTenants(
      [
        tenant('town', 'Madison', 'FL', 'town'),
        tenant('county', 'Madison', 'FL', 'county'),
      ],
      registry
    );
    expect(results).toMatchObject([
      { localitySlug: 'madison-fl' },
      { localitySlug: 'madison-county-fl' },
    ]);
  });

  it('refuses a tenant whose kind fits no namesake', () => {
    const [match] = matchTenants(
      [tenant('t', 'Tifton', 'GA', 'county')],
      registry
    );
    expect('refused' in match!).toBe(true);
  });

  it('refuses an ambiguous tenant, naming the candidates', () => {
    const [match] = matchTenants([tenant('t', 'Twin', 'OH', 'town')], registry);
    expect(match).toMatchObject({ tenantId: 't' });
    const refused = (match as { refused: string }).refused;
    expect(refused).toMatch(/ambiguous/u);
    expect(refused).toContain('twin-a');
    expect(refused).toContain('twin-b');
  });

  it('never matches a non-government locality or a bad state', () => {
    const results = matchTenants(
      [
        tenant('s', 'Georgia', 'GA', 'city'),
        tenant('g', 'Tifton', 'Georgia', 'city'),
      ],
      registry
    );
    expect(results.every((r) => 'refused' in r)).toBe(true);
  });
});
