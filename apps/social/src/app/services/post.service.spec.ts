<<<<<<< HEAD
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
=======
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PostService } from './post.service';
import { Post } from '../../entities/post.entity';
import { Repository } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';

describe('PostService', () => {
    let service: PostService;
    let repo: Repository<Post>;

    const mockPostRepo = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PostService,
                {
                    provide: getRepositoryToken(Post),
                    useValue: mockPostRepo,
                },
            ],
        }).compile();

        service = module.get<PostService>(PostService);
        repo = module.get<Repository<Post>>(getRepositoryToken(Post));
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('should create and save a post', async () => {
            const dto: CreatePostDto = { title: 'Test', content: 'Content' } as any;
            const post: Post = {
                id: '1', ...dto,
                votes: [],
                comments: [],
                links: [],
                attachments: [],
                createdAt: undefined,
                updatedAt: undefined
            };
            mockPostRepo.create.mockReturnValue(post);
            mockPostRepo.save.mockResolvedValue(post);

            const result = await service.create(dto);

            expect(mockPostRepo.create).toHaveBeenCalledWith(dto);
            expect(mockPostRepo.save).toHaveBeenCalledWith(post);
            expect(result).toEqual(post);
        });
    });

    describe('findAll', () => {
        it('should return an array of posts', async () => {
            const posts: Post[] = [{
                id: '1',
                title: '',
                content: '',
                profileId: '',
                userId: '',
                votes: [],
                comments: [],
                links: [],
                attachments: [],
                createdAt: undefined,
                updatedAt: undefined
            }, {
                id: '2',
                title: '',
                content: '',
                profileId: '',
                userId: '',
                votes: [],
                comments: [],
                links: [],
                attachments: [],
                createdAt: undefined,
                updatedAt: undefined
            }];
            mockPostRepo.find.mockResolvedValue(posts);

            const result = await service.findAll();

            expect(mockPostRepo.find).toHaveBeenCalled();
            expect(result).toEqual(posts);
        });
    });

    describe('findOne', () => {
        it('should return a single post', async () => {
            const post = { id: '1', title: 'Test' } as Post;
            mockPostRepo.findOne.mockResolvedValue(post);

            const result = await service.findOne('1');

            expect(mockPostRepo.findOne).toHaveBeenCalledWith({ where: { id: '1' } });
            expect(result).toEqual(post);
        });
    });

    describe('update', () => {
        it('should update a post', async () => {
            mockPostRepo.update.mockResolvedValue(undefined);
            const dto: UpdatePostDto = { title: 'Updated' } as any;

            await service.update(1, dto);

            expect(mockPostRepo.update).toHaveBeenCalledWith(1, dto);
        });
    });

    describe('remove', () => {
        it('should delete a post', async () => {
            mockPostRepo.delete.mockResolvedValue(undefined);

            await service.remove(1);

            expect(mockPostRepo.delete).toHaveBeenCalledWith(1);
        });
    });
});
>>>>>>> eb42fc1 (filled in unit tests)
