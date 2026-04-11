import { DiscoveryPipelineService } from './pipeline.service';
import { Lead, LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
  LeadStatus,
  LeadTopicDiscoveryIntent,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models/leads-contracts';

describe('DiscoveryPipelineService', () => {
  let service: DiscoveryPipelineService;

  const topic: LeadTopic = {
    id: 'topic-1',
    name: 'React modernization buyers',
    description: 'Service buyers for modernization projects',
    keywords: ['react', 'modernization', 'frontend platform'],
    excludedTerms: ['wordpress'],
    discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
    sources: [LeadDiscoverySource.CLUTCH],
    googleMapsCities: null,
    googleMapsTypes: null,
    enabled: true,
    lastRun: null,
    leadCount: 0,
    priority: 1,
    targetCompanies: ['saas companies'],
    buyerPersona: 'VP Engineering at B2B SaaS company',
    painPoints: ['legacy frontend', 'slow release cycles'],
    valueProposition: 'Ship frontend modernization with less delivery risk',
    searchStrategy: 'balanced',
    confidence: 88,
    appScope: 'leads-app',
    profileId: 'profile-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const lead: Lead = {
    id: 'lead-1',
    name: 'VP Engineering',
    company: 'Acme SaaS',
    email: 'vp@acme.example',
    phone: '555-1111',
    source: LeadSource.CLUTCH,
    status: LeadStatus.NEW,
    value: 10000,
    notes:
      'Urgent frontend modernization project. Legacy frontend is slowing release cycles. Budget approved this quarter.',
    nextFollowUp: undefined,
    isAutoDiscovered: true,
    searchKeywords: ['react modernization', 'frontend platform'],
    assignedTo: undefined,
    appScope: 'leads-app',
    profileId: 'profile-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const onboardingProfile: UserOnboardingProfile = {
    serviceOffer: 'React modernization consulting',
    yearsExperience: '10+',
    skills: ['React', 'TypeScript', 'Frontend architecture'],
    certifications: [],
    idealCustomer: 'VP Engineering at B2B SaaS company',
    companySizeTarget: ['50-250'],
    industries: ['SaaS'],
    problemsSolved: ['legacy frontend', 'slow release cycles'],
    outcomes: ['faster releases', 'safer migrations'],
    budgetRange: ['$25k-$100k'],
    geographicFocus: 'Global',
    salesApproach: 'Consultative',
    outreachMethod: ['Email'],
    communicationStyle: 'Direct',
    leadSignalTypes: ['budget', 'urgency'],
    excludedCompanies: ['WordPress agency'],
    excludedIndustries: ['gambling'],
    currentStep: 4,
    completedAt: new Date(),
  };

  beforeEach(() => {
    service = new DiscoveryPipelineService();
  });

  it('returns passed stage results and a strong match for a highly aligned lead', async () => {
    const result = await service.analyzeLead(lead, topic, onboardingProfile);

    expect(result.relevance.score).toBeGreaterThanOrEqual(70);
    expect(result.relevance.status).toBe('passed');
    expect(result.difficulty.score).toBeGreaterThanOrEqual(40);
    expect(result.difficulty.status).toMatch(/passed|warning/);
    expect(result.userFit.score).toBeGreaterThanOrEqual(70);
    expect(result.userFit.status).toBe('passed');
    expect(result.classification).toBe('strong-match');
    expect(result.userFit.reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining('service offer'),
        expect.stringContaining('skills'),
      ])
    );
  });

  it('marks user fit unavailable when onboarding is missing', async () => {
    const result = await service.analyzeLead(lead, topic, null);

    expect(result.userFit.score).toBeNull();
    expect(result.userFit.status).toBe('unavailable');
    expect(result.userFit.reasons).toContain(
      'User onboarding profile is required for fit scoring.'
    );
    expect(result.classification).toBe('review');
  });

  it('fails relevance when excluded terms dominate the lead text', async () => {
    const excludedLead: Lead = {
      ...lead,
      id: 'lead-2',
      company: 'WordPress agency',
      notes:
        'WordPress rebuild project for a marketing agency. Need ongoing PHP support.',
      searchKeywords: ['wordpress', 'php'],
    };

    const result = await service.analyzeLead(
      excludedLead,
      topic,
      onboardingProfile
    );

    expect(result.relevance.score).toBeLessThan(40);
    expect(result.relevance.status).toBe('failed');
    expect(result.classification).toBe('weak-match');
  });
});
