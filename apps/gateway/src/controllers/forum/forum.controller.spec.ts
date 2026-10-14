import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import {
  AuthCommands,
  ForumModerationCommands,
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
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { IdentityThrottlerGuard } from '../learning/identity-throttler.guard';

type HttpTestResponse = { statusCode: number; body: unknown };

function dispatchHttpRequest(
  app: INestApplication,
  path: string,
  headers: Record<string, string>
): Promise<HttpTestResponse> {
  return new Promise((resolve, reject) => {
    const expressApp = app.getHttpAdapter().getInstance();
    const req = {
      method: 'GET',
      url: path,
      originalUrl: path,
      path,
      query: {},
      headers,
      socket: {},
      get(name: string) {
        return this.headers[name.toLowerCase()];
      },
    };
    const res = {
      statusCode: 200,
      headersSent: false,
      headers: {} as Record<string, string>,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
      json(payload: unknown) {
        this.body = payload;
        this.headersSent = true;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      send(payload: unknown) {
        this.body = payload;
        this.headersSent = true;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      end(payload?: unknown) {
        this.body = payload ?? this.body;
        this.headersSent = true;
        resolve({ statusCode: this.statusCode, body: this.body });
        return this;
      },
    };

    try {
      expressApp.handle(req, res, (error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ statusCode: res.statusCode, body: res.body });
      });
    } catch (error) {
      reject(error);
    }
  });
}

describe('ForumController', () => {
  let forumController: ForumController;
  let forumClient: ClientProxy;
  let module: TestingModule;
  let app: INestApplication;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [
        Logger,
        { provide: 'GATEWAY_APP_REGISTRY', useValue: { apps: [] } },
        AuthGuard,
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
          useValue: { verifyAsync: jest.fn().mockResolvedValue({}) },
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
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => of(true) })
      .overrideGuard(IdentityThrottlerGuard)
      .useValue({ canActivate: () => of(true) })
      .compile();

    forumController = module.get<ForumController>(ForumController);
    forumClient = module.get<ClientProxy>('FORUM_SERVICE');
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('propagates acting identity when updating a forum post', async () => {
    await (forumController as any).updateForumPost(
      'post-1',
      {
        content: 'Updated content',
      },
      { userId: 'user-1', profileId: 'profile-1' },
      'client-interface'
    );

    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: ForumPostCommands.UPDATE },
      {
        id: 'post-1',
        data: { content: 'Updated content' },
        userId: 'user-1',
        profileId: 'profile-1',
        appScope: 'client-interface',
      }
    );
  });

  it('uses the header scope instead of the DTO scope when creating a topic', async () => {
    await (forumController as any).createTopic(
      { userId: 'user-1', profileId: 'profile-1' },
      { title: 'Scoped topic', appScope: 'attacker-scope' },
      'client-interface'
    );

    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: TopicCommands.CREATE },
      {
        title: 'Scoped topic',
        appScope: 'client-interface',
        userId: 'user-1',
        profileId: 'profile-1',
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
      {
        where: { appScope: 'client-interface' },
        requestingProfileId: undefined,
      }
    );
  });

  it('scopes thread and post reads to the app scope header', async () => {
    await forumController.getThreadsByTopic('topic-1', 'client-interface');
    await forumController.getPostsByThread('thread-1', 'client-interface');

    expect(forumClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: ThreadCommands.FIND_MANY },
      {
        where: { topicId: 'topic-1', appScope: 'client-interface' },
        requestingProfileId: undefined,
      }
    );
    expect(forumClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: ForumPostCommands.FIND_MANY },
      {
        where: { threadId: 'thread-1', appScope: 'client-interface' },
        requestingProfileId: undefined,
      }
    );
  });

  it('authenticates optional identity on direct reads and forwards the verified profile', async () => {
    const authService = module.get<ClientProxy>('AUTHENTICATION_SERVICE');
    (authService.send as jest.Mock).mockReturnValue(
      of({ isValid: true, emailVerified: true })
    );
    const jwt = module.get<JwtService>(JwtService);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({
      userId: 'member-user',
      profileId: 'member-profile',
    });
    const response = await dispatchHttpRequest(
      app,
      '/forum/post/forum-post-1',
      {
        authorization: 'Bearer member-token',
        'x-ot-appscope': 'client-interface',
      }
    );

    expect(response.statusCode).toBe(200);
    expect(authService.send).toHaveBeenCalledWith(
      { cmd: AuthCommands.Validate },
      { token: 'member-token', userId: 'member-user' }
    );
    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: ForumPostCommands.FIND },
      {
        id: 'forum-post-1',
        appScope: 'client-interface',
        requestingProfileId: 'member-profile',
      }
    );
  });

  it('keeps direct reads anonymous when no credential is supplied', async () => {
    const response = await dispatchHttpRequest(
      app,
      '/forum/post/public-forum-post',
      { 'x-ot-appscope': 'client-interface' }
    );

    expect(response.statusCode).toBe(200);
    expect(
      module.get<ClientProxy>('AUTHENTICATION_SERVICE').send
    ).not.toHaveBeenCalled();
    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: ForumPostCommands.FIND },
      {
        id: 'public-forum-post',
        appScope: 'client-interface',
        requestingProfileId: undefined,
      }
    );
  });

  it('preserves a forum-service denial for an authenticated private-post outsider', async () => {
    const authService = module.get<ClientProxy>('AUTHENTICATION_SERVICE');
    (authService.send as jest.Mock).mockReturnValue(
      of({ isValid: true, emailVerified: true })
    );
    const jwt = module.get<JwtService>(JwtService);
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({
      userId: 'outsider-user',
      profileId: 'outsider-profile',
    });
    (forumClient.send as jest.Mock).mockImplementation(() =>
      throwError(() => ({ message: 'Not found', statusCode: 404 }))
    );

    const response = await dispatchHttpRequest(
      app,
      '/forum/post/private-forum-post',
      {
        authorization: 'Bearer outsider-token',
        'x-ot-appscope': 'client-interface',
      }
    );

    expect(response.statusCode).toBe(404);

    expect(forumClient.send).toHaveBeenCalledWith(
      { cmd: ForumPostCommands.FIND },
      {
        id: 'private-forum-post',
        appScope: 'client-interface',
        requestingProfileId: 'outsider-profile',
      }
    );
  });

  it('scopes moderator report operations to the caller app scope and actor', async () => {
    const reportsRoute = (ForumController.prototype as any).getForumReports;
    const updateRoute = (ForumController.prototype as any)
      .updateForumReportStatus;

    expect(typeof reportsRoute).toBe('function');
    expect(typeof updateRoute).toBe('function');

    await (forumController as any).getForumReports('client-interface');
    await (forumController as any).updateForumReportStatus(
      'report-1',
      { status: 'reviewed', adminNotes: 'Checked' },
      { profileId: 'moderator-profile' },
      'client-interface'
    );

    expect(Reflect.getMetadata(PERMISSIONS_KEY, reportsRoute)).toEqual({
      permissions: ['forum.moderate'],
    });
    expect(Reflect.getMetadata(PERMISSIONS_KEY, updateRoute)).toEqual({
      permissions: ['forum.moderate'],
    });
    expect(forumClient.send).toHaveBeenNthCalledWith(
      1,
      { cmd: ForumModerationCommands.GET_ALL_REPORTS },
      { appScope: 'client-interface' }
    );
    expect(forumClient.send).toHaveBeenNthCalledWith(
      2,
      { cmd: ForumModerationCommands.UPDATE_REPORT_STATUS },
      {
        id: 'report-1',
        status: 'reviewed',
        adminNotes: 'Checked',
        appScope: 'client-interface',
        moderatedBy: 'moderator-profile',
      }
    );
  });

  it('rejects unsupported moderation values before forwarding them', async () => {
    await expect(
      (forumController as any).updateForumReportStatus(
        'report-1',
        { status: 'concealed' },
        { profileId: 'moderator-profile' },
        'client-interface'
      )
    ).rejects.toThrow('Unsupported report status.');
    await expect(
      (forumController as any).moderateForumThread(
        'thread-1',
        { moderationStatus: 'concealed' },
        { profileId: 'moderator-profile' },
        'client-interface'
      )
    ).rejects.toThrow('Unsupported moderation status.');
    expect(forumClient.send).not.toHaveBeenCalled();
  });
});
