import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { ClientProxy } from '@nestjs/microservices';
import {
  LeadCommands,
  LeadSource,
  LeadStatus,
} from '@optimistic-tanuki/constants';

describe('LeadsController', () => {
  let controller: LeadsController;
  let leadClient: jest.Mocked<ClientProxy>;

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
    const mockClient = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: 'LEAD_SERVICE',
          useValue: mockClient,
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
    leadClient = module.get('LEAD_SERVICE');
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should send FIND_ALL command with filters', async () => {
      const mockSend = jest.fn().mockResolvedValue([mockLead]);
      leadClient.send.mockReturnValue(mockSend as any);

      const result = await controller.findAll('new', 'upwork');

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.FIND_ALL },
        { status: 'new', source: 'upwork' }
      );
      expect(result).toEqual([mockLead]);
    });

    it('should send FIND_ALL command without filters', async () => {
      const mockSend = jest.fn().mockResolvedValue([mockLead]);
      leadClient.send.mockReturnValue(mockSend as any);

      const result = await controller.findAll();

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.FIND_ALL },
        { status: undefined, source: undefined }
      );
      expect(result).toEqual([mockLead]);
    });
  });

  describe('findOne', () => {
    it('should send FIND_ONE command with id', async () => {
      const mockSend = jest.fn().mockResolvedValue(mockLead);
      leadClient.send.mockReturnValue(mockSend as any);

      const result = await controller.findOne(mockLead.id);

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.FIND_ONE },
        { id: mockLead.id }
      );
      expect(result).toEqual(mockLead);
    });
  });

  describe('create', () => {
    it('should send CREATE command with dto', async () => {
      const createDto = { name: 'New Lead', source: LeadSource.REFERRAL };
      const mockSend = jest.fn().mockResolvedValue(mockLead);
      leadClient.send.mockReturnValue(mockSend as any);

      const result = await controller.create(createDto);

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.CREATE },
        createDto
      );
      expect(result).toEqual(mockLead);
    });
  });

  describe('update', () => {
    it('should send UPDATE command with id and dto', async () => {
      const updateDto = { status: LeadStatus.CONTACTED };
      const mockSend = jest.fn().mockResolvedValue(mockLead);
      leadClient.send.mockReturnValue(mockSend as any);

      const result = await controller.update(mockLead.id, updateDto);

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.UPDATE },
        { id: mockLead.id, dto: updateDto }
      );
      expect(result).toEqual(mockLead);
    });
  });

  describe('delete', () => {
    it('should send DELETE command with id', async () => {
      const mockSend = jest.fn().mockResolvedValue(undefined);
      leadClient.send.mockReturnValue(mockSend as any);

      await controller.delete(mockLead.id);

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.DELETE },
        { id: mockLead.id }
      );
    });
  });

  describe('getStats', () => {
    it('should send GET_STATS command', async () => {
      const stats = {
        total: 1,
        autoDiscovered: 0,
        manual: 1,
        totalValue: 5000,
        followUpsDue: 0,
        byStatus: { new: 1 },
      };
      const mockSend = jest.fn().mockResolvedValue(stats);
      leadClient.send.mockReturnValue(mockSend as any);

      const result = await controller.getStats();

      expect(leadClient.send).toHaveBeenCalledWith(
        { cmd: LeadCommands.GET_STATS },
        {}
      );
      expect(result).toEqual(stats);
    });
  });
});
