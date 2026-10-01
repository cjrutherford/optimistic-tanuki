import { openDataAdapter } from '../../src/open-data/index.js';
import type { HttpResponse } from '@optimistic-tanuki/civic-core';

const source = {
  sourceKey: 'nws-test',
  ownerSlug: 'us',
  coverage: 'mentions' as const,
  adapter: 'open-data',
  name: 'NWS',
  url: 'https://api.weather.gov',
  kind: 'alert' as const,
};

describe('open-data payload contract', () => {
  it('parses a durable text alert payload', async () => {
    const [item] = await openDataAdapter.parse(
      {
        url: 'https://api.weather.gov/alerts/active#id',
        contentType: 'application/nws-alert+json',
        payload: {
          kind: 'text',
          body: JSON.stringify({
            id: 'id',
            properties: {
              headline: 'Flood warning',
              description: 'Move now',
              areaDesc: 'Town A',
            },
          }),
        },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(item.title).toBe('Flood warning');
    expect(item.topics).toStrictEqual(['Town A']);
  });

  it('builds an NWS area query when configured with an area', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { 'content-type': 'application/geo+json' },
      });
    }) as typeof fetch;
    try {
      const httpClient = {
        fetch: async (input: string) =>
          Object.assign(await globalThis.fetch(input), {
            finalUrl: input,
            redirectChain: [input],
          }) as HttpResponse,
      };
      await openDataAdapter.fetch(
        { ...source, config: { area: 'GA' } },
        { locality: {} as never, httpClient }
      );
      expect(calls[0]).toBe('https://api.weather.gov/alerts/active?area=GA');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('retains point queries for coordinate-configured NWS sources', async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ features: [] }), {
        status: 200,
        headers: { 'content-type': 'application/geo+json' },
      });
    }) as typeof fetch;
    try {
      const httpClient = {
        fetch: async (input: string) =>
          Object.assign(await globalThis.fetch(input), {
            finalUrl: input,
            redirectChain: [input],
          }) as HttpResponse,
      };
      await openDataAdapter.fetch(
        { ...source, config: { lat: 31, lon: -83 } },
        { locality: {} as never, httpClient }
      );
      expect(calls[0]).toBe(
        'https://api.weather.gov/alerts/active?point=31,-83'
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
