import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Blog } from '../entities';
import { BlogService } from './blog.service';
import { Repository } from 'typeorm';

describe('BlogService', () => {
  let service: BlogService;
  let blogRepo: jest.Mocked<Partial<Repository<Blog>>>;

  beforeEach(async () => {
    blogRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        {
          provide: getRepositoryToken(Blog),
          useValue: blogRepo,
        },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create should save a new blog', async () => {
    const dto = { name: 'Test Blog', ownerId: 'user-1' };
    blogRepo.create.mockReturnValue(dto as any);
    blogRepo.save.mockResolvedValue(dto as any);
    
    const result = await service.create(dto as any);
    expect(blogRepo.create).toHaveBeenCalledWith(dto);
    expect(blogRepo.save).toHaveBeenCalled();
    expect(result).toEqual(dto);
  });

  it('findAll should return blogs with filters', async () => {
    blogRepo.find.mockResolvedValue([]);
    const query = { 
        name: 'test', 
        description: 'desc', 
        ownerId: 'owner',
        createdAt: ['2024-01-01', '2024-12-31'],
        updatedAt: ['2024-01-01', '2024-12-31']
    };
    await service.findAll(query as any);
    expect(blogRepo.find).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
            name: expect.anything(),
            description: expect.anything(),
            ownerId: 'owner'
        })
    }));
  });

  it('findOne should return a blog', async () => {
    blogRepo.findOne.mockResolvedValue({ id: '1' } as any);
    const result = await service.findOne('1');
    expect(result).toEqual({ id: '1' });
  });

  it('update should update and return a blog', async () => {
    blogRepo.update.mockResolvedValue(undefined as any);
    blogRepo.findOne.mockResolvedValue({ id: '1', name: 'Updated' } as any);
    const result = await service.update('1', { name: 'Updated' });
    expect(blogRepo.update).toHaveBeenCalledWith('1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });

  it('remove should delete a blog', async () => {
    blogRepo.delete.mockResolvedValue(undefined as any);
    await service.remove('1');
    expect(blogRepo.delete).toHaveBeenCalledWith('1');
  });
});
