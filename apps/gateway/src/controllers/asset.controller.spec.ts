import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ICacheProvider } from '../auth/cache/cache-provider.interface';

describe('AssetController', () => {
  let controller: AssetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ServiceTokens.AUTHENTICATION_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
        { provide: ServiceTokens.ASSETS_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: { send: jest.fn().mockResolvedValue(of({})) } },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        Logger,
        Reflector,
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
      ],
      controllers: [AssetController],
    })
    .overrideGuard(AuthGuard)
    .useValue({ canActivate: () => of(true) })
    .overrideGuard(PermissionsGuard)
    .useValue({ canActivate: () => of(true) })
    .compile();

    controller = module.get<AssetController>(AssetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
