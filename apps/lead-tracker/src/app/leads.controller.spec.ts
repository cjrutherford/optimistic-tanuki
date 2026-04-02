import { Test, TestingModule } from '@nestjs/testing';
import { DiscoveryService } from './discovery.service';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { GoogleMapsLocationAutocompleteService } from './google-maps-location-autocomplete.service';
import { OnboardingAnalysisService } from './onboarding-analysis.service';
import { LeadQualificationService } from './lead-qualification.service';
import {
  LeadAnalysisCommands,
  LeadOnboardingCommands,
} from '@optimistic-tanuki/constants';
import { LeadSource } from '@optimistic-tanuki/models/leads-contracts';

describe('LeadsController', () => {
  let controller: LeadsController;
  let service: jest.Mocked<LeadsService>;
  let discoveryService: jest.Mocked<DiscoveryService>;
  let onboardingAnalysisService: jest.Mocked<OnboardingAnalysisService>;
  let googleMapsLocationAutocompleteService: jest.Mocked<GoogleMapsLocationAutocompleteService>;
  let leadQualificationService: jest.Mocked<LeadQualificationService>;

  const context = {
    userId: 'user-1',
    profileId: 'profile-1',
    appScope: 'leads-app',
  };

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStats: jest.fn(),
      findAllTopics: jest.fn(),
      findTopicById: jest.fn(),
      createTopic: jest.fn(),
      updateTopic: jest.fn(),
      deleteTopic: jest.fn(),
      findFlagsByLead: jest.fn(),
      createFlag: jest.fn(),
      saveOnboardingProfile: jest.fn(),
    };
    const mockDiscoveryService = {
      request: jest.fn(),
      getStatus: jest.fn(),
      runNow: jest.fn(),
    };
    const mockOnboardingAnalysisService = {
      analyzeProfile: jest.fn(),
      analyzeMadLib: jest.fn(),
      parseResume: jest.fn(),
      advanceDiscInterview: jest.fn(),
    };
    const mockGoogleMapsLocationAutocompleteService = {
      searchCities: jest.fn(),
    };
    const mockLeadQualificationService = {
      analyzeAndSave: jest.fn(),
      requalifyAllLeads: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        { provide: LeadsService, useValue: mockService },
        { provide: DiscoveryService, useValue: mockDiscoveryService },
        { provide: OnboardingAnalysisService, useValue: mockOnboardingAnalysisService },
        {
          provide: GoogleMapsLocationAutocompleteService,
          useValue: mockGoogleMapsLocationAutocompleteService,
        },
        { provide: LeadQualificationService, useValue: mockLeadQualificationService },
      ],
    }).compile();

    controller = module.get(LeadsController);
    service = module.get(LeadsService);
    discoveryService = module.get(DiscoveryService);
    onboardingAnalysisService = module.get(OnboardingAnalysisService);
    googleMapsLocationAutocompleteService = module.get(
      GoogleMapsLocationAutocompleteService
    );
    leadQualificationService = module.get(LeadQualificationService);
  });

  it('passes profile-scoped filters into leads service queries', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll({
      status: 'new',
      source: 'upwork',
      profileId: 'profile-1',
    });

    expect(service.findAll).toHaveBeenCalledWith({
      status: 'new',
      source: 'upwork',
      profileId: 'profile-1',
    });
  });

  it('creates leads with explicit auth context', async () => {
    service.create.mockResolvedValue({ id: 'lead-1' } as any);

    await controller.create({
      dto: { name: 'Lead', source: LeadSource.REFERRAL },
      context,
    });

    expect(service.create).toHaveBeenCalledWith(
      { name: 'Lead', source: LeadSource.REFERRAL },
      context
    );
  });

  it('creates topics and queues discovery within the same profile scope', async () => {
    service.createTopic.mockResolvedValue({
      id: 'topic-1',
      enabled: true,
    } as any);
    service.findTopicById.mockResolvedValue({ id: 'topic-1' } as any);

    await controller.createTopic({
      dto: { name: 'Cloud', description: '', keywords: ['aws'] },
      context,
    });

    expect(service.createTopic).toHaveBeenCalledWith(
      { name: 'Cloud', description: '', keywords: ['aws'] },
      context
    );
    expect(discoveryService.request).toHaveBeenCalledWith('topic-1', 'profile-1');
    expect(service.findTopicById).toHaveBeenCalledWith('topic-1', 'profile-1');
  });

  it('uses exported onboarding command handlers while saving scoped onboarding data', async () => {
    service.createTopic.mockResolvedValue({ id: 'topic-1', enabled: false } as any);

    await controller.confirmOnboarding({
      profile: { currentStep: 4 } as any,
      topics: [{ name: 'Cloud', description: '', keywords: ['aws'] }],
      context,
    });

    expect(service.saveOnboardingProfile).toHaveBeenCalledWith(
      { currentStep: 4 },
      context
    );
    expect(leadQualificationService.requalifyAllLeads).toHaveBeenCalledWith(
      'profile-1'
    );
  });

  it('uses exported onboarding command implementations for helper flows', async () => {
    onboardingAnalysisService.analyzeMadLib.mockResolvedValue({ summary: 'x' } as any);
    googleMapsLocationAutocompleteService.searchCities.mockResolvedValue([]);

    await controller.analyzeMadLib({ text: 'hello' });
    await controller.autocompleteLocations({ query: 'sav' });

    expect(onboardingAnalysisService.analyzeMadLib).toHaveBeenCalledWith('hello');
    expect(googleMapsLocationAutocompleteService.searchCities).toHaveBeenCalledWith(
      'sav'
    );
    expect(LeadOnboardingCommands.ANALYZE_MAD_LIB).toBe('leads.onboarding.mad-lib.analyze');
    expect(LeadAnalysisCommands.RUN).toBe('leads.analysis.run');
  });
});
