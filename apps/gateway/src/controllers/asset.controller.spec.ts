import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of } from 'rxjs';
import { ServiceTokens, AssetCommands } from '@optimistic-tanuki/constants';
import { JwtService } from '@nestjs/jwt';
import { HttpException, Logger } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ICacheProvider } from '../auth/cache/cache-provider.interface';
import { ConfigService } from '@nestjs/config';
import { Readable, Writable } from 'node:stream';

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
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'ASSETS_INTERNAL_MEDIA_URL'
                ? 'http://assets:3006'
                : key === 'ASSETS_INTERNAL_MEDIA_TOKEN'
                ? 'gateway-secret'
                : undefined
            ),
          },
        },
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

  it('maps structured asset creation failures to an http exception with status code', async () => {
    assetService.send.mockImplementation(() => {
      throw {
        error: {
          statusCode: 400,
          message: 'File validation failed',
          errors: ['File extension .exe not allowed'],
        },
      };
    });

    await expect(
      controller.createAsset({ name: 'bad' } as any)
    ).rejects.toEqual(
      expect.objectContaining({
        status: 400,
        response: {
          message: 'File validation failed',
          errors: ['File extension .exe not allowed'],
        },
      })
    );
  });

  it('should delete an asset', async () => {
    await controller.deleteAsset('1');
    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.REMOVE },
      { id: '1' }
    );
  });

  it('proxies a byte-range media response without using the TCP asset read command', async () => {
    const mockRes = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      {
        setHeader: jest.fn(),
        send: jest.fn(),
        status: jest.fn(),
      }
    ) as any;
    mockRes.status.mockReturnValue(mockRes);
    const body = Readable.toWeb(Readable.from(Buffer.from('video-bytes')));
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(body as unknown as BodyInit, {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-length': '11',
          'content-range': 'bytes 0-10/100',
          'accept-ranges': 'bytes',
        },
      })
    );

    await controller.getAssetById('1', mockRes, 'bytes=0-10');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://assets:3006/internal/media/1',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Internal-Media-Token': 'gateway-secret',
          Range: 'bytes=0-10',
        }),
      })
    );
    expect(assetService.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.READ },
      { id: '1' }
    );
    expect(mockRes.status).toHaveBeenCalledWith(206);
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
    fetchSpy.mockRestore();
  });

  it('should list assets by profile and type', async () => {
    const assets = [{ id: 'asset-1', profileId: 'profile-1', type: 'image' }];
    assetService.send.mockReturnValue(of(assets));

    const response = await controller.listAssets('profile-1', 'image' as any);

    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.LIST },
      { profileId: 'profile-1', type: 'image' }
    );
    expect(response).toEqual([
      {
        id: 'asset-1',
        profileId: 'profile-1',
        type: 'image',
        url: '/api/asset/asset-1',
      },
    ]);
  });
});
