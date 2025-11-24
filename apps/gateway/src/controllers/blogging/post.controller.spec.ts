import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { PermissionsCacheService } from '../../auth/permissions-cache.service';

describe('PostController', () => {
  let controller: PostController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostController],
      providers: [
        {
          provide: ServiceTokens.BLOG_SERVICE,
          useValue: {
            send: jest.fn(),
            connect: jest.fn().mockResolvedValue(null),
            close: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
        AuthGuard,
        PermissionsGuard,
        Reflector,
        JwtService,
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({ isValid: true })),
          },
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of(true)),
          },
        },
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
    .useValue({ canActivate: () => true })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => true })
    .compile();

    controller = module.get<PostController>(PostController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
