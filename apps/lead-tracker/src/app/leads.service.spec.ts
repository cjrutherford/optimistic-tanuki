import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailService } from '@optimistic-tanuki/email';
import {
  Lead,
  LeadFlag,
  LeadQualification,
  LeadTopic,
  LeadTopicLink,
} from '@optimistic-tanuki/models/leads-entities';
import {
  CommitHardwareProposalRequest,
  DEFAULT_LEAD_DISCOVERY_SOURCES,
  LeadDiscoverySource,
  LeadFlagReason,
  LeadSource,
  LeadStatus,
} from '@optimistic-tanuki/models/leads-contracts';
import { Not, QueryFailedError, Repository } from 'typeorm';
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
  let emailService: { sendEmail: jest.Mock };

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
    contactSubject: 'General inquiry',
    contactMessage: 'Need help with a scoped delivery project.',
    contactSourceLabel: 'HAI',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastRespondedAt: null,
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
  let transactionalLeadRepository: any;
  let notificationOutboxRepository: any;
  let dataSource: { transaction: jest.Mock };
  let storedNotificationRows: any[];

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
    transactionalLeadRepository = {
      create: jest.fn((lead) => lead),
      save: jest.fn(async (lead) => ({ ...lead, id: mockLead.id })),
      update: jest.fn(),
      findOne: jest.fn(async () => mockLead),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    storedNotificationRows = [];
    notificationOutboxRepository = {
      save: jest.fn(async (notifications) => {
        const rows = Array.isArray(notifications)
          ? notifications
          : [notifications];
        for (const row of rows) {
          const existing = storedNotificationRows.find(
            (candidate) => candidate.id === row.id
          );
          if (existing) {
            Object.assign(existing, row);
          } else {
            storedNotificationRows.push({
              ...row,
              id: `outbox-${storedNotificationRows.length + 1}`,
            });
          }
        }
        return notifications;
      }),
      find: jest.fn(async () =>
        storedNotificationRows.filter(
          (notification) =>
            notification.status === 'pending' &&
            notification.nextAttemptAt.getTime() <= Date.now()
        )
      ),
      findOne: jest.fn(
        async ({ where }) =>
          storedNotificationRows.find(
            (notification) =>
              notification.id === where.id &&
              notification.status === where.status
          ) || null
      ),
      update: jest.fn(async (criteria, updates) => {
        for (const row of storedNotificationRows) {
          if (
            Object.entries(criteria).every(([key, value]) => row[key] === value)
          ) {
            Object.assign(row, updates);
          }
        }
      }),
    };
    const transactionManager = {
      getRepository: jest.fn((entity) =>
        entity === Lead
          ? transactionalLeadRepository
          : notificationOutboxRepository
      ),
    };
    dataSource = {
      transaction: jest.fn(async (callback) => callback(transactionManager)),
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
    emailService = {
      sendEmail: jest.fn().mockResolvedValue({ success: true }),
    };
    mockLeadQualificationService.analyzeAndSave.mockResolvedValue({} as any);

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
        {
          provide: EmailService,
          useValue: emailService,
        },
        {
          provide: 'LEAD_TRACKER_CONNECTION',
          useValue: dataSource,
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
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lead.appScope != :restrictedAppScope',
        { restrictedAppScope: 'hai' }
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
        where: {
          id: mockLead.id,
          profileId: 'test-profile',
          appScope: Not('hai'),
        },
        relations: { flags: true },
      });
    });

    it('should return null if lead not found', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id', 'test-profile');

      expect(result).toBeNull();
    });

    it('allows the verified owner-console path to read only HAI leads', async () => {
      repository.findOne.mockResolvedValue(mockLead as any);

      await service.findOne(mockLead.id, 'owner-profile', true);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockLead.id, appScope: 'hai' },
        relations: { flags: true },
      });
    });
  });

  describe('create', () => {
    it('should create a new lead', async () => {
      const createDto = { name: 'New Lead', source: LeadSource.REFERRAL };
      repository.create.mockReturnValue({ ...mockLead, ...createDto } as Lead);
      repository.save.mockResolvedValue({ ...mockLead, ...createDto } as Lead);
      leadQualificationService.analyzeAndSave.mockResolvedValue({} as any);

      const result = await service.create(createDto, authContext);

      expect(transactionalLeadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining(createDto)
      );
      expect(transactionalLeadRepository.save).toHaveBeenCalled();
      expect(leadQualificationService.analyzeAndSave).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Lead' }),
        null
      );
      expect(result.name).toBe('New Lead');
    });

    it('stores a HAI due time and deduplicated owner notifications with the lead', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-25T20:30:00.000Z'));
      transactionalLeadRepository.save.mockImplementationOnce(async (lead) => ({
        ...lead,
        id: mockLead.id,
      }));

      await service.create(
        { name: 'HAI Lead', source: LeadSource.OTHER },
        { ...authContext, appScope: 'hai' },
        ['Owner@Example.com', ' owner@example.com ']
      );

      expect(transactionalLeadRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          dueAt: new Date('2026-09-28T13:30:00.000Z'),
          firstPersonalResponseAt: null,
        })
      );
      const savedRows = notificationOutboxRepository.save.mock.calls[0][0];
      expect(savedRows).toHaveLength(2);
      expect(savedRows.map((row) => row.eventType)).toEqual([
        'intake',
        'sla_breach',
      ]);
      expect(savedRows.map((row) => row.recipientEmail)).toEqual([
        'owner@example.com',
        'owner@example.com',
      ]);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(
        emailService.sendEmail.mock.invocationCallOrder[0]
      ).toBeGreaterThan(
        notificationOutboxRepository.save.mock.invocationCallOrder[0]
      );
      jest.useRealTimers();
    });

    it('retries a failed owner email from the durable outbox', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-25T16:00:00.000Z'));
      emailService.sendEmail.mockResolvedValueOnce({
        success: false,
        error: 'SMTP unavailable',
      });

      await service.create(
        { name: 'HAI Retry Lead', source: LeadSource.OTHER },
        { ...authContext, appScope: 'hai' },
        ['owner@example.com']
      );

      const intakeEvent = storedNotificationRows.find(
        (row) => row.eventType === 'intake'
      );
      expect(intakeEvent).toEqual(
        expect.objectContaining({
          status: 'pending',
          attempts: 1,
          lastError: 'SMTP unavailable',
        })
      );
      intakeEvent.nextAttemptAt = new Date(Date.now() - 1);
      await (service as any).drainNotificationOutbox();

      expect(intakeEvent.status).toBe('sent');
      expect(intakeEvent.attempts).toBe(1);
      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('does not enqueue owner emails for non-HAI CREATE calls', async () => {
      await service.create(
        { name: 'Internal Lead', source: LeadSource.OTHER },
        authContext,
        ['owner@example.com']
      );

      expect(notificationOutboxRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(transactionalLeadRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ dueAt: null })
      );
    });
  });

  describe('commitHardwareProposal', () => {
    const request: CommitHardwareProposalRequest = {
      context: {
        appScope: 'owner-console',
        ownerConsoleAccess: true,
        userId: 'owner-user',
        profileId: 'owner-profile',
      },
      proposal: {
        quoteId: 'quote-123',
        customerName: 'Hardware Customer',
        customerEmail: 'customer@example.com',
        customerPhone: '555-0100',
        tier: 'tier2' as const,
        total: 12800,
        currency: 'USD',
        terms: { delivery: '4-6 weeks', warranty: '3 years' },
        idempotencyKey: 'proposal-commit-1',
      },
    };

    it('creates a HAI proposal lead without triggering intake notifications or discovery', async () => {
      transactionalLeadRepository.findOne.mockResolvedValue(null);
      const result = await service.commitHardwareProposal(request);

      expect(transactionalLeadRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Hardware Customer',
          email: 'customer@example.com',
          phone: '555-0100',
          appScope: 'hai',
          userId: 'owner-user',
          profileId: 'owner-profile',
          value: 12800,
          commercialQuoteId: 'quote-123',
          proposalIdempotencyKey: 'proposal-commit-1',
          hardwareTier: 'tier2',
          acceptedTerms: request.proposal.terms,
        })
      );
      expect(notificationOutboxRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(leadQualificationService.analyzeAndSave).not.toHaveBeenCalled();
      expect(result.id).toBe(mockLead.id);
    });

    it('returns the existing lead for an identical idempotent retry', async () => {
      transactionalLeadRepository.findOne.mockResolvedValue(null);
      await service.commitHardwareProposal(request);
      const existing = {
        ...transactionalLeadRepository.save.mock.calls[0][0],
        id: mockLead.id,
      };
      transactionalLeadRepository.findOne.mockResolvedValue(existing as any);
      transactionalLeadRepository.save.mockClear();

      const result = await service.commitHardwareProposal(request);

      expect(result).toBe(existing);
      expect(transactionalLeadRepository.save).not.toHaveBeenCalled();
    });

    it('reloads and returns the matching lead when concurrent inserts hit the unique index', async () => {
      const uniqueViolation = new QueryFailedError('INSERT INTO leads', [], {
        code: '23505',
      } as any);
      transactionalLeadRepository.findOne.mockResolvedValueOnce(null);
      transactionalLeadRepository.save.mockRejectedValueOnce(uniqueViolation);
      const existing = {
        ...mockLead,
        commercialQuoteId: request.proposal.quoteId,
        proposalIdempotencyKey: request.proposal.idempotencyKey,
      } as Lead;
      mockRepository.findOne.mockImplementationOnce(async () => {
        existing.commercialProposalHash =
          transactionalLeadRepository.save.mock.calls[0][0].commercialProposalHash;
        return existing;
      });

      const result = await service.commitHardwareProposal(request);

      expect(result).toBe(existing);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [
          { proposalIdempotencyKey: request.proposal.idempotencyKey },
          { commercialQuoteId: request.proposal.quoteId },
        ],
      });
      expect(transactionalLeadRepository.save).toHaveBeenCalledTimes(1);
    });

    it('rejects a unique-index race when the committed proposal hash differs', async () => {
      const uniqueViolation = new QueryFailedError('INSERT INTO leads', [], {
        code: '23505',
      } as any);
      transactionalLeadRepository.findOne.mockResolvedValueOnce(null);
      transactionalLeadRepository.save.mockRejectedValueOnce(uniqueViolation);
      const existing = {
        ...mockLead,
        commercialQuoteId: request.proposal.quoteId,
        proposalIdempotencyKey: request.proposal.idempotencyKey,
        commercialProposalHash: 'different-payload-hash',
      } as Lead;
      mockRepository.findOne.mockResolvedValueOnce(existing);

      await expect(service.commitHardwareProposal(request)).rejects.toThrow(
        'Idempotency key was already used for another proposal'
      );
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: [
          { proposalIdempotencyKey: request.proposal.idempotencyKey },
          { commercialQuoteId: request.proposal.quoteId },
        ],
      });
    });

    it('rejects reuse of an idempotency key with a different proposal payload', async () => {
      transactionalLeadRepository.findOne.mockResolvedValue({
        ...mockLead,
        commercialQuoteId: 'quote-123',
        proposalIdempotencyKey: 'proposal-commit-1',
        commercialProposalHash: 'different-payload-hash',
      } as any);

      await expect(service.commitHardwareProposal(request)).rejects.toThrow(
        'Idempotency key was already used for another proposal'
      );
      expect(transactionalLeadRepository.save).not.toHaveBeenCalled();
    });

    it('rejects caller-supplied owner access without a complete verified owner context', async () => {
      await expect(
        service.commitHardwareProposal({
          ...request,
          context: { ...request.context, userId: '' },
        })
      ).rejects.toThrow('Verified owner context is required');
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
        {
          id: mockLead.id,
          profileId: 'test-profile',
          appScope: Not('hai'),
        },
        updateDto
      );
      expect(repository.findOne).toHaveBeenCalled();
      expect(result.status).toBe(LeadStatus.CONTACTED);
    });
  });

  describe('sendResponse', () => {
    const dto = {
      subject: 'Thanks for reaching out',
      message: 'We can help with that.',
      status: LeadStatus.QUALIFIED,
      nextFollowUp: '2026-04-10',
    };

    it('should persist sent status when delivery succeeds', async () => {
      storedNotificationRows.push({
        id: 'breach-1',
        leadId: mockLead.id,
        eventType: 'sla_breach',
        status: 'pending',
      });
      repository.findOne
        .mockResolvedValueOnce({ ...mockLead, flags: [] } as any)
        .mockResolvedValueOnce({
          ...mockLead,
          ...dto,
          notes: `${mockLead.notes}\n---\nOperator response sent: 2026-06-03T00:00:00.000Z\nSubject: ${dto.subject}\n${dto.message}`,
          lastRespondedAt: new Date(),
          flags: [],
        } as any);

      await service.sendResponse(mockLead.id, dto, authContext);

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockLead.email,
          subject: dto.subject,
          text: expect.stringContaining(dto.message),
          html: expect.stringContaining('Lead Tracker'),
          replyTo: process.env.SMTP_FROM,
        })
      );
      expect(transactionalLeadRepository.update).toHaveBeenCalledWith(
        {
          id: mockLead.id,
          profileId: authContext.profileId,
          appScope: Not('hai'),
        },
        expect.objectContaining({
          status: LeadStatus.QUALIFIED,
          nextFollowUp: dto.nextFollowUp,
          lastRespondedAt: expect.any(Date),
          notes: expect.stringContaining('Operator response sent:'),
        })
      );
      expect(
        transactionalLeadRepository.update.mock.calls[0][1]
          .firstPersonalResponseAt
      ).toBeUndefined();
      expect(notificationOutboxRepository.update).not.toHaveBeenCalled();
    });

    it.each([
      ['on time', new Date('2100-01-01T00:00:00.000Z'), true],
      ['late', new Date('2000-01-01T00:00:00.000Z'), false],
    ])(
      'records an HAI owner reply %s and suppresses breach only when timely',
      async (_label, dueAt, suppress) => {
        const haiLead = { ...mockLead, appScope: 'hai', dueAt, flags: [] };
        repository.findOne.mockResolvedValue(haiLead as any);
        storedNotificationRows.push({
          id: 'breach-1',
          leadId: mockLead.id,
          eventType: 'sla_breach',
          status: 'pending',
        });

        await service.sendResponse(mockLead.id, dto, {
          ...authContext,
          appScope: 'owner-console',
          ownerConsoleAccess: true,
        });

        const update = transactionalLeadRepository.update.mock.calls[0][1];
        expect(update.firstPersonalResponseAt()).toBe(
          'COALESCE("firstPersonalResponseAt", CURRENT_TIMESTAMP)'
        );
        expect(notificationOutboxRepository.update).toHaveBeenCalledTimes(
          suppress ? 1 : 0
        );
        expect(storedNotificationRows[0].status).toBe(
          suppress ? 'suppressed' : 'pending'
        );
      }
    );

    it('should return an error when no recipient email is available', async () => {
      repository.findOne.mockResolvedValueOnce({
        ...mockLead,
        email: '',
        flags: [],
      } as any);

      const result = await service.sendResponse(mockLead.id, dto, authContext);

      expect(result).toEqual({
        lead: { ...mockLead, email: '', flags: [], isFlagged: false },
        delivery: {
          success: false,
          error: 'Lead does not have a recipient email address',
        },
      });
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should record a failure note without changing status when delivery fails', async () => {
      emailService.sendEmail.mockResolvedValueOnce({
        success: false,
        error: 'SMTP unavailable',
      });
      repository.findOne
        .mockResolvedValueOnce({ ...mockLead, flags: [] } as any)
        .mockResolvedValueOnce({
          ...mockLead,
          notes: `${mockLead.notes}\n---\nOperator response failed: 2026-06-03T00:00:00.000Z\nSubject: ${dto.subject}\nSMTP unavailable`,
          flags: [],
        } as any);

      const result = await service.sendResponse(mockLead.id, dto, authContext);

      expect(repository.update).toHaveBeenCalledWith(
        {
          id: mockLead.id,
          profileId: authContext.profileId,
          appScope: Not('hai'),
        },
        expect.objectContaining({
          status: mockLead.status,
          nextFollowUp: mockLead.nextFollowUp,
          lastRespondedAt: mockLead.lastRespondedAt,
          notes: expect.stringContaining('Operator response failed:'),
        })
      );
      expect(result.delivery).toEqual({
        success: false,
        error: 'SMTP unavailable',
      });
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
      await service.delete(mockLead.id, 'test-profile');

      expect(transactionalLeadRepository.delete).toHaveBeenCalledWith({
        id: mockLead.id,
        profileId: 'test-profile',
        appScope: Not('hai'),
      });
      expect(notificationOutboxRepository.update).toHaveBeenCalledWith(
        { leadId: mockLead.id, status: 'pending' },
        { status: 'suppressed' }
      );
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
