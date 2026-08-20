import {
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
} from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  buildProviderQueries,
  getProviderQueryRecipe,
} from './provider-query.util';

describe('provider-query.util', () => {
  const topic = {
    id: 'topic-1',
    name: 'React modernization consulting',
    description: 'Modernize B2B SaaS platforms',
    keywords: ['react', 'typescript', 'frontend architecture'],
    excludedTerms: [],
    discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
    sources: [LeadDiscoverySource.FUNDING_NEWS],
    googleMapsCities: null,
    googleMapsTypes: null,
    enabled: true,
    lastRun: undefined,
    leadCount: 0,
    priority: null,
    targetCompanies: ['SaaS'],
    buyerPersona: 'VP Engineering',
    painPoints: ['legacy frontend'],
    valueProposition: 'faster releases',
    searchStrategy: null,
    confidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as LeadTopic;

  it('builds funding-news queries with no site scope and funding signals', () => {
    const queries = buildProviderQueries(
      {
        ...topic,
        discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
      },
      getProviderQueryRecipe(
        'funding-news',
        LeadTopicDiscoveryIntent.SERVICE_BUYERS
      ),
      6
    );

    // No site: scope — the source reads the news feed at large. Pinning it to
    // crunchbase.com is what made the old provider misdescribe its data.
    expect(queries.some((query) => query.includes('site:'))).toBe(false);
    expect(queries.some((query) => query.includes('funding'))).toBe(true);
    expect(
      queries.some(
        (query) => query.includes('raised') || query.includes('series')
      )
    ).toBe(true);
  });
});
