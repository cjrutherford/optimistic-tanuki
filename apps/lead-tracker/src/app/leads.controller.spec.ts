import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadStatus, LeadSource } from '@optimistic-tanuki/models';

describe('LeadsController', () => {
  let controller: LeadsController;
  let service: jest.Mocked<LeadsService>;

  const mockLead = {
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

  beforeEach(async () => {
    const mockService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getStats: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
    service = module.get(LeadsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with filters', async () => {
      service.findAll.mockResolvedValue([mockLead]);

      const result = await controller.findAll({
        status: 'new',
        source: 'upwork',
      });

      expect(service.findAll).toHaveBeenCalledWith({
        status: 'new',
        source: 'upwork',
      });
      expect(result).toEqual([mockLead]);
    });

    it('should call service.findAll without filters', async () => {
      service.findAll.mockResolvedValue([mockLead]);

      await controller.findAll();

      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      service.findOne.mockResolvedValue(mockLead);

      const result = await controller.findOne({ id: mockLead.id });

      expect(service.findOne).toHaveBeenCalledWith(mockLead.id);
      expect(result).toEqual(mockLead);
    });
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const createDto = { name: 'New Lead', source: LeadSource.REFERRAL };
      service.create.mockResolvedValue(mockLead);

      const result = await controller.create(createDto);

      expect(service.create).toHaveBeenCalledWith(createDto);
      expect(result).toEqual(mockLead);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const updateDto = { status: LeadStatus.CONTACTED };
      service.update.mockResolvedValue(mockLead);

      const result = await controller.update({
        id: mockLead.id,
        dto: updateDto,
      });

      expect(service.update).toHaveBeenCalledWith(mockLead.id, updateDto);
      expect(result).toEqual(mockLead);
    });
  });

  describe('delete', () => {
    it('should call service.delete with id', async () => {
      service.delete.mockResolvedValue();

      await controller.delete({ id: mockLead.id });

      expect(service.delete).toHaveBeenCalledWith(mockLead.id);
    });
  });

  describe('getStats', () => {
    it('should call service.getStats', async () => {
      const stats = {
        total: 1,
        autoDiscovered: 0,
        manual: 1,
        totalValue: 5000,
        followUpsDue: 0,
        byStatus: { new: 1 },
      };
      service.getStats.mockResolvedValue(stats);

      const result = await controller.getStats();

      expect(service.getStats).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });
});
