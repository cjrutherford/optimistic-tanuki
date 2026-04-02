import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { HimalayasDiscoveryProvider } from './himalayas-discovery.provider';

describe('HimalayasDiscoveryProvider', () => {
  const originalFetch = global.fetch;

  const topic: LeadTopic = {
    id: 'topic-1',
    name: 'React',
    description: 'React roles',
    keywords: ['react'],
    excludedTerms: [],
    discoveryIntent: 'job-openings' as any,
    sources: [LeadDiscoverySource.HIMALAYAS],
    googleMapsCities: null,
    googleMapsTypes: null,
    enabled: true,
    lastRun: undefined,
    leadCount: 0,
    priority: null,
    targetCompanies: null,
    buyerPersona: null,
    painPoints: null,
    valueProposition: null,
    searchStrategy: null,
    confidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses the Himalayas jobs API endpoint with a larger sample size and maps matching jobs', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null,
      },
      text: async () => JSON.stringify({
        jobs: [
          {
            title: 'Senior React Engineer',
            companyName: 'Acme',
            description: '<p>Build React applications.</p>',
            applicationLink: 'https://example.com/apply',
            guid: 'job-1',
            minSalary: 140000,
            maxSalary: 180000,
            currency: 'USD',
          },
        ],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const provider = new HimalayasDiscoveryProvider();
    const result = await provider.search(topic);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://himalayas.app/jobs/api?limit=100&offset=0',
      expect.objectContaining({
        headers: { accept: 'application/json' },
      })
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].lead.name).toBe('Senior React Engineer');
    expect(result.candidates[0].lead.company).toBe('Acme');
    expect(result.candidates[0].lead.originalPostingUrl).toBe(
      'https://example.com/apply'
    );
    expect(result.candidates[0].matchedKeywords).toEqual(['react']);
    expect(result.warnings).toEqual([]);
  });

  it('returns a warning instead of throwing when Himalayas responds with html', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null),
      },
      text: async () => '<!DOCTYPE html><html><body>Not found</body></html>',
    }) as typeof fetch;

    const provider = new HimalayasDiscoveryProvider();

    await expect(provider.search(topic)).resolves.toEqual(
      expect.objectContaining({
        candidates: [],
        warnings: [
          expect.stringContaining('Expected JSON'),
        ],
      })
    );
  });
});
