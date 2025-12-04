import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { ICacheProvider } from '../auth/cache/cache-provider.interface';
import { ClientProxy } from '@nestjs/microservices';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let permissionsClient: any;
  let cacheService: PermissionsCacheService;
  let logger: Logger;

  beforeEach(async () => {
    permissionsClient = {
      send: jest.fn().mockReturnValue(of({})),
    };

    const module: TestingModule = await Test.createTestingModule({
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
            const cache = new Map<string, { value: boolean, timestamp: number }>();
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
          useFactory: (reflector: Reflector, permissionsClient: ClientProxy, logger: Logger, cacheService: PermissionsCacheService, profileService: ClientProxy) => {
            return new PermissionsGuard(reflector, permissionsClient, logger, cacheService, profileService);
          },
          inject: [Reflector, ServiceTokens.PERMISSIONS_SERVICE, Logger, PermissionsCacheService, ServiceTokens.PROFILE_SERVICE],
        }
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
    headers: any = {}
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
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

      const context = createMockContext({ id: 'user1' });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'User not authenticated'
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

    it('should throw ForbiddenException when permission check fails', async () => {
      jest.spyOn(permissionsClient, 'send')
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

  describe('canActivate - caching', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });
    });

    it('should use cached permission result on second call', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope (first call)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope (first call)
        .mockReturnValueOnce(of(true)) // CheckPermission (first call)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope (second call)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })); // GetByName for fullEffectiveScope (second call)

      const context1 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      // First call - should query permissions service
      await guard.canActivate(context1);
      expect(permissionsClient.send).toHaveBeenCalledTimes(3);

      // Second call - should use cache
      const context2 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await guard.canActivate(context2);
      
      // Two additional calls for GetByName (appScope and fullEffectiveScope), no CheckPermission call
      expect(permissionsClient.send).toHaveBeenCalledTimes(5);
    });

    it('should cache denied permissions', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope (first call)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope (first call)
        .mockReturnValueOnce(of(false)) // CheckPermission (first call - denied)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope (second call)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })); // GetByName for fullEffectiveScope (second call)

      const context1 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      // First call - should fail
      await expect(guard.canActivate(context1)).rejects.toThrow(
        ForbiddenException
      );

      // Second call - should use cached denial and fail immediately
      const context2 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await expect(guard.canActivate(context2)).rejects.toThrow(
        ForbiddenException
      );

      // Should have made one CheckPermission call on first, cached on second
      expect(permissionsClient.send).toHaveBeenCalledTimes(5);
    });

    it('should differentiate cache by profile, permission, and appScope', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope (user1)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope (user1)
        .mockReturnValueOnce(of(true)) // CheckPermission (user1)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName for appScope (user2)
        .mockReturnValueOnce(of({ id: 'scope1', name: 'global' })) // GetByName for fullEffectiveScope (user2)
        .mockReturnValueOnce(of(false)); // CheckPermission (user2)

      // User1 - should pass
      const context1 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );
      await guard.canActivate(context1);

      // User2 with same permission - should query service (different cache key)
      const context2 = createMockContext(
        { profileId: 'user2' },
        { 'x-ot-appscope': 'test-scope' }
      );
      await expect(guard.canActivate(context2)).rejects.toThrow(
        ForbiddenException
      );

      expect(permissionsClient.send).toHaveBeenCalledTimes(6);
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
