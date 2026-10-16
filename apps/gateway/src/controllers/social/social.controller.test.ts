import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SocialController } from './social.controller';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  AttachmentCommands,
  CommentCommands,
  PostCommands,
  VoteCommands,
  GuardianContentCommands,
} from '@optimistic-tanuki/constants';
import {
  CreatePostDto,
  CreateVoteDto,
  CreateCommentDto,
  CreateAttachmentDto,
  SearchPostDto,
  SearchCommentDto,
  SearchAttachmentDto,
  UpdatePostDto,
  UpdateCommentDto,
  UpdateAttachmentDto,
  AttachmentType,
} from '@optimistic-tanuki/models';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';
import { IdentityThrottlerGuard } from '../learning/identity-throttler.guard';
import { CreateGuardianCommentDto, CreateGuardianPostDto } from './dto/guardian-content.dto';

describe('SocialController', () => {
  let socialController: SocialController;
  let clientProxy: ClientProxy;
  let consoleLogSpy: jest.SpyInstance;
  const mockUser = {
    id: '1',
    userId: '1',
    username: 'test',
    email: 'someone@somewhere.net',
    profileId: '1',
    appId: 'client-interface',
    // Add fields expected by UserDetails (exp/iat/name)
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    name: 'Test User',
  };

  beforeEach(async () => {
    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialController],
      providers: [
        Logger,
        {
          provide: 'AUTHENTICATION_SERVICE',
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: 'SOCIAL_SERVICE',
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: 'PERMISSIONS_SERVICE',
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue(mockUser),
          },
        },
        Reflector,
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            invalidateProfile: jest.fn().mockResolvedValue(undefined),
            invalidateAppScope: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
            getStats: jest.fn().mockResolvedValue({}),
            cleanupExpired: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => of(true) })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => of(true) }) // Mock PermissionsGuard
      .overrideGuard(IdentityThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    socialController = module.get<SocialController>(SocialController);
    clientProxy = module.get<ClientProxy>('SOCIAL_SERVICE');
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should create a post', async () => {
    const postDto: CreatePostDto = {
      title: 'Test Post',
      content: 'Test Content',
      userId: mockUser.id,
      profileId: mockUser.profileId,
    };
    await socialController.post(mockUser, postDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.CREATE },
      postDto
    );
  });

  it('should normalize post creation to the acting user and profile', async () => {
    const postDto: CreatePostDto = {
      title: 'Test Post',
      content: 'Test Content',
      userId: 'different-user',
      profileId: 'different-profile',
      communityId: 'community-1',
    };

    await socialController.post(mockUser, postDto);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.CREATE },
      expect.objectContaining({
        userId: mockUser.userId,
        profileId: mockUser.profileId,
        appScope: mockUser.appId,
        communityId: 'community-1',
      })
    );
  });

  it('does not create posts without verified app context', async () => {
    await expect(
      socialController.post(
        { userId: 'user-1', profileId: 'profile-1' } as any,
        { title: 'title', content: 'body', profileId: 'profile-1' } as any
      )
    ).rejects.toThrow('verified Social application session');
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: PostCommands.CREATE },
      expect.anything()
    );
  });

  it('should create a vote', async () => {
    const voteDto: CreateVoteDto = {
      value: 1,
      postId: '1',
      userId: mockUser.id,
      profileId: mockUser.profileId,
    };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: '1' }));
    await socialController.vote(mockUser, voteDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: VoteCommands.UPVOTE },
      voteDto
    );
  });

  it('does not create a vote when the parent post is unavailable', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of(null));
    await expect(
      socialController.vote(
        mockUser as any,
        {
          value: 1,
          postId: 'private-post',
        } as any
      )
    ).rejects.toThrow('Post not found');
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: VoteCommands.UPVOTE },
      expect.anything()
    );
  });

  it('should create a comment', async () => {
    const commentDto: CreateCommentDto = {
      content: 'Test Content',
      userId: mockUser.id,
      postId: '1',
      profileId: mockUser.profileId,
    };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: '1' }));
    await socialController.comment(mockUser, commentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.CREATE },
      expect.objectContaining({
        ...commentDto,
        profileId: mockUser.profileId,
      })
    );
  });

  it('does not create a comment when its parent post is unavailable', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of(null));
    await expect(
      socialController.comment(
        mockUser as any,
        {
          content: 'private text',
          postId: 'private-post',
        } as any
      )
    ).rejects.toThrow('Post not found');
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: CommentCommands.CREATE },
      expect.anything()
    );
  });

  it('should create an attachment', async () => {
    const attachmentDto: CreateAttachmentDto = {
      name: 'test-attachment',
      url: 'http://test.com',
      type: AttachmentType.IMAGE,
      size: 1024,
      postId: 'post-1',
    };
    await socialController.attachment(mockUser as any, attachmentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.CREATE },
      {
        attachment: {
          name: attachmentDto.name,
          url: attachmentDto.url,
          type: attachmentDto.type,
          size: attachmentDto.size,
        },
        postId: 'post-1',
        actor: {
          userId: mockUser.userId,
          profileId: mockUser.profileId,
          appId: mockUser.appId,
        },
      }
    );
  });

  it('rejects attachment bodies that try to provide their own actor or app scope', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    await expect(
      pipe.transform(
        {
          name: 'file.png',
          url: 'https://cdn.example.test/file.png',
          type: 'IMAGE',
          size: 100,
          postId: '123e4567-e89b-42d3-a456-426614174001',
          profileId: 'forged-profile',
          userId: 'forged-user',
          appScope: 'local-hub',
        },
        { type: 'body', metatype: CreateAttachmentDto }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should get a post by id', async () => {
    const id = '1';
    await socialController.getPost(id, mockUser as any);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id, viewerProfileId: mockUser.profileId }
    );
  });

  it('should get a comment by id', async () => {
    const id = '1';
    await socialController.getComment(id);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.FIND },
      { id }
    );
  });

  it('should get a vote by id', async () => {
    const id = '1';
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ id, post: { id: 'post-1' } })
    );
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: 'post-1' }));
    await socialController.getVote(id, mockUser as any);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: VoteCommands.GET },
      { id }
    );
  });

  it('should find the current user vote for a post', async () => {
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: 'post-1' }));
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of([
        {
          id: 'vote-1',
          postId: 'post-1',
          userId: '1',
          profileId: '1',
          value: 1,
        },
        {
          id: 'vote-2',
          postId: 'post-1',
          userId: '2',
          profileId: '2',
          value: -1,
        },
      ])
    );

    const result = await socialController.findVotes(mockUser as any, {
      postId: 'post-1',
      profileId: mockUser.profileId,
    });

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: VoteCommands.GET },
      { postid: 'post-1' }
    );
    expect(result).toEqual(
      expect.objectContaining({ id: 'vote-1', profileId: mockUser.profileId })
    );
  });

  it('should return all votes when no user filter is provided', async () => {
    const votes = [{ id: 'vote-1', postId: 'post-1', userId: '1', value: 1 }];
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: 'post-1' }));
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of(votes));

    const result = await socialController.findVotes(mockUser as any, {
      postId: 'post-1',
    });

    expect(result).toEqual(votes);
  });

  it('should get an attachment by id', async () => {
    const id = '1';
    const attachment = { id, post: { id: 'post-1' } };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of(attachment));
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: 'post-1' }));
    await expect(
      socialController.getAttachment(id, mockUser as any)
    ).resolves.toMatchObject(attachment);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.FIND },
      { id, appId: mockUser.appId }
    );
  });

  it('rejects an attachment with no parent post without querying a post', async () => {
    const id = 'orphan-attachment';
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id }));
    await expect(
      socialController.getAttachment(id, mockUser as any)
    ).rejects.toThrow('Post not found');
    expect(clientProxy.send).not.toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      expect.anything()
    );
  });

  it('should search posts', async () => {
    const searchCriteria: SearchPostDto = {
      title: 'Test Post',
      content: 'Test Content',
      userIds: [mockUser.id],
    };
    await socialController.searchPosts({ criteria: searchCriteria });
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND_MANY },
      {
        criteria: searchCriteria,
        opts: undefined,
      }
    );
  });

  it('forwards the guard-verified viewer profile id when searching posts', async () => {
    const searchCriteria: SearchPostDto = {
      profileId: 'author-1',
    };
    const req = { user: { profileId: mockUser.profileId } } as any;

    await socialController.searchPosts({ criteria: searchCriteria }, req);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND_MANY },
      {
        criteria: expect.objectContaining({
          profileId: 'author-1',
        }),
        opts: undefined,
        viewerProfileId: mockUser.profileId,
      }
    );
  });

  it('forwards an undefined viewer id for anonymous post search (ignores a forged req.user-less request)', async () => {
    const searchCriteria: SearchPostDto = {
      profileId: 'author-1',
    };

    await socialController.searchPosts({ criteria: searchCriteria }, {} as any);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND_MANY },
      {
        criteria: expect.objectContaining({
          profileId: 'author-1',
        }),
        opts: undefined,
        viewerProfileId: undefined,
      }
    );
  });

  it('should search comments', async () => {
    const searchCriteria: SearchCommentDto = {
      content: 'Test Content',
      parentId: '1',
    };
    await socialController.searchComments(searchCriteria);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.FIND_MANY },
      searchCriteria
    );
  });

  it('forwards the guard-verified viewer profile id when searching comments', async () => {
    const searchCriteria: SearchCommentDto = {
      content: 'Test Content',
      parentId: '1',
    };
    const req = { user: { profileId: mockUser.profileId } } as any;

    await socialController.searchComments(searchCriteria, req);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.FIND_MANY },
      { ...searchCriteria, viewerProfileId: mockUser.profileId }
    );
  });

  it('forwards an undefined viewer id for anonymous comment search', async () => {
    const searchCriteria: SearchCommentDto = {
      content: 'Test Content',
      parentId: '1',
    };

    await socialController.searchComments(searchCriteria, {} as any);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.FIND_MANY },
      { ...searchCriteria, viewerProfileId: undefined }
    );
  });

  it('forwards the guard-verified viewer profile id when getting a shared post', async () => {
    const id = 'post-1';
    const req = { user: { profileId: mockUser.profileId } } as any;

    await socialController.getSharedPost(id, req);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id, viewerProfileId: mockUser.profileId }
    );
  });

  it('forwards an undefined viewer id for anonymous/forged shared post access', async () => {
    const id = 'post-1';

    await socialController.getSharedPost(id, {} as any);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id, viewerProfileId: undefined }
    );
  });

  it('should search attachments', async () => {
    const searchCriteria: SearchAttachmentDto = {
      filePath: 'http://test.com',
      type: AttachmentType.IMAGE,
      description: '1',
    };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of([]));
    await socialController.searchAttachments(searchCriteria, mockUser as any);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.FIND_MANY },
      { criteria: searchCriteria, appId: mockUser.appId }
    );
  });

  it('should update a post', async () => {
    const id = '1';
    const updatePostDto: UpdatePostDto = {
      /* mock data */
    };
    const mockUser = {
      userId: 'user-1',
      email: 'test@test.com',
      exp: 123,
      iat: 123,
      name: 'Test',
      profileId: 'profile-1',
    };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id }));
    await socialController.updatePost(id, mockUser, updatePostDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.UPDATE },
      {
        id,
        data: updatePostDto,
        userId: 'user-1',
        profileId: 'profile-1',
      }
    );
  });

  it('should update a comment', async () => {
    const id = '1';
    const updateCommentDto: UpdateCommentDto = {
      content: 'Test Content',
      userId: '1',
      postId: '1',
    };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ id: 'comment-1', post: { id: '1' } })
    );
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of({ id: '1' }));
    await socialController.updateComment(id, mockUser as any, updateCommentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.UPDATE },
      { id, update: updateCommentDto, userId: mockUser.userId, profileId: mockUser.profileId }
    );
  });

  it('should update an attachment', async () => {
    const id = '1';
    const updateAttachmentDto: UpdateAttachmentDto = {
      url: 'http://test.com',
      type: AttachmentType.IMAGE,
    };
    await socialController.updateAttachment(id, mockUser as any, updateAttachmentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.UPDATE },
      {
        id,
        update: updateAttachmentDto,
        actor: {
          userId: mockUser.userId,
          profileId: mockUser.profileId,
          appId: mockUser.appId,
        },
      }
    );
  });

  it('should delete a post', async () => {
    const id = '1';
    const mockUser = {
      userId: 'user-1',
      email: 'test@test.com',
      exp: 123,
      iat: 123,
      name: 'Test',
      profileId: 'profile-1',
    };
    await socialController.deletePost(id, mockUser);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.DELETE },
      { id, userId: 'user-1', profileId: 'profile-1' }
    );
  });

  it('should delete a comment', async () => {
    const id = '1';
    await socialController.deleteComment(id, mockUser as any);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.FIND },
      { id, viewerProfileId: mockUser.profileId }
    );
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.DELETE },
      { id, userId: mockUser.userId, profileId: mockUser.profileId }
    );
  });

  it('should delete an attachment', async () => {
    const id = '1';
    jest.spyOn(clientProxy, 'send').mockReturnValueOnce(
      of({ id, deleted: true }) as any
    );
    await expect(
      socialController.deleteAttachment(id, mockUser as any)
    ).resolves.toEqual({ id, deleted: true });
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.DELETE },
      {
        id,
        actor: {
          userId: mockUser.userId,
          profileId: mockUser.profileId,
          appId: mockUser.appId,
        },
      }
    );
  });

  it('uses the owning comment update contract and invalidates after a void result', async () => {
    const sender = {
      send: jest.fn((pattern) => {
        if (pattern.cmd === CommentCommands.FIND)
          return of({ id: 'comment-1', post: { id: 'post-1' } });
        if (pattern.cmd === PostCommands.FIND) return of({ id: 'post-1' });
        return of(undefined);
      }),
    };
    const gateway = {
      broadcastSocialContentInvalidated: jest.fn(),
      broadcastCommentUpdated: jest.fn(),
    };
    const controller = new SocialController(sender as any, gateway as any);
    await controller.updateComment('comment-1', mockUser as any, {
      content: 'edited',
    });
    expect(sender.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.UPDATE },
      { id: 'comment-1', update: { content: 'edited' }, userId: mockUser.userId, profileId: mockUser.profileId }
    );
    expect(gateway.broadcastSocialContentInvalidated).toHaveBeenCalledTimes(1);
  });

  it.each(['client-interface', 'local-hub'])('uses the verified %s context and path profile for guardian content', async (appId) => {
    const user = { ...mockUser, appId, appScope: 'forged-app', headers: { 'x-ot-appscope': 'business-site' } } as any;

    await socialController.listGuardianPosts('dependent-profile-from-path', user);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: GuardianContentCommands.ListPosts },
      { actorUserId: mockUser.userId, targetProfileId: 'dependent-profile-from-path', appId }
    );
  });

  it('fails closed when the authenticated user has no verified guardian app context', async () => {
    await expect(socialController.listGuardianPosts('dependent-profile', { ...mockUser, appId: undefined } as any))
      .rejects.toMatchObject({ status: 403 });
    expect(clientProxy.send).not.toHaveBeenCalled();
  });

  it('keeps guardian identity and app context out of caller-controlled comment fields', async () => {
    const user = { ...mockUser, appId: 'client-interface' } as any;

    await socialController.createGuardianComment('dependent-profile-from-path', 'dependent-post-from-path', user, {
      content: 'comment', actorUserId: 'forged-actor', appId: 'business-site', postId: 'forged-post',
    } as any);

    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: GuardianContentCommands.CreateComment },
      {
        actorUserId: mockUser.userId, targetProfileId: 'dependent-profile-from-path', appId: 'client-interface',
        data: { content: 'comment', actorUserId: 'forged-actor', appId: 'business-site', postId: 'dependent-post-from-path' },
      }
    );
  });

  it.each([
    [CreateGuardianPostDto, { title: 'title', content: 'body', appId: 'business-site' }],
    [CreateGuardianCommentDto, { content: 'body', userId: 'forged-user', postId: 'forged-post' }],
  ])('rejects guardian body fields outside the explicit DTO allowlist', async (metatype, body) => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

    await expect(pipe.transform(body, { type: 'body', metatype: metatype as any }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
