import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  ForumPostCommands,
  ThreadCommands,
  TopicCommands,
} from '@optimistic-tanuki/constants';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { ForumController } from './forum.controller';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

describe('ForumController', () => {
  let forumController: ForumController;
  let forumClient: ClientProxy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        Logger,
        {
          provide: 'FORUM_SERVICE',
          useValue: {
            send: jest.fn().mockImplementation(() => of({})),
          },
        },
        {
          provide: 'AUTHENTICATION_SERVICE',
          useValue: { send: jest.fn().mockImplementation(() => of({})) },
        },
        {
          provide: 'PERMISSIONS_SERVICE',
          useValue: { send: jest.fn().mockImplementation(() => of({})) },
        },
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue({}) },
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
      .useValue({ canActivate: () => of(true) })
      .compile();

    forumController = module.get<ForumController>(ForumController);
    forumClient = module.get<ClientProxy>('FORUM_SERVICE');
  });

  it('propagates acting identity when updating a forum post', async () => {
    await (forumController as any).updateForumPost(
      'post-1',
      {
        content: 'Updated content',
      },
      { userId: 'user-1', profileId: 'profile-1' }
    );

    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: ForumPostCommands.UPDATE },
      {
        id: 'post-1',
        data: { content: 'Updated content' },
        userId: 'user-1',
        profileId: 'profile-1',
      }
    );
  });

  it('uses the header scope instead of the DTO scope when creating a topic', async () => {
    await (forumController as any).createTopic(
      { userId: 'user-1' },
      { title: 'Scoped topic', appScope: 'attacker-scope' },
      'client-interface'
    );

    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: TopicCommands.CREATE },
      {
        title: 'Scoped topic',
        appScope: 'client-interface',
        userId: 'user-1',
      }
    );
  });

  it('rejects forum writes without an app scope header', async () => {
    await expect(
      (forumController as any).createThread(
        { userId: 'user-1' },
        { title: 'Unscoped thread', appScope: 'attacker-scope' },
        null
      )
    ).rejects.toThrow('x-ot-appscope header is required');

    expect(forumClient.send).not.toHaveBeenCalled();
  });

  it('rejects topic reads without an app scope header', async () => {
    await expect(forumController.getAllTopics(null as any)).rejects.toThrow(
      'x-ot-appscope header is required'
    );

    expect(forumClient.send).not.toHaveBeenCalled();
  });

  it('scopes topic reads to the app scope header', async () => {
    await forumController.getAllTopics('client-interface');

    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: TopicCommands.FIND_MANY },
      { where: { appScope: 'client-interface' } }
    );
  });

  it('scopes thread and post reads to the app scope header', async () => {
    await forumController.getThreadsByTopic('topic-1', 'client-interface');
    await forumController.getPostsByThread('thread-1', 'client-interface');

    expect(forumClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: ThreadCommands.FIND_MANY },
      { where: { topicId: 'topic-1', appScope: 'client-interface' } }
    );
    expect(forumClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: ForumPostCommands.FIND_MANY },
      { where: { threadId: 'thread-1', appScope: 'client-interface' } }
    );
  });
});
