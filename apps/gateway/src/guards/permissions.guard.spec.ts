import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { RoleCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { ICacheProvider } from '../auth/cache/cache-provider.interface';
import { ClientProxy } from '@nestjs/microservices';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { WORKSPACE_CONTEXT_KEY } from '../decorators/workspace-context.decorator';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let permissionsClient: any;
  let cacheService: PermissionsCacheService;
  let logger: Logger;
  let module: TestingModule;

  beforeEach(async () => {
    permissionsClient = {
      send: jest.fn().mockReturnValue(of({})),
    };

    module = await Test.createTestingModule({
      providers: [
        Reflector,
        Logger,
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: permissionsClient,
        },
        {
          provide: 'ICacheProvider', // Use a string token for the interface
          useFactory: () => {
            const cache = new Map<
              string,
              { value: boolean; timestamp: number }
            >();
            return {
              get: jest.fn(async (key: string) => {
                const entry = cache.get(key);
                if (!entry) return null;
                // Simple TTL check for testing
                if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
                  cache.delete(key);
                  return null;
                }
                return entry.value;
              }),
              set: jest.fn(async (key: string, value: boolean) => {
                cache.set(key, { value, timestamp: Date.now() });
              }),
              deletePattern: jest.fn(async (pattern: string) => {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                for (const key of cache.keys()) {
                  if (regex.test(key)) {
                    cache.delete(key);
                  }
                }
              }),
              clear: jest.fn(async () => {
                cache.clear();
              }),
            };
          },
        },
        {
          provide: PermissionsCacheService,
          useFactory: (provider: ICacheProvider) => {
            return new PermissionsCacheService(provider);
          },
          inject: ['ICacheProvider'],
        },
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of([{ appScope: 'global' }])),
          },
        },
        {
          provide: PermissionsGuard,
          useFactory: (
            reflector: Reflector,
            permissionsClient: ClientProxy,
            logger: Logger,
            cacheService: PermissionsCacheService,
            profileService: ClientProxy
          ) => {
            return new PermissionsGuard(
              reflector,
              permissionsClient,
              logger,
              cacheService,
              profileService
            );
          },
          inject: [
            Reflector,
            ServiceTokens.PERMISSIONS_SERVICE,
            Logger,
            PermissionsCacheService,
            ServiceTokens.PROFILE_SERVICE,
          ],
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    cacheService = module.get<PermissionsCacheService>(PermissionsCacheService);
    logger = module.get<Logger>(Logger);

    cacheService.clear();
    jest.clearAllMocks();
  });

  const createMockContext = (
    user: any,
    headers: any = {},
    extras: Partial<
      Record<'params' | 'body' | 'query' | 'workspaceContext', any>
    > = {}
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
          params: extras.params || {},
          body: extras.body || {},
          query: extras.query || {},
          workspaceContext: extras.workspaceContext,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  };

  describe('canActivate - no permissions required', () => {
    it('should return true when no permissions are required', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const context = createMockContext({ profileId: 'user1' });
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('canActivate - authentication checks', () => {
    it('should throw ForbiddenException when user is not authenticated', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });

      const context = createMockContext(null);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not authenticated'
      );
    });

    it('should throw ForbiddenException when user has no profileId', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });

      // Mock ProfileService to return empty list so fallback fails
      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(of([]));

      const context = createMockContext(
        { id: 'user1' },
        { 'x-ot-appscope': 'global' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User profile required for this action'
      );
    });
  });

  describe('canActivate - app scope checks', () => {
    it('should throw ForbiddenException when x-ot-appscope header is missing', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });

      const context = createMockContext({ profileId: 'user1' }, {});

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'App scope header (x-ot-appscope) is required'
      );
    });

    it('should throw ForbiddenException when app scope is not found', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });

      permissionsClient.send.mockReturnValue(of(null));

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'invalid-scope' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'App scope not found: invalid-scope'
      );
    });
  });

  describe('canActivate - permission checks', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });
    });

    it('defers required workspace permission checks until the workspace context guard resolves the request', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          if (key === PERMISSIONS_KEY) {
            return { permissions: ['blog.post.read'] };
          }

          if (key === WORKSPACE_CONTEXT_KEY) {
            return {
              kind: 'business-site',
              source: 'query',
              path: 'workspaceSlug',
              strict: true,
            };
          }

          return undefined;
        });

      const context = createMockContext({ userId: 'user-1' });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(permissionsClient.send).not.toHaveBeenCalled();
    });

    it('checks the resolved workspace child scope before product-scope fallback', async () => {
      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          {
            id: 'business-profile',
            appScope: 'business-site',
            userId: 'user1',
          },
        ])
      );
      permissionsClient.send
        .mockReturnValueOnce(
          of({ id: 'business-scope', name: 'business-site' })
        )
        .mockReturnValueOnce(
          of({
            id: 'workspace-scope',
            name: 'workspace:123e4567-e89b-12d3-a456-426614174000',
          })
        )
        .mockReturnValueOnce(of(true));

      await expect(
        guard.canActivate(
          createMockContext(
            { userId: 'user1', profileId: 'business-profile' },
            { 'x-ot-appscope': 'business-site' },
            {
              workspaceContext: {
                workspace: { appScope: 'business-site' },
                workspaceScope:
                  'workspace:123e4567-e89b-12d3-a456-426614174000',
              },
            }
          )
        )
      ).resolves.toBe(true);

      expect(permissionsClient.send).toHaveBeenCalledWith(
        { cmd: RoleCommands.CheckPermission },
        expect.objectContaining({
          appScopeId: 'workspace-scope',
          profileAppScope: 'workspace:123e4567-e89b-12d3-a456-426614174000',
        })
      );
    });

    it('denies a strict workspace route when its child scope lacks the capability', async () => {
      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          {
            id: 'business-profile',
            appScope: 'business-site',
            userId: 'user1',
          },
        ])
      );
      permissionsClient.send
        .mockReturnValueOnce(
          of({ id: 'business-scope', name: 'business-site' })
        )
        .mockReturnValueOnce(
          of({
            id: 'workspace-scope',
            name: 'workspace:123e4567-e89b-12d3-a456-426614174000',
          })
        )
        .mockReturnValueOnce(of(false));

      await expect(
        guard.canActivate(
          createMockContext(
            { userId: 'user1', profileId: 'business-profile' },
            { 'x-ot-appscope': 'business-site' },
            {
              workspaceContext: {
                workspace: { appScope: 'business-site' },
                workspaceScope:
                  'workspace:123e4567-e89b-12d3-a456-426614174000',
                strict: true,
              },
            }
          )
        )
      ).rejects.toThrow('Workspace permission denied');
      expect(permissionsClient.send).toHaveBeenCalledTimes(3);
    });

    it('should grant access when permission check passes', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope
        .mockReturnValueOnce(of(true)); // CheckPermission

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenCalledTimes(3);
    });

    it('should evaluate business-site catalog governance against the business-site scope permission', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['business-site.catalog.update'],
      });

      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          { id: 'global-profile', appScope: 'global', userId: 'user1' },
          {
            id: 'business-profile',
            appScope: 'business-site',
            userId: 'user1',
          },
        ])
      );

      permissionsClient.send
        .mockReturnValueOnce(
          of({ id: 'business-scope-id', name: 'business-site' })
        )
        .mockReturnValueOnce(of({ id: 'global-scope-id', name: 'global' }))
        .mockReturnValueOnce(of(false))
        .mockReturnValueOnce(of(true));

      const context = createMockContext(
        { userId: 'user1', profileId: 'global-profile' },
        { 'x-ot-appscope': 'business-site' }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenLastCalledWith(
        { cmd: 'CheckPermission:Role' },
        expect.objectContaining({
          profileId: 'business-profile',
          permission: 'business-site.catalog.update',
          profileAppScope: 'business-site',
          appScopeId: 'business-scope-id',
          checkGlobalFallback: true,
        })
      );
    });

    it('should pass a DTO-derived targetId when permission target metadata is configured', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          if (key === 'permissions') {
            return { permissions: ['test.permission'] };
          }

          if (key === 'permission-target') {
            return { source: 'body', path: 'communityId' };
          }

          return undefined;
        });

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of({ id: 'scope-global', name: 'global' }))
        .mockReturnValueOnce(of(true));

      const context = createMockContext(
        { profileId: 'user1', userId: 'user1' },
        { 'x-ot-appscope': 'test-scope' },
        { body: { communityId: 'community-123' } }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenLastCalledWith(
        { cmd: 'CheckPermission:Role' },
        expect.objectContaining({ targetId: 'community-123' })
      );
    });

    it('should throw ForbiddenException when permission check fails', async () => {
      jest
        .spyOn(permissionsClient, 'send')
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope
        .mockReturnValueOnce(of(false)); // CheckPermission

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should deny business-site catalog governance when the scoped permission is missing', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['business-site.catalog.update'],
      });

      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          { id: 'global-profile', appScope: 'global', userId: 'user1' },
          {
            id: 'business-profile',
            appScope: 'business-site',
            userId: 'user1',
          },
        ])
      );

      permissionsClient.send
        .mockReturnValueOnce(
          of({ id: 'business-scope-id', name: 'business-site' })
        )
        .mockReturnValueOnce(of({ id: 'global-scope-id', name: 'global' }))
        .mockReturnValueOnce(of(false))
        .mockReturnValueOnce(of(false));

      const context = createMockContext(
        { userId: 'user1', profileId: 'global-profile' },
        { 'x-ot-appscope': 'business-site' }
      );

      const activation = guard.canActivate(context);

      await expect(activation).rejects.toThrow(ForbiddenException);
      await expect(activation).rejects.toThrow(
        'Permission denied: business-site.catalog.update in app scope business-site'
      );
    });

    it('uses the app-scoped profile when the JWT profile belongs to another scope', async () => {
      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          { id: 'global-profile', appScope: 'global', userId: 'user-1' },
          { id: 'leads-profile', appScope: 'leads-app', userId: 'user-1' },
        ])
      );

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope-leads', name: 'leads-app' }))
        .mockReturnValueOnce(of({ id: 'scope-global', name: 'global' }))
        .mockReturnValueOnce(of(false))
        .mockReturnValueOnce(of(true));

      const context = createMockContext(
        { profileId: 'global-profile', userId: 'user-1' },
        { 'x-ot-appscope': 'leads-app' }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenLastCalledWith(
        { cmd: 'CheckPermission:Role' },
        expect.objectContaining({
          profileId: 'leads-profile',
          profileAppScope: 'leads-app',
          appScopeId: 'scope-leads',
        })
      );
    });

    it('uses the community-scoped profile when community governance runs in a non-global app scope', async () => {
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockImplementation((key: string) => {
          if (key === 'permissions') {
            return { permissions: ['community.manage'] };
          }

          return undefined;
        });

      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          { id: 'global-profile', appScope: 'global', userId: 'user-1' },
          { id: 'community-profile', appScope: 'local-hub', userId: 'user-1' },
          { id: 'forum-profile', appScope: 'forum', userId: 'user-1' },
        ])
      );

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope-community', name: 'local-hub' }))
        .mockReturnValueOnce(of({ id: 'scope-global', name: 'global' }))
        .mockReturnValueOnce(of(false))
        .mockReturnValueOnce(of(true));

      const context = createMockContext(
        { profileId: 'forum-profile', userId: 'user-1' },
        { 'x-ot-appscope': 'local-hub' },
        { params: { id: 'community-123' }, body: {}, query: {} }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenLastCalledWith(
        { cmd: 'CheckPermission:Role' },
        expect.objectContaining({
          profileId: 'community-profile',
          permission: 'community.manage',
          profileAppScope: 'local-hub',
          appScopeId: 'scope-community',
          targetId: 'community-123',
        })
      );
    });

    it('denies forum post updates when the permission only exists in another app scope', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['forum.post.update'],
      });

      const profileService = module.get<ClientProxy>(
        ServiceTokens.PROFILE_SERVICE
      );
      jest.spyOn(profileService, 'send').mockReturnValue(
        of([
          { id: 'global-profile', appScope: 'global', userId: 'user-1' },
          { id: 'forum-profile', appScope: 'forum', userId: 'user-1' },
          { id: 'social-profile', appScope: 'social', userId: 'user-1' },
        ])
      );

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope-forum', name: 'forum' }))
        .mockReturnValueOnce(of({ id: 'scope-global', name: 'global' }))
        .mockReturnValueOnce(of(false))
        .mockReturnValueOnce(of(false));

      const context = createMockContext(
        { profileId: 'social-profile', userId: 'user-1' },
        { 'x-ot-appscope': 'forum' },
        { params: { id: 'forum-post-1' } }
      );

      const activation = guard.canActivate(context);

      await expect(activation).rejects.toThrow(ForbiddenException);
      await expect(activation).rejects.toThrow(
        'Permission denied: forum.post.update in app scope forum'
      );
    });

    it('should fail if any permission check fails', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['permission1', 'permission2'],
      });

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope
        .mockReturnValueOnce(of(true)) // permission1 passes
        .mockReturnValueOnce(of(false)); // permission2 fails

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
    });
  });

  describe('canActivate - authoritative permission lookups', () => {
    const grants = new Map<string, boolean>();
    beforeEach(() => {
      grants.clear();
      jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue({ permissions: ['test.permission'] });
      const profiles = module.get<ClientProxy>(ServiceTokens.PROFILE_SERVICE);
      jest
        .spyOn(profiles, 'send')
        .mockImplementation((_pattern: any, payload: any) =>
          of([
            {
              id: payload.where.userId === 'account2' ? 'user2' : 'user1',
              appScope: 'test-scope',
            },
          ])
        );
      permissionsClient.send.mockImplementation((pattern: any, payload: any) =>
        pattern.cmd === RoleCommands.CheckPermission
          ? of(grants.get(payload.profileId) === true)
          : of({ id: 'scope1', name: payload.name })
      );
    });
    it('reloads authorization on a second request instead of reusing a grant', async () => {
      grants.set('user1', true);
      await expect(
        guard.canActivate(
          createMockContext(
            { userId: 'account1', profileId: 'user1' },
            { 'x-ot-appscope': 'test-scope' }
          )
        )
      ).resolves.toBe(true);
      grants.set('user1', false);
      await expect(
        guard.canActivate(
          createMockContext(
            { userId: 'account1', profileId: 'user1' },
            { 'x-ot-appscope': 'test-scope' }
          )
        )
      ).rejects.toThrow(ForbiddenException);
      expect(
        permissionsClient.send.mock.calls.filter(
          ([pattern]: any) => pattern.cmd === RoleCommands.CheckPermission
        )
      ).toHaveLength(2);
    });
    it('rechecks denied permissions without persisting an authoritative negative cache', async () => {
      for (let i = 0; i < 2; i++)
        await expect(
          guard.canActivate(
            createMockContext(
              { userId: 'account1', profileId: 'user1' },
              { 'x-ot-appscope': 'test-scope' }
            )
          )
        ).rejects.toThrow(ForbiddenException);
      expect(
        permissionsClient.send.mock.calls.filter(
          ([pattern]: any) => pattern.cmd === RoleCommands.CheckPermission
        )
      ).toHaveLength(2);
      expect(
        await cacheService.get('user1', 'test.permission', 'scope1')
      ).toBeNull();
    });
    it('keeps decisions bound to each selected account profile', async () => {
      grants.set('user1', true);
      await expect(
        guard.canActivate(
          createMockContext(
            { userId: 'account1', profileId: 'user1' },
            { 'x-ot-appscope': 'test-scope' }
          )
        )
      ).resolves.toBe(true);
      await expect(
        guard.canActivate(
          createMockContext(
            { userId: 'account2', profileId: 'user2' },
            { 'x-ot-appscope': 'test-scope' }
          )
        )
      ).rejects.toThrow(ForbiddenException);
      expect(
        permissionsClient.send.mock.calls
          .filter(
            ([pattern]: any) => pattern.cmd === RoleCommands.CheckPermission
          )
          .map(([, payload]: any) => payload.profileId)
      ).toEqual(['user1', 'user2']);
    });
  });

  describe('error handling', () => {
    it('should handle errors from permissions service', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope
        .mockReturnValueOnce(throwError(() => new Error('Service error'))); // CheckPermission throws

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow('Service error');
    });
  });
});
