import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { BlogPermissionGuard, BlogPermission } from './blog-permission.guard';
import { ServiceTokens } from '@optimistic-tanuki/constants';

describe('BlogPermissionGuard', () => {
  let guard: BlogPermissionGuard;
  let reflector: Reflector;
  let profileService: any;

  const createMockContext = (user: any, requiredPermissions: BlogPermission[]): ExecutionContext => {
    jest.spyOn(reflector, 'get').mockReturnValue(requiredPermissions);
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
        }),
      }),
      getHandler: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    profileService = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogPermissionGuard,
        Reflector,
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: profileService,
        },
      ],
    }).compile();

    guard = module.get<BlogPermissionGuard>(BlogPermissionGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true if no permissions are required', async () => {
      const context = createMockContext({ userId: 'user1' }, []);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if user is not authenticated', async () => {
      const context = createMockContext(null, [BlogPermission.POST]);
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('should grant access if user has required permissions (owner)', async () => {
      profileService.send.mockReturnValue(of('owner'));
      const context = createMockContext({ userId: 'user1' }, [BlogPermission.POST, BlogPermission.PROMOTE]);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should grant access if user has required permissions (poster)', async () => {
      profileService.send.mockReturnValue(of('poster'));
      const context = createMockContext({ userId: 'user1' }, [BlogPermission.POST]);
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should deny access if user does not have required permissions (poster)', async () => {
      profileService.send.mockReturnValue(of('poster'));
      const context = createMockContext({ userId: 'user1' }, [BlogPermission.PROMOTE]);
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should deny access if user has no blog role', async () => {
      profileService.send.mockReturnValue(of('none'));
      const context = createMockContext({ userId: 'user1' }, [BlogPermission.POST]);
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
