import { of } from 'rxjs';
import { throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { AuthCommands, ProfileCommands } from '@optimistic-tanuki/constants';
import { Attachment } from '../../entities/attachment.entity';
import { GuardianContentAudit } from '../../entities/guardian-content-audit.entity';
import { Post } from '../../entities/post.entity';
import { GuardianContentService } from './guardian-content.service';

describe('GuardianContentService', () => {
  const profile = { id: 'dependent-profile', userId: 'dependent-user', appScope: 'client-interface' };
  let profileClient: { send: jest.Mock };
  let authClient: { send: jest.Mock };
  let postRepo: any;
  let commentRepo: any;
  let attachmentRepo: any;
  let auditRepo: any;
  let manager: any;
  let dataSource: any;
  let service: GuardianContentService;
  let postService: { latchPrivateAssetReferences: jest.Mock };
  let transactionRollbackCount: number;

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
    commentRepo = {
      create: jest.fn((row) => row), save: jest.fn(async (row) => row), find: jest.fn(async () => []),
      findOne: jest.fn(async () => null), delete: jest.fn(async () => ({ affected: 0 })),
      remove: jest.fn(async (row) => row),
    };
    attachmentRepo = { delete: jest.fn(async () => ({ affected: 0 })) };
    postService = { latchPrivateAssetReferences: jest.fn(async () => undefined) };
    manager = {
      getRepository: jest.fn((entity) => entity === Post ? postRepo : entity === GuardianContentAudit ? auditRepo : entity === Attachment ? attachmentRepo : commentRepo),
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
      getRepository: jest.fn(),
    };
    service = new GuardianContentService(dataSource, profileClient as any, authClient as any, postService as any);
  });

  it('derives the dependent owner and writes metadata only for a guardian create', async () => {
    const result = await service.createPost({
      actorUserId: 'guardian-user',
      targetProfileId: 'dependent-profile',
      appId: 'client-interface',
      data: { title: 'A post', content: '<p>Hello</p>' },
    });

    expect(profileClient.send).toHaveBeenCalledWith({ cmd: ProfileCommands.Get }, { id: 'dependent-profile' });
    expect(authClient.send).toHaveBeenCalledWith({ cmd: AuthCommands.AuthorizeGuardianContentOperation }, {
      actorUserId: 'guardian-user', dependentUserId: 'dependent-user', appId: 'client-interface', operation: 'content.manage',
    });
    expect(result).toEqual(expect.objectContaining({ userId: 'dependent-user', profileId: 'dependent-profile', appScope: 'client-interface' }));
    expect(auditRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'guardian-user', dependentUserId: 'dependent-user', dependentProfileId: 'dependent-profile',
      resourceType: 'post', resourceId: 'post-1', operation: 'create', changedFields: ['content', 'title'],
    }));
    expect(JSON.stringify(auditRepo.save.mock.calls[0][0])).not.toContain('Hello');
  });

  it('lists only visible, unscheduled personal posts', async () => {
    await service.listPosts({ actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface' });

    const query = postRepo.find.mock.calls[0][0];
    expect(query.where).toHaveLength(2);
    for (const where of query.where) {
      expect(where).toEqual(expect.objectContaining({
        profileId: profile.id, moderationStatus: 'visible', isScheduled: false,
      }));
      expect(where.communityId).toBeDefined();
      expect(where.scheduledAt).toBeDefined();
    }
    expect(query.take).toBe(100);
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it('latches assets and deletes post children by the validated id before auditing the direct post delete', async () => {
    const post = {
      id: 'post-1', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
      communityId: null, moderationStatus: 'visible', isScheduled: false, scheduledAt: null, content: 'post text',
    };
    postRepo.findOne.mockResolvedValue(post);

    await expect(service.deletePost({
      actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: 'post-1',
    })).resolves.toEqual({ success: true });

    expect(postService.latchPrivateAssetReferences).toHaveBeenCalledWith(post);
    expect(commentRepo.delete).toHaveBeenCalledWith({ post: { id: 'post-1' } });
    expect(attachmentRepo.delete).toHaveBeenCalledWith({ post: { id: 'post-1' } });
    expect(postRepo.delete).toHaveBeenCalledWith('post-1');
    expect(postRepo.remove).not.toHaveBeenCalled();
    expect(auditRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: 'post', resourceId: 'post-1', operation: 'delete',
    }));
  });

  it('keeps the validated comment id in the audit when TypeORM clears it during removal', async () => {
    commentRepo.findOne.mockResolvedValue({
      id: 'comment-1', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
      post: {
        id: 'parent-post', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
        communityId: null, moderationStatus: 'visible', isScheduled: false, scheduledAt: null,
      },
    });
    commentRepo.remove = jest.fn(async (comment) => { comment.id = undefined; return comment; });

    await expect(service.deleteComment({
      actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: 'comment-1',
    })).resolves.toEqual({ success: true });

    expect(auditRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: 'comment', resourceId: 'comment-1', operation: 'delete',
    }));
  });

  it.each(['post', 'comment'] as const)('keeps %s removal and audit failure inside the transaction rollback path', async (kind) => {
    const parent = {
      id: 'parent-post', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
      communityId: null, moderationStatus: 'visible', isScheduled: false, scheduledAt: null,
    };
    const post = { ...parent, id: 'post-1' };
    const comment = { id: 'comment-1', profileId: profile.id, userId: profile.userId, appScope: 'client-interface', post };
    const entity = kind === 'post' ? post : comment;
    const expectedResourceId = entity.id;
    const repo = kind === 'post' ? postRepo : commentRepo;
    if (kind === 'post') postRepo.findOne.mockResolvedValue(post);
    else {
      commentRepo.findOne.mockResolvedValue(comment);
      repo.remove = jest.fn(async (removed) => { removed.id = undefined; return removed; });
    }
    auditRepo.save.mockRejectedValueOnce(new Error('audit insert failed'));

    await expect(kind === 'post'
      ? service.deletePost({ actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: expectedResourceId })
      : service.deleteComment({ actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: expectedResourceId })
    ).rejects.toThrow('audit insert failed');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(kind === 'post' ? postRepo.delete : commentRepo.remove).toHaveBeenCalledTimes(1);
    expect(auditRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      resourceType: kind, resourceId: expectedResourceId, operation: 'delete',
    }));
    expect(transactionRollbackCount).toBe(1);
  });

  it('rejects caller-supplied owner, actor, and scope fields before profile or database access', async () => {
    await expect(service.createPost({
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile', appId: 'client-interface',
      data: { title: 'A post', content: 'Hello', userId: 'forged-user', profileId: 'forged-profile', appScope: 'local-hub' },
    })).rejects.toMatchObject({ message: expect.stringContaining('Guardian content payload') });
    expect(profileClient.send).not.toHaveBeenCalled();
    expect(authClient.send).not.toHaveBeenCalled();
    expect(postRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a profile from a different verified app context', async () => {
    await expect(service.listPosts({ actorUserId: 'guardian-user', targetProfileId: 'dependent-profile', appId: 'local-hub' }))
      .rejects.toThrow('Guardian content target profile does not match the verified application');
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it.each([
    { statusCode: 403, code: 'GUARDIAN_CONTENT_ACCESS_DENIED' },
    new RpcException({ statusCode: 403, code: 'GUARDIAN_CONTENT_ACCESS_DENIED' }),
  ])('preserves only the known guardian content denial as a structured 403', async (denial) => {
    authClient.send.mockReturnValue(throwError(() => denial));

    let caught: unknown;
    try {
      await service.listPosts({ actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface' });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RpcException);
    expect((caught as RpcException).getError()).toEqual({
      statusCode: 403,
      code: 'GUARDIAN_CONTENT_ACCESS_DENIED',
      message: 'Guardian content access denied',
    });
  });

  it('leaves unclassified authorization failures unchanged for 5xx handling', async () => {
    const failure = new Error('Authentication service unavailable');
    authClient.send.mockReturnValue(throwError(() => failure));

    await expect(service.listPosts({
      actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface',
    })).rejects.toBe(failure);
  });

  it.each([
    ['hidden', { moderationStatus: 'hidden' }],
    ['scheduled', { isScheduled: true }],
  ])('does not return a comment when its parent post is %s', async (_name, parentOverrides) => {
    const parent = {
      id: 'parent-post', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
      communityId: null, moderationStatus: 'visible', isScheduled: false, scheduledAt: null,
      ...parentOverrides,
    };
    commentRepo.findOne.mockResolvedValue({
      id: 'comment-1', profileId: profile.id, userId: profile.userId,
      appScope: 'client-interface', post: parent,
    });
    postRepo.findOne.mockResolvedValue(parent);

    await expect(service.getComment({
      actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: 'comment-1',
    })).rejects.toThrow('Guardian comments require a visible personal post owned by the dependent');

    expect(authClient.send).not.toHaveBeenCalled();
    expect(auditRepo.save).not.toHaveBeenCalled();
  });

  it.each(['getPost', 'updatePost', 'deletePost'] as const)(
    'does not allow %s to bypass post visibility eligibility', async (operation) => {
      postRepo.findOne.mockResolvedValue({
        id: 'post-1', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
        communityId: null, moderationStatus: 'hidden', isScheduled: false, scheduledAt: null,
      });
      const input = { actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: 'post-1' };

      await expect(operation === 'getPost'
        ? service.getPost(input)
        : operation === 'updatePost'
          ? service.updatePost({ ...input, data: { title: 'updated' } })
          : service.deletePost(input)
      ).rejects.toThrow('Guardian content requires a visible personal post owned by the dependent');

      expect(authClient.send).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
      expect(postRepo.update).not.toHaveBeenCalled();
      expect(postRepo.remove).not.toHaveBeenCalled();
    }
  );

  it.each(['getComment', 'updateComment', 'deleteComment'] as const)(
    'does not allow %s to bypass parent post visibility eligibility', async (operation) => {
      const hiddenParent = {
        id: 'parent-post', profileId: profile.id, userId: profile.userId, appScope: 'client-interface',
        communityId: null, moderationStatus: 'hidden', isScheduled: false, scheduledAt: null,
      };
      commentRepo.findOne.mockResolvedValue({
        id: 'comment-1', profileId: profile.id, userId: profile.userId,
        appScope: 'client-interface', post: hiddenParent,
      });
      postRepo.findOne.mockResolvedValue(hiddenParent);
      const input = { actorUserId: 'guardian-user', targetProfileId: profile.id, appId: 'client-interface', id: 'comment-1' };

      await expect(operation === 'getComment'
        ? service.getComment(input)
        : operation === 'updateComment'
          ? service.updateComment({ ...input, data: { content: 'updated' } })
          : service.deleteComment(input)
      ).rejects.toThrow('Guardian comments require a visible personal post owned by the dependent');

      expect(authClient.send).not.toHaveBeenCalled();
      expect(auditRepo.save).not.toHaveBeenCalled();
    }
  );
});
