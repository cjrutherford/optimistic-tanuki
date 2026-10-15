import { ConfigService } from '@nestjs/config';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Readable } from 'node:stream';
import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';

import { AppService } from './app.service';
import { InternalMediaService } from './internal-media.service';

describe('InternalMediaService', () => {
  const asset = {
    id: 'asset-1',
    name: 'episode.mp4',
    storagePath: 'assets/asset-1/episode.mp4',
    storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
    type: AssetType.VIDEO,
  } as any;
  let appService: Pick<AppService, 'retrieveAsset' | 'openAuthenticatedMedia' | 'authorizeGuardianRead'>;
  let configService: Pick<ConfigService, 'get'>;
  let service: InternalMediaService;
  let plaintext: Buffer;
  let spool: {
    path: string;
    size: number;
    createReadStream: jest.Mock;
    cleanup: jest.Mock;
  };

  beforeEach(() => {
    plaintext = Buffer.from('0123456789');
    spool = {
      path: '/private/media.plain',
      size: plaintext.length,
      createReadStream: jest.fn((start?: number, end?: number) =>
        Readable.from([
          plaintext.subarray(start ?? 0, (end ?? plaintext.length - 1) + 1),
        ])
      ),
      cleanup: jest.fn().mockResolvedValue(undefined),
    };
    appService = {
      retrieveAsset: jest.fn().mockResolvedValue(asset),
      openAuthenticatedMedia: jest.fn().mockResolvedValue(spool),
      authorizeGuardianRead: jest.fn().mockResolvedValue(undefined),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'mediaMaxReadBytes') return 1024;
        return undefined;
      }),
    };
    service = new InternalMediaService(
      appService as AppService,
      configService as ConfigService
    );
  });

  it('opens a requested byte range over authenticated plaintext', async () => {
    const result = await service.open('asset-1', 'bytes=2-5');

    expect(appService.retrieveAsset).toHaveBeenCalledWith({ id: 'asset-1' });
    expect(appService.openAuthenticatedMedia).toHaveBeenCalledWith(asset, {
      maxPlaintextBytes: 1024,
      signal: undefined,
    });
    expect(result).toMatchObject({
      statusCode: 206,
      contentType: 'video/mp4',
      contentLength: 4,
      contentRange: 'bytes 2-5/10',
    });
  });

  it('returns plaintext bytes and plaintext length for a full response', async () => {
    const result = await service.open('asset-1');
    expect(result).toMatchObject({ statusCode: 200, contentLength: 10 });
    expect(result).not.toHaveProperty('contentRange');
    if ('stream' in result) {
      const chunks: Buffer[] = [];
      for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks).toString()).toBe('0123456789');
      expect(Buffer.concat(chunks).toString()).not.toContain('OTENV1:');
      await result.cleanup();
    }
  });

  it('requires a gateway authorization assertion before reading a community asset', async () => {
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({
      ...asset,
      audienceCommunityIds: ['community-1'],
    });

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(appService.openAuthenticatedMedia).not.toHaveBeenCalled();
    await expect(
      service.open('asset-1', undefined, true)
    ).resolves.toMatchObject({
      statusCode: 200,
    });
  });

  it('rechecks a signed guardian relationship for every full or ranged read', async () => {
    const guardian = {
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile',
      appId: 'client-interface', operation: 'content.view' as const,
    };
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({
      ...asset,
      profileId: 'dependent-profile',
      audienceRestrictions: [{ type: 'owner', profileId: 'dependent-profile' }],
    });
    await expect(service.open('asset-1', 'bytes=0-3', true, undefined, guardian)).resolves.toMatchObject({ statusCode: 206 });
    expect(appService.authorizeGuardianRead).toHaveBeenCalledWith({ ...guardian, id: 'asset-1' });
  });

  it.each([
    {
      audienceCommunityIds: ['community-1'],
      audienceRestrictions: [{ type: 'owner', profileId: 'dependent-profile' }],
    },
    {
      audienceCommunityIds: [],
      audienceRestrictions: [
        { type: 'owner', profileId: 'dependent-profile' },
        { type: 'followers', profileId: 'dependent-profile' },
      ],
    },
    {
      audienceCommunityIds: [],
      audienceRestrictions: [
        { type: 'owner', profileId: 'dependent-profile' },
        { type: 'owner', profileId: 'different-profile' },
      ],
    },
  ])('denies guardian reads when additional audience restrictions exist: %j', async (audience) => {
    const guardian = {
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile',
      appId: 'client-interface', operation: 'content.view' as const,
    };
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({
      ...asset,
      profileId: 'dependent-profile',
      ...audience,
    });

    await expect(service.open('asset-1', undefined, true, undefined, guardian)).rejects.toBeInstanceOf(NotFoundException);
    expect(appService.authorizeGuardianRead).not.toHaveBeenCalled();
    expect(appService.openAuthenticatedMedia).not.toHaveBeenCalled();
  });

  it('denies a revoked guardian before opening storage', async () => {
    const guardian = {
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile',
      appId: 'client-interface', operation: 'content.view' as const,
    };
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({ ...asset, profileId: 'dependent-profile' });
    (appService.authorizeGuardianRead as jest.Mock).mockRejectedValue({
      code: 'GUARDIAN_CONTENT_ACCESS_DENIED', statusCode: 403,
    });
    await expect(service.open('asset-1', undefined, true, undefined, guardian)).rejects.toBeInstanceOf(NotFoundException);
    expect(appService.openAuthenticatedMedia).not.toHaveBeenCalled();
  });

  it('requires a gateway authorization assertion before reading typed audience media', async () => {
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({
      ...asset,
      audienceRestrictions: [{ type: 'followers', profileId: 'owner-profile' }],
    });

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
    expect(appService.openAuthenticatedMedia).not.toHaveBeenCalled();
    await expect(
      service.open('asset-1', undefined, true)
    ).resolves.toMatchObject({ statusCode: 200 });
  });

  it.each([
    ['png', 'image/png'],
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['gif', 'image/gif'],
    ['webp', 'image/webp'],
  ])(
    'returns the safe raster media type for .%s uploads',
    async (extension, contentType) => {
      (appService.retrieveAsset as jest.Mock).mockResolvedValue({
        ...asset,
        name: `listing.${extension}`,
      });

      await expect(service.open('asset-1')).resolves.toMatchObject({
        statusCode: 200,
        contentType,
      });
    }
  );

  it('returns an unsatisfied range response and cleans up the verified spool', async () => {
    await expect(service.open('asset-1', 'bytes=100-')).resolves.toEqual({
      statusCode: 416,
      contentRange: 'bytes */10',
    });
    expect(spool.cleanup).toHaveBeenCalled();
  });

  it('passes request cancellation through to the storage adapter', async () => {
    const controller = new AbortController();
    await service.open('asset-1', undefined, false, controller.signal);
    expect(appService.openAuthenticatedMedia).toHaveBeenCalledWith(asset, {
      maxPlaintextBytes: 1024,
      signal: controller.signal,
    });
  });

  it('preserves authenticated storage failures instead of serving bytes or hiding them as missing', async () => {
    const failure = new ServiceUnavailableException(
      'Vault storage envelope failed AES-256-GCM authentication.'
    );
    (appService.openAuthenticatedMedia as jest.Mock).mockRejectedValue(failure);
    await expect(service.open('asset-1')).rejects.toBe(failure);
  });

  it('maps a missing asset record to an HTTP-safe not found response', async () => {
    (appService.retrieveAsset as jest.Mock).mockRejectedValue(
      new RpcException({ statusCode: 404, message: 'Asset not found' })
    );

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('preserves asset lookup infrastructure failures instead of hiding them as missing', async () => {
    const failure = new Error('database connection reset');
    (appService.retrieveAsset as jest.Mock).mockRejectedValue(failure);

    await expect(service.open('asset-1')).rejects.toBe(failure);
  });
});
