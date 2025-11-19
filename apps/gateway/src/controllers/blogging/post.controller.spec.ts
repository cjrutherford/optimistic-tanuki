import { Test, TestingModule } from '@nestjs/testing';
import { PostController } from './post.controller';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { of } from 'rxjs';
import { PermissionsGuard } from '../../guards/permissions.guard';

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
