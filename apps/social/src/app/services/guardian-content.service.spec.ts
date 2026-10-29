import { of } from 'rxjs';
import { throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import {
  AssetCommands,
  AuthCommands,
  ProfileCommands,
} from '@optimistic-tanuki/constants';
import { Attachment } from '../../entities/attachment.entity';
import { GuardianContentAudit } from '../../entities/guardian-content-audit.entity';
import { GuardianPublishedAssetGrant } from '../../entities/guardian-published-asset-grant.entity';
import { Post } from '../../entities/post.entity';
import { Comment } from '../../entities/comment.entity';
import * as assetReferenceUtil from './guardian-published-asset-reference.util';
import { GuardianContentService } from './guardian-content.service';
import { PostService } from './post.service';

describe('GuardianContentService', () => {
  const profile = {
    id: 'dependent-profile',
    userId: 'dependent-user',
    appScope: 'client-interface',
  };
  let profileClient: { send: jest.Mock };
  let authClient: { send: jest.Mock };
  let postRepo: any;
  let commentRepo: any;
  let attachmentRepo: any;
  let auditRepo: any;
  let grantRepo: any;
  let manager: any;
  let dataSource: any;
  let service: GuardianContentService;
  let postService: {
    latchPrivateAssetReferences: jest.Mock;
    latchPostAndCommentAssetReferences: jest.Mock;
    latchCommentAssetContent: jest.Mock;
  };
  let transactionRollbackCount: number;
  const stagedAssetId = '123e4567-e89b-42d3-a456-426614174000';

  beforeEach(() => {
    transactionRollbackCount = 0;
    profileClient = { send: jest.fn(() => of(profile)) };
    authClient = { send: jest.fn(() => of({ allowed: true })) };
    postRepo = {
      create: jest.fn((row) => ({ id: 'post-1', ...row })),
      save: jest.fn(async (row) => row),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => ({ affected: 1 })),
      remove: jest.fn(async (row) => row),
    };
    auditRepo = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
    };
    grantRepo = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
    };
    commentRepo = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => row),
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
      update: jest.fn(async () => undefined),
      delete: jest.fn(async () => ({ affected: 0 })),
      remove: jest.fn(async (row) => row),
    };
    attachmentRepo = { delete: jest.fn(async () => ({ affected: 0 })) };
    postService = {
      latchPrivateAssetReferences: jest.fn(async () => undefined),
      latchPostAndCommentAssetReferences: jest.fn(async () => undefined),
      latchCommentAssetContent: jest.fn(async () => undefined),
      getAssetForGuardianPublication: jest.fn(),
    };
    manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Post) return postRepo;
        if (entity === GuardianContentAudit) return auditRepo;
        if (entity === GuardianPublishedAssetGrant) return grantRepo;
        if (entity === Attachment) return attachmentRepo;
        return commentRepo;
      }),
    };
    dataSource = {
      transaction: jest.fn(async (work) => {
        try {
          return await work(manager);
        } catch (error) {
          transactionRollbackCount += 1;
          throw error;
        }
      }),
      getRepository: jest.fn((entity) =>
        entity === Post
          ? postRepo
          : entity === GuardianPublishedAssetGrant
          ? grantRepo
          : commentRepo
      ),
    };
    service = new GuardianContentService(
      dataSource,
      profileClient as any,
      authClient as any,
      postService as any
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('derives the dependent owner and writes metadata only for a guardian create', async () => {
    const result = await service.createPost({
      actorUserId: 'guardian-user',
      targetProfileId: 'dependent-profile',
      appId: 'client-interface',
      data: { title: 'A post', content: '<p>Hello</p>' },
    });

    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get },
      { id: 'dependent-profile' }
    );
    expect(authClient.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.AuthorizeGuardianContentOperation },
      {
        actorUserId: 'guardian-user',
        dependentUserId: 'dependent-user',
        appId: 'client-interface',
        operation: 'content.manage',
      }
    );
    expect(result).toEqual(
      expect.objectContaining({
        userId: 'dependent-user',
        profileId: 'dependent-profile',
        appScope: 'client-interface',
      })
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'guardian-user',
        dependentUserId: 'dependent-user',
        dependentProfileId: 'dependent-profile',
        resourceType: 'post',
        resourceId: 'post-1',
        operation: 'create',
        changedFields: ['content', 'title'],
      })
    );
    expect(JSON.stringify(auditRepo.save.mock.calls[0][0])).not.toContain(
      'Hello'
    );
    expect(grantRepo.save).not.toHaveBeenCalled();
  });

  it('grants only explicitly listed staged assets referenced by the resulting guardian post', async () => {
    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    postService.getAssetForGuardianPublication.mockResolvedValue({
      id: stagedAssetId,
      profileId: profile.id,
      originKind: 'guardian-staged',
      originProfileId: profile.id,
      originAppId: 'client-interface',
      audienceRestrictions: [
        {
          type: 'guardian-staged',
          profileId: profile.id,
          appId: 'client-interface',
        },
      ],
    });

    await service.createPost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      data: {
        title: 'A post',
        content: `<p><img src="/api/asset/${stagedAssetId}"></p>`,
        publishAssetIds: [stagedAssetId],
      },
    });

    expect(grantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: stagedAssetId,
        resourceType: 'post',
        resourceId: 'post-1',
        dependentProfileId: profile.id,
        appId: 'client-interface',
        actorUserId: 'guardian-user',
      })
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'post',
        resourceId: 'post-1',
        operation: 'create',
        changedFields: expect.arrayContaining(['publishAssetIds']),
      })
    );
    expect(grantRepo.save.mock.invocationCallOrder[0]).toBeLessThan(
      auditRepo.save.mock.invocationCallOrder[0]
    );
  });

  it('rejects publication IDs that are absent from resulting content, duplicated, or not staged for this profile/app', async () => {
    const content = `<p><img src="/api/asset/${stagedAssetId}"></p>`;
    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set());
    await expect(
      service.createPost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        data: { title: 'A post', content, publishAssetIds: [stagedAssetId] },
      })
    ).rejects.toThrow(
      'Every published asset must be referenced by the resource'
    );
    expect(postService.getAssetForGuardianPublication).not.toHaveBeenCalled();

    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    await expect(
      service.createPost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        data: {
          title: 'A post',
          content,
          publishAssetIds: [stagedAssetId, stagedAssetId],
        },
      })
    ).rejects.toThrow('Published asset identifiers must be unique');
    expect(postService.getAssetForGuardianPublication).not.toHaveBeenCalled();

    postService.getAssetForGuardianPublication.mockResolvedValue({
      id: stagedAssetId,
      profileId: 'another-profile',
      originKind: 'guardian-staged',
      originProfileId: 'another-profile',
      originAppId: 'local-hub',
      audienceRestrictions: [
        {
          type: 'guardian-staged',
          profileId: 'another-profile',
          appId: 'local-hub',
        },
      ],
    });
    await expect(
      service.createPost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        data: { title: 'A post', content, publishAssetIds: [stagedAssetId] },
      })
    ).rejects.toThrow('Asset is not staged for this dependent and application');
    expect(grantRepo.save).not.toHaveBeenCalled();
  });

  it('rolls back the resource and grant together if the guardian audit write fails', async () => {
    const pendingGrants: unknown[] = [];
    const committedGrants: unknown[] = [];
    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    postService.getAssetForGuardianPublication.mockResolvedValue({
      id: stagedAssetId,
      profileId: profile.id,
      originKind: 'guardian-staged',
      originProfileId: profile.id,
      originAppId: 'client-interface',
      audienceRestrictions: [
        {
          type: 'guardian-staged',
          profileId: profile.id,
          appId: 'client-interface',
        },
      ],
    });
    grantRepo.save.mockImplementation(async (row) => {
      pendingGrants.push(row);
      return row;
    });
    auditRepo.save.mockRejectedValueOnce(new Error('audit unavailable'));
    dataSource.transaction.mockImplementation(async (work) => {
      try {
        const result = await work(manager);
        committedGrants.push(...pendingGrants);
        return result;
      } catch (error) {
        pendingGrants.length = 0;
        transactionRollbackCount += 1;
        throw error;
      }
    });

    await expect(
      service.createPost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        data: {
          title: 'A post',
          content: `<img src="/api/asset/${stagedAssetId}">`,
          publishAssetIds: [stagedAssetId],
        },
      })
    ).rejects.toThrow('audit unavailable');
    expect(transactionRollbackCount).toBe(1);
    expect(committedGrants).toEqual([]);
  });

  it('latches guardian-created post media before persisting a followers-only post', async () => {
    await service.createPost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      data: {
        title: 'A post',
        content: '<img src="/api/asset/asset-id">',
        visibility: 'followers',
      },
    });

    expect(postService.latchPrivateAssetReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: profile.id,
        userId: profile.userId,
        visibility: 'followers',
        content: expect.stringContaining('/api/asset/asset-id'),
      }),
      expect.any(Object)
    );
    expect(
      postService.latchPrivateAssetReferences.mock.invocationCallOrder[0]
    ).toBeLessThan(postRepo.save.mock.invocationCallOrder[0]);
  });

  it('runs the real post audience latch for explicit guardian post publication', async () => {
    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchPrivateAssetReferences.mockImplementation(
      actualPostService.latchPrivateAssetReferences.bind(actualPostService)
    );
    postService.getAssetForGuardianPublication.mockImplementation(
      actualPostService.getAssetForGuardianPublication.bind(actualPostService)
    );

    await service.createPost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      data: {
        title: 'Public post',
        content: `<img src="/api/asset/${stagedAssetId}">`,
        publishAssetIds: [stagedAssetId],
      },
    });
    expect(rpc.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.RETRIEVE },
      { id: stagedAssetId }
    );
    expect(grantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: stagedAssetId, resourceType: 'post' })
    );
    await expect(
      actualPostService.latchPrivateAssetReferences({
        profileId: profile.id,
        appScope: 'client-interface',
        visibility: 'public',
        content: `<img src="/api/asset/${stagedAssetId}">`,
      })
    ).rejects.toThrow(RpcException);
    rpc.send.mockImplementation((pattern: any, payload: any) =>
      of(
        pattern.cmd === AssetCommands.RETRIEVE
          ? {
              id: stagedAssetId,
              profileId: profile.id,
              originKind: 'guardian-staged',
              originProfileId: profile.id,
              originAppId: 'client-interface',
              audienceRestrictions: [
                {
                  type: 'guardian-staged',
                  profileId: profile.id,
                  appId: 'client-interface',
                },
                { type: 'owner', profileId: profile.id },
              ],
              audienceCommunityIds: [],
            }
          : payload
      )
    );
    await expect(
      actualPostService.latchPrivateAssetReferences(
        {
          profileId: profile.id,
          appScope: 'client-interface',
          visibility: 'public',
          content: `<img src="/api/asset/${stagedAssetId}">`,
        },
        {
          dependentProfileId: profile.id,
          appId: 'client-interface',
          allowedAssetIds: new Set([stagedAssetId]),
        }
      )
    ).rejects.toThrow('Asset audience is narrower than this post audience');
  });

  it('denies unselected staged media on new public guardian posts and comments before writes', async () => {
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchPrivateAssetReferences.mockImplementation(
      actualPostService.latchPrivateAssetReferences.bind(actualPostService)
    );
    postService.latchCommentAssetContent.mockImplementation(
      actualPostService.latchCommentAssetContent.bind(actualPostService)
    );
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'public',
      content: 'parent',
    };
    postRepo.findOne.mockResolvedValue(parent);

    for (const mutate of [
      () =>
        service.createPost({
          actorUserId: 'guardian-user',
          targetProfileId: profile.id,
          appId: 'client-interface',
          data: {
            title: 'A post',
            content: `<img src="/api/asset/${stagedAssetId}">`,
          },
        }),
      () =>
        service.createComment({
          actorUserId: 'guardian-user',
          targetProfileId: profile.id,
          appId: 'client-interface',
          data: {
            postId: parent.id,
            content: `<img src="/api/asset/${stagedAssetId}">`,
          },
        }),
    ]) {
      let caught: unknown;
      try {
        await mutate();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(RpcException);
      expect((caught as RpcException).getError()).toEqual(
        expect.objectContaining({
          statusCode: 403,
          code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
        })
      );
    }

    expect(postRepo.save).not.toHaveBeenCalled();
    expect(commentRepo.save).not.toHaveBeenCalled();
    expect(grantRepo.save).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('denies newly referenced staged media on guardian post and comment updates before writes', async () => {
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchPostAndCommentAssetReferences.mockImplementation(
      actualPostService.latchPostAndCommentAssetReferences.bind(
        actualPostService
      )
    );
    postService.latchCommentAssetContent.mockImplementation(
      actualPostService.latchCommentAssetContent.bind(actualPostService)
    );
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'public',
      content: 'parent',
    };
    const existingComment = {
      id: 'comment-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      post: parent,
      content: 'old comment',
    };
    postRepo.findOne.mockResolvedValue(parent);
    commentRepo.findOne.mockResolvedValue(existingComment);

    const mutations = [
      () =>
        service.updatePost({
          actorUserId: 'guardian-user',
          targetProfileId: profile.id,
          appId: 'client-interface',
          id: parent.id,
          data: { content: `<img src="/api/asset/${stagedAssetId}">` },
        }),
      () =>
        service.updateComment({
          actorUserId: 'guardian-user',
          targetProfileId: profile.id,
          appId: 'client-interface',
          id: existingComment.id,
          data: { content: `<img src="/api/asset/${stagedAssetId}">` },
        }),
    ];
    for (const mutate of mutations) {
      let caught: unknown;
      try {
        await mutate();
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(RpcException);
      expect((caught as RpcException).getError()).toEqual(
        expect.objectContaining({
          statusCode: 403,
          code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
        })
      );
    }

    expect(postRepo.update).not.toHaveBeenCalled();
    expect(commentRepo.update).not.toHaveBeenCalled();
    expect(grantRepo.save).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('preserves exact existing grants when guardian text edits retain their staged media', async () => {
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchPostAndCommentAssetReferences.mockImplementation(
      actualPostService.latchPostAndCommentAssetReferences.bind(
        actualPostService
      )
    );
    postService.latchCommentAssetContent.mockImplementation(
      actualPostService.latchCommentAssetContent.bind(actualPostService)
    );
    const image = `<img src="/api/asset/${stagedAssetId}">`;
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'public',
      content: image,
    };
    const existingComment = {
      id: 'comment-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      post: parent,
      content: image,
    };
    grantRepo.find.mockResolvedValue([
      { assetId: stagedAssetId, resourceType: 'post', resourceId: parent.id },
      {
        assetId: stagedAssetId,
        resourceType: 'comment',
        resourceId: existingComment.id,
      },
    ]);
    postRepo.findOne.mockResolvedValue(parent);
    commentRepo.findOne.mockResolvedValue(existingComment);

    await service.updatePost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      id: parent.id,
      data: { content: `${image}<p>edited</p>` },
    });
    await service.updateComment({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      id: existingComment.id,
      data: { content: `${image}<p>edited</p>` },
    });

    expect(postRepo.update).toHaveBeenCalledWith(
      parent.id,
      expect.objectContaining({
        content: expect.stringContaining('/api/asset/'),
      })
    );
    expect(commentRepo.update).toHaveBeenCalledWith(
      existingComment.id,
      expect.objectContaining({
        content: expect.stringContaining('/api/asset/'),
      })
    );
    expect(grantRepo.save).not.toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledTimes(2);
  });

  it('uses each child comment grant during guardian parent edits and deletion', async () => {
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'public',
      content: 'parent',
    };
    const child = {
      id: 'comment-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      post: parent,
      content: `<img src="/api/asset/${stagedAssetId}">`,
    };
    commentRepo.find.mockResolvedValue([child]);
    grantRepo.find.mockImplementation(async ({ where }) =>
      where.resourceType === 'comment' && where.resourceId === child.id
        ? [
            {
              assetId: stagedAssetId,
              resourceType: 'comment',
              resourceId: child.id,
            },
          ]
        : []
    );
    postRepo.findOne.mockResolvedValue(parent);
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      commentRepo,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchPostAndCommentAssetReferences.mockImplementation(
      actualPostService.latchPostAndCommentAssetReferences.bind(
        actualPostService
      )
    );

    await service.updatePost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      id: parent.id,
      data: { title: 'Edited parent' },
    });
    expect(postRepo.update).toHaveBeenCalledWith(
      parent.id,
      expect.objectContaining({ title: 'Edited parent' })
    );
    expect(grantRepo.find).toHaveBeenCalledWith({
      where: expect.objectContaining({
        resourceType: 'comment',
        resourceId: child.id,
      }),
    });

    await service.deletePost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      id: parent.id,
    });
    expect(commentRepo.delete).toHaveBeenCalledWith({
      post: { id: parent.id },
    });
    expect(postRepo.delete).toHaveBeenCalledWith(parent.id);
  });

  it('denies parent edits and deletion when child staged media has no exact comment grant', async () => {
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'public',
      content: 'parent',
    };
    commentRepo.find.mockResolvedValue([
      {
        id: 'comment-1',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        post: parent,
        content: `<img src="/api/asset/${stagedAssetId}">`,
      },
    ]);
    postRepo.findOne.mockResolvedValue(parent);
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      commentRepo,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchPostAndCommentAssetReferences.mockImplementation(
      actualPostService.latchPostAndCommentAssetReferences.bind(
        actualPostService
      )
    );

    await expect(
      service.updatePost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        id: parent.id,
        data: { title: 'Edited parent' },
      })
    ).rejects.toThrow(RpcException);
    await expect(
      service.deletePost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        id: parent.id,
      })
    ).rejects.toThrow(RpcException);

    expect(postRepo.update).not.toHaveBeenCalled();
    expect(commentRepo.delete).not.toHaveBeenCalled();
    expect(postRepo.delete).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('runs the real comment audience latch for explicit guardian comment publication', async () => {
    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    postRepo.findOne.mockResolvedValue({
      id: 'post-1',
      profileId: profile.id,
      appScope: 'client-interface',
      userId: profile.userId,
      communityId: null,
      visibility: 'followers',
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
    });
    const rpc = {
      send: jest.fn((pattern, payload) =>
        of(
          pattern.cmd === AssetCommands.RETRIEVE
            ? {
                id: stagedAssetId,
                profileId: profile.id,
                originKind: 'guardian-staged',
                originProfileId: profile.id,
                originAppId: 'client-interface',
                audienceRestrictions: [
                  {
                    type: 'guardian-staged',
                    profileId: profile.id,
                    appId: 'client-interface',
                  },
                ],
                audienceCommunityIds: [],
              }
            : payload
        )
      ),
    };
    const actualPostService = new PostService(
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { find: async () => [] } as any,
      { findOne: async () => null } as any,
      rpc as any
    );
    postService.latchCommentAssetContent.mockImplementation(
      actualPostService.latchCommentAssetContent.bind(actualPostService)
    );
    postService.getAssetForGuardianPublication.mockImplementation(
      actualPostService.getAssetForGuardianPublication.bind(actualPostService)
    );

    await service.createComment({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      data: {
        postId: 'post-1',
        content: `<img src="/api/asset/${stagedAssetId}">`,
        publishAssetIds: [stagedAssetId],
      },
    });
    expect(rpc.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.RETRIEVE },
      { id: stagedAssetId }
    );
    expect(rpc.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_AUDIENCE_RESTRICTIONS },
      expect.objectContaining({ id: stagedAssetId })
    );
    expect(grantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: stagedAssetId,
        resourceType: 'comment',
      })
    );
  });

  it('latches the old child-comment audience before a guardian makes its post public', async () => {
    postRepo.findOne.mockResolvedValue({
      id: 'post-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'followers',
      content: 'old',
    });

    await service.updatePost({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      id: 'post-1',
      data: { visibility: 'public' },
    });

    expect(
      postService.latchPostAndCommentAssetReferences
    ).toHaveBeenCalledTimes(1);
    expect(postService.latchPostAndCommentAssetReferences).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'followers', id: 'post-1' }),
      expect.any(Object)
    );
    expect(
      postService.latchPostAndCommentAssetReferences.mock.invocationCallOrder[0]
    ).toBeLessThan(postRepo.update.mock.invocationCallOrder[0]);
  });

  it('latches guardian-created comment media before saving the comment', async () => {
    const parent = {
      id: 'post-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'followers',
      content: 'parent',
    };
    postRepo.findOne.mockResolvedValue(parent);

    await service.createComment({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      data: { postId: parent.id, content: '<img src="/api/asset/asset-id">' },
    });

    expect(postService.latchCommentAssetContent).toHaveBeenCalledWith(
      expect.stringContaining('/api/asset/asset-id'),
      parent,
      profile.id,
      expect.any(Object)
    );
    expect(
      postService.latchCommentAssetContent.mock.invocationCallOrder[0]
    ).toBeLessThan(commentRepo.save.mock.invocationCallOrder[0]);
  });

  it('accepts explicit publication IDs on guardian comment creation and records the grant with its audit', async () => {
    jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    postService.getAssetForGuardianPublication.mockResolvedValue({
      id: stagedAssetId,
      profileId: profile.id,
      originKind: 'guardian-staged',
      originProfileId: profile.id,
      originAppId: 'client-interface',
      audienceRestrictions: [
        {
          type: 'guardian-staged',
          profileId: profile.id,
          appId: 'client-interface',
        },
      ],
    });
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      visibility: 'public',
      content: 'parent',
    };
    postRepo.findOne.mockResolvedValue(parent);
    commentRepo.create.mockImplementationOnce((row) => ({
      id: 'comment-1',
      ...row,
    }));

    await service.createComment({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
      data: {
        postId: parent.id,
        content: `<img src="/api/asset/${stagedAssetId}">`,
        publishAssetIds: [stagedAssetId],
      },
    });

    expect(grantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: stagedAssetId,
        resourceType: 'comment',
        resourceId: 'comment-1',
        dependentProfileId: profile.id,
        appId: 'client-interface',
        actorUserId: 'guardian-user',
      })
    );
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'comment',
        resourceId: 'comment-1',
        operation: 'create',
        changedFields: expect.arrayContaining(['publishAssetIds']),
      })
    );
  });

  it('invalidates the exact stored publication grant as soon as the current resource drops its asset reference', async () => {
    const resourceId = '223e4567-e89b-42d3-a456-426614174000';
    const grant = {
      assetId: stagedAssetId,
      resourceType: 'post',
      resourceId,
      dependentProfileId: '323e4567-e89b-42d3-a456-426614174000',
      appId: 'client-interface',
    };
    grantRepo.findOne.mockResolvedValue(grant);
    postRepo.findOne.mockResolvedValue({
      id: resourceId,
      profileId: '323e4567-e89b-42d3-a456-426614174000',
      appScope: 'client-interface',
      visibility: 'public',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      content: `<img src="/api/asset/${stagedAssetId}">`,
    });
    const references = jest
      .spyOn(assetReferenceUtil, 'guardianPublishedAssetReferences')
      .mockReturnValue(new Set([stagedAssetId]));
    const input = {
      assetId: stagedAssetId,
      appId: 'client-interface',
      dependentProfileId: '323e4567-e89b-42d3-a456-426614174000',
      resourceType: 'post' as const,
      resourceId,
      viewerProfileId: undefined,
      viewerUserId: undefined,
    };

    await expect(service.checkPublishedAssetGrant(input)).resolves.toBe(true);
    references.mockReturnValue(new Set());
    await expect(service.checkPublishedAssetGrant(input)).resolves.toBe(false);
    expect(grantRepo.findOne).toHaveBeenCalledTimes(2);
  });

  it('lists only visible, unscheduled personal posts', async () => {
    await service.listPosts({
      actorUserId: 'guardian-user',
      targetProfileId: profile.id,
      appId: 'client-interface',
    });

    const query = postRepo.find.mock.calls[0][0];
    expect(query.where).toHaveLength(2);
    for (const where of query.where) {
      expect(where).toEqual(
        expect.objectContaining({
          profileId: profile.id,
          moderationStatus: 'visible',
          isScheduled: false,
        })
      );
      expect(where.communityId).toBeDefined();
      expect(where.scheduledAt).toBeDefined();
    }
    expect(query.take).toBe(100);
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('latches assets and deletes post children by the validated id before auditing the direct post delete', async () => {
    const post = {
      id: 'post-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
      content: 'post text',
    };
    postRepo.findOne.mockResolvedValue(post);

    await expect(
      service.deletePost({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        id: 'post-1',
      })
    ).resolves.toEqual({ success: true });

    expect(postService.latchPostAndCommentAssetReferences).toHaveBeenCalledWith(
      post,
      expect.any(Object)
    );
    expect(commentRepo.delete).toHaveBeenCalledWith({ post: { id: 'post-1' } });
    expect(attachmentRepo.delete).toHaveBeenCalledWith({
      post: { id: 'post-1' },
    });
    expect(postRepo.delete).toHaveBeenCalledWith('post-1');
    expect(postRepo.remove).not.toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'post',
        resourceId: 'post-1',
        operation: 'delete',
      })
    );
  });

  it('keeps the validated comment id in the audit when TypeORM clears it during removal', async () => {
    const parent = {
      id: 'parent-post',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      communityId: null,
      moderationStatus: 'visible',
      isScheduled: false,
      scheduledAt: null,
    };
    commentRepo.findOne.mockResolvedValue({
      id: 'comment-1',
      profileId: profile.id,
      userId: profile.userId,
      appScope: 'client-interface',
      post: parent,
    });
    postRepo.findOne.mockResolvedValue(parent);
    commentRepo.remove = jest.fn(async (comment) => {
      comment.id = undefined;
      return comment;
    });

    await expect(
      service.deleteComment({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        id: 'comment-1',
      })
    ).resolves.toEqual({ success: true });

    expect(auditRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'comment',
        resourceId: 'comment-1',
        operation: 'delete',
      })
    );
  });

  it.each(['post', 'comment'] as const)(
    'keeps %s removal and audit failure inside the transaction rollback path',
    async (kind) => {
      const parent = {
        id: 'parent-post',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        communityId: null,
        moderationStatus: 'visible',
        isScheduled: false,
        scheduledAt: null,
      };
      const post = { ...parent, id: 'post-1' };
      const comment = {
        id: 'comment-1',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        post,
      };
      const entity = kind === 'post' ? post : comment;
      const expectedResourceId = entity.id;
      const repo = kind === 'post' ? postRepo : commentRepo;
      if (kind === 'post') postRepo.findOne.mockResolvedValue(post);
      else {
        commentRepo.findOne.mockResolvedValue(comment);
        postRepo.findOne.mockResolvedValue(parent);
        repo.remove = jest.fn(async (removed) => {
          removed.id = undefined;
          return removed;
        });
      }
      auditRepo.save.mockRejectedValueOnce(new Error('audit insert failed'));

      await expect(
        kind === 'post'
          ? service.deletePost({
              actorUserId: 'guardian-user',
              targetProfileId: profile.id,
              appId: 'client-interface',
              id: expectedResourceId,
            })
          : service.deleteComment({
              actorUserId: 'guardian-user',
              targetProfileId: profile.id,
              appId: 'client-interface',
              id: expectedResourceId,
            })
      ).rejects.toThrow('audit insert failed');

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(
        kind === 'post' ? postRepo.delete : commentRepo.remove
      ).toHaveBeenCalledTimes(1);
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: kind,
          resourceId: expectedResourceId,
          operation: 'delete',
        })
      );
      expect(transactionRollbackCount).toBe(1);
    }
  );

  it('rejects caller-supplied owner, actor, and scope fields before profile or database access', async () => {
    await expect(
      service.createPost({
        actorUserId: 'guardian-user',
        targetProfileId: 'dependent-profile',
        appId: 'client-interface',
        data: {
          title: 'A post',
          content: 'Hello',
          userId: 'forged-user',
          profileId: 'forged-profile',
          appScope: 'local-hub',
        },
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('Guardian content payload'),
    });
    expect(profileClient.send).not.toHaveBeenCalled();
    expect(authClient.send).not.toHaveBeenCalled();
    expect(postRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a profile from a different verified app context', async () => {
    await expect(
      service.listPosts({
        actorUserId: 'guardian-user',
        targetProfileId: 'dependent-profile',
        appId: 'local-hub',
      })
    ).rejects.toThrow(
      'Guardian content target profile does not match the verified application'
    );
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 403, code: 'GUARDIAN_CONTENT_ACCESS_DENIED' },
    new RpcException({
      statusCode: 403,
      code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
    }),
  ])(
    'preserves only the known guardian content denial as a structured 403',
    async (denial) => {
      authClient.send.mockReturnValue(throwError(() => denial));

      let caught: unknown;
      try {
        await service.listPosts({
          actorUserId: 'guardian-user',
          targetProfileId: profile.id,
          appId: 'client-interface',
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(RpcException);
      expect((caught as RpcException).getError()).toEqual({
        statusCode: 403,
        code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
        message: 'Guardian content access denied',
      });
    }
  );

  it('leaves unclassified authorization failures unchanged for 5xx handling', async () => {
    const failure = new Error('Authentication service unavailable');
    authClient.send.mockReturnValue(throwError(() => failure));

    await expect(
      service.listPosts({
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
      })
    ).rejects.toBe(failure);
  });

  it.each([
    ['hidden', { moderationStatus: 'hidden' }],
    ['scheduled', { isScheduled: true }],
  ])(
    'does not return a comment when its parent post is %s',
    async (_name, parentOverrides) => {
      const parent = {
        id: 'parent-post',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        communityId: null,
        moderationStatus: 'visible',
        isScheduled: false,
        scheduledAt: null,
        ...parentOverrides,
      };
      commentRepo.findOne.mockResolvedValue({
        id: 'comment-1',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        post: parent,
      });
      postRepo.findOne.mockResolvedValue(parent);

      await expect(
        service.getComment({
          actorUserId: 'guardian-user',
          targetProfileId: profile.id,
          appId: 'client-interface',
          id: 'comment-1',
        })
      ).rejects.toThrow(
        'Guardian comments require a visible personal post owned by the dependent'
      );

      expect(authClient.send).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    }
  );

  it.each(['getPost', 'updatePost', 'deletePost'] as const)(
    'does not allow %s to bypass post visibility eligibility',
    async (operation) => {
      postRepo.findOne.mockResolvedValue({
        id: 'post-1',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        communityId: null,
        moderationStatus: 'hidden',
        isScheduled: false,
        scheduledAt: null,
      });
      const input = {
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        id: 'post-1',
      };

      await expect(
        operation === 'getPost'
          ? service.getPost(input)
          : operation === 'updatePost'
          ? service.updatePost({ ...input, data: { title: 'updated' } })
          : service.deletePost(input)
      ).rejects.toThrow(
        'Guardian content requires a visible personal post owned by the dependent'
      );

      expect(authClient.send).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(postRepo.update).not.toHaveBeenCalled();
      expect(postRepo.remove).not.toHaveBeenCalled();
    }
  );

  it.each(['getComment', 'updateComment', 'deleteComment'] as const)(
    'does not allow %s to bypass parent post visibility eligibility',
    async (operation) => {
      const hiddenParent = {
        id: 'parent-post',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        communityId: null,
        moderationStatus: 'hidden',
        isScheduled: false,
        scheduledAt: null,
      };
      commentRepo.findOne.mockResolvedValue({
        id: 'comment-1',
        profileId: profile.id,
        userId: profile.userId,
        appScope: 'client-interface',
        post: hiddenParent,
      });
      postRepo.findOne.mockResolvedValue(hiddenParent);
      const input = {
        actorUserId: 'guardian-user',
        targetProfileId: profile.id,
        appId: 'client-interface',
        id: 'comment-1',
      };

      await expect(
        operation === 'getComment'
          ? service.getComment(input)
          : operation === 'updateComment'
          ? service.updateComment({ ...input, data: { content: 'updated' } })
          : service.deleteComment(input)
      ).rejects.toThrow(
        'Guardian comments require a visible personal post owned by the dependent'
      );

      expect(authClient.send).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    }
  );
});
