import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { OverpassDiscoveryProvider } from './overpass-discovery.provider';

const buildTopic = (overrides: Partial<LeadTopic> = {}): LeadTopic =>
  ({
    id: 'topic-osm',
    name: 'Local buyers',
    keywords: ['website'],
    excludedTerms: ['wordpress'],
    discoveryIntent: 'service-buyers',
    googleMapsCities: ['Savannah, GA'],
    googleMapsTypes: ['restaurants'],
    googleMapsLocation: '',
    enabled: true,
    leadCount: 0,
    ...overrides,
  } as unknown as LeadTopic);

const overpassResponse = (elements: unknown[]) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ elements }),
  } as unknown as Response);

describe('OverpassDiscoveryProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('scopes the query to the administrative area without a geocoder', async () => {
    const fetchMock = jest.fn().mockResolvedValue(overpassResponse([]));
    global.fetch = fetchMock as unknown as typeof fetch;

    await new OverpassDiscoveryProvider().search(buildTopic());

    const body = String(fetchMock.mock.calls[0][1].body);
    // "Savannah, GA" must reduce to the bare area name Overpass matches on.
    expect(decodeURIComponent(body)).toContain('area["name"="Savannah"]');
    expect(decodeURIComponent(body)).toContain('amenity');
  });

  it('surfaces a business with presence gaps and names them', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      overpassResponse([
        {
          type: 'node',
          id: 1,
          tags: { name: 'Corner Diner', amenity: 'restaurant' },
        },
      ])
    ) as unknown as typeof fetch;

    const result = await new OverpassDiscoveryProvider().search(buildTopic());

    expect(result.candidates).toHaveLength(1);
    const lead = result.candidates[0].lead;
    expect(lead.company).toBe('Corner Diner');
    expect(lead.notes).toContain('No website listed');
    expect(lead.notes).toContain('openstreetmap.org/node/1');
  });

  it('skips a business whose listing is already complete', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      overpassResponse([
        {
          type: 'node',
          id: 2,
          tags: {
            name: 'Complete Cafe',
            amenity: 'cafe',
            website: 'https://complete.example',
            phone: '+1 912-555-0100',
            opening_hours: 'Mo-Fr 09:00-17:00',
          },
        },
      ])
    ) as unknown as typeof fetch;

    const result = await new OverpassDiscoveryProvider().search(buildTopic());

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('no gaps');
  });

  it('ignores unnamed map features, which cannot be contacted', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        overpassResponse([{ type: 'node', id: 3, tags: { amenity: 'cafe' } }])
      ) as unknown as typeof fetch;

    const result = await new OverpassDiscoveryProvider().search(buildTopic());
    expect(result.candidates).toHaveLength(0);
  });

  it('honours excluded terms', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      overpassResponse([
        {
          type: 'node',
          id: 4,
          tags: { name: 'WordPress Studio', office: 'company' },
        },
      ])
    ) as unknown as typeof fetch;

    const result = await new OverpassDiscoveryProvider().search(buildTopic());

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('Excluded 1');
  });

  it('says so rather than querying blindly when the topic has no location', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await new OverpassDiscoveryProvider().search(
      buildTopic({ googleMapsCities: [], googleMapsLocation: '' })
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.warnings.join(' ')).toContain('at least one city');
  });
});
