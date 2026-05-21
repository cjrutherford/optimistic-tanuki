import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { CrunchbaseDiscoveryProvider } from './crunchbase-discovery.provider';

describe('CrunchbaseDiscoveryProvider', () => {
  it('generates multiple funding-oriented query variants', async () => {
    const searchAcquisitionService = {
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(6),
      searchNews: jest.fn().mockResolvedValue([]),
      analyzePage: jest.fn(),
    };
    const provider = new CrunchbaseDiscoveryProvider(searchAcquisitionService as any);
    const topic = {
      id: 'topic-1',
      name: 'Developer platform',
      description: 'Find funded companies',
      keywords: ['developer tools'],
      excludedTerms: [],
      discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
      sources: [LeadDiscoverySource.CRUNCHBASE],
      enabled: true,
      lastRun: undefined,
      leadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadTopic;

    await provider.search(topic);

    const queries = searchAcquisitionService.searchNews.mock.calls.map(
      (call) => call[0] as string
    );
    expect(queries.some((query) => query.includes('site:crunchbase.com/organization'))).toBe(
      true
    );
    expect(queries.some((query) => query.includes('funding'))).toBe(true);
    expect(queries.some((query) => query.includes('raised') || query.includes('series'))).toBe(
      true
    );
  });
});
