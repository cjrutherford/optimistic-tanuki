import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Lead,
  LeadOnboardingProfileRecord,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import { Repository } from 'typeorm';
import { LeadQualificationService } from './lead-qualification.service';
import { DiscoveryPipelineService } from './discovery/pipeline.service';

describe('LeadQualificationService', () => {
  let service: LeadQualificationService;
  let onboardingProfileRepository: jest.Mocked<Repository<LeadOnboardingProfileRecord>>;
  let qualificationRepository: jest.Mocked<Repository<LeadQualification>>;
  let pipelineService: jest.Mocked<DiscoveryPipelineService>;

  const mockLead = {
    id: 'lead-1',
    name: 'React modernization',
    profileId: 'profile-1',
  } as Lead;

  const mockAnalysis = {
    relevance: { score: 80, status: 'available', reasons: ['Strong match'] },
    difficulty: { score: 50, status: 'available', reasons: ['Moderate'] },
    userFit: { score: 85, status: 'available', reasons: ['Aligned'] },
    finalScore: 78,
    classification: 'strong-match',
    pipelineVersion: '2.0',
    analyzedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadQualificationService,
        {
          provide: getRepositoryToken(Lead),
          useValue: { find: jest.fn(), findBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(LeadTopic),
          useValue: { findBy: jest.fn(), findOneBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(LeadTopicLink),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(LeadQualification),
          useValue: {
            findOneBy: jest.fn(),
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(LeadOnboardingProfileRecord),
          useValue: {
            find: jest.fn(),
            create: jest.fn((value) => value),
            save: jest.fn(async (value) => value),
          },
        },
        {
          provide: DiscoveryPipelineService,
          useValue: {
            analyzeLead: jest.fn().mockResolvedValue(mockAnalysis),
          },
        },
      ],
    }).compile();

    service = module.get(LeadQualificationService);
    onboardingProfileRepository = module.get(
      getRepositoryToken(LeadOnboardingProfileRecord)
    );
    qualificationRepository = module.get(getRepositoryToken(LeadQualification));
    pipelineService = module.get(DiscoveryPipelineService);

    onboardingProfileRepository.find.mockResolvedValue([]);
    qualificationRepository.findOneBy.mockResolvedValue(null);
  });

  it('loads the latest onboarding profile without using findOne without conditions', async () => {
    onboardingProfileRepository.find.mockResolvedValue([
      {
        id: 'profile-1',
        profile: {
          serviceOffer: 'Frontend consulting',
          currentStep: 4,
        },
      } as LeadOnboardingProfileRecord,
    ]);

    await service.analyzeAndSave(mockLead, null);

    expect(onboardingProfileRepository.find).toHaveBeenCalledWith({
      where: { profileId: 'profile-1' },
      order: {
        completedAt: 'DESC',
        updatedAt: 'DESC',
      },
      take: 1,
    });
    expect(pipelineService.analyzeLead).toHaveBeenCalledWith(
      mockLead,
      null,
      expect.objectContaining({
        serviceOffer: 'Frontend consulting',
      })
    );
  });
});
