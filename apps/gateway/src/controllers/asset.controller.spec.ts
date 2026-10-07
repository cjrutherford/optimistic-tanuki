import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of } from 'rxjs';
import {
  ServiceTokens,
  AssetCommands,
  ClassifiedCommands,
} from '@optimistic-tanuki/constants';
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
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({ userId: 'user-1' })),
          },
        },
        {
          provide: ServiceTokens.SOCIAL_SERVICE,
          useValue: {
            send: jest
              .fn()
              .mockReturnValue(
                of({
                  id: 'community-1',
                  appScope: 'local-hub',
                  isPrivate: false,
                })
              ),
          },
        },
        {
          provide: ServiceTokens.CLASSIFIEDS_SERVICE,
          useValue: { send: jest.fn().mockReturnValue(of([])) },
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
    const createDto: any = {
      name: 'test',
      profileId: 'profile-1',
      type: 'image',
    };
    await controller.createAsset(
      createDto,
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'local-hub'
    );
    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      createDto
    );
  });

  it('rejects HTTP sourcePath imports while preserving the trusted RPC contract', async () => {
    await expect(
      controller.createAsset(
        {
          name: 'controlled.txt',
          profileId: 'profile-1',
          sourcePath: '/tmp/controlled.txt',
        } as any,
        { userId: 'user-1', profileId: 'profile-1' } as any,
        'local-hub'
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(assetService.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.objectContaining({ sourcePath: expect.any(String) })
    );
  });

  it('allows a former member to upload into their own existing private classified', async () => {
    (controller as any).socialService.send.mockImplementation(
      (pattern: { cmd: string }) =>
        of(
          pattern.cmd === 'IS_COMMUNITY_MEMBER'
            ? false
            : { id: 'community-1', appScope: 'local-hub', isPrivate: true }
        )
    );
    (controller as any).classifiedsService.send.mockImplementation(
      (pattern: { cmd: string }) =>
        pattern.cmd === ClassifiedCommands.FIND_BY_ID
          ? of({
              id: 'classified-1',
              communityId: 'community-1',
              appScope: 'local-hub',
              userId: 'user-1',
              profileId: 'profile-1',
            })
          : of([])
    );
    assetService.send.mockReturnValue(of({ id: 'asset-1' }));

    await controller.createAsset(
      {
        name: 'replacement.png',
        profileId: 'profile-1',
        type: 'image',
        content: 'data:image/png;base64,AAA',
        fileExtension: 'png',
        communityId: 'community-1',
        classifiedAdId: 'classified-1',
      } as any,
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'local-hub'
    );

    expect((controller as any).classifiedsService.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.FIND_BY_ID },
      { id: 'classified-1', appScope: 'local-hub', requestingUserId: 'user-1' }
    );
    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.objectContaining({
        profileId: 'profile-1',
        communityId: 'community-1',
        classifiedAdId: undefined,
      })
    );
  });

  it('allows a former member to edit their own public classified without privatizing media', async () => {
    (controller as any).socialService.send.mockImplementation(
      (pattern: { cmd: string }) =>
        of(
          pattern.cmd === 'IS_COMMUNITY_MEMBER'
            ? false
            : { id: 'community-1', appScope: 'local-hub', isPrivate: false }
        )
    );
    (controller as any).classifiedsService.send.mockReturnValue(
      of({
        id: 'classified-1',
        communityId: 'community-1',
        appScope: 'local-hub',
        userId: 'user-1',
        profileId: 'profile-1',
      })
    );
    assetService.send.mockReturnValue(of({ id: 'asset-1' }));

    await controller.createAsset(
      {
        name: 'replacement.png',
        profileId: 'profile-1',
        type: 'image',
        content: 'data:image/png;base64,AAA',
        fileExtension: 'png',
        communityId: 'community-1',
        classifiedAdId: 'classified-1',
      } as any,
      { userId: 'user-1', profileId: 'profile-1' } as any,
      'local-hub'
    );

    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.objectContaining({
        communityId: undefined,
        classifiedAdId: undefined,
      })
    );
  });

  it('rejects a former member using another profile’s classified context', async () => {
    (controller as any).socialService.send.mockImplementation(
      (pattern: { cmd: string }) =>
        of(
          pattern.cmd === 'IS_COMMUNITY_MEMBER'
            ? false
            : { id: 'community-1', appScope: 'local-hub', isPrivate: true }
        )
    );
    (controller as any).classifiedsService.send.mockReturnValue(
      of({
        id: 'classified-1',
        communityId: 'community-1',
        appScope: 'local-hub',
        userId: 'different-user',
        profileId: 'profile-1',
      })
    );

    await expect(
      controller.createAsset(
        {
          name: 'replacement.png',
          profileId: 'profile-1',
          type: 'image',
          content: 'data:image/png;base64,AAA',
          fileExtension: 'png',
          communityId: 'community-1',
          classifiedAdId: 'classified-1',
        } as any,
        { userId: 'user-1', profileId: 'profile-1' } as any,
        'local-hub'
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(assetService.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      expect.anything()
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
      controller.createAsset(
        { name: 'bad', profileId: 'profile-1' } as any,
        { userId: 'user-1', profileId: 'profile-1' } as any,
        'local-hub'
      )
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
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? of({ id: '1', profileId: 'profile-1' })
        : of({ id: '1' })
    );
    await controller.deleteAsset('1', {
      userId: 'user-1',
      profileId: 'profile-1',
    } as any);
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

    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? of({ id: '1', audienceCommunityIds: [] })
        : of([])
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

  it('returns a typed media-unconfigured diagnostic when the media token is missing', async () => {
    const unconfigured = new AssetController(
      assetService,
      {
        get: jest.fn((key: string) =>
          key === 'ASSETS_INTERNAL_MEDIA_URL' ? 'http://assets:3006' : undefined
        ),
      } as any,
      undefined,
      undefined,
      { send: jest.fn().mockReturnValue(of([])) } as any
    );
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? of({ id: '1', audienceCommunityIds: [] })
        : of([])
    );
    const mockRes = { setHeader: jest.fn(), status: jest.fn(), end: jest.fn() };
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      unconfigured.getAssetById('1', mockRes as any)
    ).rejects.toEqual(
      expect.objectContaining({
        status: 502,
        response: expect.objectContaining({
          message: 'Internal media streaming is unavailable',
          code: 'media-unconfigured',
        }),
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('allows a legacy classified owner to read their private image after leaving', async () => {
    const classifiedsService = (controller as any).classifiedsService;
    const socialService = (controller as any).socialService;
    const profileService = (controller as any).profileService;
    classifiedsService.send.mockReturnValue(
      of([
        {
          communityId: 'community-1',
          appScope: 'local-hub',
          ownerProfileId: 'legacy-owner-profile',
        },
      ])
    );
    socialService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === 'IS_COMMUNITY_MEMBER'
        ? of(false)
        : of({ id: 'community-1', appScope: 'local-hub', isPrivate: true })
    );
    profileService.send.mockReturnValue(of({ userId: 'asset-owner-user' }));
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? of({
            id: 'legacy-asset',
            profileId: 'legacy-owner-profile',
            audienceCommunityIds: [],
          })
        : of({})
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(Buffer.from('private-image'), { status: 200 })
      );
    const mockRes = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      { setHeader: jest.fn(), status: jest.fn(), end: jest.fn() }
    ) as any;
    mockRes.status.mockReturnValue(mockRes);

    await controller.getAssetById('legacy-asset', mockRes, undefined, {
      userId: 'legacy-owner-user',
      profileId: 'legacy-owner-profile',
    } as any);

    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_COMMUNITY_AUDIENCE },
      { id: 'legacy-asset', communityId: 'community-1' }
    );
    expect(socialService.send).not.toHaveBeenCalledWith(
      { cmd: 'IS_COMMUNITY_MEMBER' },
      expect.anything()
    );
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not let a legacy foreign-owner reference privatize public media', async () => {
    (controller as any).classifiedsService.send.mockReturnValue(
      of([
        {
          communityId: 'community-1',
          appScope: 'local-hub',
          ownerProfileId: 'classified-owner-profile',
        },
      ])
    );
    (controller as any).socialService.send.mockReturnValue(
      of({ id: 'community-1', appScope: 'local-hub', isPrivate: true })
    );
    assetService.send.mockReturnValue(
      of({
        id: 'public-asset',
        profileId: 'different-asset-owner',
        audienceCommunityIds: [],
      })
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(Buffer.from('public-image'), { status: 200 })
      );
    const mockRes = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      { setHeader: jest.fn(), status: jest.fn(), end: jest.fn() }
    ) as any;
    mockRes.status.mockReturnValue(mockRes);

    await controller.getAssetById('public-asset', mockRes);

    expect(assetService.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.ADD_COMMUNITY_AUDIENCE },
      expect.anything()
    );
    expect(fetchSpy).toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(200);
    fetchSpy.mockRestore();
  });

  it.each([
    ['anonymous', undefined],
    ['revoked non-owner', { userId: 'other-user', profileId: 'other-profile' }],
  ])('does not fetch private media for %s', async (_label, user) => {
    assetService.send.mockReturnValue(
      of({
        id: 'private-asset',
        profileId: 'asset-owner',
        audienceCommunityIds: ['community-1'],
      })
    );
    (controller as any).classifiedsService.send.mockReturnValue(of([]));
    (controller as any).socialService.send.mockImplementation(
      (pattern: { cmd: string }) =>
        of(
          pattern.cmd === 'IS_COMMUNITY_MEMBER'
            ? false
            : { id: 'community-1', appScope: 'local-hub', isPrivate: true }
        )
    );
    const fetchSpy = jest.spyOn(global, 'fetch');
    const mockRes = { setHeader: jest.fn(), status: jest.fn(), end: jest.fn() };

    await expect(
      controller.getAssetById(
        'private-asset',
        mockRes as any,
        undefined,
        user as any
      )
    ).rejects.toMatchObject({ status: 404 });

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'private, no-store'
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('allows anonymous reads when a persisted community audience is public now', async () => {
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? of({
            id: 'public-again',
            profileId: 'owner-profile',
            audienceCommunityIds: ['community-1'],
          })
        : of([])
    );
    (controller as any).classifiedsService.send.mockReturnValue(of([]));
    (controller as any).socialService.send.mockReturnValue(
      of({ id: 'community-1', appScope: 'local-hub', isPrivate: false })
    );
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(Buffer.from('public-image'), { status: 200 })
      );
    const mockRes = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      { setHeader: jest.fn(), status: jest.fn(), end: jest.fn() }
    ) as any;
    mockRes.status.mockReturnValue(mockRes);

    await controller.getAssetById('public-again', mockRes);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://assets:3006/internal/media/public-again',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Internal-Media-Viewer': 'public',
        }),
      })
    );
    expect(mockRes.status).toHaveBeenCalledWith(200);
    fetchSpy.mockRestore();
  });

  it('should list assets by profile and type', async () => {
    const assets = [{ id: 'asset-1', profileId: 'profile-1', type: 'image' }];
    assetService.send.mockReturnValue(of(assets));

    const response = await controller.listAssets(
      'profile-1',
      'image' as any,
      { userId: 'user-1', profileId: 'profile-1' } as any
    );

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
