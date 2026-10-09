import { Test, TestingModule } from '@nestjs/testing';
import { PostService } from './post.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Post } from '../../entities/post.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Comment } from '../../entities/comment.entity';
import { Repository } from 'typeorm';
import { CreatePostDto, UpdatePostDto } from '@optimistic-tanuki/models';
import { CommunityService } from './community.service';
import { of } from 'rxjs';
import { AssetCommands } from '@optimistic-tanuki/constants';

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
        {
          provide: CommunityService,
          useValue: {
            findOne: jest.fn(),
            isMember: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PostService>(PostService);
    postRepo = module.get(getRepositoryToken(Post)) as jest.Mocked<
      Repository<Post>
    >;
    attachmentRepo = module.get(getRepositoryToken(Attachment)) as jest.Mocked<
      Repository<Attachment>
    >;
    commentRepo = module.get(getRepositoryToken(Comment)) as jest.Mocked<
      Repository<Comment>
    >;
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
    expect(postRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: dto.title,
        userId: dto.userId,
      })
    );
    expect(postRepo.save).toHaveBeenCalledWith(post);
    expect(result).toBe(post);
  });

  it('defaults community posts to members and records explicit public choice only when selected', async () => {
    const communityService = (service as any).communityService;
    communityService.isMember.mockResolvedValue(true);
    postRepo.create.mockImplementation((value) => value as Post);
    postRepo.save.mockImplementation(async (value) => value as Post);

    await service.create({
      title: 'Members',
      content: 'hello',
      userId: 'user1',
      profileId: 'profile1',
      communityId: 'community1',
    } as CreatePostDto);

    expect(postRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visibility: 'community',
        publicAudienceExplicit: false,
      })
    );

    await service.create({
      title: 'Public',
      content: 'hello',
      userId: 'user1',
      profileId: 'profile1',
      communityId: 'community1',
      visibility: 'public',
    } as CreatePostDto);

    expect(postRepo.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        visibility: 'public',
        publicAudienceExplicit: true,
      })
    );
  });

  it('finds exact asset references in all posts and derives their current audience', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    postRepo.find.mockResolvedValue([
      {
        content: `<img src="https://local/api/asset/${assetId}">`,
        profileId: 'author-profile',
        visibility: 'followers',
        communityId: null,
      } as Post,
      {
        content: `<img src="https://local/api/asset/${assetId}-other">`,
        profileId: 'wrong-match',
        visibility: 'followers',
        communityId: null,
      } as Post,
      {
        content: `<img src="https://local/api/asset/${assetId}">`,
        profileId: 'author-profile',
        visibility: 'public',
        communityId: 'private-community',
      } as Post,
      {
        content: `<img src="https://local/api/asset/${assetId}">`,
        profileId: 'foreign-author',
        visibility: 'followers',
        communityId: 'foreign-private-community',
      } as Post,
    ]);
    (service as any).communityService.findOne.mockResolvedValue({
      id: 'private-community',
      isPrivate: true,
    });

    await expect(
      service.findAssetAudienceReferences(assetId, 'author-profile')
    ).resolves.toEqual({
      restrictions: [{ type: 'followers', profileId: 'author-profile' }],
      communityIds: ['private-community'],
    });
    expect((service as any).communityService.findOne).toHaveBeenCalledTimes(1);
  });

  it('rejects malformed asset ids before building a reference query', async () => {
    await expect(
      service.findAssetAudienceReferences('asset-id', 'author-profile')
    ).rejects.toThrow('Invalid asset id');
    expect(postRepo.find).not.toHaveBeenCalled();
  });

  it('persists the followers restriction before deleting a private post reference', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const assetClient = {
      send: jest.fn().mockReturnValue(of({ profileId: 'author-profile' })),
    };
    (service as any).assetService = assetClient;
    postRepo.findOne.mockResolvedValue({
      id: 'private-post',
      userId: 'author-user',
      profileId: 'author-profile',
      visibility: 'followers',
      content: `<img src="/asset/${assetId}">`,
      communityId: null,
    } as Post);
    postRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
    commentRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
    attachmentRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

    await service.remove('private-post', 'author-user');

    expect(assetClient.send).toHaveBeenCalledWith(
      { cmd: 'asset.addAudienceRestrictions' },
      {
        id: assetId,
        restrictions: [{ type: 'followers', profileId: 'author-profile' }],
      }
    );
    expect(assetClient.send.mock.invocationCallOrder[0]).toBeLessThan(
      postRepo.delete.mock.invocationCallOrder[0]
    );
  });

  it('does not apply community media restrictions to comment images on personal public posts', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const post = {
      id: 'personal-public-post',
      userId: 'author-user',
      profileId: 'author-profile',
      content: 'public parent body',
      visibility: 'public',
      publicAudienceExplicit: false,
      communityId: null,
    } as Post;
    postRepo.findOne.mockResolvedValue(post);
    postRepo.update.mockResolvedValue({ affected: 1, raw: [] });
    commentRepo.find.mockResolvedValue([
      {
        profileId: 'commenter-profile',
        content: `<img src="/api/asset/${assetId}">`,
      } as Comment,
    ]);
    const assetClient = {
      send: jest
        .fn()
        .mockReturnValue(
          of({ profileId: 'commenter-profile', audienceRestrictions: [] })
        ),
    };
    (service as any).assetService = assetClient;

    await service.update(
      post.id,
      { title: 'Updated personal public post' } as UpdatePostDto,
      'author-user',
      'author-profile'
    );

    expect(assetClient.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.RETRIEVE },
      { id: assetId }
    );
    expect(assetClient.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
      expect.anything()
    );
  });

  it('latches commenter-owned image references when narrowing a parent post', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const post = {
      id: 'parent-post',
      userId: 'author-user',
      profileId: 'author-profile',
      visibility: 'public',
      content: 'parent body',
      communityId: null,
    } as Post;
    postRepo.findOne.mockResolvedValue(post);
    postRepo.update.mockResolvedValue({ affected: 1, raw: [] });
    commentRepo.find.mockResolvedValue([
      {
        profileId: 'commenter-profile',
        content: `<p>comment</p><img src="/api/asset/${assetId}">`,
      } as Comment,
    ]);
    (service as any).assetService = {
      send: jest
        .fn()
        .mockReturnValue(
          of({ profileId: 'commenter-profile', audienceRestrictions: [] })
        ),
    };

    await service.update(
      post.id,
      { visibility: 'followers' } as UpdatePostDto,
      'author-user',
      'author-profile'
    );

    expect((service as any).assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
      {
        id: assetId,
        restrictions: [{ type: 'followers', profileId: 'author-profile' }],
      }
    );
  });

  it('does not mutate any media or narrow a post when a comment borrows foreign media', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const post = {
      id: 'parent-post',
      userId: 'author-user',
      profileId: 'author-profile',
      visibility: 'public',
      content: `<img src="/api/asset/${assetId}">`,
      communityId: null,
    } as Post;
    postRepo.findOne.mockResolvedValue(post);
    commentRepo.find.mockResolvedValue([
      {
        profileId: 'commenter-profile',
        content: `<img src="/api/asset/${assetId}">`,
      } as Comment,
    ]);
    const assetClient = {
      send: jest
        .fn()
        .mockReturnValue(
          of({ profileId: 'third-party-profile', audienceRestrictions: [] })
        ),
    };
    (service as any).assetService = assetClient;

    await expect(
      service.update(
        post.id,
        { visibility: 'followers' } as UpdatePostDto,
        'author-user',
        'author-profile'
      )
    ).rejects.toMatchObject({
      error: {
        statusCode: 400,
        message:
          'Restricted posts cannot contain another profile’s comment image',
      },
    });
    expect(assetClient.send).toHaveBeenCalledTimes(1);
    expect(assetClient.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
      expect.anything()
    );
    expect(postRepo.update).not.toHaveBeenCalled();
  });

  it("keeps a foreign author's generic public media public when borrowed", async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const assetClient = {
      send: jest.fn().mockReturnValue(
        of({
          profileId: 'asset-owner',
          audienceRestrictions: [],
          audienceCommunityIds: [],
        })
      ),
    };
    (service as any).assetService = assetClient;
    postRepo.create.mockImplementation((post) => post as Post);
    postRepo.save.mockImplementation(async (post) => post as Post);
    (service as any).communityService.findOne.mockResolvedValue(undefined);

    await service.create({
      title: 'Private to followers',
      content: `<img src="/api/asset/${assetId}">`,
      profileId: 'post-author',
      userId: 'post-user',
      visibility: 'followers',
    } as CreatePostDto);

    expect(assetClient.send).toHaveBeenCalledTimes(1);
    expect(assetClient.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ cmd: expect.stringContaining('addAudience') }),
      expect.anything()
    );
  });

  it('rejects an owner-only asset attached to a public post', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    (service as any).assetService = {
      send: jest.fn().mockReturnValue(
        of({
          profileId: 'post-author',
          audienceRestrictions: [{ type: 'owner', profileId: 'post-author' }],
          audienceCommunityIds: [],
        })
      ),
    };

    await expect(
      service.create({
        title: 'Public',
        content: `<img src="/api/asset/${assetId}">`,
        profileId: 'post-author',
        userId: 'post-user',
        visibility: 'public',
      } as CreatePostDto)
    ).rejects.toThrow('Asset audience is narrower than this post audience');
    expect(postRepo.save).not.toHaveBeenCalled();
  });

  it('latches the actual private community audience for matching owned images', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const assetClient = {
      send: jest.fn().mockReturnValue(
        of({
          profileId: 'post-author',
          audienceRestrictions: [],
          audienceCommunityIds: [],
        })
      ),
    };
    (service as any).assetService = assetClient;
    (service as any).communityService.isMember = jest
      .fn()
      .mockResolvedValue(true);
    (service as any).communityService.hasPermission = jest
      .fn()
      .mockResolvedValue(true);
    (service as any).communityService.findOne.mockResolvedValue({
      id: 'private-community',
      isPrivate: true,
    });
    postRepo.create.mockImplementation((post) => post as Post);
    postRepo.save.mockImplementation(async (post) => post as Post);

    await service.create({
      title: 'Private community image',
      content: `<img src="/api/asset/${assetId}">`,
      profileId: 'post-author',
      userId: 'post-user',
      communityId: 'private-community',
    } as CreatePostDto);

    expect(assetClient.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
      {
        id: assetId,
        restrictions: [
          {
            type: 'community',
            profileId: 'post-author',
            communityId: 'private-community',
          },
        ],
      }
    );
    expect(assetClient.send).toHaveBeenCalledWith(
      { cmd: 'asset.addCommunityAudience' },
      { id: assetId, communityId: 'private-community' }
    );
  });

  it('preserves combined follower and private-community policy across update and removal', async () => {
    const assetId = '123e4567-e89b-42d3-a456-426614174000';
    const state = {
      profileId: 'post-author',
      audienceRestrictions: [] as Array<{ type: string; profileId: string }>,
      audienceCommunityIds: [] as string[],
    };
    const assetClient = {
      send: jest
        .fn()
        .mockImplementation((pattern: { cmd: string }, payload: any) => {
          if (pattern.cmd === AssetCommands.RETRIEVE) return of({ ...state });
          if (pattern.cmd === AssetCommands.ADD_AUDIENCE_RESTRICTIONS) {
            state.audienceRestrictions = [
              ...state.audienceRestrictions,
              ...payload.restrictions,
            ];
          }
          if (pattern.cmd === AssetCommands.ADD_COMMUNITY_AUDIENCE) {
            state.audienceCommunityIds = [
              ...state.audienceCommunityIds,
              payload.communityId,
            ];
          }
          return of({});
        }),
    };
    (service as any).assetService = assetClient;
    (service as any).communityService.isMember = jest
      .fn()
      .mockResolvedValue(true);
    (service as any).communityService.hasPermission = jest
      .fn()
      .mockResolvedValue(true);
    (service as any).communityService.findOne.mockResolvedValue({
      id: 'private-community',
      isPrivate: true,
    });
    const post = {
      id: 'private-community-post',
      title: 'Private image',
      content: `<img src="/api/asset/${assetId}">`,
      profileId: 'post-author',
      userId: 'post-user',
      communityId: 'private-community',
      visibility: 'followers',
    } as Post;
    postRepo.create.mockReturnValue(post);
    postRepo.save.mockResolvedValue(post);
    postRepo.findOne.mockResolvedValue(post);

    await service.create(post as any);
    expect(state.audienceRestrictions).toContainEqual({
      type: 'followers',
      profileId: 'post-author',
    });
    expect(state.audienceCommunityIds).toContain('private-community');
    await expect(
      service.update(
        post.id,
        { content: post.content },
        'post-user',
        'post-author'
      )
    ).resolves.toBe(post);
    await expect(service.remove(post.id, 'post-user')).resolves.toEqual({
      success: true,
    });
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
    expect(postRepo.findOne).toHaveBeenCalledWith({
      where: { id: '1', moderationStatus: 'visible' },
    });
    expect(result).toBe(post);
  });

  it('should update a post', async () => {
    postRepo.findOne.mockResolvedValue({
      id: '1',
      userId: 'user-1',
      profileId: 'profile-1',
      communityId: null,
    } as Post);
    postRepo.update.mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected: 1,
    });
    const dto: UpdatePostDto = { title: 'Updated', content: 'Updated' };
    await service.update('1', dto, 'user-1', 'profile-1');
    // Content should be sanitized
    expect(postRepo.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        title: dto.title,
      })
    );
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

    await service.findOne('1', {
      where: [{ userId: 'u1' }, { visibility: 'public' }],
    });

    expect(postRepo.findOne).toHaveBeenCalledWith({
      where: [
        { userId: 'u1', id: '1', moderationStatus: 'visible' },
        { visibility: 'public', id: '1', moderationStatus: 'visible' },
      ],
    });
  });

  it('should find one post with where as an object', async () => {
    const post = { id: '1' } as Post;

    postRepo.findOne.mockResolvedValue(post);

    await service.findOne('1', { where: { userId: 'u1' } });

    expect(postRepo.findOne).toHaveBeenCalledWith({
      where: { userId: 'u1', id: '1', moderationStatus: 'visible' },
    });
  });

  it('should update a post and sanitize content', async () => {
    postRepo.findOne.mockResolvedValue({
      id: '1',
      userId: 'user-1',
      profileId: 'profile-1',
      communityId: null,
    } as Post);
    postRepo.update.mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected: 1,
    });

    const dto: UpdatePostDto = {
      content: '<script>alert("xss")</script><p>Hello</p>',
    };

    await service.update('1', dto, 'user-1', 'profile-1');

    expect(postRepo.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        content: '<p>Hello</p>',
      })
    );
  });

  it('rejects post updates from non-owners', async () => {
    postRepo.findOne.mockResolvedValue({
      id: '1',
      userId: 'owner-user',
      profileId: 'owner-profile',
      communityId: null,
    } as Post);

    await expect(
      service.update('1', { title: 'Updated' }, 'owner-user', 'other-profile')
    ).rejects.toThrow();
  });

  it('allows a non-community post update only for the owning profile', async () => {
    postRepo.findOne.mockResolvedValue({
      id: '1',
      userId: 'owner-user',
      profileId: 'owner-profile',
      communityId: null,
    } as Post);
    postRepo.update.mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected: 1,
    });
    postRepo.findOne.mockResolvedValueOnce({
      id: '1',
      userId: 'owner-user',
      profileId: 'owner-profile',
      communityId: null,
    } as Post);
    postRepo.findOne.mockResolvedValueOnce({
      id: '1',
      userId: 'owner-user',
      profileId: 'owner-profile',
      title: 'Updated',
      communityId: null,
    } as Post);

    await expect(
      service.update('1', { title: 'Updated' }, 'owner-user', 'owner-profile')
    ).resolves.toEqual(expect.objectContaining({ title: 'Updated' }));
  });

  it('should throw error when remove fails', async () => {
    postRepo.findOne.mockResolvedValue({ id: '1' } as Post);
    commentRepo.delete.mockRejectedValue(new Error('Delete failed'));

    await expect(service.remove('1')).rejects.toThrow('Delete failed');
  });

  it('should get posts with various filters', async () => {
    const searchDto = {
      userIds: ['user1'],

      visibility: 'public' as any,

      profileId: 'prof1',
    };

    const posts = [{ id: '1' } as Post];

    postRepo.find.mockResolvedValue(posts);

    const result = await service.getPosts(searchDto);

    expect(postRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        userId: expect.anything(),

        visibility: 'public',

        profileId: 'prof1',
      }),
    });

    expect(result).toBe(posts);
  });

  it('should get posts with empty userIds and no visibility', async () => {
    const searchDto = {
      userIds: [],

      profileId: 'prof1',
    };

    postRepo.find.mockResolvedValue([]);

    await service.getPosts(searchDto);

    expect(postRepo.find).toHaveBeenCalledWith({
      where: { profileId: 'prof1', moderationStatus: 'visible' },
    });
  });

  it('filters hidden posts from default findAll queries', async () => {
    postRepo.find.mockResolvedValue([]);

    await service.findAll();

    expect(postRepo.find).toHaveBeenCalledWith({
      where: { moderationStatus: 'visible' },
    });
  });

  it('soft moderates a post instead of deleting it', async () => {
    const post = {
      id: '1',
      moderationStatus: 'visible',
    } as Post;
    postRepo.findOne.mockResolvedValue(post);
    postRepo.update.mockResolvedValue({
      generatedMaps: [],
      raw: [],
      affected: 1,
    });

    await service.moderate('1', 'hidden', 'reviewer-1', 'Spam cleanup');

    expect(postRepo.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        moderationStatus: 'hidden',
        moderatedBy: 'reviewer-1',
        moderationNotes: 'Spam cleanup',
      })
    );
  });
});
