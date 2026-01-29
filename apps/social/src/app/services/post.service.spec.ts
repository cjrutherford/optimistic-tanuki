import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Comment } from '../../entities/comment.entity';
import { Repository } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';

describe('PostService', () => {
  let service: PostService;
  let postRepo: jest.Mocked<Repository<Post>>;
  let attachmentRepo: jest.Mocked<Repository<Attachment>>;
  let commentRepo: jest.Mocked<Repository<Comment>>;

  const mockRepoFactory = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findBy: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostService,
        {
          provide: getRepositoryToken(Post),
          useFactory: mockRepoFactory,
        },
        {
          provide: getRepositoryToken(Attachment),
          useFactory: mockRepoFactory,
        },
        {
          provide: getRepositoryToken(Comment),
          useFactory: mockRepoFactory,
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    postRepo = module.get(getRepositoryToken(Post)) as jest.Mocked<Repository<Post>>;
    attachmentRepo = module.get(getRepositoryToken(Attachment)) as jest.Mocked<Repository<Attachment>>;
    commentRepo = module.get(getRepositoryToken(Comment)) as jest.Mocked<Repository<Comment>>;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a post', async () => {
    const dto: CreatePostDto = {
      title: 'Test Post',
      content: 'Test Content',
      userId: 'user1',
      profileId: 'profile1',
      visibility: 'public',
    };
    const post = { id: '1', ...dto } as Post;
    postRepo.create.mockReturnValue(post);
    postRepo.save.mockResolvedValue(post);
    const result = await service.create(dto);
    // Content should be sanitized, so we check the structure was called with sanitized version
    expect(postRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        title: dto.title,
        userId: dto.userId
    }));
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
    postRepo.update.mockResolvedValue({ generatedMaps: [], raw: [], affected: 1 });
    const dto: UpdatePostDto = { title: 'Updated', content: 'Updated' };
    await service.update('1', dto);
    // Content should be sanitized
    expect(postRepo.update).toHaveBeenCalledWith('1', expect.objectContaining({
        title: dto.title
    }));
  });

    it('should create a post with attachmentIds', async () => {

      const dto: CreatePostDto = {

        title: 'Post with Attachments',

        content: 'Content',

        userId: 'user1',

        profileId: 'profile1',

        visibility: 'public',

        attachmentIds: ['att1', 'prof1'],

      };

      const mockAttachments = [{ id: 'att1' }, { id: 'prof1' }];

      const post = { id: '1', ...dto } as Post;

      postRepo.create.mockReturnValue(post);

      attachmentRepo.findBy.mockResolvedValue(mockAttachments as any);

      postRepo.save.mockResolvedValue(post);

  

      const result = await service.create(dto);

  

      expect(attachmentRepo.findBy).toHaveBeenCalled();

      expect(post.attachments).toEqual(mockAttachments);

      expect(result).toBe(post);

    });

  

    it('should find one post with where as an array', async () => {

      const post = { id: '1' } as Post;

      postRepo.findOne.mockResolvedValue(post);

      await service.findOne('1', { where: [{ userId: 'u1' }, { visibility: 'public' }] });

      expect(postRepo.findOne).toHaveBeenCalledWith({

        where: [{ userId: 'u1', id: '1' }, { visibility: 'public', id: '1' }],

      });

    });

  

    it('should find one post with where as an object', async () => {

      const post = { id: '1' } as Post;

      postRepo.findOne.mockResolvedValue(post);

      await service.findOne('1', { where: { userId: 'u1' } });

      expect(postRepo.findOne).toHaveBeenCalledWith({

        where: { userId: 'u1', id: '1' },

      });

    });

  

    it('should update a post and sanitize content', async () => {

      postRepo.update.mockResolvedValue({ generatedMaps: [], raw: [], affected: 1 });

      const dto: UpdatePostDto = { content: '<script>alert("xss")</script><p>Hello</p>' };

      await service.update('1', dto);

      expect(postRepo.update).toHaveBeenCalledWith('1', expect.objectContaining({

          content: '<p>Hello</p>'

      }));

    });

  

    it('should throw error when remove fails', async () => {

      commentRepo.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(service.remove('1')).rejects.toThrow('Delete failed');

    });

  

    it('should get posts with various filters', async () => {

      const searchDto = {

        userIds: ['user1'],

        visibility: 'public' as any,

        profileId: 'prof1'

      };

      const posts = [{ id: '1' } as Post];

      postRepo.find.mockResolvedValue(posts);

  

      const result = await service.getPosts(searchDto);

  

      expect(postRepo.find).toHaveBeenCalledWith({

        where: expect.objectContaining({

          userId: expect.anything(),

          visibility: 'public',

          profileId: 'prof1'

        })

      });

      expect(result).toBe(posts);

    });

  

    it('should get posts with empty userIds and no visibility', async () => {

      const searchDto = {

        userIds: [],

        profileId: 'prof1'

      };

      postRepo.find.mockResolvedValue([]);

      await service.getPosts(searchDto);

      expect(postRepo.find).toHaveBeenCalledWith({

        where: { profileId: 'prof1' }

      });

    });

  });

  