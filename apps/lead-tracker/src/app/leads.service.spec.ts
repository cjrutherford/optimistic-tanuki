import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Lead,
  LeadFlag,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import {
  DEFAULT_LEAD_DISCOVERY_SOURCES,
  LeadDiscoverySource,
  LeadFlagReason,
  LeadSource,
  LeadStatus,
} from '@optimistic-tanuki/models/leads-contracts';
import { Repository } from 'typeorm';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let repository: jest.Mocked<Repository<Lead>>;
  let leadFlagRepository: jest.Mocked<Repository<LeadFlag>>;
  let leadTopicRepository: jest.Mocked<Repository<LeadTopic>>;
  let leadTopicLinkRepository: jest.Mocked<Repository<LeadTopicLink>>;
  let qualificationRepository: jest.Mocked<Repository<LeadQualification>>;
  let leadQualificationService: jest.Mocked<LeadQualificationService>;

  const mockLead: Lead = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Lead',
    company: 'Test Company',
    email: 'test@example.com',
    phone: '555-1234',
    source: LeadSource.UPWORK,
    status: LeadStatus.NEW,
    value: 5000,
    notes: 'Test notes',
    nextFollowUp: '2026-04-01',
    isAutoDiscovered: false,
    searchKeywords: ['react', 'typescript'],
    assignedTo: 'user-1',
    profileId: 'test-profile',
    userId: 'test-user',
    appScope: 'test-scope',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFlag: LeadFlag = {
    id: 'flag-1',
    leadId: mockLead.id,
    reasons: [LeadFlagReason.SPAM],
    notes: 'Not a fit',
    profileId: 'test-profile',
    userId: 'test-user',
    createdAt: new Date(),
  };

  const mockTopic: LeadTopic = {
    id: 'topic-1',
    name: 'React Work',
    description: 'React contracts',
    keywords: ['react', 'frontend'],
    excludedTerms: [],
    discoveryIntent: 'job-openings' as any,
    sources: [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.HIMALAYAS],
    googleMapsCities: null,
    googleMapsTypes: null,
    googleMapsLocation: null,
    googleMapsRadiusMiles: null,
    enabled: true,
    lastRun: new Date(),
    leadCount: 2,
    priority: null,
    targetCompanies: null,
    buyerPersona: null,
    painPoints: null,
    valueProposition: null,
    searchStrategy: null,
    confidence: null,
    profileId: 'test-profile',
    userId: 'test-user',
    appScope: 'test-scope',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const authContext = {
    profileId: 'test-profile',
    userId: 'test-user',
    appScope: 'test-scope',
  };

  let mockRepository: any;
  let mockFlagRepository: any;
  let mockTopicRepository: any;

  beforeEach(async () => {
    mockRepository = {
      createQueryBuilder: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      findBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };
    mockFlagRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    mockTopicRepository = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findOneBy: jest.fn(),
    };
    const mockTopicLinkRepository = {
      find: jest.fn(),
    };
    const mockQualificationRepository = {
      find: jest.fn(),
    };
    const mockLeadQualificationService = {
      analyzeAndSave: jest.fn(),
      logFailure: jest.fn(),
      saveOnboardingProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getRepositoryToken(Lead),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(LeadFlag),
          useValue: mockFlagRepository,
        },
        {
          provide: getRepositoryToken(LeadTopic),
          useValue: mockTopicRepository,
        },
        {
          provide: getRepositoryToken(LeadTopicLink),
          useValue: mockTopicLinkRepository,
        },
        {
          provide: getRepositoryToken(LeadQualification),
          useValue: mockQualificationRepository,
        },
        {
          provide: LeadQualificationService,
          useValue: mockLeadQualificationService,
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    repository = mockRepository;
    leadFlagRepository = mockFlagRepository;
    leadTopicRepository = mockTopicRepository;
    leadTopicLinkRepository = module.get(getRepositoryToken(LeadTopicLink));
    qualificationRepository = module.get(getRepositoryToken(LeadQualification));
    leadQualificationService = module.get(LeadQualificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all leads without filters', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLead]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll({ profileId: 'test-profile' });

      expect(result).toEqual([{ ...mockLead, isFlagged: false }]);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lead.profileId = :profileId',
        { profileId: 'test-profile' }
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'lead.nextFollowUp',
        'ASC'
      );
    });

    it('should filter leads by status', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLead]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findAll({ status: 'new', profileId: 'test-profile' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lead.status = :status',
        { status: 'new' }
      );
    });

    it('should filter leads by source', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLead]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findAll({ source: 'upwork', profileId: 'test-profile' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lead.source = :source',
        { source: 'upwork' }
      );
    });
  });

  describe('findOne', () => {
    it('should return a single lead by id', async () => {
      repository.findOne.mockResolvedValue({
        ...mockLead,
        flags: [mockFlag],
      } as any);

      const result = await service.findOne(mockLead.id, 'test-profile');

      expect(result).toEqual({
        ...mockLead,
        flags: [mockFlag],
        isFlagged: true,
      });
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockLead.id, profileId: 'test-profile' },
        relations: { flags: true },
      });
    });

    it('should return null if lead not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id', 'test-profile');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new lead', async () => {
      const createDto = { name: 'New Lead', source: LeadSource.REFERRAL };
      repository.create.mockReturnValue({ ...mockLead, ...createDto } as Lead);
      repository.save.mockResolvedValue({ ...mockLead, ...createDto } as Lead);
      leadQualificationService.analyzeAndSave.mockResolvedValue({} as any);

      const result = await service.create(createDto, authContext);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining(createDto)
      );
      expect(repository.save).toHaveBeenCalled();
      expect(leadQualificationService.analyzeAndSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Lead' }),
        null
      );
      expect(result.name).toBe('New Lead');
    });
  });

  describe('update', () => {
    it('should update a lead', async () => {
      const updateDto = { status: LeadStatus.CONTACTED };
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOne.mockResolvedValue({
        ...mockLead,
        ...updateDto,
      } as Lead);

      const result = await service.update(
        mockLead.id,
        updateDto,
        'test-profile'
      );

      expect(repository.update).toHaveBeenCalledWith(
        { id: mockLead.id, profileId: 'test-profile' },
        updateDto
      );
      expect(repository.findOne).toHaveBeenCalled();
      expect(result.status).toBe(LeadStatus.CONTACTED);
    });
  });

  describe('topics', () => {
    it('should return all topics', async () => {
      leadTopicRepository.find.mockResolvedValue([mockTopic]);
      leadTopicLinkRepository.find.mockResolvedValue([]);

      const result = await service.findAllTopics('test-profile');

      expect(leadTopicRepository.find).toHaveBeenCalledWith({
        where: { profileId: 'test-profile' },
        order: { enabled: 'DESC', updatedAt: 'DESC', name: 'ASC' },
      });
      expect(result).toEqual([
        {
          ...mockTopic,
          qualificationSummary: {
            byClassification: {
              'strong-match': 0,
              review: 0,
              'weak-match': 0,
            },
            averageRelevanceScore: null,
            averageDifficultyScore: null,
            averageUserFitScore: null,
            missingUserFitCount: 0,
          },
        },
      ]);
    });

    it('should create a topic', async () => {
      const dto = {
        name: 'Cloud',
        description: 'Cloud work',
        keywords: ['aws'],
        sources: [LeadDiscoverySource.REMOTE_OK],
      };
      leadTopicRepository.create.mockReturnValue({ ...mockTopic, ...dto });
      leadTopicRepository.save.mockResolvedValue({ ...mockTopic, ...dto });

      const result = await service.createTopic(dto, authContext);

      expect(leadTopicRepository.create).toHaveBeenCalled();
      expect(result.name).toBe('Cloud');
    });

    it('should default topic sources to the discovery source defaults', async () => {
      const dto = {
        name: 'Cloud',
        description: 'Cloud work',
        keywords: ['aws'],
      };
      leadTopicRepository.create.mockImplementation(
        (input) => input as LeadTopic
      );
      leadTopicRepository.save.mockImplementation(
        async (input) => input as LeadTopic
      );

      const result = await service.createTopic(dto as any, authContext);

      expect(result.sources).toEqual(DEFAULT_LEAD_DISCOVERY_SOURCES);
    });

    it('should persist normalized Google Maps settings for Google Maps topics', async () => {
      const dto = {
        name: 'Savannah Local',
        description: 'Local opportunities',
        keywords: ['restaurants'],
        sources: [LeadDiscoverySource.GOOGLE_MAPS],
        googleMapsCities: [' Savannah, GA '],
        googleMapsTypes: [' restaurants ', 'restaurants'],
      };
      leadTopicRepository.create.mockImplementation(
        (input) => input as LeadTopic
      );
      leadTopicRepository.save.mockImplementation(
        async (input) => input as any
      );

      const result = await service.createTopic(dto as any, authContext);

      expect(result.googleMapsCities).toEqual(['Savannah, GA']);
      expect(result.googleMapsTypes).toEqual(['restaurants']);
    });

    it('should normalize excluded terms and default discovery intent on create', async () => {
      const dto = {
        name: 'Local Buyers',
        description: 'Find local buyers',
        keywords: ['react'],
        excludedTerms: [' Wordpress ', 'php', 'wordpress'],
      };
      leadTopicRepository.create.mockImplementation(
        (input) => input as LeadTopic
      );
      leadTopicRepository.save.mockImplementation(
        async (input) => input as any
      );

      const result = await service.createTopic(dto as any, authContext);

      expect(result.excludedTerms).toEqual(['wordpress', 'php']);
      expect(result.discoveryIntent).toBe('job-openings');
    });

    it('should update a topic', async () => {
      leadTopicRepository.update.mockResolvedValue({ affected: 1 } as any);
      leadTopicRepository.findOneBy.mockResolvedValue({
        ...mockTopic,
        enabled: false,
      });

      const result = await service.updateTopic(
        mockTopic.id,
        { enabled: false },
        'test-profile'
      );

      expect(leadTopicRepository.update).toHaveBeenCalledWith(
        { id: mockTopic.id, profileId: 'test-profile' },
        {
          enabled: false,
          excludedTerms: undefined,
          discoveryIntent: undefined,
          sources: undefined,
          googleMapsCities: null,
          googleMapsTypes: null,
          googleMapsLocation: null,
          googleMapsRadiusMiles: null,
          lastRun: undefined,
        }
      );
      expect(result?.enabled).toBe(false);
    });

    it('should clear Google Maps fields when Google Maps is not selected', async () => {
      leadTopicRepository.update.mockResolvedValue({ affected: 1 } as any);
      leadTopicRepository.findOneBy.mockResolvedValue({
        ...mockTopic,
        googleMapsCities: null,
        googleMapsTypes: null,
        sources: [LeadDiscoverySource.REMOTE_OK],
      });

      await service.updateTopic(
        mockTopic.id,
        {
          sources: [LeadDiscoverySource.REMOTE_OK],
          googleMapsCities: ['Savannah, GA'],
          googleMapsTypes: ['restaurants'],
        } as any,
        'test-profile'
      );

      expect(leadTopicRepository.update).toHaveBeenCalledWith(
        { id: mockTopic.id, profileId: 'test-profile' },
        {
          sources: [LeadDiscoverySource.REMOTE_OK],
          googleMapsCities: null,
          googleMapsTypes: null,
          googleMapsLocation: null,
          googleMapsRadiusMiles: null,
          excludedTerms: undefined,
          discoveryIntent: undefined,
          lastRun: undefined,
        }
      );
    });

    it('should preserve generic topic metadata when disabling google maps', async () => {
      leadTopicRepository.update.mockResolvedValue({ affected: 1 } as any);
      leadTopicRepository.findOneBy.mockResolvedValue({
        ...mockTopic,
        googleMapsCities: null,
        googleMapsTypes: null,
        excludedTerms: ['wordpress', 'php'],
        discoveryIntent: 'service-buyers' as any,
        sources: [LeadDiscoverySource.REMOTE_OK],
      });

      await service.updateTopic(
        mockTopic.id,
        {
          sources: [LeadDiscoverySource.REMOTE_OK],
          googleMapsCities: ['Savannah, GA'],
          googleMapsTypes: ['restaurants'],
          excludedTerms: [' Wordpress ', 'php'],
          discoveryIntent: 'service-buyers',
        } as any,
        'test-profile'
      );

      expect(leadTopicRepository.update).toHaveBeenCalledWith(
        { id: mockTopic.id, profileId: 'test-profile' },
        {
          sources: [LeadDiscoverySource.REMOTE_OK],
          googleMapsCities: null,
          googleMapsTypes: null,
          googleMapsLocation: null,
          googleMapsRadiusMiles: null,
          excludedTerms: ['wordpress', 'php'],
          discoveryIntent: 'service-buyers',
          lastRun: undefined,
        }
      );
    });

    it('should default missing sources to the discovery source defaults on create', async () => {
      const dto = {
        name: 'General',
        description: '',
        keywords: ['web'],
      };
      leadTopicRepository.create.mockImplementation(
        (input) => input as LeadTopic
      );
      leadTopicRepository.save.mockImplementation(
        async (input) => input as any
      );

      const result = await service.createTopic(dto as any, authContext);

      expect(result.sources).toEqual(DEFAULT_LEAD_DISCOVERY_SOURCES);
    });
  });

  describe('flags', () => {
    it('should return flags for a lead', async () => {
      leadFlagRepository.find.mockResolvedValue([mockFlag]);

      const result = await service.findFlagsByLead(mockLead.id, 'test-profile');

      expect(leadFlagRepository.find).toHaveBeenCalledWith({
        where: { leadId: mockLead.id, profileId: 'test-profile' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockFlag]);
    });

    it('should create a flag', async () => {
      const dto = { reasons: [LeadFlagReason.SPAM], notes: 'Not a fit' };
      leadFlagRepository.create.mockReturnValue(mockFlag);
      leadFlagRepository.save.mockResolvedValue(mockFlag);

      const result = await service.createFlag(mockLead.id, dto, authContext);

      expect(leadFlagRepository.create).toHaveBeenCalledWith({
        leadId: mockLead.id,
        reasons: dto.reasons,
        notes: dto.notes,
        profileId: authContext.profileId,
        userId: authContext.userId,
      });
      expect(result).toEqual(mockFlag);
    });
  });

  describe('delete', () => {
    it('should delete a lead', async () => {
      repository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.delete(mockLead.id, 'test-profile');

      expect(repository.delete).toHaveBeenCalledWith({
        id: mockLead.id,
        profileId: 'test-profile',
      });
    });

    it('should delete a topic', async () => {
      leadTopicRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteTopic(mockTopic.id, 'test-profile');

      expect(leadTopicRepository.delete).toHaveBeenCalledWith({
        id: mockTopic.id,
        profileId: 'test-profile',
      });
    });
  });

  describe('getStats', () => {
    it('should return lead statistics', async () => {
      const leads = [
        {
          ...mockLead,
          isAutoDiscovered: true,
          value: 5000,
          status: LeadStatus.NEW,
          nextFollowUp: '2030-01-01',
        },
        {
          ...mockLead,
          id: '2',
          isAutoDiscovered: false,
          value: 3000,
          status: LeadStatus.WON,
          nextFollowUp: '2030-01-01',
        },
        {
          ...mockLead,
          id: '3',
          isAutoDiscovered: true,
          value: 2000,
          status: LeadStatus.NEW,
          nextFollowUp: '2025-01-01',
        },
      ] as Lead[];
      repository.findBy.mockResolvedValue(leads);
      qualificationRepository.find.mockResolvedValue([]);

      const result = await service.getStats('test-profile');

      expect(result.total).toBe(3);
      expect(result.autoDiscovered).toBe(2);
      expect(result.manual).toBe(1);
      expect(result.totalValue).toBe(10000);
      expect(result.followUpsDue).toBe(1);
      expect(result.byStatus.new).toBe(2);
      expect(result.byStatus.won).toBe(1);
      expect(result.byStatus.qualified).toBe(0);
    });

    it('should include qualification summary metrics', async () => {
      repository.findBy.mockResolvedValue([
        mockLead,
        {
          ...mockLead,
          id: '2',
          status: LeadStatus.QUALIFIED,
          isAutoDiscovered: true,
          value: 8000,
        } as Lead,
      ]);
      qualificationRepository.find.mockResolvedValue([
        {
          leadId: mockLead.id,
          classification: 'strong-match',
          relevanceScore: 82,
          difficultyScore: 48,
          userFitScore: 91,
          userFitStatus: 'passed',
        },
        {
          leadId: '2',
          classification: 'review',
          relevanceScore: 60,
          difficultyScore: 77,
          userFitScore: null,
          userFitStatus: 'unavailable',
        },
      ] as any);

      const result = await service.getStats('test-profile');

      expect((result as any).qualification).toEqual({
        byClassification: {
          'strong-match': 1,
          review: 1,
          'weak-match': 0,
        },
        averageRelevanceScore: 71,
        averageDifficultyScore: 63,
        averageUserFitScore: 91,
        missingUserFitCount: 1,
      });
    });

    it('should not count follow-ups due for won or lost leads', async () => {
      const leads = [
        { ...mockLead, status: LeadStatus.WON, nextFollowUp: '2025-01-01' },
        {
          ...mockLead,
          id: '2',
          status: LeadStatus.LOST,
          nextFollowUp: '2025-01-01',
        },
      ] as Lead[];
      repository.findBy.mockResolvedValue(leads);
      qualificationRepository.find.mockResolvedValue([]);

      const result = await service.getStats('test-profile');

      expect(result.followUpsDue).toBe(0);
    });
  });
});
