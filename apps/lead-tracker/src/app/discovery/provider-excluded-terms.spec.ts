import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { ClutchDiscoveryProvider } from './clutch-discovery.provider';
import { CrunchbaseDiscoveryProvider } from './crunchbase-discovery.provider';
import { IndeedDiscoveryProvider } from './indeed-discovery.provider';
import { JustRemoteDiscoveryProvider } from './justremote-discovery.provider';
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
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('drops remoteok jobs containing excluded terms even when positive keywords match', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ([
        {
          position: 'React Engineer',
          company: 'Acme',
          description: 'Build React frontends and maintain Wordpress sites.',
          url: 'https://example.com/job',
          tags: ['react'],
        },
      ]),
    }) as typeof fetch;

    const result = await new RemoteOkDiscoveryProvider().search(buildTopic(LeadDiscoverySource.REMOTE_OK));

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

    const result = await new WeWorkRemotelyDiscoveryProvider().search(buildTopic(LeadDiscoverySource.WE_WORK_REMOTELY));

    expect(result.candidates).toHaveLength(0);
  });

  it('drops justremote feed items containing excluded terms', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      text: async () => `
        <rss><channel><item>
          <title>React Engineer</title>
          <link>https://example.com/jr</link>
          <description>React app delivery with Wordpress migrations</description>
        </item></channel></rss>
      `,
    }) as typeof fetch;

    const result = await new JustRemoteDiscoveryProvider().search(buildTopic(LeadDiscoverySource.JUST_REMOTE));

    expect(result.candidates).toHaveLength(0);
  });

  it('drops clutch results containing excluded terms', async () => {
    const searchAcquisition = {
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(4),
      searchWeb: jest.fn().mockResolvedValue([
        {
          title: 'Acme React Agency',
          url: 'https://clutch.co/profile/acme',
          snippet: 'React specialists',
          query: 'react',
          resultType: 'web',
          rank: 1,
        },
      ]),
      analyzePage: jest.fn().mockResolvedValue({
        url: 'https://clutch.co/profile/acme',
        title: 'Acme React Agency | Clutch',
        description: 'React delivery with Wordpress maintenance',
        text: 'React delivery with Wordpress maintenance',
      }),
    } as unknown as SearchAcquisitionService;

    const result = await new ClutchDiscoveryProvider(searchAcquisition).search(buildTopic(LeadDiscoverySource.CLUTCH));

    expect(result.candidates).toHaveLength(0);
  });

  it('drops crunchbase results containing excluded terms', async () => {
    const searchAcquisition = {
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(4),
      searchNews: jest.fn().mockResolvedValue([
        {
          title: 'Acme raises for React product',
          url: 'https://www.crunchbase.com/organization/acme',
          snippet: 'React company',
          query: 'react',
          resultType: 'news',
          rank: 1,
        },
      ]),
      analyzePage: jest.fn().mockResolvedValue({
        url: 'https://www.crunchbase.com/organization/acme',
        title: 'Acme | Crunchbase',
        description: 'React product team with Wordpress consulting',
        text: 'React product team with Wordpress consulting',
      }),
    } as unknown as SearchAcquisitionService;

    const result = await new CrunchbaseDiscoveryProvider(searchAcquisition).search(buildTopic(LeadDiscoverySource.CRUNCHBASE));

    expect(result.candidates).toHaveLength(0);
  });

  it('drops indeed results containing excluded terms', async () => {
    const searchAcquisition = {
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(4),
      searchWeb: jest.fn().mockResolvedValue([
        {
          title: 'React Engineer - Indeed',
          url: 'https://www.indeed.com/viewjob?jk=1',
          snippet: 'React role',
          query: 'react',
          resultType: 'web',
          rank: 1,
        },
      ]),
      analyzePage: jest.fn().mockResolvedValue({
        url: 'https://www.indeed.com/viewjob?jk=1',
        title: 'React Engineer - Indeed',
        description: 'React role with Wordpress support',
        text: 'React role with Wordpress support',
      }),
    } as unknown as SearchAcquisitionService;

    const result = await new IndeedDiscoveryProvider(searchAcquisition).search(buildTopic(LeadDiscoverySource.INDEED));

    expect(result.candidates).toHaveLength(0);
  });
});
