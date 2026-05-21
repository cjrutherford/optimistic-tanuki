import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { ClutchDiscoveryProvider } from './clutch-discovery.provider';

describe('ClutchDiscoveryProvider', () => {
  it('generates broader clutch queries for service-buyer discovery', async () => {
    const searchAcquisitionService = {
      getMaxQueriesPerProvider: jest.fn().mockReturnValue(6),
      searchWeb: jest.fn().mockResolvedValue([]),
      analyzePage: jest.fn(),
    };
    const provider = new ClutchDiscoveryProvider(searchAcquisitionService as any);
    const topic = {
      id: 'topic-1',
      name: 'Healthcare analytics consulting',
      description: 'Find local buyers',
      keywords: ['healthcare analytics'],
      excludedTerms: [],
      discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
      sources: [LeadDiscoverySource.CLUTCH],
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
    expect(queries.some((query) => query.includes('site:clutch.co/agencies'))).toBe(
      true
    );
    expect(queries.some((query) => query.includes('"client reviews"'))).toBe(true);
  });
});
