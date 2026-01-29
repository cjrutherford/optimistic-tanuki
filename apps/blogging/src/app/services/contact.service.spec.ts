import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contact } from '../entities';
import { ContactService } from './contact.service';
import { Repository } from 'typeorm';

describe('ContactService', () => {
  let service: ContactService;
  let contactRepo: jest.Mocked<Partial<Repository<Contact>>>;

  beforeEach(async () => {
    contactRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: getRepositoryToken(Contact),
          useValue: contactRepo,
        },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should save a new contact', async () => {
    const dto = { name: 'Test', email: 'test@example.com', message: 'hello' };
    contactRepo.create.mockReturnValue(dto as any);
    contactRepo.save.mockResolvedValue(dto as any);
    
    const result = await service.create(dto as any);
    expect(contactRepo.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(dto);
  });

  it('findAll should return contacts with filters', async () => {
    contactRepo.find.mockResolvedValue([]);
    const query = { 
        name: 'test', 
        email: 'test@example.com',
        message: 'hello',
        phone: '123',
        createdAt: ['2024-01-01', '2024-12-31']
    };
    await service.findAll(query as any);
    expect(contactRepo.find).toHaveBeenCalled();
  });

  it('findOne should return a contact', async () => {
    contactRepo.findOne.mockResolvedValue({ id: '1' } as any);
    const result = await service.findOne('1');
    expect(result).toEqual({ id: '1' });
  });

  it('update should update and return a contact', async () => {
    contactRepo.update.mockResolvedValue(undefined as any);
    contactRepo.findOne.mockResolvedValue({ id: '1', name: 'Updated' } as any);
    const result = await service.update('1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('remove should delete a contact', async () => {
    contactRepo.delete.mockResolvedValue(undefined as any);
    await service.remove('1');
    expect(contactRepo.delete).toHaveBeenCalledWith('1');
  });
});
