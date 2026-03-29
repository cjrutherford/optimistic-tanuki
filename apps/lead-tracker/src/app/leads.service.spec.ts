import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeadsService } from './leads.service';
import { Lead, LeadStatus, LeadSource } from '@optimistic-tanuki/models';

describe('LeadsService', () => {
  let service: LeadsService;
  let repository: jest.Mocked<Repository<Lead>>;

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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockRepository: any;

  beforeEach(async () => {
    mockRepository = {
      createQueryBuilder: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: getRepositoryToken(Lead),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    repository = mockRepository;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all leads without filters', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLead]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.findAll();

      expect(result).toEqual([mockLead]);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'lead.nextFollowUp',
        'ASC'
      );
    });

    it('should filter leads by status', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLead]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findAll({ status: 'new' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lead.status = :status',
        { status: 'new' }
      );
    });

    it('should filter leads by source', async () => {
      const mockQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockLead]),
      };
      repository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await service.findAll({ source: 'upwork' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'lead.source = :source',
        { source: 'upwork' }
      );
    });
  });

  describe('findOne', () => {
    it('should return a single lead by id', async () => {
      repository.findOneBy.mockResolvedValue(mockLead);

      const result = await service.findOne(mockLead.id);

      expect(result).toEqual(mockLead);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: mockLead.id });
    });

    it('should return null if lead not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.findOne('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new lead', async () => {
      const createDto = { name: 'New Lead', source: LeadSource.REFERRAL };
      repository.create.mockReturnValue({ ...mockLead, ...createDto } as Lead);
      repository.save.mockResolvedValue({ ...mockLead, ...createDto } as Lead);

      const result = await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith(createDto);
      expect(repository.save).toHaveBeenCalled();
      expect(result.name).toBe('New Lead');
    });
  });

  describe('update', () => {
    it('should update a lead', async () => {
      const updateDto = { status: LeadStatus.CONTACTED };
      repository.update.mockResolvedValue({ affected: 1 } as any);
      repository.findOneBy.mockResolvedValue({
        ...mockLead,
        ...updateDto,
      } as Lead);

      const result = await service.update(mockLead.id, updateDto);

      expect(repository.update).toHaveBeenCalledWith(mockLead.id, updateDto);
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: mockLead.id });
      expect(result.status).toBe(LeadStatus.CONTACTED);
    });
  });

  describe('delete', () => {
    it('should delete a lead', async () => {
      repository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.delete(mockLead.id);

      expect(repository.delete).toHaveBeenCalledWith(mockLead.id);
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
        },
        {
          ...mockLead,
          id: '2',
          isAutoDiscovered: false,
          value: 3000,
          status: LeadStatus.WON,
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
      repository.find.mockResolvedValue(leads);

      const result = await service.getStats();

      expect(result.total).toBe(3);
      expect(result.autoDiscovered).toBe(2);
      expect(result.manual).toBe(1);
      expect(result.totalValue).toBe(10000);
      expect(result.followUpsDue).toBe(1);
      expect(result.byStatus).toEqual({
        new: 2,
        won: 1,
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
      repository.find.mockResolvedValue(leads);

      const result = await service.getStats();

      expect(result.followUpsDue).toBe(0);
    });
  });
});
