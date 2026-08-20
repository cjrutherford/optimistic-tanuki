import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { FundingNewsDiscoveryProvider } from './funding-news-discovery.provider';
import { RemoteOkDiscoveryProvider } from './remoteok-discovery.provider';
import { SearchAcquisitionService } from './search-acquisition.service';
import { WeWorkRemotelyDiscoveryProvider } from './weworkremotely-discovery.provider';

describe('Discovery provider excluded-term filtering', () => {
  const originalFetch = global.fetch;

  const buildTopic = (source: LeadDiscoverySource): LeadTopic => ({
    id: `topic-${source}`,
    name: 'React',
    description: 'React roles',
    keywords: ['react'],
    excludedTerms: ['wordpress'],
    discoveryIntent: 'job-openings' as any,
    sources: [source],
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
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('drops remoteok jobs containing excluded terms even when positive keywords match', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => [
        {
          position: 'React Engineer',
          company: 'Acme',
          description: 'Build React frontends and maintain Wordpress sites.',
          url: 'https://example.com/job',
          tags: ['react'],
        },
      ],
    }) as typeof fetch;

    const result = await new RemoteOkDiscoveryProvider().search(
      buildTopic(LeadDiscoverySource.REMOTE_OK)
    );

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Excluded 1 result(s) because they matched blocked terms: wordpress.',
        'RemoteOK returned no jobs that matched the configured topic keywords.',
      ])
    );
  });

  it('drops weworkremotely feed items containing excluded terms', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      text: async () => `
        <rss><channel><item>
          <title>Acme: React Engineer</title>
          <link>https://example.com/wwr</link>
          <description>React product work plus Wordpress support</description>
        </item></channel></rss>
      `,
    }) as typeof fetch;

    const result = await new WeWorkRemotelyDiscoveryProvider().search(
      buildTopic(LeadDiscoverySource.WE_WORK_REMOTELY)
    );

    expect(result.candidates).toHaveLength(0);
  });

  it('drops funding-news results containing excluded terms', async () => {
    const searchAcquisitionService = {
      searchNews: jest.fn().mockResolvedValue([
        {
          title: 'WordPress agency raises seed round',
          url: 'https://news.example.com/wordpress-agency-raises',
          snippet: 'A wordpress shop raised a seed round.',
          query: 'funding',
          resultType: 'news',
          rank: 1,
        },
      ]),
      analyzePage: jest.fn().mockResolvedValue(null),
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(2),
    } as unknown as SearchAcquisitionService;

    const result = await new FundingNewsDiscoveryProvider(
      searchAcquisitionService
    ).search(buildTopic(LeadDiscoverySource.FUNDING_NEWS));

    expect(result.candidates).toHaveLength(0);
  });
});
