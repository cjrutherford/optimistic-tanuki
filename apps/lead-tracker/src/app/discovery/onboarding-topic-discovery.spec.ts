import {
  GeneratedTopicSuggestion,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LlmOnboardingAnalysisService } from '../llm-onboarding-analysis.service';
import { OnboardingAnalysisService } from '../onboarding-analysis.service';
import { RemoteOkDiscoveryProvider } from './remoteok-discovery.provider';

/**
 * The reported failure, end to end: a completed onboarding profile produced
 * topics, and every source then reported zero leads.
 *
 * The cause was never the sources. Topics generated from a profile carry the
 * profile's prose — `serviceOffer` is a sentence, `outcomes` are achievement
 * lines — and providers tested each of those as one literal substring, which no
 * job posting ever contains. This drives the real topic generator and a real
 * provider so the two stay honest about each other.
 */

const profile: UserOnboardingProfile = {
  serviceOffer: 'Fractional CTO and platform engineering leadership',
  yearsExperience: '15',
  skills: ['TypeScript', 'Kubernetes', 'AWS', 'Postgres'],
  certifications: [],
  idealCustomer: 'Seed-stage founder without a technical co-founder',
  companySizeTarget: ['10-50'],
  industries: ['Healthcare', 'Fintech'],
  problemsSolved: [
    'Legacy monoliths that block delivery',
    'No CI/CD or release discipline',
  ],
  outcomes: [
    'Cut cloud spend by 40%',
    'Shipped a platform migration in one quarter',
  ],
  budgetRange: [],
  geographicFocus: 'Global',
  salesApproach: 'consultative',
  outreachMethod: ['email'],
  communicationStyle: 'direct',
  leadSignalTypes: [],
  excludedCompanies: [],
  excludedIndustries: [],
  currentStep: 4,
};

/**
 * A posting any human would call an obvious match for the profile above.
 *
 * Deliberately free of the profile's single-word keywords — no "healthcare",
 * no named tool — so it can only be found through the prose. That is the case
 * the literal test could never answer.
 */
const matchingPosting = {
  position: 'Head of Platform Engineering',
  company: 'Northwind Clinical',
  description:
    'We are a clinical data company looking for engineering leadership to take our platform off a legacy monolith and put real delivery discipline in place.',
  url: 'https://example.com/jobs/head-of-platform',
  tags: ['leadership', 'platform'],
};

const toLeadTopic = (suggestion: GeneratedTopicSuggestion): LeadTopic =>
  ({
    id: 'topic-1',
    name: suggestion.name,
    description: suggestion.description,
    keywords: suggestion.keywords,
    excludedTerms: suggestion.excludedTerms,
    discoveryIntent: suggestion.discoveryIntent,
    sources: suggestion.sources,
    enabled: true,
    leadCount: 0,
    priority: suggestion.priority,
    targetCompanies: suggestion.targetCompanies,
    buyerPersona: suggestion.buyerPersona,
    painPoints: suggestion.painPoints,
    valueProposition: suggestion.valueProposition,
    searchStrategy: suggestion.searchStrategy,
    confidence: suggestion.confidence,
    appScope: 'leads-app',
    profileId: 'profile-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as LeadTopic);

describe('discovery for topics generated from an onboarding profile', () => {
  const originalFetch = global.fetch;
  let topics: GeneratedTopicSuggestion[];

  beforeAll(async () => {
    const analysis = new OnboardingAnalysisService({
      isAvailable: false,
    } as unknown as LlmOnboardingAnalysisService);
    topics = await analysis.analyzeProfile(profile);
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => [matchingPosting],
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('generates topics whose keywords are prose, not single words', () => {
    // Guards the premise: if onboarding ever starts emitting tidy single-word
    // keywords, the matching rules below are being tested against nothing.
    expect(
      topics.some((topic) =>
        topic.keywords.some((keyword) => keyword.split(' ').length > 3)
      )
    ).toBe(true);
  });

  it('finds an obviously matching posting from the generated job topic', async () => {
    const jobTopic = topics.find((topic) => topic.name.includes('roles'));
    expect(jobTopic).toBeDefined();

    const result = await new RemoteOkDiscoveryProvider().search(
      toLeadTopic(jobTopic as GeneratedTopicSuggestion)
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].matchedKeywords.length).toBeGreaterThan(0);
    expect(result.candidates[0].lead.company).toBe('Northwind Clinical');
  });

  it('finds the same posting from a generated service-buyer topic', async () => {
    // These are the topics that matter for winning customers, and they carried
    // the longest prose of all, so they were the most reliably empty.
    const buyerTopic = topics.find((topic) => topic.name.includes('buyers'));
    expect(buyerTopic).toBeDefined();

    const result = await new RemoteOkDiscoveryProvider().search(
      toLeadTopic(buyerTopic as GeneratedTopicSuggestion)
    );

    expect(result.candidates).toHaveLength(1);
  });

  it('still turns away a posting with nothing to do with the profile', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/json']]),
      json: async () => [
        {
          position: 'Pastry Chef',
          company: 'Corner Bakery',
          description: 'Early mornings, laminated dough, seasonal menus.',
          url: 'https://example.com/jobs/pastry',
          tags: ['food'],
        },
      ],
    }) as unknown as typeof fetch;

    const jobTopic = topics.find((topic) => topic.name.includes('roles'));
    const result = await new RemoteOkDiscoveryProvider().search(
      toLeadTopic(jobTopic as GeneratedTopicSuggestion)
    );

    expect(result.candidates).toHaveLength(0);
    expect(result.warnings.join(' ')).toContain('no jobs that matched');
  });
});
