import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Event } from '../entities';
import { EventService } from './event.service';
import { Repository } from 'typeorm';

describe('EventService', () => {
  let service: EventService;
  let eventRepo: jest.Mocked<Partial<Repository<Event>>>;

  beforeEach(async () => {
    eventRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: getRepositoryToken(Event),
          useValue: eventRepo,
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should save a new event', async () => {
    const dto = { name: 'Test Event', organizerId: 'user-1' };
    eventRepo.create.mockReturnValue(dto as any);
    eventRepo.save.mockResolvedValue(dto as any);
    
    const result = await service.create(dto as any);
    expect(eventRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(dto);
  });

  it('findAll should return events with filters', async () => {
    eventRepo.find.mockResolvedValue([]);
    const query = { 
        name: 'test', 
        description: 'desc',
        location: 'loc',
        organizerId: 'org',
        startTime: ['2024-01-01', '2024-12-31'],
        endTime: ['2024-01-01', '2024-12-31'],
        createdAt: ['2024-01-01', '2024-12-31']
    };
    await service.findAll(query as any);
    expect(eventRepo.find).toHaveBeenCalled();
  });

  it('findOne should return an event', async () => {
    eventRepo.findOne.mockResolvedValue({ id: '1' } as any);
    const result = await service.findOne('1');
    expect(result).toEqual({ id: '1' });
  });

  it('update should update and return an event', async () => {
    eventRepo.update.mockResolvedValue(undefined as any);
    eventRepo.findOne.mockResolvedValue({ id: '1', name: 'Updated' } as any);
    const result = await service.update('1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('remove should delete an event', async () => {
    eventRepo.delete.mockResolvedValue(undefined as any);
    await service.remove('1');
    expect(eventRepo.delete).toHaveBeenCalledWith('1');
  });
});
