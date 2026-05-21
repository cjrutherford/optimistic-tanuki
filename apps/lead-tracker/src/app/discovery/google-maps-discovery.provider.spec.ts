import { ConfigService } from '@nestjs/config';
import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { GoogleMapsDiscoveryProvider } from './google-maps-discovery.provider';

describe('GoogleMapsDiscoveryProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('keeps service-buyer candidates based on the business query even without keyword hits in the place name', async () => {
    const topic = {
      id: 'topic-1',
      name: 'React',
      description: 'Find local buyers',
      keywords: ['react'],
      sources: [LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['dental office'],
      googleMapsLocation: 'Savannah, GA',
      googleMapsRadiusMiles: 25,
      excludedTerms: ['wordpress', 'php'],
      discoveryIntent: 'service-buyers',
      enabled: true,
      lastRun: undefined,
      leadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadTopic;

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-type'
              ? 'application/json; charset=utf-8'
              : null,
        },
        text: async () =>
          JSON.stringify({
            results: [
              {
                geometry: {
                  location: { lat: 32.0809, lng: -81.0912 },
                },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === 'content-type'
              ? 'application/json; charset=utf-8'
              : null,
        },
        text: async () =>
          JSON.stringify({
            results: [
              {
                place_id: 'place-1',
                name: 'Bright Smile Dental',
                formatted_address: '123 Main St, Savannah, GA',
                business_status: 'OPERATIONAL',
              },
            ],
          }),
      }) as typeof fetch;

    const provider = new GoogleMapsDiscoveryProvider({
      get: jest.fn().mockReturnValue({
        enabled: true,
        apiKey: 'test-key',
        maxResults: 10,
      }),
    } as unknown as ConfigService);

    const result = await provider.search(topic);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchedKeywords).toContain('dental office');
    expect(result.candidates[0].lead.notes).toContain('dental office in Savannah, GA');
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('radius=40234'),
      expect.any(Object)
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('location=32.0809%2C-81.0912'),
      expect.any(Object)
    );
  });

  it('rejects service-buyer candidates containing excluded terms', async () => {
    const topic = {
      id: 'topic-2',
      name: 'Websites',
      description: 'Find service buyers',
      keywords: ['website redesign'],
      sources: [LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['dental office'],
      excludedTerms: ['wordpress', 'php'],
      discoveryIntent: 'service-buyers',
      enabled: true,
      lastRun: undefined,
      leadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadTopic;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null,
      },
      text: async () => JSON.stringify({
        results: [
          {
            place_id: 'place-2',
            name: 'Bright Smile Dental Wordpress Experts',
            formatted_address: '123 Main St, Savannah, GA',
            business_status: 'OPERATIONAL',
          },
        ],
      }),
    }) as typeof fetch;

    const provider = new GoogleMapsDiscoveryProvider({
      get: jest.fn().mockReturnValue({
        enabled: true,
        apiKey: 'test-key',
        maxResults: 10,
      }),
    } as unknown as ConfigService);

    const result = await provider.search(topic);

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Excluded 1 result(s) because they matched blocked terms: wordpress, php.',
        'Google Maps returned no places that matched the configured topic keywords.',
      ])
    );
  });
});
