import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';
import { Test, TestingModule } from '@nestjs/testing';

import { Post } from '../../entities/post.entity';
import { PostService } from './post.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('PostService', () => {
  let service: PostService;
  let postRepo: jest.Mocked<Repository<Post>>;

  const mockPostRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getRepositoryToken(Post),
          useFactory: mockPostRepo,
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    postRepo = module.get(getRepositoryToken(Post));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a post', async () => {
    const dto: CreatePostDto = { title: 'Test', content: 'Content', profileId: '1' };
    const post = { id: '1', ...dto } as Post;
    postRepo.create.mockReturnValue(post);
    postRepo.save.mockResolvedValue(post);
    const result = await service.create(dto);
    expect(postRepo.create).toHaveBeenCalledWith(dto);
    expect(postRepo.save).toHaveBeenCalledWith(post);
    expect(result).toBe(post);
  });

  it('should find all posts', async () => {
    const posts = [{ id: '1' } as Post, { id: '2' } as Post];
    postRepo.find.mockResolvedValue(posts);
    const result = await service.findAll();
    expect(postRepo.find).toHaveBeenCalled();
    expect(result).toBe(posts);
  });

  it('should find one post', async () => {
    const post = { id: '1' } as Post;
    postRepo.findOne.mockResolvedValue(post);
    const result = await service.findOne('1');
    expect(postRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result).toBe(post);
  });

  it('should update a post', async () => {
    postRepo.update.mockResolvedValue(undefined);
    const dto: UpdatePostDto = { title: 'Updated', content: 'Updated' };
    await service.update(1, dto);
    expect(postRepo.update).toHaveBeenCalledWith(1, dto);
  });

  it('should remove a post', async () => {
    postRepo.delete.mockResolvedValue(undefined);
    await service.remove(1);
    expect(postRepo.delete).toHaveBeenCalledWith(1);
  });
});
