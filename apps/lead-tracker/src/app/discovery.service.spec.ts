import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Lead,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
  LeadStatus,
} from '@optimistic-tanuki/models/leads-contracts';
import { Repository } from 'typeorm';
import { DiscoveryService } from './discovery.service';
import { ClutchDiscoveryProvider } from './discovery/clutch-discovery.provider';
import { CrunchbaseDiscoveryProvider } from './discovery/crunchbase-discovery.provider';
import { GoogleMapsDiscoveryProvider } from './discovery/google-maps-discovery.provider';
import { HimalayasDiscoveryProvider } from './discovery/himalayas-discovery.provider';
import { IndeedDiscoveryProvider } from './discovery/indeed-discovery.provider';
import { InternalDiscoveryProvider } from './discovery/internal-discovery.provider';
import { JobicyDiscoveryProvider } from './discovery/jobicy-discovery.provider';
import { JustRemoteDiscoveryProvider } from './discovery/justremote-discovery.provider';
import { RemoteOkDiscoveryProvider } from './discovery/remoteok-discovery.provider';
import { WeWorkRemotelyDiscoveryProvider } from './discovery/weworkremotely-discovery.provider';
import { LeadQualificationService } from './lead-qualification.service';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let leadRepository: jest.Mocked<Repository<Lead>>;
  let topicRepository: jest.Mocked<Repository<LeadTopic>>;
  let linkRepository: jest.Mocked<Repository<LeadTopicLink>>;
  let internalProvider: { providerName: string; search: jest.Mock };
  let remoteOkProvider: { providerName: string; search: jest.Mock };
  let himalayasProvider: { providerName: string; search: jest.Mock };
  let weWorkRemotelyProvider: { providerName: string; search: jest.Mock };
  let justRemoteProvider: { providerName: string; search: jest.Mock };
  let jobicyProvider: { providerName: string; search: jest.Mock };
  let clutchProvider: { providerName: string; search: jest.Mock };
  let crunchbaseProvider: { providerName: string; search: jest.Mock };
  let indeedProvider: { providerName: string; search: jest.Mock };
  let googleMapsProvider: { providerName: string; search: jest.Mock };
  let leadQualificationService: {
    analyzeAndSave: jest.Mock;
    logFailure: jest.Mock;
  };

  const matchingLead: Lead = {
    id: 'lead-1',
    name: 'React Platform Upgrade',
    company: 'Acme',
    email: 'react@example.com',
    phone: '555-1111',
    source: LeadSource.REMOTE_OK,
    status: LeadStatus.NEW,
    value: 1000,
    notes: 'Looking for a React contractor',
    nextFollowUp: undefined,
    isAutoDiscovered: false,
    searchKeywords: ['react', 'frontend'],
    assignedTo: undefined,
    appScope: 'leads-app',
    profileId: 'profile-1',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const nonMatchingLead: Lead = {
    ...matchingLead,
    id: 'lead-2',
    name: 'Legacy PHP Maintenance',
    notes: 'No JavaScript work',
    searchKeywords: ['php'],
  };

  const topic: LeadTopic = {
    id: 'topic-1',
    name: 'React',
    description: 'React work',
    keywords: ['react'],
    excludedTerms: [],
    discoveryIntent: 'job-openings' as any,
    sources: [LeadDiscoverySource.REMOTE_OK],
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

  const emptyProviderResult = {
    candidates: [],
    warnings: [],
    queries: [],
  };

  beforeEach(async () => {
    const mockLeadRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
      save: jest.fn(),
    };
    const mockTopicRepository = {
      findOneBy: jest.fn(),
      update: jest.fn(),
    };
    const mockLinkRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    internalProvider = { providerName: 'internal', search: jest.fn() };
    remoteOkProvider = { providerName: 'remoteok', search: jest.fn() };
    himalayasProvider = { providerName: 'himalayas', search: jest.fn() };
    weWorkRemotelyProvider = {
      providerName: 'weworkremotely',
      search: jest.fn(),
    };
    justRemoteProvider = { providerName: 'justremote', search: jest.fn() };
    jobicyProvider = { providerName: 'jobicy', search: jest.fn() };
    clutchProvider = { providerName: 'clutch', search: jest.fn() };
    crunchbaseProvider = { providerName: 'crunchbase', search: jest.fn() };
    indeedProvider = { providerName: 'indeed', search: jest.fn() };
    googleMapsProvider = { providerName: 'google-maps', search: jest.fn() };
    leadQualificationService = {
      analyzeAndSave: jest.fn(),
      logFailure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscoveryService,
        {
          provide: getRepositoryToken(Lead),
          useValue: mockLeadRepository,
        },
        {
          provide: getRepositoryToken(LeadTopic),
          useValue: mockTopicRepository,
        },
        {
          provide: getRepositoryToken(LeadTopicLink),
          useValue: mockLinkRepository,
        },
        {
          provide: InternalDiscoveryProvider,
          useValue: internalProvider,
        },
        {
          provide: RemoteOkDiscoveryProvider,
          useValue: remoteOkProvider,
        },
        {
          provide: HimalayasDiscoveryProvider,
          useValue: himalayasProvider,
        },
        {
          provide: WeWorkRemotelyDiscoveryProvider,
          useValue: weWorkRemotelyProvider,
        },
        {
          provide: JustRemoteDiscoveryProvider,
          useValue: justRemoteProvider,
        },
        {
          provide: JobicyDiscoveryProvider,
          useValue: jobicyProvider,
        },
        {
          provide: ClutchDiscoveryProvider,
          useValue: clutchProvider,
        },
        {
          provide: CrunchbaseDiscoveryProvider,
          useValue: crunchbaseProvider,
        },
        {
          provide: IndeedDiscoveryProvider,
          useValue: indeedProvider,
        },
        {
          provide: GoogleMapsDiscoveryProvider,
          useValue: googleMapsProvider,
        },
        {
          provide: LeadQualificationService,
          useValue: leadQualificationService,
        },
      ],
    }).compile();

    service = module.get(DiscoveryService);
    leadRepository = module.get(getRepositoryToken(Lead));
    topicRepository = module.get(getRepositoryToken(LeadTopic));
    linkRepository = module.get(getRepositoryToken(LeadTopicLink));

    linkRepository.create.mockImplementation((input) => input as LeadTopicLink);
    linkRepository.find.mockResolvedValue([]);
    linkRepository.save.mockImplementation(async (input) => input as any);
    linkRepository.remove.mockImplementation(async (input) => input as any);
    leadRepository.find.mockResolvedValue([]);
    leadRepository.findBy.mockResolvedValue([]);
    leadRepository.save.mockImplementation(async (input) => input as any);
    leadQualificationService.analyzeAndSave.mockResolvedValue({} as any);
    topicRepository.update.mockResolvedValue({ affected: 1 } as any);
    internalProvider.search.mockResolvedValue(emptyProviderResult);
    remoteOkProvider.search.mockResolvedValue(emptyProviderResult);
    himalayasProvider.search.mockResolvedValue(emptyProviderResult);
    weWorkRemotelyProvider.search.mockResolvedValue(emptyProviderResult);
    justRemoteProvider.search.mockResolvedValue(emptyProviderResult);
    jobicyProvider.search.mockResolvedValue(emptyProviderResult);
    clutchProvider.search.mockResolvedValue(emptyProviderResult);
    crunchbaseProvider.search.mockResolvedValue(emptyProviderResult);
    indeedProvider.search.mockResolvedValue(emptyProviderResult);
    googleMapsProvider.search.mockResolvedValue(emptyProviderResult);
  });

  it('creates links for newly matched leads', async () => {
    topicRepository.findOneBy.mockResolvedValue(topic);
    internalProvider.search.mockResolvedValue({
      candidates: [
        {
          lead: matchingLead,
          matchedKeywords: ['react'],
          providerName: 'internal',
        },
      ],
      warnings: [],
      queries: [],
    });
    linkRepository.find.mockResolvedValue([]);

    const result = await service.runNow(topic.id);

    expect(linkRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        leadId: matchingLead.id,
        topicId: topic.id,
        linkType: 'auto',
        sourceProvider: 'internal',
        matchedKeywords: ['react'],
      }),
    ]);
    expect(leadRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: matchingLead.id }),
    ]);
    expect(leadQualificationService.analyzeAndSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: matchingLead.id }),
      topic
    );
    expect(topicRepository.update).toHaveBeenCalledWith(
      topic.id,
      expect.objectContaining({ leadCount: 1 })
    );
    expect(result).toEqual(
      expect.objectContaining({
        topicId: topic.id,
        linkedLeadCount: 1,
        addedCount: 1,
        removedCount: 0,
        queued: false,
        status: 'completed',
      })
    );
  });

  it('removes stale auto links that no longer match', async () => {
    topicRepository.findOneBy.mockResolvedValue(topic);
    linkRepository.find.mockResolvedValue([
      {
        id: 'link-1',
        leadId: matchingLead.id,
        topicId: topic.id,
        linkType: 'auto',
        sourceProvider: 'internal',
        matchedKeywords: ['react'],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as LeadTopicLink,
    ]);

    const result = await service.runNow(topic.id);

    expect(linkRepository.remove).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'link-1' }),
    ]);
    expect(topicRepository.update).toHaveBeenCalledWith(
      topic.id,
      expect.objectContaining({ leadCount: 0 })
    );
    expect(result).toEqual(
      expect.objectContaining({
        linkedLeadCount: 0,
        addedCount: 0,
        removedCount: 1,
      })
    );
  });

  it('skips disabled topics', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      enabled: false,
      leadCount: 4,
    });

    const result = await service.runNow(topic.id);

    expect(leadRepository.find).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        topicId: topic.id,
        linkedLeadCount: 4,
        skipped: true,
        queued: false,
        status: 'skipped',
      })
    );
  });

  it('filters matches by configured topic sources', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      sources: [LeadDiscoverySource.HIMALAYAS],
    });
    linkRepository.find.mockResolvedValue([]);

    const result = await service.runNow(topic.id);

    expect(linkRepository.save).not.toHaveBeenCalled();
    expect(himalayasProvider.search).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        linkedLeadCount: 0,
        addedCount: 0,
        removedCount: 0,
      })
    );
  });

  it('invokes source-specific adapters for selected topic sources', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      sources: [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['restaurants'],
    });
    linkRepository.find.mockResolvedValue([]);

    await service.runNow(topic.id);

    expect(internalProvider.search).toHaveBeenCalled();
    expect(remoteOkProvider.search).toHaveBeenCalled();
    expect(googleMapsProvider.search).toHaveBeenCalled();
    expect(himalayasProvider.search).not.toHaveBeenCalled();
  });

  it('continues discovery when one provider fails', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      sources: [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['restaurants'],
    });
    linkRepository.find.mockResolvedValue([]);
    internalProvider.search.mockResolvedValue(emptyProviderResult);
    remoteOkProvider.search.mockRejectedValue(
      new Error('provider unavailable')
    );
    googleMapsProvider.search.mockResolvedValue({
      candidates: [
        {
          lead: {
            ...matchingLead,
            id: 'lead-local-1',
            source: LeadSource.GOOGLE_MAPS,
            isAutoDiscovered: true,
          },
          matchedKeywords: ['react'],
          providerName: 'google-maps',
        },
      ],
      warnings: [],
      queries: ['restaurants in Savannah, GA'],
    });

    const result = await service.runNow(topic.id);

    expect(leadRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'lead-local-1' }),
    ]);
    expect(linkRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ leadId: 'lead-local-1' }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        linkedLeadCount: 1,
        addedCount: 1,
        removedCount: 0,
        status: 'completed',
      })
    );
    expect(result?.providerResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerName: 'remoteok',
          warnings: ['Provider failed: provider unavailable'],
        }),
        expect.objectContaining({
          providerName: 'google-maps',
          candidateCount: 1,
        }),
      ])
    );
  });

  it('returns queued status when discovery is requested', async () => {
    topicRepository.findOneBy.mockResolvedValue(topic);

    const result = await service.request(topic.id);

    expect(result).toEqual(
      expect.objectContaining({
        topicId: topic.id,
        queued: true,
        status: 'queued',
      })
    );
  });

  it('surfaces dead-endpoint diagnostics in the discovery message when no matches are found', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      sources: [LeadDiscoverySource.HIMALAYAS],
    });
    linkRepository.find.mockResolvedValue([]);
    himalayasProvider.search.mockResolvedValue({
      candidates: [],
      warnings: [
        'Himalayas request failed with HTTP 404. Expected JSON but received text/html. Preview: <!DOCTYPE html>',
      ],
      queries: ['https://himalayas.app/jobs/api?limit=20&offset=0'],
    });

    const result = await service.runNow(topic.id);

    expect(result?.message).toContain('HTTP 404');
    expect(result?.message).toContain('text/html');
  });

  it('surfaces missing-api-key diagnostics in the discovery message when no matches are found', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      sources: [LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['dental office'],
    });
    linkRepository.find.mockResolvedValue([]);
    googleMapsProvider.search.mockResolvedValue({
      candidates: [],
      warnings: ['Google Maps discovery requires an API key.'],
      queries: [],
    });

    const result = await service.runNow(topic.id);

    expect(result?.message).toContain('requires an API key');
    expect(result?.severity).toBe('warning');
    expect(result?.summaryTitle).toContain('attention');
    expect(result?.actionItems).toContain(
      'Add the Google Maps API key before running this topic again.'
    );
    expect(result?.providerResults).toContainEqual(
      expect.objectContaining({
        providerName: 'google-maps',
        status: 'error',
        issues: expect.arrayContaining([
          expect.objectContaining({
            type: 'missing-credentials',
            severity: 'error',
          }),
        ]),
      })
    );
  });

  it('surfaces exclusion diagnostics in the discovery message when providers filter everything out', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      excludedTerms: ['wordpress', 'php'],
      sources: [LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['dental office'],
    });
    linkRepository.find.mockResolvedValue([]);
    googleMapsProvider.search.mockResolvedValue({
      candidates: [],
      warnings: [
        'Excluded 2 result(s) because they matched blocked terms: wordpress, php.',
        'Google Maps returned no places that matched the configured topic keywords.',
      ],
      queries: ['dental office in Savannah, GA'],
    });

    const result = await service.runNow(topic.id);

    expect(result?.message).toContain('matched blocked terms');
    expect(result?.message).toContain('wordpress, php');
  });

  it('reuses an existing lead when a new candidate matches by business fingerprint', async () => {
    topicRepository.findOneBy.mockResolvedValue({
      ...topic,
      sources: [LeadDiscoverySource.GOOGLE_MAPS],
      googleMapsCities: ['Savannah, GA'],
      googleMapsTypes: ['restaurants'],
    });
    leadRepository.find.mockResolvedValue([
      {
        ...matchingLead,
        id: 'lead-existing-local',
        source: LeadSource.GOOGLE_MAPS,
        name: 'Savannah Restaurant Group',
        company: 'Savannah Restaurant Group',
        notes: 'Existing lead',
      },
    ]);
    leadRepository.findBy.mockResolvedValue([
      {
        ...matchingLead,
        id: 'lead-existing-local',
        source: LeadSource.GOOGLE_MAPS,
        name: 'Savannah Restaurant Group',
        company: 'Savannah Restaurant Group',
        notes: 'Existing lead',
      },
    ]);
    linkRepository.find.mockResolvedValue([]);
    googleMapsProvider.search.mockResolvedValue({
      candidates: [
        {
          lead: {
            ...matchingLead,
            id: 'lead-new-url-derived',
            source: LeadSource.GOOGLE_MAPS,
            name: 'Savannah Restaurant Group',
            company: 'Savannah Restaurant Group LLC',
            notes: 'Freshly discovered from article',
            isAutoDiscovered: true,
          },
          matchedKeywords: ['react'],
          providerName: 'google-maps',
        },
      ],
      warnings: [],
      queries: ['restaurants in Savannah, GA'],
    });

    const result = await service.runNow(topic.id);

    expect(leadRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'lead-existing-local' }),
    ]);
    expect(linkRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        leadId: 'lead-existing-local',
        topicId: topic.id,
      }),
    ]);
    expect(result).toEqual(
      expect.objectContaining({
        linkedLeadCount: 1,
        addedCount: 1,
      })
    );
  });
});
