import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { IndeedDiscoveryProvider } from './indeed-discovery.provider';

describe('IndeedDiscoveryProvider', () => {
  it('uses richer search queries across multiple indeed paths', async () => {
    const searchAcquisitionService = {
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(6),
      searchWeb: jest.fn().mockResolvedValue([]),
      analyzePage: jest.fn(),
    };
    const provider = new IndeedDiscoveryProvider(searchAcquisitionService as any);
    const topic = {
      id: 'topic-1',
      name: 'React Engineer',
      description: 'Remote React roles',
      keywords: ['react', 'typescript'],
      excludedTerms: [],
      discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      sources: [LeadDiscoverySource.INDEED],
      enabled: true,
      lastRun: undefined,
      leadCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LeadTopic;

    await provider.search(topic);

    const queries = searchAcquisitionService.searchWeb.mock.calls.map(
      (call) => call[0] as string
    );
    expect(queries.some((query) => query.includes('site:indeed.com/viewjob'))).toBe(
      true
    );
    expect(queries.some((query) => query.includes('site:indeed.com/jobs'))).toBe(
      true
    );
    expect(queries.some((query) => query.includes('remote'))).toBe(true);
  });
});
