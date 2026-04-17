import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { JobicyDiscoveryProvider } from './jobicy-discovery.provider';

describe('JobicyDiscoveryProvider', () => {
  const originalFetch = global.fetch;

  const topic: LeadTopic = {
    id: 'topic-1',
    name: 'React',
    description: 'React roles',
    keywords: ['react'],
    excludedTerms: [],
    discoveryIntent: 'job-openings' as any,
    sources: [LeadDiscoverySource.JOBICY],
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
    appScope: 'leads-app',
    profileId: 'profile-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('maps the source url into originalPostingUrl for matching jobs', async () => {
    global.fetch = jest.fn().mockResolvedValue({
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
          jobs: [
            {
              jobTitle: 'Senior React Engineer',
              companyName: 'Acme',
              jobDescription: '<p>Build React apps.</p>',
              url: 'https://jobicy.com/job/react-engineer',
            },
          ],
        }),
    }) as typeof fetch;

    const provider = new JobicyDiscoveryProvider();
    const result = await provider.search(topic);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://jobicy.com/api/v2/remote-jobs?count=100',
      expect.objectContaining({
        headers: { accept: 'application/json' },
      })
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].lead.originalPostingUrl).toBe(
      'https://jobicy.com/job/react-engineer'
    );
  });

  it('returns a warning instead of throwing when jobicy responds with html', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type' ? 'text/html' : null,
      },
      text: async () =>
        '<!DOCTYPE html><html><body>Temporarily unavailable</body></html>',
    }) as typeof fetch;

    const provider = new JobicyDiscoveryProvider();

    await expect(provider.search(topic)).resolves.toEqual(
      expect.objectContaining({
        candidates: [],
        warnings: [expect.stringContaining('Expected JSON')],
      })
    );
  });
});
