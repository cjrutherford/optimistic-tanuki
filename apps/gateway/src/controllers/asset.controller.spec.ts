import { Test, TestingModule } from '@nestjs/testing';
import { AssetController } from './asset.controller';
import { of, throwError } from 'rxjs';
import {
  ServiceTokens,
  AssetCommands,
  ClassifiedCommands,
  FollowCommands,
  PostCommands,
} from '@optimistic-tanuki/constants';
import { JwtService } from '@nestjs/jwt';
import { HttpException, Logger, ParseUUIDPipe } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Reflector } from '@nestjs/core';
import { PermissionsCacheService } from '../auth/permissions-cache.service';
import { ICacheProvider } from '../auth/cache/cache-provider.interface';
import { ConfigService } from '@nestjs/config';
import { Readable, Writable } from 'node:stream';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';

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
            send: jest.fn().mockReturnValue(
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
        {
          provide: ServiceTokens.FORUM_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({ restrictions: [] })),
          },
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

  it('validates the public asset GET UUID before making an asset RPC', async () => {
    const args = Reflect.getMetadata(
      ROUTE_ARGS_METADATA,
      AssetController,
      'getAssetById'
    );
    const parameter = Object.values(args).find(
      (value: any) => value.index === 0
    ) as { pipes: unknown[] };
    const pipe = parameter.pipes.find(
      (value): value is ParseUUIDPipe => value instanceof ParseUUIDPipe
    );

    expect(pipe).toBeInstanceOf(ParseUUIDPipe);
    await expect(
      pipe!.transform('not-a-uuid%2F..', { type: 'param', data: 'id' })
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      pipe!.transform('d5a7d0e3-a183-46bc-92e5-57cc84d9c534', {
        type: 'param',
        data: 'id',
      })
    ).resolves.toBe('d5a7d0e3-a183-46bc-92e5-57cc84d9c534');
    expect(assetService.send).not.toHaveBeenCalled();
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

  it('allows a commenter to upload an asset restricted to the followed parent author', async () => {
    const social = (controller as any).socialService;
    social.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === FollowCommands.GET_FOLLOWING
        ? of([{ followeeId: '123e4567-e89b-42d3-a456-426614174001' }])
        : of({ restrictions: [], communityIds: [] })
    );
    const upload = {
      profileId: '123e4567-e89b-42d3-a456-426614174099',
      audienceRestrictions: [
        {
          type: 'followers',
          profileId: '123e4567-e89b-42d3-a456-426614174001',
        },
      ],
    } as any;
    await expect(
      controller.createAsset(
        upload,
        {
          userId: 'user-1',
          profileId: upload.profileId,
        } as any,
        null
      )
    ).resolves.toEqual({});
    expect(assetService.send).toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      upload
    );
  });

  it('rejects a commenter upload restricted to an author they do not follow', async () => {
    const social = (controller as any).socialService;
    social.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === FollowCommands.GET_FOLLOWING
        ? of([])
        : of({ restrictions: [], communityIds: [] })
    );
    const upload = {
      profileId: '123e4567-e89b-42d3-a456-426614174099',
      audienceRestrictions: [
        {
          type: 'followers',
          profileId: '123e4567-e89b-42d3-a456-426614174001',
        },
      ],
    } as any;
    await expect(
      controller.createAsset(
        upload,
        {
          userId: 'user-1',
          profileId: upload.profileId,
        } as any,
        null
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(assetService.send).not.toHaveBeenCalledWith(
      { cmd: AssetCommands.CREATE },
      upload
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

  it('maps the typed missing-asset RPC to a not-found response before media access', async () => {
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? throwError(() => ({ statusCode: 404, message: 'Asset not found' }))
        : of([])
    );
    const response = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      {
        setHeader: jest.fn(),
        status: jest.fn(),
        end: jest.fn(),
        json: jest.fn(),
      }
    ) as any;
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(
      controller.getAssetById('missing-asset', response)
    ).rejects.toMatchObject({
      status: 404,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('keeps asset-provider retrieval failures as gateway errors', async () => {
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? throwError(() => ({
            statusCode: 503,
            message: 'Asset provider unavailable',
          }))
        : of([])
    );
    const response = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      {
        setHeader: jest.fn(),
        status: jest.fn(),
        end: jest.fn(),
        json: jest.fn(),
      }
    ) as any;

    await expect(
      controller.getAssetById('asset-1', response)
    ).rejects.toMatchObject({
      status: 502,
    });
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
        ? of({ id: '1', profileId: 'profile-1', audienceCommunityIds: [] })
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

  it('proxies an isolated HTTP range response through the gateway controller', async () => {
    let observedHeaders: Record<string, string | string[] | undefined> = {};
    const upstream = createServer((request, response) => {
      observedHeaders = request.headers;
      response.writeHead(206, {
        'content-type': 'video/mp4',
        'content-length': '6',
        'content-range': 'bytes 2-7/20',
        'accept-ranges': 'bytes',
      });
      response.end('abcdef');
    });
    let gateway: Server | undefined;

    try {
      await new Promise<void>((resolve) =>
        upstream.listen(0, '127.0.0.1', resolve)
      );
      const upstreamUrl = `http://127.0.0.1:${
        (upstream.address() as AddressInfo).port
      }`;
      (controller as any).configService.get.mockImplementation((key: string) =>
        key === 'ASSETS_INTERNAL_MEDIA_URL'
          ? upstreamUrl
          : key === 'ASSETS_INTERNAL_MEDIA_TOKEN'
          ? 'gateway-secret'
          : undefined
      );
      assetService.send.mockImplementation((pattern: { cmd: string }) =>
        pattern.cmd === AssetCommands.RETRIEVE
          ? of({
              id: 'http-range-asset',
              profileId: 'owner-profile',
              audienceCommunityIds: [],
            })
          : of([])
      );

      gateway = createServer((request, response) => {
        (response as any).status = (statusCode: number) => {
          response.statusCode = statusCode;
          return response;
        };
        const id = request.url?.split('/').pop() || '';
        controller
          .getAssetById(
            id,
            response as any,
            request.headers.range,
            undefined,
            undefined,
            request as any
          )
          .catch((error) => {
            if (!response.headersSent) {
              response.statusCode =
                typeof error?.getStatus === 'function'
                  ? error.getStatus()
                  : 500;
              response.end();
            }
          });
      });
      await new Promise<void>((resolve) =>
        gateway!.listen(0, '127.0.0.1', resolve)
      );
      const gatewayUrl = `http://127.0.0.1:${
        (gateway.address() as AddressInfo).port
      }`;
      const response = await fetch(`${gatewayUrl}/asset/http-range-asset`, {
        headers: { range: 'bytes=2-7' },
      });

      expect(response.status).toBe(206);
      expect(response.headers.get('content-length')).toBe('6');
      expect(response.headers.get('content-range')).toBe('bytes 2-7/20');
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        Buffer.from('abcdef')
      );
      expect(observedHeaders['x-internal-media-token']).toBe('gateway-secret');
      expect(observedHeaders.range).toBe('bytes=2-7');
    } finally {
      for (const server of [gateway, upstream]) {
        if (server?.listening) {
          await new Promise<void>((resolve, reject) =>
            server.close((error) => (error ? reject(error) : resolve()))
          );
        }
      }
    }
  });

  it('returns a typed media-unconfigured diagnostic when the media token is missing', async () => {
    const unconfigured = new AssetController(
      assetService,
      {
        get: jest.fn((key: string) =>
          key === 'ASSETS_INTERNAL_MEDIA_URL' ? 'http://assets:3006' : undefined
        ),
      } as any,
      {
        send: jest
          .fn()
          .mockReturnValue(of({ restrictions: [], communityIds: [] })),
      } as any,
      undefined,
      { send: jest.fn().mockReturnValue(of([])) } as any,
      { send: jest.fn().mockReturnValue(of({ restrictions: [] })) } as any
    );
    assetService.send.mockImplementation((pattern: { cmd: string }) =>
      pattern.cmd === AssetCommands.RETRIEVE
        ? of({ id: '1', profileId: 'profile-1', audienceCommunityIds: [] })
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
      { setHeader: jest.fn(), status: jest.fn() }
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
      { setHeader: jest.fn(), status: jest.fn() }
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

  it.each([
    [
      'current follower',
      true,
      '123e4567-e89b-42d3-a456-426614174001',
      '123e4567-e89b-42d3-a456-426614174001',
    ],
    [
      'former follower',
      false,
      '123e4567-e89b-42d3-a456-426614174001',
      '123e4567-e89b-42d3-a456-426614174001',
    ],
    [
      'commenter following the parent author',
      true,
      '123e4567-e89b-42d3-a456-426614174099',
      '123e4567-e89b-42d3-a456-426614174001',
    ],
    [
      'commenter after parent author unfollow',
      false,
      '123e4567-e89b-42d3-a456-426614174099',
      '123e4567-e89b-42d3-a456-426614174001',
    ],
    [
      'asset owner after parent author unfollow',
      false,
      'viewer-profile',
      '123e4567-e89b-42d3-a456-426614174001',
    ],
    [
      'parent author alternate profile',
      false,
      '123e4567-e89b-42d3-a456-426614174099',
      '123e4567-e89b-42d3-a456-426614174001',
      'alternate-profile',
      'audience-owner-user',
      true,
    ],
  ])(
    'checks the live follow graph for a %s typed asset',
    async (
      _label,
      follows,
      assetProfileId,
      audienceProfileId,
      viewerProfileId = 'viewer-profile',
      viewerUserId = 'viewer-user',
      alternateOwner = false
    ) => {
      const social = (controller as any).socialService;
      social.send.mockImplementation((pattern: { cmd: string }) =>
        pattern.cmd === PostCommands.FIND_ASSET_AUDIENCES
          ? of({ restrictions: [], communityIds: [] })
          : pattern.cmd === FollowCommands.GET_FOLLOWING
          ? of(follows ? [{ followeeId: audienceProfileId }] : [])
          : of({
              id: 'community-1',
              appScope: 'client-interface',
              isPrivate: false,
            })
      );
      (controller as any).classifiedsService.send.mockReturnValue(of([]));
      (controller as any).profileService.send.mockImplementation(
        (_pattern: unknown, payload: { id: string }) =>
          of({
            userId:
              alternateOwner && payload.id === audienceProfileId
                ? 'audience-owner-user'
                : 'asset-owner-user',
          })
      );
      assetService.send.mockImplementation((pattern: { cmd: string }) =>
        pattern.cmd === AssetCommands.RETRIEVE
          ? of({
              id: 'followers-asset',
              profileId: assetProfileId,
              audienceCommunityIds: [],
              audienceRestrictions: [
                {
                  type: 'followers',
                  profileId: audienceProfileId,
                },
              ],
            })
          : of({})
      );
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(new Response(Buffer.from('current follower image')));
      const res = Object.assign(
        new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          },
        }),
        { setHeader: jest.fn(), status: jest.fn() }
      ) as any;
      res.status.mockReturnValue(res);

      const read = controller.getAssetById('followers-asset', res, undefined, {
        userId: viewerUserId,
        profileId: viewerProfileId,
      } as any);
      if (follows || alternateOwner) {
        await expect(read).resolves.toBeUndefined();
        expect(fetchSpy).toHaveBeenCalled();
      } else {
        await expect(read).rejects.toMatchObject({ status: 404 });
        expect(fetchSpy).not.toHaveBeenCalled();
      }
      if (alternateOwner) {
        expect(social.send).not.toHaveBeenCalledWith(
          { cmd: FollowCommands.GET_FOLLOWING },
          expect.anything()
        );
      } else {
        expect(social.send).toHaveBeenCalledWith(
          { cmd: FollowCommands.GET_FOLLOWING },
          { followerId: viewerProfileId }
        );
      }
      fetchSpy.mockRestore();
    }
  );

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
      { setHeader: jest.fn(), status: jest.fn() }
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
