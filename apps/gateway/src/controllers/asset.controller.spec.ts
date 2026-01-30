import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of } from 'rxjs';
import { ServiceTokens, AssetCommands } from '@optimistic-tanuki/constants';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ICacheProvider } from '../auth/cache/cache-provider.interface';

describe('AssetController', () => {
  let controller: AssetController;
  let assetService: any;

  beforeEach(async () => {
    assetService = {
      send: jest.fn().mockReturnValue(of({})),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ServiceTokens.AUTHENTICATION_SERVICE,
          useValue: { send: jest.fn().mockResolvedValue(of({})) },
        },
        {
          provide: ServiceTokens.ASSETS_SERVICE,
          useValue: assetService,
        },
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: { send: jest.fn().mockResolvedValue(of({})) },
        },
        { provide: JwtService, useValue: { verify: jest.fn() } },
        Logger,
        Reflector,
        {
          provide: 'ICacheProvider', // Use a string token for the interface
          useFactory: () => {
            return {
              get: jest.fn(),
              set: jest.fn(),
            };
          },
        },
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
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

  it('should create an asset', async () => {
    const createDto: any = { name: 'test' };
    await controller.createAsset(createDto);
    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      createDto
    );
  });

  it('should delete an asset', async () => {
    await controller.deleteAsset('1');
    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.REMOVE },
      { id: '1' }
    );
  });

  it('should get an asset by id', async () => {
    const mockRes = {
      setHeader: jest.fn(),
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
    } as any;
    assetService.send.mockReturnValue(of('data:image/png;base64,dGVzdA=='));

    await controller.getAssetById('1', mockRes);

    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.READ },
      { id: '1' }
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
    expect(mockRes.send).toHaveBeenCalled();
  });
});
