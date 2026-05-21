import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { buildProviderQueries, getProviderQueryRecipe } from './provider-query.util';

describe('provider-query.util', () => {
  const topic = {
    id: 'topic-1',
    name: 'React modernization consulting',
    description: 'Modernize B2B SaaS platforms',
    keywords: ['react', 'typescript', 'frontend architecture'],
    excludedTerms: [],
    discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
    sources: [LeadDiscoverySource.CLUTCH],
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

  it('builds richer indeed queries across multiple site scopes and signals', () => {
    const queries = buildProviderQueries(
      {
        ...topic,
        discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
      },
      getProviderQueryRecipe('indeed', LeadTopicDiscoveryIntent.JOB_OPENINGS),
      6
    );

    expect(queries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('site:indeed.com/viewjob'),
        expect.stringContaining('site:indeed.com/jobs'),
        expect.stringContaining('remote'),
      ])
    );
  });

  it('builds clutch queries without hard-coding only web developer directories', () => {
    const queries = buildProviderQueries(
      topic,
      getProviderQueryRecipe('clutch', topic.discoveryIntent),
      6
    );

    expect(queries.some((query) => query.includes('site:clutch.co/agencies'))).toBe(
      true
    );
    expect(queries.some((query) => query.includes('"client reviews"'))).toBe(true);
  });
});
