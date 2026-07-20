import { Test, TestingModule } from '@nestjs/testing';
import { SocialController } from './social.controller';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  AttachmentCommands,
  CommentCommands,
  PostCommands,
  VoteCommands,
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
import { ProfileTelosRefreshService } from '../../app/profile-telos-refresh.service';

describe('SocialController', () => {
  let socialController: SocialController;
  let clientProxy: ClientProxy;
  let telosRefresh: { queueSourceRefresh: jest.Mock };
  let consoleLogSpy: jest.SpyInstance;
  const flushPromises = async () =>
    await new Promise((resolve) => setTimeout(resolve, 0));
  const mockUser = {
    id: '1',
    userId: '1',
    username: 'test',
    email: 'someone@somewhere.net',
    profileId: '1',
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
          provide: ProfileTelosRefreshService,
          useValue: {
            queueSourceRefresh: jest.fn(),
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
      .compile();

    socialController = module.get<SocialController>(SocialController);
    clientProxy = module.get<ClientProxy>('SOCIAL_SERVICE');
    telosRefresh = module.get(ProfileTelosRefreshService);
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
    await flushPromises();
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.CREATE },
      postDto
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: mockUser.profileId,
        namespaceKey: 'social',
      })
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
        communityId: 'community-1',
      })
    );
  });

  it('should create a vote', async () => {
    const voteDto: CreateVoteDto = {
      value: 1,
      postId: '1',
      userId: mockUser.id,
      profileId: mockUser.profileId,
    };
    await socialController.vote(mockUser, voteDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: VoteCommands.UPVOTE },
      voteDto
    );
  });

  it('should create a comment', async () => {
    const commentDto: CreateCommentDto = {
      content: 'Test Content',
      userId: mockUser.id,
      postId: '1',
      profileId: mockUser.profileId,
    };
    (clientProxy.send as jest.Mock).mockReturnValueOnce(
      of({ profileId: mockUser.profileId })
    );
    await socialController.comment(mockUser, commentDto);
    await flushPromises();
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.CREATE },
      commentDto
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: mockUser.profileId,
        namespaceKey: 'social',
      })
    );
  });

  it('should create an attachment', async () => {
    const attachmentDto: CreateAttachmentDto = {
      name: 'test-attachment',
      url: 'http://test.com',
      type: AttachmentType.IMAGE,
      size: 1024,
    };
    await socialController.attachment(mockUser, attachmentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.CREATE },
      attachmentDto
    );
  });

  it('should get a post by id', async () => {
    const id = '1';
    await socialController.getPost(id);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id }
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
    await socialController.getVote(id);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: VoteCommands.GET },
      { id }
    );
  });

  it('should find the current user vote for a post', async () => {
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
    (clientProxy.send as jest.Mock).mockReturnValueOnce(of(votes));

    const result = await socialController.findVotes(mockUser as any, {
      postId: 'post-1',
    });

    expect(result).toEqual(votes);
  });

  it('should get an attachment by id', async () => {
    const id = '1';
    await socialController.getAttachment(id);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.FIND },
      { id }
    );
  });

  it('should search posts', async () => {
    const searchCriteria: SearchPostDto = {
      title: 'Test Post',
      content: 'Test Content',
      userIds: [mockUser.id],
    };
    await socialController.searchPosts(searchCriteria);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND_MANY },
      {
        criteria: searchCriteria,
        opts: undefined,
      }
    );
  });

  it('passes viewer profile information when searching posts', async () => {
    const searchCriteria: SearchPostDto = {
      profileId: 'author-1',
    };

    await socialController.searchPosts(
      searchCriteria,
      undefined,
      mockUser as any
    );

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

  it('should search attachments', async () => {
    const searchCriteria: SearchAttachmentDto = {
      filePath: 'http://test.com',
      type: AttachmentType.IMAGE,
      description: '1',
    };
    await socialController.searchAttachments(searchCriteria);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.FIND_MANY },
      searchCriteria
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

  it('queues a TELOS refresh for the existing post owner when update returns no profileId', async () => {
    const id = 'post-1';
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(of({ id, profileId: 'profile-2' }))
      .mockReturnValueOnce(of(undefined));

    await socialController.updatePost(
      id,
      {
        ...mockUser,
        profileId: 'profile-1',
        userId: 'user-1',
      } as any,
      {}
    );

    expect(clientProxy.send).toHaveBeenNthCalledWith(
      1,
      { cmd: PostCommands.FIND },
      { id }
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-2',
        namespaceKey: 'social',
      })
    );
  });

  it('should update a comment', async () => {
    const id = '1';
    const updateCommentDto: UpdateCommentDto = {
      content: 'Test Content',
      userId: '1',
      postId: '1',
    };
    await socialController.updateComment(id, updateCommentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.UPDATE },
      { id, data: updateCommentDto }
    );
  });

  it('queues a TELOS refresh for the existing comment owner when update returns no profileId', async () => {
    const id = 'comment-1';
    const updateCommentDto: UpdateCommentDto = {
      content: 'Updated comment',
      userId: '1',
      postId: 'post-1',
    };
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(of({ id, profileId: 'profile-3', postId: 'post-1' }))
      .mockReturnValueOnce(of(undefined));

    await socialController.updateComment(id, updateCommentDto);

    expect(clientProxy.send).toHaveBeenNthCalledWith(
      1,
      { cmd: CommentCommands.FIND },
      { id }
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-3',
        namespaceKey: 'social',
      })
    );
  });

  it('should update an attachment', async () => {
    const id = '1';
    const updateAttachmentDto: UpdateAttachmentDto = {
      url: 'http://test.com',
      type: AttachmentType.IMAGE,
    };
    await socialController.updateAttachment(id, updateAttachmentDto);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.UPDATE },
      { id, data: updateAttachmentDto }
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
      { id, userId: 'user-1' }
    );
  });

  it('queues a TELOS refresh for the existing post owner when delete returns no profileId', async () => {
    const id = 'post-1';
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(of({ id, profileId: 'profile-4' }))
      .mockReturnValueOnce(of({ success: true }));

    await socialController.deletePost(id, {
      ...mockUser,
      profileId: 'profile-1',
      userId: 'user-1',
    } as any);

    expect(clientProxy.send).toHaveBeenNthCalledWith(
      1,
      { cmd: PostCommands.FIND },
      { id }
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-4',
        namespaceKey: 'social',
      })
    );
  });

  it('should delete a comment', async () => {
    const id = '1';
    await socialController.deleteComment(id);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.DELETE },
      { id }
    );
  });

  it('queues a TELOS refresh for the existing comment owner when delete returns no profileId', async () => {
    const id = 'comment-1';
    (clientProxy.send as jest.Mock)
      .mockReturnValueOnce(
        of({ id, profileId: 'profile-5', postId: 'post-1' } as any)
      )
      .mockReturnValueOnce(of({ success: true }));

    await socialController.deleteComment(id);

    expect(clientProxy.send).toHaveBeenNthCalledWith(
      1,
      { cmd: CommentCommands.FIND },
      { id }
    );
    expect(telosRefresh.queueSourceRefresh).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: 'profile-5',
        namespaceKey: 'social',
      })
    );
  });

  it('should delete an attachment', async () => {
    const id = '1';
    await socialController.deleteAttachment(id);
    expect(clientProxy.send).toHaveBeenCalledWith(
      { cmd: AttachmentCommands.DELETE },
      { id }
    );
  });
});
