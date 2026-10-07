import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { stat } from 'node:fs/promises';
import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';

import { AppService } from './app.service';
import { InternalMediaService } from './internal-media.service';

jest.mock('node:fs/promises', () => ({
  stat: jest.fn(),
}));

describe('InternalMediaService', () => {
  const asset = {
    id: 'asset-1',
    name: 'episode.mp4',
    storagePath: 'assets/asset-1/episode.mp4',
    storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
    type: AssetType.VIDEO,
  } as any;
  let appService: Pick<AppService, 'retrieveAsset' | 'readAssetContent'>;
  let configService: Pick<ConfigService, 'get'>;
  let service: InternalMediaService;

  beforeEach(() => {
    appService = {
      retrieveAsset: jest.fn().mockResolvedValue(asset),
      readAssetContent: jest.fn().mockResolvedValue(Buffer.from('0123456789')),
    };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'storagePath') return '/srv/assets';
        return undefined;
      }),
    };
    service = new InternalMediaService(
      appService as AppService,
      configService as ConfigService
    );
    (stat as jest.Mock).mockResolvedValue({ size: 100, isFile: () => true });
  });

  it('opens a requested byte range over authenticated plaintext', async () => {
    const result = await service.open('asset-1', 'bytes=2-5');

    expect(appService.retrieveAsset).toHaveBeenCalledWith({ id: 'asset-1' });
    expect(appService.readAssetContent).toHaveBeenCalledWith(
      { id: 'asset-1' },
      25 * 1024 * 1024 + 64 * 1024
    );
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
    expect(appService.readAssetContent).not.toHaveBeenCalled();
    await expect(
      service.open('asset-1', undefined, true)
    ).resolves.toMatchObject({
      statusCode: 200,
    });
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

  it('returns an unsatisfied range response for bytes beyond the file', async () => {
    await expect(service.open('asset-1', 'bytes=100-')).resolves.toEqual({
      statusCode: 416,
      contentRange: 'bytes */10',
    });
  });

  it('rejects an oversized stored object before reading or allocating it', async () => {
    (stat as jest.Mock).mockResolvedValue({
      size: 25 * 1024 * 1024 + 64 * 1024 + 1,
      isFile: () => true,
    });
    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      PayloadTooLargeException
    );
    expect(appService.readAssetContent).not.toHaveBeenCalled();
  });

  it('preserves authenticated storage failures instead of serving bytes or hiding them as missing', async () => {
    const failure = new ServiceUnavailableException(
      'Vault storage envelope failed AES-256-GCM authentication.'
    );
    (appService.readAssetContent as jest.Mock).mockRejectedValue(failure);
    await expect(service.open('asset-1')).rejects.toBe(failure);
  });

  it('does not resolve storage paths outside local asset storage', async () => {
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({
      ...asset,
      storagePath: '../secrets.txt',
    });

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('maps a missing asset record to an HTTP-safe not found response', async () => {
    (appService.retrieveAsset as jest.Mock).mockRejectedValue(
      new Error('Asset with id asset-1 not found')
    );

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
