import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;
  let permissionsClient: any;
  let cacheService: PermissionsCacheService;
  let logger: Logger;

  beforeEach(async () => {
    permissionsClient = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsGuard,
        Reflector,
        Logger,
        PermissionsCacheService,
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: permissionsClient,
        },
      ],
    }).compile();

    guard = module.get<PermissionsGuard>(PermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    cacheService = module.get<PermissionsCacheService>(PermissionsCacheService);
    logger = module.get<Logger>(Logger);

    // Clear cache before each test
    cacheService.clear();
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
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' })) // GetByName
        .mockReturnValueOnce(of(true)); // CheckPermission

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenCalledTimes(2);
    });

    it('should throw ForbiddenException when permission check fails', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of(false));

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Permission denied: test.permission in app scope test-scope'
      );
    });

    it('should check multiple permissions and all must pass', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['permission1', 'permission2'],
      });

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of(true)) // permission1
        .mockReturnValueOnce(of(true)); // permission2

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(permissionsClient.send).toHaveBeenCalledTimes(3);
    });

    it('should fail if any permission check fails', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['permission1', 'permission2'],
      });

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
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
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of(true))
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }));

      const context1 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      // First call - should query permissions service
      await guard.canActivate(context1);
      expect(permissionsClient.send).toHaveBeenCalledTimes(2);

      // Second call - should use cache
      const context2 = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await guard.canActivate(context2);
      
      // Only one additional call for GetByName, no CheckPermission call
      expect(permissionsClient.send).toHaveBeenCalledTimes(3);
    });

    it('should cache denied permissions', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of(false))
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }));

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

      // Should have made only one CheckPermission call (cached on second)
      expect(permissionsClient.send).toHaveBeenCalledTimes(3);
    });

    it('should differentiate cache by profile, permission, and appScope', async () => {
      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of(true))
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(of(false));

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

      expect(permissionsClient.send).toHaveBeenCalledTimes(4);
    });
  });

  describe('error handling', () => {
    it('should handle errors from permissions service', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        permissions: ['test.permission'],
      });

      permissionsClient.send
        .mockReturnValueOnce(of({ id: 'scope1', name: 'test-scope' }))
        .mockReturnValueOnce(throwError(() => new Error('Service error')));

      const context = createMockContext(
        { profileId: 'user1' },
        { 'x-ot-appscope': 'test-scope' }
      );

      await expect(guard.canActivate(context)).rejects.toThrow('Service error');
    });
  });
});
